import { allTeams } from '../data/tournament'
import { mockPrediction } from '../utils/prediction'
import TeamBadge from '../components/TeamBadge'
import ProbabilityBars from '../components/ProbabilityBars'

export default function Overview({ onNavigate }) {
  const sample = mockPrediction(allTeams[0], allTeams[8])

  return (
    <section className="page overview-page">

      <div className="hero-panel">

        <div className="hero-copy">
          <span className="eyebrow">2026 FIFA World Cup</span>
          <h1>Match prediction lab for every fixture in North America.</h1>
          <p>
            Explore model-backed win, draw, and loss probabilities across the group stage,
            bracket path, and any custom matchup from the 48-team field.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => onNavigate('Custom Match')}>Try a custom match</button>
            <button type="button" className="secondary-button" onClick={() => onNavigate('Group Stage')}>
              Browse groups
            </button>
          </div>
        </div>
        
        <div className="prediction-card hero-card">
          <div className="card-header">
            <span>Sample prediction</span>
            <strong>Model preview</strong>
          </div>
          <div className="match-title">
            <TeamBadge team={allTeams[0]} />
            <span>vs</span>
            <TeamBadge team={allTeams[8]} />
          </div>
          <ProbabilityBars prediction={sample} home={allTeams[0]} away={allTeams[8]} />
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
          <h2>How to use it</h2>
          <p>
            Start with a group, inspect the six fixtures, simulate individual matches, then
            compare the same teams in the custom match tab.
          </p>
        </article>
      </div>
    </section>
  )
}
