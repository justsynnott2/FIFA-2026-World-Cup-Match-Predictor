import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { predictMatch } from '../utils/api'
import { isMatchLive, isMatchCompleted, STATUS_DELAYED } from '../utils/matchStatus'
import { formatMatchDate, getFixtureLabel } from '../utils/format'
import SegmentedProbabilityBar from './SegmentedProbabilityBar'
import LoadingState from './LoadingState'

// Compares the model's predicted outcome against the actual full-time result
// for a completed, predictable fixture. Uses all three prediction values
// (unlike Overview's final-only verdict, which ignores the draw because a
// final must resolve to a winner) — a group or knockout fixture can
// legitimately have the draw as the model's most likely outcome.
function getVerdict(fixture, prediction) {
    const predictedHome = prediction.home >= prediction.draw && prediction.home >= prediction.away
    const predictedAway = !predictedHome && prediction.away >= prediction.draw
    const predictedOutcome = predictedHome ? 'home' : predictedAway ? 'away' : 'draw'

    // Penalty shootouts are intentionally excluded from this comparison: the
    // model predicts the 90/120-minute result and never predicted shootouts
    // at all, so a knockout tie that went to penalties counts as a correctly
    // predicted draw rather than being scored against the shootout winner.
    const actualOutcome = fixture.home_score > fixture.away_score
        ? 'home'
        : fixture.away_score > fixture.home_score
            ? 'away'
            : 'draw'

    const isMatch = predictedOutcome === actualOutcome
    const result = isMatch ? 'called it' : 'upset'
    return predictedOutcome === 'draw'
        ? `Model predicted a draw, ${result}`
        : `Model predicted a ${predictedOutcome === 'home' ? fixture.home_team : fixture.away_team} win, ${result}`
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

/**
 * Single fixture card used across Fixtures and TeamPage's "Upcoming"/"Results"
 * lists. Upcoming and completed, predictable fixtures expand on click to
 * reveal a lazily-fetched SegmentedProbabilityBar prediction beneath the
 * teams; completed cards additionally show a verdict comparing the
 * prediction to the real result. Live fixtures always render statically,
 * regardless of predictability. When a team's ESPN id matches currentEspnId
 * (e.g. viewing that team's own page), its name renders as plain text
 * instead of a link back to itself.
 */
export default function FixtureCard({ fixture, currentEspnId }) {
    const navigate = useNavigate()
    const isCompleted = isMatchCompleted(fixture.status)
    const isLive = isMatchLive(fixture.status)
    const isPredictable = !!fixture.home_logo && !!fixture.away_logo
    const homeIsSelf = fixture.home_espn_id === currentEspnId
    const awayIsSelf = fixture.away_espn_id === currentEspnId
    const [isExpanded, setIsExpanded] = useState(false)
    const [prediction, setPrediction] = useState(undefined)

    function handleToggle() {
        if (!isExpanded && prediction === undefined) {
            setPrediction('loading')
            predictMatch(fixture.home_team, fixture.away_team)
                .then(result => setPrediction(result))
                .catch(() => setPrediction('error'))
        }
        setIsExpanded(v => !v)
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            if (e.key === ' ') e.preventDefault()
            handleToggle()
        }
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

    if (!isPredictable || isLive) {
        return (
            <article className="fixture-card">
                {metaMarkup}
                {teamsMarkup}
            </article>
        )
    }

    return (
        <article
            className="fixture-card"
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            onClick={handleToggle}
            onKeyDown={handleKeyDown}
        >
            {metaMarkup}
            {teamsMarkup}
            <div className={`fixture-card__reveal${isExpanded ? ' fixture-card__reveal--open' : ''}`}>
                <div className="fixture-card__reveal-inner">
                    {prediction === 'loading' && <LoadingState compact />}
                    {prediction && prediction !== 'loading' && prediction !== 'error' && (
                        <SegmentedProbabilityBar
                            prediction={prediction}
                            home={{ name: fixture.home_team, code: fixture.home_code }}
                            away={{ name: fixture.away_team, code: fixture.away_code }}
                        />
                    )}
                    {isCompleted && prediction && prediction !== 'loading' && prediction !== 'error' && (
                        <p className="fixture-card__verdict">{getVerdict(fixture, prediction)}</p>
                    )}
                    {prediction === 'error' && <p className="predict-loading">Prediction unavailable</p>}
                </div>
            </div>
        </article>
    )
}
