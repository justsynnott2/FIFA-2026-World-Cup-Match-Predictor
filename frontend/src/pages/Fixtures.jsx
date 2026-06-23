import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLiveFixtures, getUpcomingFixtures, getRecentResults } from '../utils/api'
import { isMatchLive, isMatchCompleted, STATUS_DELAYED } from '../utils/matchStatus'

// Converts a UTC ISO date string to a readable local time e.g. "Sat, Jun 13 · 6:00 PM"
function formatMatchDate(isoString) {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    })
}

// Converts a form string e.g. "WWLDD" into colored dot spans
function FormDots({ form }) {
    if (!form) return null
    return (
        <span className="form-dots">
            {form.split('').map((result, index) => (
                <span key={index} className={`form-dot form-dot--${result.toLowerCase()}`}>
                    {result}
                </span>
            ))}
        </span>
    )
}

// Single fixture card used for both upcoming and results
function FixtureCard({ fixture }) {
    const navigate = useNavigate()
    const isCompleted = isMatchCompleted(fixture.status)
    const isLive = isMatchLive(fixture.status)

    return (
        <article className="fixture-card">

            {/* Date, time, and venue */}
            <div className="fixture-card__meta">
                <span>{formatMatchDate(fixture.date)}</span>
                <span>{fixture.venue}, {fixture.city}</span>
            </div>

            {/* Teams and score/form row */}
            <div className="fixture-card__teams">

                {/* Home team */}
                <div className="fixture-card__team">
                    <img src={fixture.home_logo} alt={fixture.home_team} className="fixture-card__logo" />
                    <span
                        className="fixture-card__name team-name-link"
                        onClick={() => fixture.home_espn_id && navigate(`/team/${fixture.home_espn_id}`)}
                    >
                        {fixture.home_team}
                    </span>
                    <FormDots form={fixture.home_form} />
                </div>

                {/* Score, VS, or live score */}
                <div className="fixture-card__score">
                    {isCompleted
                        ? <strong>{fixture.home_score} – {fixture.away_score}</strong>
                        : isLive
                            ? (
                                <div className="fixture-card__live">
                                    <strong>{fixture.home_score} – {fixture.away_score}</strong>
                                    <span className={fixture.status === STATUS_DELAYED ? 'delay-badge' : 'live-badge'}>
                                        {fixture.status === STATUS_DELAYED ? 'DELAY' : 'LIVE'}
                                    </span>
                                </div>
                            )
                            : <span className="fixture-card__vs">vs</span>
                    }
                </div>

                {/* Away team */}
                <div className="fixture-card__team fixture-card__team--away">
                    <FormDots form={fixture.away_form} />
                    <span
                        className="fixture-card__name team-name-link"
                        onClick={() => fixture.away_espn_id && navigate(`/team/${fixture.away_espn_id}`)}
                    >
                        {fixture.away_team}
                    </span>
                    <img src={fixture.away_logo} alt={fixture.away_team} className="fixture-card__logo" />
                </div>

            </div>
        </article>
    )
}

// Featured match card at the top — shows live match if one is in progress, otherwise next upcoming
function Countdown({ fixture, isKnownLive = false }) {
    const navigate = useNavigate()
    const [timeLeft, setTimeLeft] = useState('')
    const isLive = isKnownLive || isMatchLive(fixture?.status)

    useEffect(() => {
        // No countdown needed for live matches
        if (!fixture || isLive) return

        function updateCountdown() {
            const now = new Date()
            const kickoff = new Date(fixture.date)
            const diffMs = kickoff - now

            if (diffMs <= 0) {
                setTimeLeft('Kickoff!')
                return
            }

            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)

            setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`)
        }

        // Update immediately then every second
        updateCountdown()
        const interval = setInterval(updateCountdown, 1000)
        return () => clearInterval(interval)
    }, [fixture, isLive])

    if (!fixture) return null

    return (
        <div className="countdown-card">
            {isLive ? (
                <>
                    <div className="countdown-card__live-header">
                        <span className={fixture.status === STATUS_DELAYED ? 'delay-badge' : 'live-badge'}>
                            {fixture.status === STATUS_DELAYED ? 'DELAY' : 'LIVE'}
                        </span>
                        <span className="countdown-card__clock">{fixture.status === 'STATUS_HALFTIME' ? 'HT' : (fixture.clock || fixture.detail)}</span>
                    </div>
                    <div className="countdown-card__matchup">
                        <div className="countdown-card__team">
                            <img src={fixture.home_logo} alt={fixture.home_team} className="countdown-card__logo" />
                            <span
                                className="team-name-link"
                                onClick={() => fixture.home_espn_id && navigate(`/team/${fixture.home_espn_id}`)}
                            >
                                {fixture.home_team}
                            </span>
                        </div>
                        <div className="countdown-card__score">
                            {fixture.home_score} – {fixture.away_score}
                        </div>
                        <div className="countdown-card__team countdown-card__team--away">
                            <img src={fixture.away_logo} alt={fixture.away_team} className="countdown-card__logo" />
                            <span
                                className="team-name-link"
                                onClick={() => fixture.away_espn_id && navigate(`/team/${fixture.away_espn_id}`)}
                            >
                                {fixture.away_team}
                            </span>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <span className="eyebrow">Next Fixture</span>
                    <div className="countdown-card__match">
                        <img src={fixture.home_logo} alt={fixture.home_team} className="fixture-card__logo" />
                        <span className="team-name-link" onClick={() => fixture.home_espn_id && navigate(`/team/${fixture.home_espn_id}`)}>
                            {fixture.home_team}
                        </span>
                        {' vs '}
                        <span className="team-name-link" onClick={() => fixture.away_espn_id && navigate(`/team/${fixture.away_espn_id}`)}>
                            {fixture.away_team}
                        </span>
                        <img src={fixture.away_logo} alt={fixture.away_team} className="fixture-card__logo" />
                    </div>
                    <div className="countdown-card__timer">{timeLeft}</div>
                    <div className="countdown-card__detail">{fixture.detail}</div>
                </>
            )}
        </div>
    )
}

function computeDelay(live, upcoming) {
    if (live.length > 0) return 30_000
    const next = upcoming[0]
    if (!next) return 300_000
    const msUntilKickoff = new Date(next.date).getTime() - Date.now()
    if (msUntilKickoff <= 0) return 30_000                    // past kickoff, waiting for ESPN to go live
    if (msUntilKickoff <= 30 * 60 * 1000) return 60_000      // within 30 min of kickoff
    return 300_000
}

export default function Fixtures() {
    const [liveFixtures, setLiveFixtures] = useState([])
    const [upcomingFixtures, setUpcomingFixtures] = useState([])
    const [recentResults, setRecentResults] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let timerId

        async function tick() {
            try {
                const [live, upcoming, results] = await Promise.all([
                    getLiveFixtures(),
                    getUpcomingFixtures(),
                    getRecentResults(),
                ])
                setLiveFixtures(live)
                setUpcomingFixtures(upcoming)
                setRecentResults([...results].reverse())
                setIsLoading(false)
                timerId = setTimeout(tick, computeDelay(live, upcoming))
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
                : <Countdown fixture={upcomingFixtures[0]} isKnownLive={false} />
            }

            <div className="fixtures-grid">

                {/* Upcoming fixtures */}
                <div className="fixtures-column">
                    <h2>Upcoming</h2>
                    <div className="fixture-list">
                        {upcomingFixtures.map((fixture) => (
                            <FixtureCard key={fixture.fixture_id} fixture={fixture} />
                        ))}
                    </div>
                </div>

                {/* Recent results */}
                <div className="fixtures-column">
                    <h2>Results</h2>
                    <div className="fixture-list">
                        {recentResults.length === 0
                            ? <p className="empty-state">No results yet.</p>
                            : recentResults.map((fixture) => (
                                <FixtureCard key={fixture.fixture_id} fixture={fixture} />
                            ))
                        }
                    </div>
                </div>

            </div>
        </section>
    )
}