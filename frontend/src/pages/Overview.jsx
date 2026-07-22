import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllFixtures, predictMatch } from '../utils/api'
import { getFinalFixture, getFinalOutcome } from '../utils/matchStatus'
import SegmentedProbabilityBar from '../components/SegmentedProbabilityBar'

// Landing page: intro copy plus a hero card showing how the real final
// finished alongside the model's read on that exact matchup — ties together
// the two things the app does (predict any matchup, track the real
// tournament through to its champion).
// Default export: Overview.

export default function Overview() {
  const navigate = useNavigate()
  const [final, setFinal] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [prediction, setPrediction] = useState(null)

  useEffect(() => {
    getAllFixtures()
      .then((all) => {
        const finalFixture = getFinalFixture(all)
        if (!finalFixture) return
        setFinal(finalFixture)
        setOutcome(getFinalOutcome(finalFixture))
        return predictMatch(finalFixture.home_team, finalFixture.away_team).then(setPrediction)
      })
      // Silently fail — this is a decorative hero, not something the user
      // asked for, so if the backend is down the card just stays in its
      // loading state rather than surfacing an error to the landing page.
      .catch(() => { })
  }, [])

  const isReady = final && outcome && prediction

  let favoredSide, favoredTeamName, verdict
  if (isReady) {
    favoredSide = prediction.home >= prediction.away ? 'home' : 'away'
    favoredTeamName = favoredSide === 'home' ? final.home_team : final.away_team
    verdict = (favoredSide === 'home') === outcome.homeWon ? 'called it' : 'upset'
  }

  return (
    <section className="page overview-page">

      <div className="hero-panel">

        <div className="hero-copy">
          <span className="eyebrow">2026 FIFA World Cup</span>
          <h1>A prediction model for every fixture, and the tournament it called.</h1>
          <p>
            Explore model-backed win, draw, and loss probabilities for any of the 48 teams,
            and see how the real tournament played out — tracked live from kickoff through
            the final.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => navigate('/custom')}>Try a custom match</button>
            <button type="button" className="secondary-button" onClick={() => navigate('/groups')}>
              Browse groups
            </button>
          </div>
        </div>

        <div className="prediction-card hero-card">
          <div className="card-header">
            <span>Tournament complete</span>
            <strong>Final · model call</strong>
          </div>

          {isReady ? (
            <>
              <div className="final-result">
                <div className={`final-result__side${outcome.homeWon ? ' final-result__side--champion' : ''}`}>
                  <img src={final.home_logo} alt={final.home_team} className="final-result__logo" />
                  {final.home_espn_id ? (
                    <span
                      className="team-name-link final-result__name"
                      onClick={() => navigate(`/team/${final.home_espn_id}`)}
                    >
                      {final.home_team}
                    </span>
                  ) : (
                    <span className="final-result__name">{final.home_team}</span>
                  )}
                  {outcome.homeWon && <span className="final-result__kicker">Champion</span>}
                </div>

                <div className="final-result__score">
                  <strong>{final.home_score}–{final.away_score}</strong>
                  <span>{outcome.isPens ? `${outcome.homeShootout}–${outcome.awayShootout} pens` : 'FT'}</span>
                </div>

                <div className={`final-result__side${!outcome.homeWon ? ' final-result__side--champion' : ''}`}>
                  <img src={final.away_logo} alt={final.away_team} className="final-result__logo" />
                  {final.away_espn_id ? (
                    <span
                      className="team-name-link final-result__name"
                      onClick={() => navigate(`/team/${final.away_espn_id}`)}
                    >
                      {final.away_team}
                    </span>
                  ) : (
                    <span className="final-result__name">{final.away_team}</span>
                  )}
                  {!outcome.homeWon && <span className="final-result__kicker">Champion</span>}
                </div>
              </div>

              <p className="final-result__summary">
                <span
                  className="team-name-link"
                  onClick={() => outcome.winner.espnId && navigate(`/team/${outcome.winner.espnId}`)}
                >
                  {outcome.winner.name}
                </span>
                {' '}beat{' '}
                {outcome.runnerUp.espnId ? (
                  <span
                    className="team-name-link"
                    onClick={() => navigate(`/team/${outcome.runnerUp.espnId}`)}
                  >
                    {outcome.runnerUp.name}
                  </span>
                ) : (
                  outcome.runnerUp.name
                )}
                {' '}{outcome.winner.score}–{outcome.runnerUp.score}
                {outcome.isPens ? ' on penalties' : ''}
              </p>

              <div className="model-call">
                <span className="model-call__label">What the model predicted</span>
                <SegmentedProbabilityBar
                  prediction={prediction}
                  home={{ name: final.home_team }}
                  away={{ name: final.away_team }}
                />
                <div className="model-call__verdict">
                  <span className="model-call__verdict-tag">{verdict === 'called it' ? '✓' : '!'}</span>
                  Model favored {favoredTeamName}, {verdict}
                </div>
              </div>
            </>
          ) : (
            <p className="empty-state">Loading the final result...</p>
          )}
        </div>

      </div>

      <div className="stat-grid">
        <article>
          <span>Accuracy</span>
          <strong>57%</strong>
          <p>Comparable with public tournament forecasting baselines.</p>
        </article>
        <article>
          <span>Features</span>
          <strong>15</strong>
          <p>Recent form, goals, Elo, confederation, head-to-head, and host context.</p>
        </article>
        <article>
          <span>Field</span>
          <strong>48</strong>
          <p>All qualified World Cup teams grouped into the new 12-group format.</p>
        </article>
      </div>

      <div className="info-grid">
        <article>
          <h2>What the model does</h2>
          <p>
            The backend estimates three outcomes for a selected match: home team win, draw,
            or away team win. Neutral-site matches are averaged in both directions to reduce
            home/away bias.
          </p>
        </article>
        <article>
          <h2>How it was built</h2>
          <p>
            The feature set combines international results, Elo ratings, recent form, goal
            averages, head-to-head history, tournament weight, and confederation encodings.
          </p>
        </article>
        <article>
          <h2>How it tracked the tournament</h2>
          <p>
            Real ESPN results were followed from kickoff through the final, with group
            standings and the bracket updating automatically as matches completed.
          </p>
        </article>
      </div>
    </section>
  )
}
