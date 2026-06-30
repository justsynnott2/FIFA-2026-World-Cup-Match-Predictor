import { toModelName } from '../data/tournament'

// Base URL for the FastAPI backend
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

// Predicts win/draw/loss probabilities for a given matchup
export async function predictMatch(homeName, awayName) {
  const response = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      home_team: toModelName(homeName),
      away_team: toModelName(awayName)
    }),
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

// Fetches all 72 group stage fixtures — both completed and upcoming — from ESPN via backend
export async function getAllFixtures() {
  const response = await fetch(`${API_BASE}/schedule/all`)
  if (!response.ok) throw new Error('Failed to fetch all fixtures')
  return response.json()
}

export async function getLiveFixtures() {
  const response = await fetch(`${API_BASE}/schedule/live`)
  if (!response.ok) throw new Error('Failed to fetch live fixtures')
  return response.json()
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

export async function getKnockoutFixtures() {
  const response = await fetch(`${API_BASE}/schedule/knockout`)
  if (!response.ok) throw new Error('Failed to fetch knockout fixtures')
  return response.json()
}

export async function predictKnockout(homeName, awayName) {
  const { home, draw, away } = await predictMatch(homeName, awayName)
  if (home + away === 0) return { home: 50, away: 50 }
  const homeAdj = home + draw * home / (home + away)
  const awayAdj = away + draw * away / (home + away)
  return { home: Math.round(homeAdj), away: Math.round(awayAdj) }
}

export async function getTeamSquad(espnId) {
  const response = await fetch(`${API_BASE}/team/${espnId}/squad`)
  if (!response.ok) throw new Error('Failed to fetch squad')
  return response.json()
}

export async function getTeamNews(espnId) {
  const response = await fetch(`${API_BASE}/team/${espnId}/news`)
  if (!response.ok) throw new Error('Failed to fetch news')
  return response.json()
}

export async function getStandings() {
  const response = await fetch(`${API_BASE}/schedule/standings`)
  if (!response.ok) throw new Error('Failed to fetch standings')
  return response.json()
}