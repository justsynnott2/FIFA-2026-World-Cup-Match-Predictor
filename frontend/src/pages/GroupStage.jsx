import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { groups } from '../data/tournament'
import { predictMatch, getAllFixtures } from '../utils/api'
import { computeLiveStandings, computeSimStandings } from '../utils/standings'
import { isMatchLive, isMatchCompleted, STATUS_DELAYED } from '../utils/matchStatus'
import ProbabilityBars from '../components/ProbabilityBars'

const API_BASE = 'http://localhost:8000'

function getEspnId(code, fixtures) {
  for (const f of fixtures) {
    if (f.home_code === code) return f.home_espn_id
    if (f.away_code === code) return f.away_espn_id
  }
  return null
}

// Filters all ESPN fixtures down to just the 6 belonging to a specific group
function getGroupFixtures(group, allFixtures) {
  const groupCodes = new Set(group.teams.map((team) => team.code))
  return allFixtures.filter(
    (fixture) => groupCodes.has(fixture.home_code) && groupCodes.has(fixture.away_code)
  )
}

// Standings table shared between both tabs
function StandingsTable({ standings, allFixtures }) {
  const navigate = useNavigate()
  return (
    <table className="standings-table">
      <thead>
        <tr>
          <th>Team</th>
          <th>GP</th>
          <th>W</th>
          <th>D</th>
          <th>L</th>
          <th>GF</th>
          <th>GA</th>
          <th>GD</th>
          <th>Pts</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((team) => (
          <tr key={team.code}>
            <td>
              <span
                className="team-name-link"
                onClick={() => navigate(`/team/${getEspnId(team.code, allFixtures)}`)}
              >
                {team.name}
              </span>
            </td>
            <td>{team.gp ?? '—'}</td>
            <td>{team.w  ?? '—'}</td>
            <td>{team.d  ?? '—'}</td>
            <td>{team.l  ?? '—'}</td>
            <td>{team.gf ?? '—'}</td>
            <td>{team.ga ?? '—'}</td>
            <td>{team.gd ?? '—'}</td>
            <td>{team.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function GroupStage() {
  const navigate = useNavigate()
  const [expandedGroup, setExpandedGroup] = useState('')
  const [activeTab, setActiveTab] = useState({})
  const [allFixtures, setAllFixtures] = useState([])
  const [espnStandings, setEspnStandings] = useState({})
  const [predictions, setPredictions] = useState({})
  const [simStandings, setSimStandings] = useState({})
  const [standingsLoading, setStandingsLoading] = useState({})

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch fixtures and ESPN standings on mount
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const fixtures = await getAllFixtures()
        setAllFixtures(fixtures)
      } catch {
        setError('Failed to load fixtures. Make sure the backend is running.')
      } finally {
        setIsLoading(false)
      }

      fetch(`${API_BASE}/schedule/standings`)
        .then(r => r.json())
        .then(setEspnStandings)
        .catch(() => {})
    }
    fetchInitialData()
  }, [])

  // Recursive polling — 30s when live, 5min otherwise
  useEffect(() => {
    let timerId

    async function tick() {
      try {
        const fixtures = await getAllFixtures()
        setAllFixtures(fixtures)
        const hasLiveMatch = fixtures.some(f => isMatchLive(f.status))
        timerId = setTimeout(tick, hasLiveMatch ? 30_000 : 300_000)
      } catch {
        // ignore transient polling errors; next tick will retry
      }
    }

    tick()
    return () => clearTimeout(timerId)
  }, [])

  function getActiveTab(groupId) {
    return activeTab[groupId] ?? 'results'
  }

  function setGroupTab(groupId, tab) {
    setActiveTab((current) => ({ ...current, [groupId]: tab }))
  }

  async function handleSimulateFixture(fixture) {
    setPredictions((current) => ({ ...current, [fixture.fixture_id]: 'loading' }))
    try {
      const result = await predictMatch(fixture.home_team, fixture.away_team)
      setPredictions((current) => ({ ...current, [fixture.fixture_id]: result }))
    } catch {
      setPredictions((current) => ({ ...current, [fixture.fixture_id]: 'error' }))
    }
  }

  function handleHideFixture(fixtureId) {
    setPredictions((current) => {
      const next = { ...current }
      delete next[fixtureId]
      return next
    })
  }

  async function handleSimulateGroup(group, groupFixtures) {
    const isSimulated = Boolean(simStandings[group.id])

    if (isSimulated) {
      setSimStandings((current) => {
        const next = { ...current }
        delete next[group.id]
        return next
      })
      return
    }

    setStandingsLoading((current) => ({ ...current, [group.id]: true }))
    try {
      const results = await Promise.all(
        groupFixtures.map((fixture) => predictMatch(fixture.home_team, fixture.away_team))
      )
      const newPredictions = Object.fromEntries(
        groupFixtures.map((fixture, i) => [fixture.fixture_id, results[i]])
      )
      const mergedPredictions = { ...predictions, ...newPredictions }
      setPredictions(mergedPredictions)
      setSimStandings((current) => ({
        ...current,
        [group.id]: computeSimStandings(group, groupFixtures, mergedPredictions, espnStandings[`Group ${group.id}`]),
      }))
    } catch {
      // silently fail
    } finally {
      setStandingsLoading((current) => ({ ...current, [group.id]: false }))
    }
  }

  if (isLoading) return <section className="page"><p className="empty-state">Loading fixtures...</p></section>
  if (error) return <section className="page"><p className="empty-state">{error}</p></section>

  const espnIdToCode = Object.fromEntries(
    allFixtures.flatMap(f => [
      [f.home_espn_id, f.home_code],
      [f.away_espn_id, f.away_code],
    ])
  )

  return (
    <section className="page">
      <div className="section-heading">
        <span className="eyebrow">Group Stage</span>
        <h1>All 12 groups, fixtures, and projected tables.</h1>
      </div>

      <div className="group-grid">
        {groups.map((group) => {
          const isExpanded = expandedGroup === group.id
          const groupFixtures = getGroupFixtures(group, allFixtures)
          const currentTab = getActiveTab(group.id)
          const isStandingsLoading = standingsLoading[group.id]
          const groupEspnStandings = (espnStandings[`Group ${group.id}`] ?? []).map(e => ({
            ...e,
            code: espnIdToCode[e.espn_id],
          }))

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
                  <span key={team.code} className="team-badge">
                    <span>{team.code}</span>
                    <span
                      className="team-name-link"
                      onClick={() => navigate(`/team/${getEspnId(team.code, allFixtures)}`)}
                    >
                      {team.name}
                    </span>
                  </span>
                ))}
              </div>

              {isExpanded && (
                <div className="group-detail">

                  <div className="group-tabs">
                    <button
                      type="button"
                      className={currentTab === 'results' ? 'active' : 'secondary-button'}
                      onClick={() => setGroupTab(group.id, 'results')}
                    >
                      Results
                    </button>
                    <button
                      type="button"
                      className={currentTab === 'simulate' ? 'active' : 'secondary-button'}
                      onClick={() => setGroupTab(group.id, 'simulate')}
                    >
                      Simulate
                    </button>
                  </div>

                  {currentTab === 'results' && (
                    <div className="group-expanded-layout">
                      <div>
                        <div className="fixture-list">
                          {groupFixtures.map((fixture) => {
                            const completed = isMatchCompleted(fixture.status)
                            const inProgress = isMatchLive(fixture.status)
                            const prediction = predictions[fixture.fixture_id]
                            const isLoadingPrediction = prediction === 'loading'
                            const isError = prediction === 'error'
                            const hasResult = prediction && prediction !== 'loading' && prediction !== 'error'
                            const isShown = Boolean(prediction)

                            return (
                              <div className="fixture-row" key={fixture.fixture_id}>
                                <div>
                                  <span className="fixture-meta">
                                    {fixture.detail} · {fixture.venue}
                                  </span>
                                  <strong>
                                    <span className="team-name-link" onClick={() => navigate(`/team/${fixture.home_espn_id}`)}>
                                      {fixture.home_team}
                                    </span>
                                    {' vs '}
                                    <span className="team-name-link" onClick={() => navigate(`/team/${fixture.away_espn_id}`)}>
                                      {fixture.away_team}
                                    </span>
                                  </strong>
                                  {(completed || inProgress) && (
                                    <span className="real-score">
                                      {fixture.home_score} – {fixture.away_score}
                                      {inProgress && (
                                        <span className={fixture.status === STATUS_DELAYED ? 'delay-badge' : 'live-badge'}>
                                          {fixture.status === STATUS_DELAYED ? 'DELAY' : 'LIVE'}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>

                                {!completed && (
                                  <button
                                    type="button"
                                    disabled={isLoadingPrediction}
                                    onClick={() =>
                                      isShown
                                        ? handleHideFixture(fixture.fixture_id)
                                        : handleSimulateFixture(fixture)
                                    }
                                  >
                                    {isLoadingPrediction ? 'Loading…' : isShown ? 'Hide' : 'Simulate'}
                                  </button>
                                )}

                                {isError && <p className="form-note">Prediction failed.</p>}
                                {hasResult && (
                                  <ProbabilityBars
                                    prediction={prediction}
                                    home={{ name: fixture.home_team, code: fixture.home_code }}
                                    away={{ name: fixture.away_team, code: fixture.away_code }}
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {groupFixtures.some((f) => !isMatchCompleted(f.status)) && (
                          <button
                            className="wide-button"
                            type="button"
                            disabled={isStandingsLoading}
                            onClick={() => handleSimulateGroup(group, groupFixtures)}
                          >
                            {isStandingsLoading ? 'Simulating…' : 'Simulate remaining fixtures'}
                          </button>
                        )}
                      </div>

                      <StandingsTable
                        standings={computeLiveStandings(group, groupFixtures, predictions, groupEspnStandings)}
                        allFixtures={allFixtures}
                      />
                    </div>
                  )}

                  {currentTab === 'simulate' && (
                    <div className="group-expanded-layout">
                      <div>
                        <div className="fixture-list">
                          {groupFixtures.map((fixture) => {
                            const prediction = predictions[fixture.fixture_id]
                            const isLoadingPrediction = prediction === 'loading'
                            const isError = prediction === 'error'
                            const hasResult = prediction && prediction !== 'loading' && prediction !== 'error'
                            const isShown = Boolean(prediction)

                            return (
                              <div className="fixture-row" key={fixture.fixture_id}>
                                <div>
                                  <span className="fixture-meta">
                                    {fixture.detail} · {fixture.venue}
                                  </span>
                                  <strong>
                                    <span className="team-name-link" onClick={() => navigate(`/team/${fixture.home_espn_id}`)}>
                                      {fixture.home_team}
                                    </span>
                                    {' vs '}
                                    <span className="team-name-link" onClick={() => navigate(`/team/${fixture.away_espn_id}`)}>
                                      {fixture.away_team}
                                    </span>
                                  </strong>
                                </div>
                                <button
                                  type="button"
                                  disabled={isLoadingPrediction}
                                  onClick={() =>
                                    isShown
                                      ? handleHideFixture(fixture.fixture_id)
                                      : handleSimulateFixture(fixture)
                                  }
                                >
                                  {isLoadingPrediction ? 'Loading…' : isShown ? 'Hide' : 'Simulate'}
                                </button>
                                {isError && <p className="form-note">Prediction failed.</p>}
                                {hasResult && (
                                  <ProbabilityBars
                                    prediction={prediction}
                                    home={{ name: fixture.home_team, code: fixture.home_code }}
                                    away={{ name: fixture.away_team, code: fixture.away_code }}
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
                          onClick={() => handleSimulateGroup(group, groupFixtures)}
                        >
                          {isStandingsLoading
                            ? 'Simulating…'
                            : simStandings[group.id]
                              ? 'Reset simulation'
                              : 'Simulate full group'}
                        </button>
                      </div>

                      {simStandings[group.id] && (
                        <StandingsTable standings={simStandings[group.id]} allFixtures={allFixtures} />
                      )}
                    </div>
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
