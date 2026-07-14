import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { predictMatch } from '../utils/api'
import { isMatchLive, isMatchCompleted, STATUS_DELAYED } from '../utils/matchStatus'
import { formatMatchDate, getFixtureLabel } from '../utils/format'
import SegmentedProbabilityBar from './SegmentedProbabilityBar'

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

/**
 * Single fixture card used across Fixtures and TeamPage's "Upcoming"/"Results"
 * lists. Upcoming, predictable fixtures flip on click to reveal a
 * lazily-fetched SegmentedProbabilityBar prediction on the back face. When a
 * team's ESPN id matches currentEspnId (e.g. viewing that team's own page),
 * its name renders as plain text instead of a link back to itself.
 */
export default function FixtureCard({ fixture, currentEspnId }) {
    const navigate = useNavigate()
    const isCompleted = isMatchCompleted(fixture.status)
    const isLive = isMatchLive(fixture.status)
    const isUpcoming = !isCompleted && !isLive
    const isPredictable = !!fixture.home_logo && !!fixture.away_logo
    const homeIsSelf = fixture.home_espn_id === currentEspnId
    const awayIsSelf = fixture.away_espn_id === currentEspnId
    const [isFlipped, setIsFlipped] = useState(false)
    const [prediction, setPrediction] = useState(undefined)

    function handleFlip() {
        if (!isFlipped && prediction === undefined) {
            setPrediction('loading')
            predictMatch(fixture.home_team, fixture.away_team)
                .then(result => setPrediction(result))
                .catch(() => setPrediction('error'))
        }
        setIsFlipped(true)
    }

    const teamsMarkup = (
        <div className="fixture-card__teams">

            {/* Home team */}
            <div className="fixture-card__team">
                {fixture.home_logo && <img src={fixture.home_logo} alt={fixture.home_team} className="fixture-card__logo" />}
                <span
                    className={(!homeIsSelf && fixture.home_logo) ? 'fixture-card__name team-name-link' : 'fixture-card__name'}
                    style={!fixture.home_logo ? { color: 'var(--muted)' } : undefined}
                    onClick={(!homeIsSelf && fixture.home_logo) ? (e) => { e.stopPropagation(); fixture.home_espn_id && navigate(`/team/${fixture.home_espn_id}`) } : undefined}
                >
                    {fixture.home_team}
                </span>
                <FormDots form={fixture.home_form} />
            </div>

            {/* Score, VS, or live score */}
            <div className="fixture-card__score">
                {isCompleted
                    ? <>
                        <strong>{fixture.home_score} – {fixture.away_score}</strong>
                        {/* Penalty shootouts don't change the normal score (still 90/120 min result);
                            the shootout tally comes from separate home/away_shootout_score fields
                            the backend only populates for STATUS_FINAL_PEN, so it's shown as an
                            extra line rather than folded into the main score. */}
                        {fixture.status === 'STATUS_FINAL_PEN' && (
                            <span className="fixture-card__pens">
                                ({fixture.home_shootout_score}–{fixture.away_shootout_score} pens)
                            </span>
                        )}
                      </>
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
                    className={(!awayIsSelf && fixture.away_logo) ? 'fixture-card__name team-name-link' : 'fixture-card__name'}
                    style={!fixture.away_logo ? { color: 'var(--muted)' } : undefined}
                    onClick={(!awayIsSelf && fixture.away_logo) ? (e) => { e.stopPropagation(); fixture.away_espn_id && navigate(`/team/${fixture.away_espn_id}`) } : undefined}
                >
                    {fixture.away_team}
                </span>
                {fixture.away_logo && <img src={fixture.away_logo} alt={fixture.away_team} className="fixture-card__logo" />}
            </div>

        </div>
    )

    const roundLabel = getFixtureLabel(fixture) || null

    const metaMarkup = (
        <div className="fixture-card__meta">
            <span>{formatMatchDate(fixture.date)}</span>
            <span>{fixture.venue}, {fixture.city}</span>
            {roundLabel && <span>{roundLabel}</span>}
        </div>
    )

    if (!isUpcoming || !isPredictable) {
        return (
            <article className="fixture-card">
                {metaMarkup}
                {teamsMarkup}
            </article>
        )
    }

    return (
        <div className={`fixture-card-wrapper${isFlipped ? ' fixture-card-flipped' : ''}`}>
            <div className="fixture-card-flipper">

                {/* Front face */}
                <article className="fixture-card fixture-card__front" onClick={handleFlip}>
                    {metaMarkup}
                    {teamsMarkup}
                </article>

                {/* Back face */}
                <div className="fixture-card fixture-card__back" onClick={() => setIsFlipped(false)}>
                    {prediction === 'loading' && <p className="predict-loading">Fetching…</p>}
                    {prediction && prediction !== 'loading' && prediction !== 'error' && (
                        <SegmentedProbabilityBar
                            prediction={prediction}
                            home={{ name: fixture.home_team, code: fixture.home_code }}
                            away={{ name: fixture.away_team, code: fixture.away_code }}
                        />
                    )}
                    {prediction === 'error' && <p className="predict-loading">Prediction unavailable</p>}
                </div>

            </div>
        </div>
    )
}
