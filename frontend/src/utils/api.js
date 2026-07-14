import { toModelName } from '../data/tournament'

// Thin fetch wrapper around the FastAPI backend. Every function here hits one
// endpoint and returns already-parsed JSON (or throws on a non-OK response).
// Exports: predictMatch, getAllFixtures, getKnockoutFixtures, predictKnockout,
// getTeamSquad, getTeamNews, getStandings.

// Base URL for the FastAPI backend
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

/**
 * Predicts win/draw/loss probabilities for a given matchup.
 * @param {string} homeName - ESPN display name of the home team.
 * @param {string} awayName - ESPN display name of the away team.
 * @returns {Promise<{home: number, draw: number, away: number}>} Percentages (0-100, each rounded independently).
 */
export async function predictMatch(homeName, awayName) {
  const response = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // ESPN's displayName for a team doesn't always match the exact string the
      // model was trained on. toModelName remaps the three known mismatches
      // (Türkiye→Turkey, Bosnia-Herzegovina→Bosnia and Herzegovina,
      // Congo DR→Democratic Republic of Congo, see tournament.js's
      // ESPN_TO_MODEL_NAME) and passes anything else through unchanged.
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

/** Fetches all 104 World Cup fixtures (group + knockout), merged and sorted by date, from `/schedule/all`. */
export async function getAllFixtures() {
  const response = await fetch(`${API_BASE}/schedule/all`)
  if (!response.ok) throw new Error('Failed to fetch all fixtures')
  return response.json()
}

/** Fetches all 32 knockout stage fixtures from `/schedule/knockout`. */
export async function getKnockoutFixtures() {
  const response = await fetch(`${API_BASE}/schedule/knockout`)
  if (!response.ok) throw new Error('Failed to fetch knockout fixtures')
  return response.json()
}

/**
 * Predicts a knockout matchup as a two-way (no-draw) result, for use in the
 * bracket where a draw isn't a valid outcome. The draw probability from
 * predictMatch is redistributed to home/away in proportion to their existing
 * win shares (rather than dropped or split 50/50), so a heavy favorite that's
 * "60% home / 10% draw / 30% away" stays a heavy favorite after the draw is
 * folded in, instead of the draw share arbitrarily boosting the underdog.
 */
export async function predictKnockout(homeName, awayName) {
  const { home, draw, away } = await predictMatch(homeName, awayName)
  if (home + away === 0) return { home: 50, away: 50 }
  const homeAdj = home + draw * home / (home + away)
  const awayAdj = away + draw * away / (home + away)
  return { home: Math.round(homeAdj), away: Math.round(awayAdj) }
}

/** Fetches squad/roster grouped by position for a given ESPN team ID from `/team/{espnId}/squad`. */
export async function getTeamSquad(espnId) {
  const response = await fetch(`${API_BASE}/team/${espnId}/squad`)
  if (!response.ok) throw new Error('Failed to fetch squad')
  return response.json()
}

/** Fetches recent news articles for a given ESPN team ID from `/team/{espnId}/news`. */
export async function getTeamNews(espnId) {
  const response = await fetch(`${API_BASE}/team/${espnId}/news`)
  if (!response.ok) throw new Error('Failed to fetch news')
  return response.json()
}

/** Fetches ESPN group standings from `/schedule/standings`, keyed by group name (e.g. "Group A"). */
export async function getStandings() {
  const response = await fetch(`${API_BASE}/schedule/standings`)
  if (!response.ok) throw new Error('Failed to fetch standings')
  return response.json()
}