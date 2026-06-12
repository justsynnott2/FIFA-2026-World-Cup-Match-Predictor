// Base URL for the FastAPI backend
const API_BASE = 'http://localhost:8000'

// Predicts win/draw/loss probabilities for a given matchup
export async function predictMatch(homeName, awayName) {
  const response = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ home_team: homeName, away_team: awayName }),
  })
  if (!response.ok) throw new Error('Prediction request failed')
  const data = await response.json()
  if (data.message) throw new Error(data.message)
  return {
    home: Math.round(data.home_win_prob * 100),
    draw: Math.round(data.draw_prob * 100),
    away: Math.round(data.away_win_prob * 100),
  }
}

// Fetches the next 10 scheduled group stage fixtures from ESPN via backend
export async function getUpcomingFixtures() {
  const response = await fetch(`${API_BASE}/schedule/upcoming`)
  if (!response.ok) throw new Error('Failed to fetch upcoming fixtures')
  return response.json()
}

// Fetches the last 10 completed group stage fixtures with scores from ESPN via backend
export async function getRecentResults() {
  const response = await fetch(`${API_BASE}/schedule/results`)
  if (!response.ok) throw new Error('Failed to fetch recent results')
  return response.json()
}