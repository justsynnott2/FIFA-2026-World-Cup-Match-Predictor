import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { groups } from '../data/tournament'
import { predictMatch, getAllFixtures } from '../utils/api'
import { computeLiveStandings, computeSimStandings } from '../utils/standings'
import { isMatchLive, isMatchCompleted } from '../utils/matchStatus'
import ProbabilityBars from '../components/ProbabilityBars'

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
          <th>Pts</th>
          <th>Win Prob</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((team, index) => (
          <tr key={team.code}>
            <td>
              <span
                className="team-name-link"
                onClick={() => navigate(`/team/${getEspnId(team.code, allFixtures)}`)}
              >
                {team.name}
              </span>
            </td>
            <td>{team.points}</td>
            <td>{team.probSum}%</td>
            <td>
              {index < 2
                ? 'Advances'
                : index === 2
                  ? 'Third-place watch'
                  : 'At risk'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function GroupStage() {
  const navigate = useNavigate()
  const [expandedGroup, setExpandedGroup] = useState('')  // Which group card is expanded
  const [activeTab, setActiveTab] = useState({})  // 'results' or 'simulate' per group
  const [allFixtures, setAllFixtures] = useState([])  // All 72 ESPN fixtures fetched on mount
  const [predictions, setPredictions] = useState({}) // fixture_id → { home, draw, away } for any simulated fixtures
  const [liveStandings, setLiveStandings] = useState({})  // group.id → standings array for live tab
  const [simStandings, setSimStandings] = useState({}) // group.id → standings array for simulate tab
  const [standingsLoading, setStandingsLoading] = useState({})  // group.id → boolean for standings loading state

  // Initial fetch loading state
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch all fixtures on mount
  useEffect(() => {
    async function fetchFixtures() {
      try {
        const fixtures = await getAllFixtures()
        setAllFixtures(fixtures)
      } catch {
        setError('Failed to load fixtures. Make sure the backend is running.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchFixtures()
  }, [])

  // Get the active tab for a group, defaulting to 'results'
  function getActiveTab(groupId) {
    return activeTab[groupId] ?? 'results'
  }

  function setGroupTab(groupId, tab) {
    setActiveTab((current) => ({ ...current, [groupId]: tab }))
  }

  // Simulate a single fixture and update predictions
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

  // Simulate remaining non-completed fixtures for a group and compute live standings
  async function handleSimulateRemaining(group, groupFixtures) {
    setStandingsLoading((current) => ({ ...current, [group.id]: true }))
    try {
      const nonCompleted = groupFixtures.filter((fixture) => !isMatchCompleted(fixture.status))
      const results = await Promise.all(
        nonCompleted.map((fixture) => predictMatch(fixture.home_team, fixture.away_team))
      )
      const newPredictions = Object.fromEntries(
        nonCompleted.map((fixture, i) => [fixture.fixture_id, results[i]])
      )
      const mergedPredictions = { ...predictions, ...newPredictions }
      setPredictions(mergedPredictions)
      setLiveStandings((current) => ({
        ...current,
        [group.id]: computeLiveStandings(group, groupFixtures, mergedPredictions),
      }))
    } catch {
      // silently fail — standings just won't update
    } finally {
      setStandingsLoading((current) => ({ ...current, [group.id]: false }))
    }
  }

  // Simulate all 6 fixtures for a group and compute sim standings
  async function handleSimulateGroup(group, groupFixtures) {
    const isSimulated = Boolean(simStandings[group.id])

    // If already simulated, reset
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
        [group.id]: computeSimStandings(group, groupFixtures, mergedPredictions),
      }))
    } catch {
      // silently fail
    } finally {
      setStandingsLoading((current) => ({ ...current, [group.id]: false }))
    }
  }

  if (isLoading) return <section className="page"><p className="empty-state">Loading fixtures...</p></section>
  if (error) return <section className="page"><p className="empty-state">{error}</p></section>

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

          return (
            <article className={`group-card ${isExpanded ? 'expanded' : ''}`} key={group.id}>

              {/* Group header — click to expand/collapse */}
              <button
                className="group-summary"
                type="button"
                onClick={() => setExpandedGroup(isExpanded ? '' : group.id)}
              >
                <span>Group {group.id}</span>
                <strong>{group.teams.map((team) => team.code).join(' / ')}</strong>
              </button>

              {/* Team list always visible */}
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

                  {/* Inner tab switcher */}
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

                  {/* Results tab */}
                  {currentTab === 'results' && (
                    <>
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
                                {/* Use ESPN detail string for correct date/time */}
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
                                {/* Show real score for completed and in progress matches */}
                                {(completed || inProgress) && (
                                  <span className="real-score">
                                    {fixture.home_score} – {fixture.away_score}
                                    {inProgress && <span className="live-badge">LIVE</span>}
                                  </span>
                                )}
                              </div>

                              {/* No sim button for completed matches in results tab */}
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

                      {/* Simulate remaining button — only show if there are non-completed fixtures */}
                      {groupFixtures.some((f) => !isMatchCompleted(f.status)) && (
                        <button
                          className="wide-button"
                          type="button"
                          disabled={isStandingsLoading}
                          onClick={() => handleSimulateRemaining(group, groupFixtures)}
                        >
                          {isStandingsLoading ? 'Simulating…' : 'Simulate remaining & project standings'}
                        </button>
                      )}

                      {/* Live standings — show if any fixture is completed or remaining have been simmed */}
                      {liveStandings[group.id] && (
                        <StandingsTable standings={liveStandings[group.id]} allFixtures={allFixtures} />
                      )}

                      {/* If all fixtures are completed, show real standings automatically */}
                      {groupFixtures.every((f) => isMatchCompleted(f.status)) && !liveStandings[group.id] && (
                        <StandingsTable
                          standings={computeLiveStandings(group, groupFixtures, {})}
                          allFixtures={allFixtures}
                        />
                      )}
                    </>
                  )}

                  {/* Simulate tab */}
                  {currentTab === 'simulate' && (
                    <>
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

                      {simStandings[group.id] && (
                        <StandingsTable standings={simStandings[group.id]} allFixtures={allFixtures} />
                      )}
                    </>
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