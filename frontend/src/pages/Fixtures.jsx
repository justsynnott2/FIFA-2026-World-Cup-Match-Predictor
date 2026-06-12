import { useState, useEffect } from 'react'
import { getUpcomingFixtures, getRecentResults } from '../utils/api'

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
    const isCompleted = fixture.status === 'STATUS_FULL_TIME'

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

                {/* Score or VS */}
                <div className="fixture-card__score">
                    {isCompleted
                        ? <strong>{fixture.home_score} – {fixture.away_score}</strong>
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

// Countdown timer to the next fixture
function Countdown({ nextFixture }) {
    const [timeLeft, setTimeLeft] = useState('')

    useEffect(() => {
        if (!nextFixture) return

        function updateCountdown() {
            const now = new Date()
            const kickoff = new Date(nextFixture.date)
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
    }, [nextFixture])

    if (!nextFixture) return null

    return (
        <div className="countdown-card">
            <span className="eyebrow">Next fixture</span>
            <div className="countdown-card__match">
                <img src={nextFixture.home_logo} alt={nextFixture.home_team} className="fixture-card__logo" />
                <span>{nextFixture.home_team} vs {nextFixture.away_team}</span>
                <img src={nextFixture.away_logo} alt={nextFixture.away_team} className="fixture-card__logo" />
            </div>
            <div className="countdown-card__timer">{timeLeft}</div>
            <div className="countdown-card__detail">{nextFixture.detail}</div>
        </div>
    )
}

export default function Fixtures() {
    const [upcomingFixtures, setUpcomingFixtures] = useState([])
    const [recentResults, setRecentResults] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        async function fetchFixtures() {
            try {
                // Fetch both in parallel
                const [upcoming, results] = await Promise.all([
                    getUpcomingFixtures(),
                    getRecentResults(),
                ])
                setUpcomingFixtures(upcoming)
                setRecentResults(results)
            } catch (err) {
                setError('Failed to load fixtures. Make sure the backend is running.')
            } finally {
                setIsLoading(false)
            }
        }

        fetchFixtures()
    }, [])

    if (isLoading) return <section className="page"><p className="empty-state">Loading fixtures...</p></section>
    if (error) return <section className="page"><p className="empty-state">{error}</p></section>

    return (
        <section className="page fixtures-page">

            <div className="section-heading">
                <span className="eyebrow">2026 FIFA World Cup</span>
                <h1>Fixtures & Results</h1>
            </div>

            {/* Countdown to next match */}
            <Countdown nextFixture={upcomingFixtures[0]} />

            <div className="fixtures-grid">

                {/* Upcoming fixtures */}
                <div className="fixtures-column">
                    <h2>Upcoming</h2>
                    <div className="fixture-list">
                        {upcomingFixtures.map(fixture => (
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
                            : recentResults.map(fixture => (
                                <FixtureCard key={fixture.fixture_id} fixture={fixture} />
                            ))
                        }
                    </div>
                </div>

            </div>
        </section>
    )
}