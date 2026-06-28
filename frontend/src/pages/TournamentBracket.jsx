import { useState, useEffect } from 'react'
import { getKnockoutFixtures, predictKnockout } from '../utils/api'
import { buildBracketState, isRealTeam } from '../utils/bracket'
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

function loserOfSim(sf) {
  if (!sf?.winner) return null
  return sf.winner.code === sf.teamA?.code ? sf.teamB : sf.teamA
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

  const realBracket = knockoutFixtures ? buildBracketState(knockoutFixtures) : null

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

  async function runSimulation(mode) {
    if (!realBracket) return null
    const roundOrder = ['round-of-32', 'round-of-16', 'quarterfinals', 'semifinals', 'final']
    const newSim = {}
    let prevRound = null

    for (const roundKey of roundOrder) {
      const espnFixtures = realBracket[roundKey] ?? []
      const results = []

      for (let i = 0; i < espnFixtures.length; i++) {
        const fixture = espnFixtures[i]

        let teamA, teamB
        if (prevRound === null) {
          teamA = { name: fixture.home_team, code: fixture.home_code, logo: fixture.home_logo }
          teamB = { name: fixture.away_team, code: fixture.away_code, logo: fixture.away_logo }
        } else if (mode === 'remaining' && isMatchCompleted(fixture.status)) {
          teamA = { name: fixture.home_team, code: fixture.home_code, logo: fixture.home_logo }
          teamB = { name: fixture.away_team, code: fixture.away_code, logo: fixture.away_logo }
        } else {
          teamA = prevRound[i * 2]?.winner ?? null
          teamB = prevRound[i * 2 + 1]?.winner ?? null
        }

        let winner, source, probs = null
        if (mode === 'remaining' && isMatchCompleted(fixture.status)) {
          const homeWon = parseFloat(fixture.home_score) > parseFloat(fixture.away_score)
          winner = homeWon ? teamA : teamB
          source = 'real'
        } else if (teamA && teamB && isRealTeam(null, teamA.logo) && isRealTeam(null, teamB.logo)) {
          probs = await predictKnockout(teamA.name, teamB.name)
          winner = probs.home >= probs.away ? teamA : teamB
          source = 'sim'
        } else {
          winner = null
          source = 'tbd'
        }

        results.push({ fixture, teamA, teamB, winner, source, probs })
      }

      newSim[roundKey] = results
      prevRound = results
    }

    // 3rd place — losers of the two semifinals
    const sfResults = newSim['semifinals'] ?? []
    const sf1 = sfResults[0], sf2 = sfResults[1]
    const loser1 = sf1?.winner ? (sf1.winner.code === sf1.teamA?.code ? sf1.teamB : sf1.teamA) : null
    const loser2 = sf2?.winner ? (sf2.winner.code === sf2.teamA?.code ? sf2.teamB : sf2.teamA) : null
    const thirdFixture = realBracket['3rd-place-match']?.[0] ?? null

    let thirdMatch
    if (thirdFixture && mode === 'remaining' && isMatchCompleted(thirdFixture.status)) {
      const homeWon = parseFloat(thirdFixture.home_score) > parseFloat(thirdFixture.away_score)
      const t3A = { name: thirdFixture.home_team, code: thirdFixture.home_code, logo: thirdFixture.home_logo }
      const t3B = { name: thirdFixture.away_team, code: thirdFixture.away_code, logo: thirdFixture.away_logo }
      thirdMatch = { fixture: thirdFixture, teamA: t3A, teamB: t3B, winner: homeWon ? t3A : t3B, source: 'real', probs: null }
    } else if (loser1 && loser2 && isRealTeam(null, loser1.logo) && isRealTeam(null, loser2.logo)) {
      const p = await predictKnockout(loser1.name, loser2.name)
      const winner = p.home >= p.away ? loser1 : loser2
      thirdMatch = { fixture: thirdFixture, teamA: loser1, teamB: loser2, winner, source: 'sim', probs: p }
    } else {
      thirdMatch = { fixture: thirdFixture, teamA: loser1, teamB: loser2, winner: null, source: 'tbd', probs: null }
    }

    newSim['3rd-place-match'] = [thirdMatch]
    return newSim
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

  function getCol(roundKey, start, end) {
    const expected = end - start
    const arr = simBracket
      ? (simBracket[roundKey] ?? []).slice(start, end).map(simMatchToProps)
      : (realBracket?.[roundKey] ?? []).slice(start, end).map(fixtureToProps)
    while (arr.length < expected) arr.push(TBD_PROPS)
    return arr
  }

  const cols = {
    r32Left:  getCol('round-of-32', 0, 8),
    r16Left:  getCol('round-of-16', 0, 4),
    qfLeft:   getCol('quarterfinals', 0, 2),
    sfLeft:   getCol('semifinals', 0, 1),
    sfRight:  getCol('semifinals', 1, 2),
    qfRight:  getCol('quarterfinals', 2, 4),
    r16Right: getCol('round-of-16', 4, 8),
    r32Right: getCol('round-of-32', 8, 16),
  }

  function getCenterProps(roundKey) {
    if (simBracket?.[roundKey]?.[0]) return simMatchToProps(simBracket[roundKey][0])
    if (realBracket?.[roundKey]?.[0]) return fixtureToProps(realBracket[roundKey][0])
    return null
  }

  const finalSim    = simBracket?.['final']?.[0] ?? null
  const champion    = finalSim?.winner ?? null
  const runnerUp    = champion ? (finalSim.teamA?.code === champion.code ? finalSim.teamB : finalSim.teamA) : null
  const sfSim       = simBracket?.['semifinals'] ?? []

  const oddsTeams = finalSim ? [
    { team: champion,           prob: probFor(finalSim, champion),  label: 'Champion' },
    { team: runnerUp,           prob: probFor(finalSim, runnerUp),  label: 'Runner-up' },
    { team: loserOfSim(sfSim[0]), prob: probFor(sfSim[0], loserOfSim(sfSim[0])), label: 'Semifinalist' },
    { team: loserOfSim(sfSim[1]), prob: probFor(sfSim[1], loserOfSim(sfSim[1])), label: 'Semifinalist' },
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
