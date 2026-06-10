import { useMemo, useState } from 'react'
import { allTeams } from '../data/tournament'
import { predictMatch } from '../utils/api'
import TeamBadge from '../components/TeamBadge'
import ProbabilityBars from '../components/ProbabilityBars'

export default function CustomMatch() {
  const [homeCode, setHomeCode] = useState('USA')
  const [awayCode, setAwayCode] = useState('BRA')
  const [prediction, setPrediction] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const home = useMemo(() => allTeams.find((team) => team.code === homeCode), [homeCode])
  const away = useMemo(() => allTeams.find((team) => team.code === awayCode), [awayCode])

  async function handlePredict() {
    setLoading(true)
    setError(null)
    try {
      const result = await predictMatch(home.name, away.name)
      setPrediction(result)
    } catch (err) {
      setError('Prediction failed. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="page custom-page">
      <div className="section-heading">
        <span className="eyebrow">Custom Match</span>
        <h1>Pick any two World Cup teams.</h1>
      </div>
      <div className="custom-layout">
        <div className="selector-panel">
          <label>
            Team A
            <select value={homeCode} onChange={(event) => setHomeCode(event.target.value)}>
              {allTeams.map((team) => (
                <option value={team.code} key={team.code}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Team B
            <select value={awayCode} onChange={(event) => setAwayCode(event.target.value)}>
              {allTeams.map((team) => (
                <option value={team.code} key={team.code}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={homeCode === awayCode || loading}
            onClick={handlePredict}
          >
            {loading ? 'Predicting…' : 'Predict'}
          </button>
          {homeCode === awayCode && <p className="form-note">Choose two different teams.</p>}
          {error && <p className="form-note">{error}</p>}
        </div>
        <div className="prediction-card">
          <div className="card-header">
            <span>Prediction output</span>
            <strong>{prediction ? 'Model result' : 'Ready'}</strong>
          </div>
          <div className="match-title">
            <TeamBadge team={home} />
            <span>vs</span>
            <TeamBadge team={away} />
          </div>
          {prediction ? (
            <ProbabilityBars prediction={prediction} home={home} away={away} />
          ) : (
            <p className="empty-state">Select teams and run the predictor to reveal probability bars.</p>
          )}
        </div>
      </div>
    </section>
  )
}
