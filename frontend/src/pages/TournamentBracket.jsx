import { useState, useEffect } from 'react'
import { getKnockoutFixtures, predictKnockout } from '../utils/api'
import { buildBracketState, isRealTeam, BRACKET_STRUCTURE, buildFixtureLookup, resolveSlotTeam, getStructuralFeeders } from '../utils/bracket'
import { isMatchLive, isMatchCompleted } from '../utils/matchStatus'

// Tournament Bracket page: renders the full 32-match knockout bracket (Round
// of 32 through Final + 3rd place) using the fixed fixture-ID topology from
// bracket.js. Two independent tabs: Live (real results, with an optional
// "Simulate remaining" overlay) and Simulate (a from-scratch playground that
// ignores real results entirely). Every eligible match is individually
// click-to-simulate in either tab, in addition to the bulk actions.
// Default export: TournamentBracket.

const BRACKET_HEADERS = [
  'Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals',
  'Final',
  'Semifinals', 'Quarterfinals', 'Round of 16', 'Round of 32',
]

const TBD_PROPS = { teamAName: 'TBD', teamBName: 'TBD', winnerCode: null, teamACode: null, teamBCode: null, clickable: false, pending: false, onClick: undefined }

function simMatchToProps({ teamA, teamB, winner }) {
  return {
    teamAName: teamA && isRealTeam(teamA.espnId, teamA.logo) ? teamA.name : 'TBD',
    teamBName: teamB && isRealTeam(teamB.espnId, teamB.logo) ? teamB.name : 'TBD',
    teamACode: teamA?.code ?? null,
    teamBCode: teamB?.code ?? null,
    winnerCode: winner?.code ?? null,
  }
}

function probFor(match, team) {
  if (!match?.probs || !team) return null
  return match.teamA?.code === team.code ? match.probs.home : match.probs.away
}

function matchModifierClass(clickable, pending) {
  return `${clickable ? ' bracket-match--clickable' : ''}${pending ? ' bracket-match--pending' : ''}`
}

function BracketMatch({ teamAName, teamBName, winnerCode, teamACode, teamBCode, clickable, pending, onClick }) {
  const aWon = winnerCode && winnerCode === teamACode
  const bWon = winnerCode && winnerCode === teamBCode
  return (
    <div className={`bracket-match${matchModifierClass(clickable, pending)}`} onClick={clickable ? onClick : undefined}>
      <div className={`bracket-team${aWon ? ' winner' : bWon ? ' loser' : ''}`}>
        {teamAName ?? 'TBD'}
      </div>
      <div className={`bracket-team${bWon ? ' winner' : aWon ? ' loser' : ''}`}>
        {teamBName ?? 'TBD'}
      </div>
    </div>
  )
}

function FinalMatch({ teamAName, teamBName, winnerCode, teamACode, teamBCode, clickable, pending, onClick }) {
  const aWon = winnerCode && winnerCode === teamACode
  const bWon = winnerCode && winnerCode === teamBCode
  return (
    <div className={`bracket-final-match${matchModifierClass(clickable, pending)}`} onClick={clickable ? onClick : undefined}>
      <div className={`bracket-team${aWon ? ' winner' : bWon ? ' loser' : ''}`}>
        {teamAName ?? 'TBD'}
      </div>
      <div className={`bracket-team${bWon ? ' winner' : aWon ? ' loser' : ''}`}>
        {teamBName ?? 'TBD'}
      </div>
    </div>
  )
}

function BracketCol({ matches, side }) {
  return (
    <div className={`bracket-col ${side}`}>
      {matches.map((props, i) => (
        <BracketMatch key={i} {...(props ?? TBD_PROPS)} />
      ))}
    </div>
  )
}

function CenterCol({ finalProps, thirdProps }) {
  return (
    <div className="bracket-col center">
      <div className="bracket-center-item">
        <span className="bracket-zone-label">Final</span>
        <FinalMatch {...(finalProps ?? TBD_PROPS)} />
      </div>
      <div className="bracket-center-item">
        <span className="bracket-zone-label">3rd Place</span>
        <BracketMatch {...(thirdProps ?? TBD_PROPS)} />
      </div>
    </div>
  )
}

export default function TournamentBracket() {
  const [knockoutFixtures, setKnockoutFixtures] = useState(null)
  const [activeTab, setActiveTab]                = useState('live')   // 'live' | 'simulate'
  const [liveSim, setLiveSim]                     = useState({})
  const [simSim, setSimSim]                       = useState({})
  const [liveLoading, setLiveLoading]             = useState(false)
  const [simLoading, setSimLoading]               = useState(false)
  const [pendingMatchIds, setPendingMatchIds]     = useState(() => new Set())
  const [error, setError]                         = useState(null)

  const realBracket   = knockoutFixtures ? buildBracketState(knockoutFixtures) : null
  const fixtureLookup = knockoutFixtures ? buildFixtureLookup(knockoutFixtures) : {}

  const activeSim     = activeTab === 'live' ? liveSim : simSim
  const activeLoading = activeTab === 'live' ? liveLoading : simLoading

  useEffect(() => {
    let timeoutId
    let cancelled = false
    let previousFixtures = null

    async function fetchAndSchedule() {
      try {
        const fixtures = await getKnockoutFixtures()
        if (cancelled) return

        // If any knockout fixture newly transitioned to completed this tick,
        // the Live tab's predictions may now be stale (they may have assumed
        // a different outcome for that match) — clear them wholesale rather
        // than attempt partial invalidation. The Simulate tab is a
        // from-scratch playground and is unaffected by real results.
        if (previousFixtures) {
          const newlyCompleted = fixtures.some(f => {
            const prev = previousFixtures.find(p => p.fixture_id === f.fixture_id)
            return isMatchCompleted(f.status) && prev && !isMatchCompleted(prev.status)
          })
          if (newlyCompleted) {
            setLiveSim(current => Object.keys(current).length > 0 ? {} : current)
          }
        }
        previousFixtures = fixtures

        setKnockoutFixtures(fixtures)
        const hasLive = fixtures.some(f => isMatchLive(f.status))
        timeoutId = setTimeout(fetchAndSchedule, hasLive ? 30000 : 300000)
      } catch {
        if (!cancelled) setError('Failed to load fixtures.')
      }
    }

    fetchAndSchedule()
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [])

  /**
   * Resolves the two competing teams (and the winner, if determined) for a
   * single bracket fixture under the active tab. Precedence: a completed
   * real result (Live tab only) locks the match; otherwise a direct sim
   * entry for this fixture (also locks it — Reset is the only way to redo a
   * prediction); otherwise — for the 3rd-place match specifically — its own
   * placeholder text via resolveSlotTeam, falling back to deriving from the
   * two semifinals' own resolution if that doesn't resolve both sides;
   * otherwise generic placeholder resolution via resolveSlotTeam.
   */
  function resolveOutcome(fixtureId) {
    const fixture = fixtureLookup[fixtureId]
    if (!fixture) return { teamA: null, teamB: null, winner: null, locked: false }

    const locked = activeTab === 'live' && isMatchCompleted(fixture.status)
    if (locked) {
      const teamA = { name: fixture.home_team, code: fixture.home_code, logo: fixture.home_logo }
      const teamB = { name: fixture.away_team, code: fixture.away_code, logo: fixture.away_logo }
      const homeWon = parseFloat(fixture.home_score) > parseFloat(fixture.away_score)
      return { teamA, teamB, winner: homeWon ? teamA : teamB, locked: true }
    }

    const simEntry = activeSim[fixtureId]
    if (simEntry) {
      // Locked once simulated too, not just once really completed — Reset
      // is the only way to redo a prediction.
      return { teamA: simEntry.teamA, teamB: simEntry.teamB, winner: simEntry.winner, locked: true }
    }

    if (fixture.round === '3rd-place-match') {
      // Try the shared helper against this fixture's own raw team fields
      // first (its placeholder pattern is "Semifinal N Loser", which
      // parsePlaceholderRef does recognize). Only trust it if BOTH sides
      // resolve — a partial result isn't useful here.
      const viaHelper = {
        teamA: resolveSlotTeam(fixture.home_team, fixture.home_code, fixture.home_logo, activeSim, fixtureLookup, activeTab),
        teamB: resolveSlotTeam(fixture.away_team, fixture.away_code, fixture.away_logo, activeSim, fixtureLookup, activeTab),
      }
      if (viaHelper.teamA && viaHelper.teamB) {
        return { ...viaHelper, winner: null, locked: false }
      }

      // Fallback: ESPN's raw placeholder text for this fixture doesn't
      // reliably match that pattern before it's backfilled, so derive
      // directly from the two semifinal slots' own resolution instead —
      // handles both a really-completed semifinal and a click-simulated
      // one, recursing one level (safe: semifinals are never themselves the
      // 3rd-place fixture, so this can't recurse further).
      const sfLeftId  = BRACKET_STRUCTURE.left.semifinals[0]
      const sfRightId = BRACKET_STRUCTURE.right.semifinals[0]
      const left = resolveOutcome(sfLeftId)
      const right = resolveOutcome(sfRightId)
      const loserOf = ({ teamA, teamB, winner }) => winner ? (winner.code === teamA?.code ? teamB : teamA) : null
      return { teamA: loserOf(left), teamB: loserOf(right), winner: null, locked: false }
    }

    const isSeeded = fixture.round === 'round-of-32'
    const feeders = getStructuralFeeders(fixture.round, fixtureId)
    const teamA = resolveSlotTeam(fixture.home_team, fixture.home_code, fixture.home_logo, activeSim, fixtureLookup, activeTab, isSeeded, feeders?.home)
    const teamB = resolveSlotTeam(fixture.away_team, fixture.away_code, fixture.away_logo, activeSim, fixtureLookup, activeTab, isSeeded, feeders?.away)
    return { teamA, teamB, winner: null, locked: false }
  }

  /**
   * Runs a full bracket simulation and returns simResults keyed by fixture
   * ID. Two modes: 'live' keeps every already-played real result as-is and
   * only predicts fixtures that haven't happened yet; 'simulate' predicts
   * every single match, including ones with a real result already, so the
   * whole bracket plays out hypothetically. Rounds must be walked in strict
   * order (R32 → R16 → QF → SF → Final) because each round's matchups depend
   * on the previous round's winners — a QF slot can't be resolved until its
   * feeding R16 fixture has a winner in simResults.
   */
  async function runSimulation(mode) {
    if (!realBracket) return null
    const simResults = {}

    const roundOrder = ['round-of-32', 'round-of-16', 'quarterfinals', 'semifinals']
    for (const roundKey of roundOrder) {
      const ids = [
        ...BRACKET_STRUCTURE.left[roundKey],
        ...BRACKET_STRUCTURE.right[roundKey],
      ]
      for (const fixtureId of ids) {
        const fixture = fixtureLookup[fixtureId]
        if (!fixture) continue

        const useReal = mode === 'live' && isMatchCompleted(fixture.status)
        const isSeeded = roundKey === 'round-of-32'
        const feeders = getStructuralFeeders(roundKey, fixtureId)
        let teamA, teamB
        if (useReal) {
          teamA = { name: fixture.home_team, code: fixture.home_code, logo: fixture.home_logo }
          teamB = { name: fixture.away_team, code: fixture.away_code, logo: fixture.away_logo }
        } else {
          teamA = resolveSlotTeam(fixture.home_team, fixture.home_code, fixture.home_logo, simResults, fixtureLookup, mode, isSeeded, feeders?.home)
          teamB = resolveSlotTeam(fixture.away_team, fixture.away_code, fixture.away_logo, simResults, fixtureLookup, mode, isSeeded, feeders?.away)
        }

        let winner, loserTeam, source, probs = null
        if (useReal) {
          const homeWon = parseFloat(fixture.home_score) > parseFloat(fixture.away_score)
          winner = homeWon ? teamA : teamB
          loserTeam = homeWon ? teamB : teamA
          source = 'real'
        } else if (teamA && teamB && isRealTeam(null, teamA.logo) && isRealTeam(null, teamB.logo)) {
          probs = await predictKnockout(teamA.name, teamB.name)
          winner = probs.home >= probs.away ? teamA : teamB
          loserTeam = probs.home >= probs.away ? teamB : teamA
          source = 'sim'
        } else {
          winner = null
          loserTeam = null
          source = 'tbd'
        }

        simResults[fixtureId] = { teamA, teamB, winner, loser: loserTeam, source, probs }
      }
    }

    // final
    const finalFixture = realBracket['final']?.[0] ?? null
    if (finalFixture) {
      const useReal = mode === 'live' && isMatchCompleted(finalFixture.status)
      const finalFeeders = getStructuralFeeders('final', String(finalFixture.fixture_id))
      let teamA, teamB
      if (useReal) {
        teamA = { name: finalFixture.home_team, code: finalFixture.home_code, logo: finalFixture.home_logo }
        teamB = { name: finalFixture.away_team, code: finalFixture.away_code, logo: finalFixture.away_logo }
      } else {
        teamA = resolveSlotTeam(finalFixture.home_team, finalFixture.home_code, finalFixture.home_logo, simResults, fixtureLookup, mode, false, finalFeeders?.home)
        teamB = resolveSlotTeam(finalFixture.away_team, finalFixture.away_code, finalFixture.away_logo, simResults, fixtureLookup, mode, false, finalFeeders?.away)
      }
      let winner, loserTeam, source, probs = null
      if (useReal) {
        const homeWon = parseFloat(finalFixture.home_score) > parseFloat(finalFixture.away_score)
        winner = homeWon ? teamA : teamB
        loserTeam = homeWon ? teamB : teamA
        source = 'real'
      } else if (teamA && teamB && isRealTeam(null, teamA.logo) && isRealTeam(null, teamB.logo)) {
        probs = await predictKnockout(teamA.name, teamB.name)
        winner = probs.home >= probs.away ? teamA : teamB
        loserTeam = probs.home >= probs.away ? teamB : teamA
        source = 'sim'
      } else {
        winner = null
        loserTeam = null
        source = 'tbd'
      }
      simResults[String(finalFixture.fixture_id)] = { teamA, teamB, winner, loser: loserTeam, source, probs }
    }

    // 3rd place isn't its own bracket branch — it's always contested by
    // whichever two teams lost the semifinals, so it's derived here from
    // simResults' semifinal losers rather than resolved via placeholder text.
    const sfLeftId  = BRACKET_STRUCTURE.left.semifinals[0]
    const sfRightId = BRACKET_STRUCTURE.right.semifinals[0]
    const loser1 = simResults[sfLeftId]?.loser ?? null
    const loser2 = simResults[sfRightId]?.loser ?? null
    const thirdFixture = realBracket['3rd-place-match']?.[0] ?? null

    let thirdMatch
    const thirdUseReal = thirdFixture && mode === 'live' && isMatchCompleted(thirdFixture.status)
    if (thirdUseReal) {
      const homeWon = parseFloat(thirdFixture.home_score) > parseFloat(thirdFixture.away_score)
      const t3A = { name: thirdFixture.home_team, code: thirdFixture.home_code, logo: thirdFixture.home_logo }
      const t3B = { name: thirdFixture.away_team, code: thirdFixture.away_code, logo: thirdFixture.away_logo }
      thirdMatch = { teamA: t3A, teamB: t3B, winner: homeWon ? t3A : t3B, loser: homeWon ? t3B : t3A, source: 'real', probs: null }
    } else if (loser1 && loser2 && isRealTeam(null, loser1.logo) && isRealTeam(null, loser2.logo)) {
      const p = await predictKnockout(loser1.name, loser2.name)
      const winner = p.home >= p.away ? loser1 : loser2
      const loserTeam = p.home >= p.away ? loser2 : loser1
      thirdMatch = { teamA: loser1, teamB: loser2, winner, loser: loserTeam, source: 'sim', probs: p }
    } else {
      thirdMatch = { teamA: loser1, teamB: loser2, winner: null, loser: null, source: 'tbd', probs: null }
    }

    if (thirdFixture) {
      simResults[String(thirdFixture.fixture_id)] = thirdMatch
    }

    return simResults
  }

  async function handleSimulateLive() {
    setLiveLoading(true)
    setError(null)
    try {
      const result = await runSimulation('live')
      setLiveSim(result ?? {})
    } catch {
      setError('Simulation failed. Make sure the backend is running.')
    } finally {
      setLiveLoading(false)
    }
  }

  async function handleSimulateScratch() {
    setSimLoading(true)
    setError(null)
    try {
      const result = await runSimulation('simulate')
      setSimSim(result ?? {})
    } catch {
      setError('Simulation failed. Make sure the backend is running.')
    } finally {
      setSimLoading(false)
    }
  }

  async function handleMatchClick(fixtureId, teamA, teamB) {
    const tab = activeTab
    const pendingKey = `${tab}:${fixtureId}`
    setPendingMatchIds(current => new Set(current).add(pendingKey))
    setError(null)
    try {
      const probs = await predictKnockout(teamA.name, teamB.name)
      const winner = probs.home >= probs.away ? teamA : teamB
      const loserTeam = probs.home >= probs.away ? teamB : teamA
      const entry = { teamA, teamB, winner, loser: loserTeam, source: 'sim', probs }
      const setter = tab === 'live' ? setLiveSim : setSimSim
      setter(current => ({ ...current, [fixtureId]: entry }))
    } catch {
      setError('Prediction failed. Make sure the backend is running.')
    } finally {
      setPendingMatchIds(current => {
        const next = new Set(current)
        next.delete(pendingKey)
        return next
      })
    }
  }

  function buildMatchProps(fixtureId) {
    const fixture = fixtureLookup[fixtureId]
    if (!fixture) return TBD_PROPS

    const { teamA, teamB, winner, locked } = resolveOutcome(fixtureId)
    const bothReal = teamA && teamB && isRealTeam(null, teamA.logo) && isRealTeam(null, teamB.logo)
    const pending = pendingMatchIds.has(`${activeTab}:${fixtureId}`)
    const clickable = bothReal && !locked && !activeLoading && !pending

    return {
      ...simMatchToProps({ teamA, teamB, winner }),
      clickable,
      pending,
      onClick: clickable ? () => handleMatchClick(fixtureId, teamA, teamB) : undefined,
    }
  }

  function getCol(side, roundKey) {
    return BRACKET_STRUCTURE[side][roundKey].map(buildMatchProps)
  }

  const cols = {
    r32Left:  getCol('left',  'round-of-32'),
    r16Left:  getCol('left',  'round-of-16'),
    qfLeft:   getCol('left',  'quarterfinals'),
    sfLeft:   getCol('left',  'semifinals'),
    sfRight:  getCol('right', 'semifinals'),
    qfRight:  getCol('right', 'quarterfinals'),
    r16Right: getCol('right', 'round-of-16'),
    r32Right: getCol('right', 'round-of-32'),
  }

  function getCenterProps(roundKey) {
    const fixture = realBracket?.[roundKey]?.[0]
    return fixture ? buildMatchProps(String(fixture.fixture_id)) : null
  }

  // Champion panel/odds read directly from the active tab's sim state — they
  // only populate once the final fixture itself has a sim entry (from a bulk
  // run or a direct click on the final), not from generic cascading
  // resolution, matching the existing behavior this replaces.
  const finalFixture = realBracket?.['final']?.[0]
  const finalId      = finalFixture ? String(finalFixture.fixture_id) : null
  const finalSim      = finalId ? activeSim[finalId] ?? null : null
  const champion      = finalSim?.winner ?? null
  const runnerUp      = champion ? (finalSim.teamA?.code === champion.code ? finalSim.teamB : finalSim.teamA) : null
  const sfLeftId       = BRACKET_STRUCTURE.left.semifinals[0]
  const sfRightId      = BRACKET_STRUCTURE.right.semifinals[0]
  const sfSim          = [activeSim[sfLeftId], activeSim[sfRightId]].filter(Boolean)

  const oddsTeams = finalSim ? [
    { team: champion,             prob: probFor(finalSim, champion),              label: 'Champion' },
    { team: runnerUp,             prob: probFor(finalSim, runnerUp),              label: 'Runner-up' },
    { team: sfSim[0]?.loser,      prob: probFor(sfSim[0], sfSim[0]?.loser),      label: 'Semifinalist' },
    { team: sfSim[1]?.loser,      prob: probFor(sfSim[1], sfSim[1]?.loser),      label: 'Semifinalist' },
  ].filter(row => row.team) : []

  // "Fully simulated" means the final and 3rd-place match both have a
  // decided winner per the active tab's own resolution rules — real or sim
  // — not "does the sim-state object happen to have an entry for every
  // fixture" (a real-decided bracket the user never clicked anything on
  // would otherwise never read as complete).
  const thirdFixtureObj = realBracket?.['3rd-place-match']?.[0]
  const thirdId = thirdFixtureObj ? String(thirdFixtureObj.fixture_id) : null
  const finalOutcome = finalId ? resolveOutcome(finalId) : null
  const thirdOutcome = thirdId ? resolveOutcome(thirdId) : null
  const isFullySimulated = Boolean(finalOutcome?.winner) && Boolean(thirdOutcome?.winner)

  const activeSimCount = Object.keys(activeSim).length

  const statusText = activeLoading
    ? 'Running predictions…'
    : !knockoutFixtures
      ? 'Loading fixtures…'
      : isFullySimulated
        ? (activeTab === 'live' ? 'Live results + full simulation' : 'Full tournament simulation')
        : activeSimCount === 0
          ? (activeTab === 'live' ? 'Live bracket — run a simulation' : 'Simulate playground — seeded teams only')
          : 'Partial simulation — click matches or run a full simulation'

  return (
    <section className="page bracket-page">
      <div className="section-heading">
        <span className="eyebrow">Tournament Bracket</span>
        <h1>104-match path from groups to champion.</h1>
      </div>

      <div className="bracket-tabs">
        <button type="button" className={activeTab === 'live' ? 'active' : 'secondary-button'} onClick={() => setActiveTab('live')}>
          Live
        </button>
        <button type="button" className={activeTab === 'simulate' ? 'active' : 'secondary-button'} onClick={() => setActiveTab('simulate')}>
          Simulate
        </button>
      </div>

      <div className="bracket-toolbar">
        {activeTab === 'live' ? (
          <>
            <button type="button" disabled={liveLoading || !realBracket || isFullySimulated} onClick={handleSimulateLive}>
              {liveLoading ? 'Simulating…' : 'Simulate remaining'}
            </button>
            <button type="button" className="secondary-button" disabled={Object.keys(liveSim).length === 0} onClick={() => setLiveSim({})}>
              Reset
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={simLoading || !realBracket || isFullySimulated} onClick={handleSimulateScratch}>
              {simLoading ? 'Simulating…' : 'Simulate entire tournament'}
            </button>
            <button type="button" className="secondary-button" disabled={Object.keys(simSim).length === 0} onClick={() => setSimSim({})}>
              Reset
            </button>
          </>
        )}
        <span>{statusText}</span>
      </div>
      {error && <p className="form-note">{error}</p>}

      <div className="bracket-visual">
        {BRACKET_HEADERS.map((name, i) => (
          <span className="bracket-header-label" key={i}>{name}</span>
        ))}
        <BracketCol matches={cols.r32Left}  side="left"  />
        <BracketCol matches={cols.r16Left}  side="left"  />
        <BracketCol matches={cols.qfLeft}   side="left"  />
        <BracketCol matches={cols.sfLeft}   side="left"  />
        <CenterCol  finalProps={getCenterProps('final')} thirdProps={getCenterProps('3rd-place-match')} />
        <BracketCol matches={cols.sfRight}  side="right" />
        <BracketCol matches={cols.qfRight}  side="right" />
        <BracketCol matches={cols.r16Right} side="right" />
        <BracketCol matches={cols.r32Right} side="right" />
      </div>

      <div className="champion-panel">
        <div>
          <span className="eyebrow">Projected Champion</span>
          <h2>{champion ? champion.name : 'Run a simulation'}</h2>
        </div>
        <div className="odds-list">
          {oddsTeams.map(({ team, prob, label }) => (
            <div className="odds-row" key={team.code}>
              <span>{team.name} <em>({label})</em></span>
              <strong>{prob != null ? `${prob}%` : '—'}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
