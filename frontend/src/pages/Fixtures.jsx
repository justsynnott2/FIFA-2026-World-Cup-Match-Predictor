import { useState, useEffect } from 'react'
import { getLiveFixtures, getUpcomingFixtures, getRecentResults } from '../utils/api'
import { isMatchLive, isMatchCompleted } from '../utils/matchStatus'

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
                    <span className="fixture-card__name">{fixture.home_team}</span>
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
                                    <span className="live-badge">LIVE</span>
                                </div>
                            )
                            : <span className="fixture-card__vs">vs</span>
                    }
                </div>

                {/* Away team */}
                <div className="fixture-card__team fixture-card__team--away">
                    <FormDots form={fixture.away_form} />
                    <span className="fixture-card__name">{fixture.away_team}</span>
                    <img src={fixture.away_logo} alt={fixture.away_team} className="fixture-card__logo" />
                </div>

            </div>
        </article>
    )
}

// Featured match card at the top — shows live match if one is in progress, otherwise next upcoming
function Countdown({ fixture }) {
    const [timeLeft, setTimeLeft] = useState('')
    const isLive = isMatchLive(fixture?.status)

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
                        <span className="live-badge">LIVE</span>
                        <span className="countdown-card__clock">{fixture.status === 'STATUS_HALFTIME' ? 'HT' : (fixture.clock || fixture.detail)}</span>
                    </div>
                    <div className="countdown-card__matchup">
                        <div className="countdown-card__team">
                            <img src={fixture.home_logo} alt={fixture.home_team} className="countdown-card__logo" />
                            <span>{fixture.home_team}</span>
                        </div>
                        <div className="countdown-card__score">
                            {fixture.home_score} – {fixture.away_score}
                        </div>
                        <div className="countdown-card__team countdown-card__team--away">
                            <img src={fixture.away_logo} alt={fixture.away_team} className="countdown-card__logo" />
                            <span>{fixture.away_team}</span>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <span className="eyebrow">Next Fixture</span>
                    <div className="countdown-card__match">
                        <img src={fixture.home_logo} alt={fixture.home_team} className="fixture-card__logo" />
                        <span>{fixture.home_team} vs {fixture.away_team}</span>
                        <img src={fixture.away_logo} alt={fixture.away_team} className="fixture-card__logo" />
                    </div>
                    <div className="countdown-card__timer">{timeLeft}</div>
                    <div className="countdown-card__detail">{fixture.detail}</div>
                </>
            )}
        </div>
    )
}

export default function Fixtures() {
    const [liveFixture, setLiveFixture] = useState(null)
    const [upcomingFixtures, setUpcomingFixtures] = useState([])
    const [recentResults, setRecentResults] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        async function fetchFixtures() {
            try {
                const [live, upcoming, results] = await Promise.all([
                    getLiveFixtures(),
                    getUpcomingFixtures(),
                    getRecentResults(),
                ])
                setLiveFixture(live)
                setUpcomingFixtures(upcoming)
                setRecentResults(results.reverse())
            } catch {
                setError('Failed to load fixtures. Make sure the backend is running.')
            } finally {
                setIsLoading(false)
            }
        }

        fetchFixtures()
    }, [])

    // Poll the live fixture every 60 seconds while a match is in progress
    useEffect(() => {
        if (!liveFixture) return
        const interval = setInterval(async () => {
            const live = await getLiveFixtures()
            setLiveFixture(live)
        }, 60000)
        return () => clearInterval(interval)
    }, [liveFixture !== null])

    if (isLoading) return <section className="page"><p className="empty-state">Loading fixtures...</p></section>
    if (error) return <section className="page"><p className="empty-state">{error}</p></section>

    return (
        <section className="page fixtures-page">

            <div className="section-heading">
                <span className="eyebrow">2026 FIFA World Cup</span>
                <h1>Fixtures & Results</h1>
            </div>

            {/* Featured match — live if in progress, otherwise next upcoming */}
            <Countdown fixture={liveFixture ?? upcomingFixtures[0]} />

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