export async function predictMatch(homeName, awayName) {
  const res = await fetch('http://localhost:8000/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ home_team: homeName, away_team: awayName }),
  })
  if (!res.ok) throw new Error('Prediction request failed')
  const data = await res.json()
  if (data.message) throw new Error(data.message)
  return {
    home: Math.round(data.home_win_prob * 100),
    draw: Math.round(data.draw_prob * 100),
    away: Math.round(data.away_win_prob * 100),
  }
}
