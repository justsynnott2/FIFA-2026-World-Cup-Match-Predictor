import { useState } from 'react'
import { predictMatch } from '../utils/api'
import { buildR32Seedings } from '../utils/bracket'

const ROUND_NAMES = ['Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Final']
const BRACKET_HEADERS = [
  'Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals',
  'Final',
  'Semifinals', 'Quarterfinals', 'Round of 16', 'Round of 32',
]

function getProbFor(match, team) {
  return match.teamA.code === team.code ? match.probs.home : match.probs.away
}

function loserOf(match) {
  return match.teamA.code === match.winner.code ? match.teamB : match.teamA
}

function BracketMatch({ match }) {
  const aWon = match && match.winner.code === match.teamA.code
  const bWon = match && match.winner.code === match.teamB.code
  return (
    <div className="bracket-match">
      <div className={`bracket-team${aWon ? ' winner' : bWon ? ' loser' : ''}`}>
        {match ? match.teamA.name : 'TBD'}
      </div>
      <div className={`bracket-team${bWon ? ' winner' : aWon ? ' loser' : ''}`}>
        {match ? match.teamB.name : 'TBD'}
      </div>
    </div>
  )
}

function FinalMatch({ match }) {
  const aWon = match && match.winner.code === match.teamA.code
  const bWon = match && match.winner.code === match.teamB.code
  return (
    <div className="bracket-final-match">
      <div className={`bracket-team${aWon ? ' winner' : bWon ? ' loser' : ''}`}>
        {match ? match.teamA.name : 'TBD'}
      </div>
      <div className={`bracket-team${bWon ? ' winner' : aWon ? ' loser' : ''}`}>
        {match ? match.teamB.name : 'TBD'}
      </div>
    </div>
  )
}

function BracketCol({ matches, side }) {
  return (
    <div className={`bracket-col ${side}`}>
      {matches.map((match, i) => (
        <BracketMatch key={i} match={match} />
      ))}
    </div>
  )
}

function CenterCol({ finalMatch, thirdPlace }) {
  return (
    <div className="bracket-col center">
      <div className="bracket-center-item">
        <span className="bracket-zone-label">Final</span>
        <FinalMatch match={finalMatch} />
      </div>
      <div className="bracket-center-item">
        <span className="bracket-zone-label">3rd Place</span>
        <BracketMatch match={thirdPlace} />
      </div>
    </div>
  )
}

const empty = (n) => Array(n).fill(null)

export default function TournamentBracket() {
  const [simulation, setSimulation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSimulate() {
    setLoading(true)
    setError(null)
    setSimulation(null)

    try {
      const allRounds = []
      let currentMatches = buildR32Seedings()

      for (const roundName of ROUND_NAMES) {
        const results = await Promise.all(
          currentMatches.map(async ({ teamA, teamB }) => {
            const probs = await predictMatch(teamA.name, teamB.name)
            const winner = probs.home >= probs.away ? teamA : teamB
            return { teamA, teamB, winner, probs }
          })
        )
        allRounds.push({ name: roundName, matches: results })

        const winners = results.map((r) => r.winner)
        currentMatches = []
        for (let i = 0; i < winners.length; i += 2) {
          currentMatches.push({ teamA: winners[i], teamB: winners[i + 1] })
        }
      }

      const sf1Loser = loserOf(allRounds[3].matches[0])
      const sf2Loser = loserOf(allRounds[3].matches[1])
      const thirdProbs = await predictMatch(sf1Loser.name, sf2Loser.name)
      const thirdPlace = {
        teamA: sf1Loser,
        teamB: sf2Loser,
        winner: thirdProbs.home >= thirdProbs.away ? sf1Loser : sf2Loser,
        probs: thirdProbs,
      }

      setSimulation({ rounds: allRounds, thirdPlace })
    } catch {
      setError('Simulation failed. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const r = simulation?.rounds ?? null
  const finalMatch = r ? r[4].matches[0] : null
  const champion = finalMatch ? finalMatch.winner : null
  const thirdPlace = simulation?.thirdPlace ?? null

  const oddsTeams = finalMatch
    ? (() => {
        const runnerUp = finalMatch.teamA.code === champion.code ? finalMatch.teamB : finalMatch.teamA
        const sfMatches = r[3].matches
        return [
          { team: champion,              prob: getProbFor(finalMatch,  champion),              label: 'Champion' },
          { team: runnerUp,              prob: getProbFor(finalMatch,  runnerUp),              label: 'Runner-up' },
          { team: loserOf(sfMatches[0]), prob: getProbFor(sfMatches[0], loserOf(sfMatches[0])), label: 'Semifinalist' },
          { team: loserOf(sfMatches[1]), prob: getProbFor(sfMatches[1], loserOf(sfMatches[1])), label: 'Semifinalist' },
        ]
      })()
    : []

  const cols = {
    r32Left:  r ? r[0].matches.slice(0, 8)  : empty(8),
    r16Left:  r ? r[1].matches.slice(0, 4)  : empty(4),
    qfLeft:   r ? r[2].matches.slice(0, 2)  : empty(2),
    sfLeft:   r ? [r[3].matches[0]]          : empty(1),
    sfRight:  r ? [r[3].matches[1]]          : empty(1),
    qfRight:  r ? r[2].matches.slice(2, 4)  : empty(2),
    r16Right: r ? r[1].matches.slice(4, 8)  : empty(4),
    r32Right: r ? r[0].matches.slice(8, 16) : empty(8),
  }

  return (
    <section className="page bracket-page">
      <div className="section-heading">
        <span className="eyebrow">Tournament Bracket</span>
        <h1>104-match path from groups to champion.</h1>
      </div>
      <div className="bracket-toolbar">
        <button type="button" disabled={loading} onClick={handleSimulate}>
          {loading ? 'Simulating…' : simulation ? 'Re-simulate' : 'Simulate Tournament'}
        </button>
        <span>
          {loading
            ? 'Running 32 predictions…'
            : simulation
              ? 'Bracket complete'
              : 'Awaiting simulation'}
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
        <CenterCol  finalMatch={finalMatch}  thirdPlace={thirdPlace} />
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
              <strong>{prob}%</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
