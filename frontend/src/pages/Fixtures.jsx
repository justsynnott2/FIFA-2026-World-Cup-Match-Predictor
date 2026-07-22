import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllFixtures } from '../utils/api'
import { isMatchLive, isMatchCompleted, getFinalFixture, isTournamentOver, getFinalOutcome } from '../utils/matchStatus'
import FixtureCard from '../components/FixtureCard'
import Countdown from '../components/Countdown'
import PaginationControls from '../components/PaginationControls'

// Fixtures & Results page: a live/upcoming countdown card plus paginated
// "Upcoming" and "Results" lists. Owns the app's most active polling loop,
// since it's the page most likely to be open during a live match.
// Default export: Fixtures.

/**
 * Picks how long to wait before the next fixtures poll, in three tiers: fast
 * (30s) while a match is actually live so scores/clock feel near-real-time;
 * medium (60s) once kickoff is within 30 minutes, to catch the transition into
 * "live" promptly without polling at full speed the whole time beforehand;
 * otherwise slow (5 min), since nothing on the page is expected to change and
 * there's no reason to hit the backend/ESPN more often than that.
 */
function computeDelay(live, upcoming) {
    if (live.length > 0) return 30_000
    const next = upcoming[0]
    if (!next) return 300_000
    const msUntilKickoff = new Date(next.date).getTime() - Date.now()
    if (msUntilKickoff <= 0) return 30_000                    // past kickoff, waiting for ESPN to go live
    if (msUntilKickoff <= 30 * 60 * 1000) return 60_000      // within 30 min of kickoff
    return 300_000
}

// Replaces the countdown card once the final has been completed: the
// winning team's logo/name plus how they beat the runner-up. Reuses the
// countdown-card shell/classes — no timer, no prediction fetch.
function ChampionCard({ finalFixture }) {
    const navigate = useNavigate()
    const { winner, runnerUp, isPens, homeShootout, awayShootout } = getFinalOutcome(finalFixture)

    return (
        <div className="countdown-card champion-card">
            <span className="eyebrow">Tournament Complete</span>
            <div className="countdown-card__match">
                <img src={winner.logo} alt={winner.name} className="champion-card__logo" />
                <span
                    className="team-name-link champion-card__name"
                    onClick={() => winner.espnId && navigate(`/team/${winner.espnId}`)}
                >
                    {winner.name}
                </span>
            </div>
            <div className="countdown-card__detail">
                Beat {runnerUp.name} {winner.score}–{runnerUp.score}
                {isPens && (
                    <span className="fixture-card__pens">
                        ({homeShootout}–{awayShootout} pens)
                    </span>
                )}
            </div>
        </div>
    )
}

export default function Fixtures() {
    const PAGE_SIZE = 5
    const [liveFixtures, setLiveFixtures] = useState([])
    const [allFixtures, setAllFixtures] = useState([])
    const [upcomingPage, setUpcomingPage] = useState(0)
    const [resultsPage, setResultsPage] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)

    // Polls via a recursive setTimeout rather than setInterval because the poll
    // interval is dynamic (see computeDelay) and setInterval can't change its
    // own delay. Rescheduling only after the previous fetch resolves also
    // serializes requests — with setInterval on a slow network, a fetch that
    // takes longer than the interval could overlap with the next one firing;
    // setTimeout guarantees at most one fixtures fetch in flight at a time.
    useEffect(() => {
        let timerId

        async function tick() {
            try {
                const all = await getAllFixtures()
                // Live fixtures are derived from the full list rather than fetched
                // from a separate endpoint, so matchStatus.js's allowlist stays the
                // single source of truth for what counts as "live".
                const live = all.filter(f => isMatchLive(f.status))
                const allUpcoming = all
                    .filter(f => f.status === 'STATUS_SCHEDULED')
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                setLiveFixtures(live)
                setAllFixtures(all)
                setIsLoading(false)
                if (!isTournamentOver(all)) {
                    timerId = setTimeout(tick, computeDelay(live, allUpcoming))
                }
            } catch {
                setError('Failed to load fixtures. Make sure the backend is running.')
                setIsLoading(false)
            }
        }

        tick()
        return () => clearTimeout(timerId)
    }, [])

    if (isLoading) return <section className="page"><p className="empty-state">Loading fixtures...</p></section>
    if (error) return <section className="page"><p className="empty-state">{error}</p></section>

    const allUpcoming = allFixtures
        .filter(f => f.status === 'STATUS_SCHEDULED')
        .sort((a, b) => new Date(a.date) - new Date(b.date))

    const allResults = allFixtures
        .filter(f => isMatchCompleted(f.status))
        .sort((a, b) => new Date(b.date) - new Date(a.date))

    const nextKickoffFixtures = allUpcoming.length > 0
        ? allUpcoming.filter(f => f.date.slice(0, 16) === allUpcoming[0].date.slice(0, 16))
        : []

    const upcomingSlice = allUpcoming.slice(upcomingPage * PAGE_SIZE, (upcomingPage + 1) * PAGE_SIZE)
    const resultsSlice  = allResults.slice(resultsPage  * PAGE_SIZE, (resultsPage  + 1) * PAGE_SIZE)
    const isSingleColumn = allUpcoming.length === 0

    return (
        <section className="page fixtures-page">

            <div className="section-heading">
                <span className="eyebrow">2026 FIFA World Cup</span>
                <h1>Fixtures & Results</h1>
            </div>

            {/* Live matches, or next upcoming if none are in progress */}
            {liveFixtures.length > 0
                ? liveFixtures.map((fixture) => (
                    <Countdown key={fixture.fixture_id} fixture={fixture} isKnownLive={true} />
                ))
                : isTournamentOver(allFixtures)
                    ? <ChampionCard finalFixture={getFinalFixture(allFixtures)} />
                    : nextKickoffFixtures.map(fixture => (
                        <Countdown
                            key={fixture.fixture_id}
                            fixture={fixture}
                            isKnownLive={false}
                            label={nextKickoffFixtures.length > 1 ? 'Next Fixtures' : 'Next Fixture'}
                        />
                    ))
            }

            <div className={`fixtures-grid${isSingleColumn ? ' fixtures-grid--single' : ''}`}>

                {/* Upcoming fixtures */}
                {!isSingleColumn && (
                    <div className="fixtures-column">
                        <h2>Upcoming</h2>
                        <div className="fixture-list">
                            {upcomingSlice.map((fixture) => (
                                <FixtureCard key={fixture.fixture_id} fixture={fixture} />
                            ))}
                        </div>
                        <PaginationControls
                            page={upcomingPage}
                            totalItems={allUpcoming.length}
                            pageSize={PAGE_SIZE}
                            setPage={setUpcomingPage}
                            prevLabel="← Prev"
                            nextLabel="Next →"
                        />
                    </div>
                )}

                {/* Recent results */}
                <div className="fixtures-column">
                    <h2>Results</h2>
                    <div className="fixture-list">
                        {resultsSlice.length === 0
                            ? <p className="empty-state">No results yet.</p>
                            : resultsSlice.map((fixture) => (
                                <FixtureCard key={fixture.fixture_id} fixture={fixture} />
                            ))
                        }
                    </div>
                    <PaginationControls
                        page={resultsPage}
                        totalItems={allResults.length}
                        pageSize={PAGE_SIZE}
                        setPage={setResultsPage}
                        prevLabel="← Newer"
                        nextLabel="Older →"
                    />
                </div>

            </div>
        </section>
    )
}