import { useMemo, useState } from 'react'
import { allTeams, bracketRounds, fixturesByGroup, groups } from './data/tournament'
import './App.css'

const tabs = ['Overview', 'Group Stage', 'Tournament Bracket', 'Custom Match']

const contenderCodes = ['ARG', 'BRA', 'FRA', 'ESP', 'ENG', 'POR', 'GER', 'NED']

function hashValue(value) {
  return [...value].reduce((total, char) => total + char.charCodeAt(0), 0)
}

function mockPrediction(home, away) {
  const homeSeed = hashValue(home.code)
  const awaySeed = hashValue(away.code)
  const favoriteBoost = contenderCodes.includes(home.code) ? 16 : 0
  const awayBoost = contenderCodes.includes(away.code) ? 16 : 0
  const rawHome = 32 + (homeSeed % 18) + favoriteBoost
  const rawAway = 30 + (awaySeed % 18) + awayBoost
  const rawDraw = 22 + ((homeSeed + awaySeed) % 12)
  const total = rawHome + rawAway + rawDraw

  return {
    home: Math.round((rawHome / total) * 100),
    draw: Math.round((rawDraw / total) * 100),
    away: Math.max(1, 100 - Math.round((rawHome / total) * 100) - Math.round((rawDraw / total) * 100)),
  }
}

function TeamBadge({ team }) {
  return (
    <span className="team-badge">
      <span>{team.code}</span>
      {team.name}
    </span>
  )
}

function ProbabilityBars({ prediction, home, away }) {
  const rows = [
    { label: `${home.code} win`, value: prediction.home, tone: 'home' },
    { label: 'Draw', value: prediction.draw, tone: 'draw' },
    { label: `${away.code} win`, value: prediction.away, tone: 'away' },
  ]

  return (
    <div className="probability-bars">
      {rows.map((row) => (
        <div className="probability-row" key={row.label}>
          <div className="probability-label">
            <span>{row.label}</span>
            <strong>{row.value}%</strong>
          </div>
          <div className="bar-track">
            <span className={`bar-fill ${row.tone}`} style={{ width: `${row.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Overview() {
  const sample = mockPrediction(allTeams[0], allTeams[8])

  return (
    <section className="page overview-page">
      <div className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">2026 FIFA World Cup</span>
          <h1>Match prediction lab for every fixture in North America.</h1>
          <p>
            Explore model-backed win, draw, and loss probabilities across the group stage,
            bracket path, and any custom matchup from the 48-team field.
          </p>
          <div className="hero-actions">
            <button type="button">Try a custom match</button>
            <button type="button" className="secondary-button">
              Browse groups
            </button>
          </div>
        </div>
        <div className="prediction-card hero-card">
          <div className="card-header">
            <span>Sample prediction</span>
            <strong>Model preview</strong>
          </div>
          <div className="match-title">
            <TeamBadge team={allTeams[0]} />
            <span>vs</span>
            <TeamBadge team={allTeams[8]} />
          </div>
          <ProbabilityBars prediction={sample} home={allTeams[0]} away={allTeams[8]} />
        </div>
      </div>

      <div className="stat-grid">
        <article>
          <span>Accuracy</span>
          <strong>57%</strong>
          <p>Comparable with public tournament forecasting baselines.</p>
        </article>
        <article>
          <span>Features</span>
          <strong>15</strong>
          <p>Recent form, goals, Elo, confederation, head-to-head, and host context.</p>
        </article>
        <article>
          <span>Field</span>
          <strong>48</strong>
          <p>All qualified World Cup teams grouped into the new 12-group format.</p>
        </article>
      </div>

      <div className="info-grid">
        <article>
          <h2>What the model does</h2>
          <p>
            The backend estimates three outcomes for a selected match: home team win, draw,
            or away team win. Neutral-site matches are averaged in both directions to reduce
            home/away bias.
          </p>
        </article>
        <article>
          <h2>How it was built</h2>
          <p>
            The feature set combines international results, Elo ratings, recent form, goal
            averages, head-to-head history, tournament weight, and confederation encodings.
          </p>
        </article>
        <article>
          <h2>How to use it</h2>
          <p>
            Start with a group, inspect the six fixtures, simulate individual matches, then
            compare the same teams in the custom match tab.
          </p>
        </article>
      </div>
    </section>
  )
}

function GroupStage() {
  const [expandedGroup, setExpandedGroup] = useState('A')
  const [simulatedMatches, setSimulatedMatches] = useState({})
  const [simulatedGroups, setSimulatedGroups] = useState({})

  function standingsFor(group) {
    const fixtures = fixturesByGroup[group.id]
    const points = Object.fromEntries(group.teams.map((team) => [team.code, 0]))

    fixtures.forEach((fixture) => {
      const prediction = mockPrediction(fixture.home, fixture.away)
      if (prediction.draw > prediction.home && prediction.draw > prediction.away) {
        points[fixture.home.code] += 1
        points[fixture.away.code] += 1
      } else if (prediction.home >= prediction.away) {
        points[fixture.home.code] += 3
      } else {
        points[fixture.away.code] += 3
      }
    })

    return group.teams
      .map((team) => ({
        ...team,
        points: points[team.code],
        gd: (hashValue(team.code) % 7) - 2,
      }))
      .sort((a, b) => b.points - a.points || b.gd - a.gd)
  }

  return (
    <section className="page">
      <div className="section-heading">
        <span className="eyebrow">Group Stage</span>
        <h1>All 12 groups, fixtures, and projected tables.</h1>
      </div>
      <div className="group-grid">
        {groups.map((group) => {
          const isExpanded = expandedGroup === group.id
          const standings = simulatedGroups[group.id] ? standingsFor(group) : []

          return (
            <article className={`group-card ${isExpanded ? 'expanded' : ''}`} key={group.id}>
              <button
                className="group-summary"
                type="button"
                onClick={() => setExpandedGroup(isExpanded ? '' : group.id)}
              >
                <span>Group {group.id}</span>
                <strong>{group.teams.map((team) => team.code).join(' / ')}</strong>
              </button>
              <div className="team-list">
                {group.teams.map((team) => (
                  <TeamBadge key={team.code} team={team} />
                ))}
              </div>

              {isExpanded && (
                <div className="group-detail">
                  <div className="fixture-list">
                    {fixturesByGroup[group.id].map((fixture) => {
                      const prediction = mockPrediction(fixture.home, fixture.away)
                      const isSimulated = simulatedMatches[fixture.id]

                      return (
                        <div className="fixture-row" key={fixture.id}>
                          <div>
                            <span className="fixture-meta">
                              {fixture.date} · {fixture.venue}
                            </span>
                            <strong>
                              {fixture.home.name} vs {fixture.away.name}
                            </strong>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSimulatedMatches((current) => ({
                                ...current,
                                [fixture.id]: !current[fixture.id],
                              }))
                            }
                          >
                            {isSimulated ? 'Hide' : 'Simulate'}
                          </button>
                          {isSimulated && (
                            <ProbabilityBars
                              prediction={prediction}
                              home={fixture.home}
                              away={fixture.away}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <button
                    className="wide-button"
                    type="button"
                    onClick={() =>
                      setSimulatedGroups((current) => ({
                        ...current,
                        [group.id]: !current[group.id],
                      }))
                    }
                  >
                    {simulatedGroups[group.id] ? 'Reset projected group' : 'Simulate full group'}
                  </button>
                  {simulatedGroups[group.id] && (
                    <table className="standings-table">
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th>Pts</th>
                          <th>GD</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((team, index) => (
                          <tr key={team.code}>
                            <td>{team.name}</td>
                            <td>{team.points}</td>
                            <td>{team.gd > 0 ? `+${team.gd}` : team.gd}</td>
                            <td>{index < 2 ? 'Advances' : index === 2 ? 'Third-place watch' : 'At risk'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function TournamentBracket() {
  const [simulated, setSimulated] = useState(false)
  const contenders = allTeams
    .filter((team) => contenderCodes.includes(team.code))
    .map((team, index) => ({ ...team, odds: Math.max(6, 19 - index * 2) }))

  return (
    <section className="page bracket-page">
      <div className="section-heading">
        <span className="eyebrow">Tournament Bracket</span>
        <h1>104-match path from groups to champion.</h1>
      </div>
      <div className="bracket-toolbar">
        <button type="button" onClick={() => setSimulated(true)}>
          Simulate Tournament
        </button>
        <button type="button" className="secondary-button" onClick={() => setSimulated(true)}>
          Run Monte Carlo x1000
        </button>
        <span>{simulated ? 'Mock bracket populated' : 'Awaiting simulation'}</span>
      </div>

      <div className="bracket-board">
        {bracketRounds.map((round, roundIndex) => (
          <div className="round-column" key={round.name}>
            <h2>{round.name}</h2>
            {Array.from({ length: round.matches }).map((_, matchIndex) => {
              const teamA = contenders[(matchIndex + roundIndex) % contenders.length]
              const teamB = contenders[(matchIndex + roundIndex + 3) % contenders.length]

              return (
                <div className="bracket-match" key={`${round.name}-${matchIndex}`}>
                  <span>Match {matchIndex + 1}</span>
                  <strong>{simulated ? teamA.name : 'Qualifier'}</strong>
                  <strong>{simulated ? teamB.name : 'Qualifier'}</strong>
                  <button type="button">Override</button>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="champion-panel">
        <div>
          <span className="eyebrow">Projected Champion</span>
          <h2>{simulated ? 'Argentina' : 'Run a simulation'}</h2>
        </div>
        <div className="odds-list">
          {contenders.slice(0, 6).map((team) => (
            <div className="odds-row" key={team.code}>
              <span>{team.name}</span>
              <strong>{simulated ? `${team.odds}%` : '--'}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CustomMatch() {
  const [homeCode, setHomeCode] = useState('USA')
  const [awayCode, setAwayCode] = useState('BRA')
  const [prediction, setPrediction] = useState(null)

  const home = useMemo(() => allTeams.find((team) => team.code === homeCode), [homeCode])
  const away = useMemo(() => allTeams.find((team) => team.code === awayCode), [awayCode])

  return (
    <section className="page custom-page">
      <div className="section-heading">
        <span className="eyebrow">Custom Match</span>
        <h1>Pick any two World Cup teams.</h1>
      </div>
      <div className="custom-layout">
        <div className="selector-panel">
          <label>
            Team A
            <select value={homeCode} onChange={(event) => setHomeCode(event.target.value)}>
              {allTeams.map((team) => (
                <option value={team.code} key={team.code}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Team B
            <select value={awayCode} onChange={(event) => setAwayCode(event.target.value)}>
              {allTeams.map((team) => (
                <option value={team.code} key={team.code}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={homeCode === awayCode}
            onClick={() => setPrediction(mockPrediction(home, away))}
          >
            Predict
          </button>
          {homeCode === awayCode && <p className="form-note">Choose two different teams.</p>}
        </div>
        <div className="prediction-card">
          <div className="card-header">
            <span>Prediction output</span>
            <strong>{prediction ? 'Mock result' : 'Ready'}</strong>
          </div>
          <div className="match-title">
            <TeamBadge team={home} />
            <span>vs</span>
            <TeamBadge team={away} />
          </div>
          {prediction ? (
            <ProbabilityBars prediction={prediction} home={home} away={away} />
          ) : (
            <p className="empty-state">Select teams and run the predictor to reveal probability bars.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('Overview')

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span>WC26</span>
          <strong>Match Predictor</strong>
        </div>
        <nav aria-label="Primary navigation">
          {tabs.map((tab) => (
            <button
              className={activeTab === tab ? 'active' : ''}
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
      </header>

      {activeTab === 'Overview' && <Overview />}
      {activeTab === 'Group Stage' && <GroupStage />}
      {activeTab === 'Tournament Bracket' && <TournamentBracket />}
      {activeTab === 'Custom Match' && <CustomMatch />}
    </main>
  )
}

export default App
