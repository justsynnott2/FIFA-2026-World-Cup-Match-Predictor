import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { groups } from '../data/tournament'
import { predictMatch, getAllFixtures, getStandings } from '../utils/api'
import { computeLiveStandings, computeSimStandings } from '../utils/standings'
import { isMatchLive, isMatchCompleted, STATUS_DELAYED, isTournamentOver } from '../utils/matchStatus'
import SegmentedProbabilityBar from '../components/SegmentedProbabilityBar'

// Group Stage page: a 3-column grid of all 12 groups, each expandable into a
// detail panel with two tabs — "Results" (real fixtures/standings) and
// "Simulate" (model-predicted standings for fixtures not yet played).
// Default export: GroupStage.

function getEspnId(code, fixtures) {
  for (const f of fixtures) {
    if (f.home_code === code) return f.home_espn_id
    if (f.away_code === code) return f.away_espn_id
  }
  return null
}

function getGroupFixtures(group, allFixtures) {
  const groupCodes = new Set(group.teams.map((team) => team.code))
  return allFixtures.filter(
    (fixture) => groupCodes.has(fixture.home_code) && groupCodes.has(fixture.away_code)
  )
}

// True once every fixture in the group has a settled (non-loading, non-error)
// prediction. Drives both the "Reset simulation"/"Simulate remaining
// fixtures" button label and handleSimulateGroup's own reset-vs-simulate
// branch, so the two can't disagree about whether a group is "simulated".
function isGroupFullySimulated(groupFixtures, predictions) {
  return groupFixtures.length > 0 && groupFixtures.every((fixture) => {
    const prediction = predictions[fixture.fixture_id]
    return Boolean(prediction) && prediction !== 'loading' && prediction !== 'error'
  })
}

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

function SimStandingsTable({ standings, allFixtures }) {
  const navigate = useNavigate()
  return (
    <table className="standings-table">
      <thead>
        <tr>
          <th>Team</th>
          <th>Pts</th>
          <th>Win%</th>
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
            <td>{team.points}</td>
            <td>{Math.round(team.probSum * 100)}%</td>
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
  const [standingsLoading, setStandingsLoading] = useState({})

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // One-time initial load: fixtures gate the loading spinner (the page can't
  // render groups without them), while ESPN standings are best-effort and load
  // independently — a standings failure shouldn't block the rest of the page.
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

      getStandings()
        .then(setEspnStandings)
        .catch(() => { })
    }
    fetchInitialData()
  }, [])

  // Separate recurring poll (same dynamic setTimeout pattern as Fixtures.jsx)
  // that only refreshes fixtures — standings aren't re-polled here since
  // ESPN's own standings table updates on a much slower cadence than scores.
  useEffect(() => {
    let timerId

    async function tick() {
      try {
        const fixtures = await getAllFixtures()
        setAllFixtures(fixtures)
        const hasLiveMatch = fixtures.some(f => isMatchLive(f.status))
        if (!isTournamentOver(fixtures)) {
            timerId = setTimeout(tick, hasLiveMatch ? 30_000 : 300_000)
        }
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

  // Toggles a group's "Simulate remaining fixtures" run. On toggle-off, the
  // group's per-fixture predictions are cleared (not just hidden) so the next
  // run re-predicts from scratch rather than reusing stale numbers. Standings
  // aren't tracked here at all — the table derives from `predictions` at
  // render time (see isGroupFullySimulated / activeGroupValidPredictions).
  async function handleSimulateGroup(group, groupFixtures) {
    const isSimulated = isGroupFullySimulated(groupFixtures, predictions)

    if (isSimulated) {
      const groupFixtureIds = new Set(groupFixtures.map(f => f.fixture_id))
      setPredictions((current) => {
        const next = { ...current }
        for (const id of groupFixtureIds) delete next[id]
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
      setPredictions((current) => ({ ...current, ...newPredictions }))
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

  const activeGroup = expandedGroup ? groups.find(g => g.id === expandedGroup) : null
  const activeGroupFixtures = activeGroup ? getGroupFixtures(activeGroup, allFixtures) : []
  const activeCurrentTab = activeGroup ? getActiveTab(activeGroup.id) : 'results'
  const activeIsStandingsLoading = activeGroup ? standingsLoading[activeGroup.id] : false
  const activeGroupEspnStandings = activeGroup
    ? (espnStandings[`Group ${activeGroup.id}`] ?? []).map(e => ({ ...e, code: espnIdToCode[e.espn_id] }))
    : []
  const activeGroupFullySimulated = activeGroup ? isGroupFullySimulated(activeGroupFixtures, predictions) : false
  // Excludes the 'loading'/'error' sentinel strings handleSimulateFixture can
  // leave in `predictions` — computeSimStandings only guards against falsy
  // values, so passing a sentinel straight through would corrupt its math
  // (e.g. 'loading'.home / 100 => NaN).
  const activeGroupValidPredictions = Object.fromEntries(
    Object.entries(predictions).filter(([, p]) => p && p !== 'loading' && p !== 'error')
  )

  return (
    <section className="page">
      <div className="section-heading">
        <span className="eyebrow">Group Stage</span>
        <h1>All 12 groups, fixtures, and projected tables.</h1>
      </div>

      {/* Zone 1: Detail panel */}
      {activeGroup && (
        <div className="group-detail-panel">
          <button
            className="group-detail-panel__close secondary-button"
            type="button"
            onClick={() => setExpandedGroup('')}
          >
            ✕
          </button>

          <div className={`group-expanded-layout${activeCurrentTab === 'simulate' ? ' group-expanded-layout--simulate' : ''}`}>

            {/* Left: group label + standings */}
            <div>
              <h2 className="group-detail-panel__label">Group {activeGroup.id}</h2>
              {activeCurrentTab === 'results' && (
                <StandingsTable
                  standings={computeLiveStandings(activeGroup, activeGroupFixtures, {}, activeGroupEspnStandings)}
                  allFixtures={allFixtures}
                />
              )}
              {activeCurrentTab === 'simulate' && (
                <>
                  <SimStandingsTable
                    standings={computeSimStandings(activeGroup, activeGroupFixtures, activeGroupValidPredictions, activeGroupEspnStandings)}
                    allFixtures={allFixtures}
                  />
                  <button
                    className="wide-button"
                    style={{ marginTop: '1rem' }}
                    type="button"
                    disabled={activeIsStandingsLoading}
                    onClick={() => handleSimulateGroup(activeGroup, activeGroupFixtures)}
                  >
                    {activeIsStandingsLoading
                      ? 'Simulating…'
                      : activeGroupFullySimulated
                        ? 'Reset simulation'
                        : 'Simulate remaining fixtures'}
                  </button>
                </>
              )}
            </div>

            {/* Right: tab switcher + fixture content */}
            <div>
              <div className="group-tabs">
                <button
                  type="button"
                  className={activeCurrentTab === 'results' ? 'active' : 'secondary-button'}
                  onClick={() => setGroupTab(activeGroup.id, 'results')}
                >
                  Results
                </button>
                <button
                  type="button"
                  className={activeCurrentTab === 'simulate' ? 'active' : 'secondary-button'}
                  onClick={() => setGroupTab(activeGroup.id, 'simulate')}
                >
                  Simulate
                </button>
              </div>

              {activeCurrentTab === 'results' && (
                <div className="fixture-list">
                  {activeGroupFixtures.map((fixture) => {
                    const completed = isMatchCompleted(fixture.status)
                    const inProgress = isMatchLive(fixture.status)

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
                              {/* Shootout tally shown separately from the score, same as Fixtures.jsx */}
                              {fixture.status === 'STATUS_FINAL_PEN' && (
                                <span className="fixture-card__pens">
                                  ({fixture.home_shootout_score}–{fixture.away_shootout_score} pens)
                                </span>
                              )}
                              {inProgress && (
                                <span className={fixture.status === STATUS_DELAYED ? 'delay-badge' : 'live-badge'}>
                                  {fixture.status === STATUS_DELAYED ? 'DELAY' : 'LIVE'}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {activeCurrentTab === 'simulate' && (
                <div className="fixture-list">
                  {activeGroupFixtures.map((fixture) => {
                    const prediction = predictions[fixture.fixture_id]
                    const isLoadingPrediction = prediction === 'loading'
                    const isError = prediction === 'error'
                    const hasResult = prediction && prediction !== 'loading' && prediction !== 'error'
                    const isShown = Boolean(prediction)

                    return (
                      <div className="fixture-row" key={fixture.fixture_id}>
                        {!hasResult && (
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
                        )}
                        {hasResult && (
                          <SegmentedProbabilityBar
                            prediction={prediction}
                            home={{ name: fixture.home_team, code: fixture.home_code }}
                            away={{ name: fixture.away_team, code: fixture.away_code }}
                          />
                        )}
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
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Zone 2: 3-column group grid */}
      <div className="group-grid">
        {groups.map((group) => (
          <article
            className={`group-card${expandedGroup === group.id ? ' group-card--active' : ''}`}
            key={group.id}
          >
            <button
              className="group-summary"
              type="button"
              onClick={() => setExpandedGroup(expandedGroup === group.id ? '' : group.id)}
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
          </article>
        ))}
      </div>
    </section>
  )
}
