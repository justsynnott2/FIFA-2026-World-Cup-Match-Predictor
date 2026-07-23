import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllFixtures } from '../utils/api'
import { isMatchLive, isMatchCompleted, getFinalFixture, isTournamentOver, getFinalOutcome } from '../utils/matchStatus'
import FixtureCard from '../components/FixtureCard'
import Countdown from '../components/Countdown'
import PaginationControls from '../components/PaginationControls'
import LoadingState from '../components/LoadingState'
import { getChampionSummary } from '../utils/bracket'

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

// How far outside the card's own edge the outline beam sits — the single
// source of truth shared by the SVG's sizing, its positioning, and the path
// geometry below, so the three stay in agreement.
const CHAMPION_OUTLINE_OFFSET = 4

// Traces a rounded rect clockwise, inset from the SVG's own box by half the
// halo's (the wider of the two strokes) width so neither stroke gets clipped
// at the SVG's boundary — pathLength is only reliably honored on <path>, not
// on basic shapes like <rect>, so the outline beam is drawn explicitly
// rather than as a <rect>.
function buildChampionOutlinePath(width, height) {
    const strokeInset = 2 // half of the halo's 4px stroke width
    const radius = 8 + CHAMPION_OUTLINE_OFFSET // card's own 0.5rem (8px) radius, offset outward
    const w = width + CHAMPION_OUTLINE_OFFSET * 2
    const h = height + CHAMPION_OUTLINE_OFFSET * 2
    const left = strokeInset
    const top = strokeInset
    const right = w - strokeInset
    const bottom = h - strokeInset

    return `M ${left + radius},${top} L ${right - radius},${top} A ${radius},${radius} 0 0 1 ${right},${top + radius} ` +
        `L ${right},${bottom - radius} A ${radius},${radius} 0 0 1 ${right - radius},${bottom} ` +
        `L ${left + radius},${bottom} A ${radius},${radius} 0 0 1 ${left},${bottom - radius} ` +
        `L ${left},${top + radius} A ${radius},${radius} 0 0 1 ${left + radius},${top} Z`
}

// Replaces the countdown card once the final has been completed: the
// champion's logo/name, a faint logo watermark, their whole-tournament
// totals (played/won/goals), and their ordered knockout road to the final.
// Reuses the countdown-card shell/classes — no timer, no prediction fetch.
function ChampionCard({ finalFixture, allFixtures }) {
    const navigate = useNavigate()
    const cardRef = useRef(null)
    const [cardSize, setCardSize] = useState({ width: 0, height: 0 })
    const { winner, runnerUp, isPens, homeShootout, awayShootout } = getFinalOutcome(finalFixture)
    const { played, won, goals, run } = getChampionSummary(allFixtures, winner.espnId)

    // Measures the card itself (not the wrapper) so the outline SVG can be
    // sized 1:1 with real pixels instead of stretched across a fixed viewBox.
    useEffect(() => {
        const card = cardRef.current
        if (!card) return

        const observer = new ResizeObserver(([entry]) => {
            const { inlineSize: width, blockSize: height } = entry.borderBoxSize[0]
            setCardSize({ width, height })
        })
        observer.observe(card)
        return () => observer.disconnect()
    }, [])

    const svgWidth = cardSize.width + CHAMPION_OUTLINE_OFFSET * 2
    const svgHeight = cardSize.height + CHAMPION_OUTLINE_OFFSET * 2
    const hasMeasured = cardSize.width > 0 && cardSize.height > 0
    const outlinePath = hasMeasured ? buildChampionOutlinePath(cardSize.width, cardSize.height) : null

    return (
        <div className="champion-card-wrap">
            {hasMeasured && (
                <svg
                    className="champion-outline"
                    aria-hidden="true"
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    style={{
                        width: svgWidth,
                        height: svgHeight,
                        top: -CHAMPION_OUTLINE_OFFSET,
                        left: -CHAMPION_OUTLINE_OFFSET,
                    }}
                >
                    <path className="champion-outline__halo" d={outlinePath} pathLength="100" />
                    <path className="champion-outline__stroke" d={outlinePath} pathLength="100" />
                    <path className="champion-outline__halo champion-outline--offset" d={outlinePath} pathLength="100" />
                    <path className="champion-outline__stroke champion-outline--offset" d={outlinePath} pathLength="100" />
                </svg>
            )}

            <div ref={cardRef} className="countdown-card champion-card">
                <img src="/logo.png" alt="" aria-hidden="true" className="champion-watermark" />

                <span className="eyebrow">World Champions</span>

                <div className="champion-hero">
                    <img src={winner.logo} alt={winner.name} className="champion-card__logo" />
                    <span
                        className="team-name-link champion-card__name"
                        onClick={() => winner.espnId && navigate(`/team/${winner.espnId}`)}
                    >
                        {winner.name}
                    </span>
                    <p className="champion-hero__beat">
                        Beat <strong>{runnerUp.name}</strong> {winner.score}–{runnerUp.score}
                        {isPens && (
                            <span className="fixture-card__pens">
                                ({homeShootout}–{awayShootout} pens)
                            </span>
                        )}
                    </p>
                </div>

                <div className="champion-totals">
                    <div>
                        <span className="champion-totals__figure">{played}</span>
                        <span className="champion-totals__caption">Played</span>
                    </div>
                    <div>
                        <span className="champion-totals__figure">{won}</span>
                        <span className="champion-totals__caption">Won</span>
                    </div>
                    <div>
                        <span className="champion-totals__figure">{goals}</span>
                        <span className="champion-totals__caption">Goals</span>
                    </div>
                </div>

                {run.length > 0 && (
                    <div className="champion-road">
                        <h3 className="champion-road__heading">Road to the Final</h3>
                        {run.map((leg) => (
                            <div
                                key={leg.round}
                                className={`champion-road__leg${leg.round === 'final' ? ' champion-road__leg--final' : ''}`}
                            >
                                <span className="champion-road__round">{leg.label}</span>
                                <span className="champion-road__opponent">{leg.opponent}</span>
                                <span className="champion-road__score">
                                    {leg.teamScore}–{leg.opponentScore}
                                    {leg.isPens && (
                                        <span className="fixture-card__pens">
                                            ({leg.teamShootout}–{leg.opponentShootout} pens)
                                        </span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
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

    if (isLoading) return <section className="page"><LoadingState label="Loading fixtures…" /></section>
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
                    ? <ChampionCard finalFixture={getFinalFixture(allFixtures)} allFixtures={allFixtures} />
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
                    />
                </div>

            </div>
        </section>
    )
}