import { useState, useEffect } from 'react'
import { getKnockoutFixtures, predictKnockout } from '../utils/api'
import { buildBracketState, isRealTeam, BRACKET_STRUCTURE, buildFixtureLookup, parsePlaceholderRef } from '../utils/bracket'
import { isMatchLive, isMatchCompleted } from '../utils/matchStatus'

const BRACKET_HEADERS = [
  'Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals',
  'Final',
  'Semifinals', 'Quarterfinals', 'Round of 16', 'Round of 32',
]

const TBD_PROPS = { teamAName: 'TBD', teamBName: 'TBD', winnerCode: null, source: 'tbd', teamACode: null, teamBCode: null }

function simMatchToProps({ teamA, teamB, winner, source }) {
  return {
    teamAName: teamA && isRealTeam(teamA.espnId, teamA.logo) ? teamA.name : 'TBD',
    teamBName: teamB && isRealTeam(teamB.espnId, teamB.logo) ? teamB.name : 'TBD',
    teamACode: teamA?.code ?? null,
    teamBCode: teamB?.code ?? null,
    winnerCode: winner?.code ?? null,
    source,
  }
}

function fixtureToProps(fixture) {
  const completed = isMatchCompleted(fixture.status)
  const homeWon = completed && parseFloat(fixture.home_score) > parseFloat(fixture.away_score)
  return {
    teamAName: isRealTeam(fixture.home_espn_id, fixture.home_logo) ? fixture.home_team : 'TBD',
    teamBName: isRealTeam(fixture.away_espn_id, fixture.away_logo) ? fixture.away_team : 'TBD',
    teamACode: fixture.home_code,
    teamBCode: fixture.away_code,
    winnerCode: completed ? (homeWon ? fixture.home_code : fixture.away_code) : null,
    source: completed ? 'real' : 'tbd',
  }
}

function probFor(match, team) {
  if (!match?.probs || !team) return null
  return match.teamA?.code === team.code ? match.probs.home : match.probs.away
}

function BracketMatch({ teamAName, teamBName, winnerCode, teamACode, teamBCode }) {
  const aWon = winnerCode && winnerCode === teamACode
  const bWon = winnerCode && winnerCode === teamBCode
  return (
    <div className="bracket-match">
      <div className={`bracket-team${aWon ? ' winner' : bWon ? ' loser' : ''}`}>
        {teamAName ?? 'TBD'}
      </div>
      <div className={`bracket-team${bWon ? ' winner' : aWon ? ' loser' : ''}`}>
        {teamBName ?? 'TBD'}
      </div>
    </div>
  )
}

function FinalMatch({ teamAName, teamBName, winnerCode, teamACode, teamBCode }) {
  const aWon = winnerCode && winnerCode === teamACode
  const bWon = winnerCode && winnerCode === teamBCode
  return (
    <div className="bracket-final-match">
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
  const [simBracket, setSimBracket]             = useState(null)
  const [simMode, setSimMode]                   = useState(null)
  const [loading, setLoading]                   = useState(false)
  const [error, setError]                       = useState(null)

  const realBracket  = knockoutFixtures ? buildBracketState(knockoutFixtures) : null
  const fixtureLookup = knockoutFixtures ? buildFixtureLookup(knockoutFixtures) : {}

  useEffect(() => {
    let timeoutId
    let cancelled = false

    async function fetchAndSchedule() {
      try {
        const fixtures = await getKnockoutFixtures()
        if (cancelled) return
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

  function resolveTeam(teamName, teamCode, teamLogo, mode, simResults) {
    if (isRealTeam(null, teamLogo)) {
      return { name: teamName, code: teamCode, logo: teamLogo }
    }
    const ref = parsePlaceholderRef(teamName)
    if (!ref) return null
    const { fixtureId, loser } = ref
    if (mode === 'remaining') {
      const srcFixture = fixtureLookup[fixtureId]
      if (srcFixture && isMatchCompleted(srcFixture.status)) {
        const homeWon = parseFloat(srcFixture.home_score) > parseFloat(srcFixture.away_score)
        const winner = homeWon
          ? { name: srcFixture.home_team, code: srcFixture.home_code, logo: srcFixture.home_logo }
          : { name: srcFixture.away_team, code: srcFixture.away_code, logo: srcFixture.away_logo }
        const loserTeam = homeWon
          ? { name: srcFixture.away_team, code: srcFixture.away_code, logo: srcFixture.away_logo }
          : { name: srcFixture.home_team, code: srcFixture.home_code, logo: srcFixture.home_logo }
        return loser ? loserTeam : winner
      }
    }
    const srcResult = simResults[fixtureId]
    if (!srcResult) return null
    return loser ? srcResult.loser : srcResult.winner
  }

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

        let teamA, teamB
        if (mode === 'remaining' && isMatchCompleted(fixture.status)) {
          teamA = { name: fixture.home_team, code: fixture.home_code, logo: fixture.home_logo }
          teamB = { name: fixture.away_team, code: fixture.away_code, logo: fixture.away_logo }
        } else {
          teamA = resolveTeam(fixture.home_team, fixture.home_code, fixture.home_logo, mode, simResults)
          teamB = resolveTeam(fixture.away_team, fixture.away_code, fixture.away_logo, mode, simResults)
        }

        let winner, loserTeam, source, probs = null
        if (mode === 'remaining' && isMatchCompleted(fixture.status)) {
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
      let teamA, teamB
      if (mode === 'remaining' && isMatchCompleted(finalFixture.status)) {
        teamA = { name: finalFixture.home_team, code: finalFixture.home_code, logo: finalFixture.home_logo }
        teamB = { name: finalFixture.away_team, code: finalFixture.away_code, logo: finalFixture.away_logo }
      } else {
        teamA = resolveTeam(finalFixture.home_team, finalFixture.home_code, finalFixture.home_logo, mode, simResults)
        teamB = resolveTeam(finalFixture.away_team, finalFixture.away_code, finalFixture.away_logo, mode, simResults)
      }
      let winner, loserTeam, source, probs = null
      if (mode === 'remaining' && isMatchCompleted(finalFixture.status)) {
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

    // 3rd place — losers of the two semifinals
    const sfLeftId  = BRACKET_STRUCTURE.left.semifinals[0]
    const sfRightId = BRACKET_STRUCTURE.right.semifinals[0]
    const loser1 = simResults[sfLeftId]?.loser ?? null
    const loser2 = simResults[sfRightId]?.loser ?? null
    const thirdFixture = realBracket['3rd-place-match']?.[0] ?? null

    let thirdMatch
    if (thirdFixture && mode === 'remaining' && isMatchCompleted(thirdFixture.status)) {
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

  async function handleSimulate(mode) {
    setLoading(true)
    setError(null)
    try {
      const result = await runSimulation(mode)
      setSimBracket(result)
      setSimMode(mode)
    } catch {
      setError('Simulation failed. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setSimBracket(null)
    setSimMode(null)
  }

  function getCol(side, roundKey) {
    const ids = BRACKET_STRUCTURE[side][roundKey]
    return ids.map(id => {
      const fixture = fixtureLookup[id]
      if (!fixture) return TBD_PROPS
      if (simBracket?.[id]) return simMatchToProps(simBracket[id])
      return fixtureToProps(fixture)
    })
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
    if (!fixture) return null
    const id = String(fixture.fixture_id)
    if (simBracket?.[id]) return simMatchToProps(simBracket[id])
    return fixtureToProps(fixture)
  }

  const finalFixture = realBracket?.['final']?.[0]
  const finalSim     = finalFixture ? simBracket?.[String(finalFixture.fixture_id)] ?? null : null
  const champion     = finalSim?.winner ?? null
  const runnerUp     = champion ? (finalSim.teamA?.code === champion.code ? finalSim.teamB : finalSim.teamA) : null
  const sfLeftId     = BRACKET_STRUCTURE.left.semifinals[0]
  const sfRightId    = BRACKET_STRUCTURE.right.semifinals[0]
  const sfSim        = [simBracket?.[sfLeftId], simBracket?.[sfRightId]].filter(Boolean)

  const oddsTeams = finalSim ? [
    { team: champion,             prob: probFor(finalSim, champion),              label: 'Champion' },
    { team: runnerUp,             prob: probFor(finalSim, runnerUp),              label: 'Runner-up' },
    { team: sfSim[0]?.loser,      prob: probFor(sfSim[0], sfSim[0]?.loser),      label: 'Semifinalist' },
    { team: sfSim[1]?.loser,      prob: probFor(sfSim[1], sfSim[1]?.loser),      label: 'Semifinalist' },
  ].filter(row => row.team) : []

  return (
    <section className="page bracket-page">
      <div className="section-heading">
        <span className="eyebrow">Tournament Bracket</span>
        <h1>104-match path from groups to champion.</h1>
      </div>
      <div className="bracket-toolbar">
        {simMode ? (
          <button type="button" onClick={handleReset}>Reset</button>
        ) : (
          <>
            <button type="button" disabled={loading || !realBracket} onClick={() => handleSimulate('remaining')}>
              {loading ? 'Simulating…' : 'Simulate remaining'}
            </button>
            <button type="button" disabled={loading || !realBracket} onClick={() => handleSimulate('scratch')}>
              {loading ? 'Simulating…' : 'Simulate from scratch'}
            </button>
          </>
        )}
        <span>
          {loading
            ? 'Running predictions…'
            : simMode === 'remaining' ? 'Showing real results + predictions'
            : simMode === 'scratch'   ? 'Full simulation from scratch'
            : knockoutFixtures        ? 'Live bracket — run a simulation'
            : 'Loading fixtures…'}
        </span>
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
