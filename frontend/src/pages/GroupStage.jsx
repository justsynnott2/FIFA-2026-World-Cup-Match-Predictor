import { useState } from 'react'
import { fixturesByGroup, groups } from '../data/tournament'
import { hashValue } from '../utils/prediction'
import { predictMatch } from '../utils/api'
import TeamBadge from '../components/TeamBadge'
import ProbabilityBars from '../components/ProbabilityBars'

function computeStandings(group, predictions) {
  const fixtures = fixturesByGroup[group.id]
  const points = Object.fromEntries(group.teams.map((team) => [team.code, 0]))

  fixtures.forEach((fixture) => {
    const prediction = predictions[fixture.id]
    if (!prediction) return
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

export default function GroupStage() {
  const [expandedGroup, setExpandedGroup] = useState('')
  // fixture.id → { home, draw, away } | 'loading' | 'error'
  const [predictions, setPredictions] = useState({})
  // group.id → sorted team array
  const [groupStandings, setGroupStandings] = useState({})
  const [standingsLoading, setStandingsLoading] = useState({})

  async function handleSimulateFixture(fixture) {
    setPredictions((current) => ({ ...current, [fixture.id]: 'loading' }))
    try {
      const result = await predictMatch(fixture.home.name, fixture.away.name)
      setPredictions((current) => ({ ...current, [fixture.id]: result }))
    } catch {
      setPredictions((current) => ({ ...current, [fixture.id]: 'error' }))
    }
  }

  function handleHideFixture(fixtureId) {
    setPredictions((current) => {
      const next = { ...current }
      delete next[fixtureId]
      return next
    })
  }

  async function handleSimulateGroup(group) {
    const isSimulated = Boolean(groupStandings[group.id])
    if (isSimulated) {
      setGroupStandings((current) => {
        const next = { ...current }
        delete next[group.id]
        return next
      })
      return
    }

    setStandingsLoading((current) => ({ ...current, [group.id]: true }))
    try {
      const fixtures = fixturesByGroup[group.id]
      const results = await Promise.all(
        fixtures.map((fixture) => predictMatch(fixture.home.name, fixture.away.name))
      )
      const fetchedPredictions = Object.fromEntries(
        fixtures.map((fixture, i) => [fixture.id, results[i]])
      )
      setPredictions((current) => ({ ...current, ...fetchedPredictions }))
      setGroupStandings((current) => ({
        ...current,
        [group.id]: computeStandings(group, fetchedPredictions),
      }))
    } catch {
      // silently fail — standings just won't appear
    } finally {
      setStandingsLoading((current) => ({ ...current, [group.id]: false }))
    }
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
          const standings = groupStandings[group.id]
          const isStandingsLoading = standingsLoading[group.id]

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
                      const prediction = predictions[fixture.id]
                      const isLoading = prediction === 'loading'
                      const isError = prediction === 'error'
                      const hasResult = prediction && prediction !== 'loading' && prediction !== 'error'
                      const isShown = Boolean(prediction)

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
                            disabled={isLoading}
                            onClick={() =>
                              isShown
                                ? handleHideFixture(fixture.id)
                                : handleSimulateFixture(fixture)
                            }
                          >
                            {isLoading ? 'Loading…' : isShown ? 'Hide' : 'Simulate'}
                          </button>
                          {isError && <p className="form-note">Prediction failed.</p>}
                          {hasResult && (
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
                    disabled={isStandingsLoading}
                    onClick={() => handleSimulateGroup(group)}
                  >
                    {isStandingsLoading
                      ? 'Simulating…'
                      : standings
                        ? 'Reset projected group'
                        : 'Simulate full group'}
                  </button>
                  {standings && (
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
