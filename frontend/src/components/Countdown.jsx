import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { predictMatch } from '../utils/api'
import { isMatchLive, isMatchCompleted, STATUS_DELAYED } from '../utils/matchStatus'
import SegmentedProbabilityBar from './SegmentedProbabilityBar'

/**
 * Featured match card at the top of the page — shows a live match if one is in
 * progress (with its own live score/clock), otherwise a ticking countdown to
 * the next scheduled kickoff plus a prefetched prediction.
 */
export default function Countdown({ fixture, isKnownLive = false, label = 'Next Fixture' }) {
    const navigate = useNavigate()
    const [timeLeft, setTimeLeft] = useState('')
    const [prediction, setPrediction] = useState(undefined)
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

    useEffect(() => {
        if (!fixture || isLive || isMatchCompleted(fixture.status)) {
            setPrediction(undefined)
            return
        }
        setPrediction('loading')
        predictMatch(fixture.home_team, fixture.away_team)
            .then(result => setPrediction(result))
            .catch(() => setPrediction('error'))
    }, [fixture?.fixture_id, isLive])

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
                    <span className="eyebrow">{label}</span>
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
                    {prediction === 'loading' && (
                        <p className="predict-loading">Fetching prediction…</p>
                    )}
                    {prediction && prediction !== 'loading' && prediction !== 'error' && (
                        <SegmentedProbabilityBar
                            prediction={prediction}
                            home={{ name: fixture.home_team, code: fixture.home_code }}
                            away={{ name: fixture.away_team, code: fixture.away_code }}
                        />
                    )}
                </>
            )}
        </div>
    )
}
