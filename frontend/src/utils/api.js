import { toModelName } from '../data/tournament'
import { isMatchLive } from './matchStatus'

// Thin fetch wrapper around the FastAPI backend. Every function here hits one
// endpoint and returns already-parsed JSON (or throws on a non-OK response).
// Exports: predictMatch, getAllFixtures, getKnockoutFixtures, predictKnockout,
// getTeamSquad, getTeamNews, getStandings.

// Base URL for the FastAPI backend
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

// Dev-only test aid: append ?mockOver (or ?mockOver=pens) to the URL while
// running the Vite dev server to preview the tournament-complete UI without
// waiting for the real final to be played. No effect in production builds,
// and no effect without the query param. Folds "no live fixtures" into this
// same transform (rather than a separate getLiveFixtures call) since every
// page derives live fixtures by filtering getAllFixtures' output. Applied to
// both getAllFixtures and getKnockoutFixtures. Caveat: if used before the
// knockout bracket is seeded, TBD fixtures get force-completed too, so the
// previewed bracket may look odd — acceptable for a dev-only aid.
function mockTournamentOver(fixtures) {
    if (!import.meta.env.DEV) return fixtures
    const params = new URLSearchParams(window.location.search)
    if (!params.has('mockOver')) return fixtures
    const pens = params.get('mockOver') === 'pens'

    return fixtures.map(fixture => {
        const isFinal = fixture.round === 'final'
        const needsCompleting = isFinal || fixture.status === 'STATUS_SCHEDULED' || isMatchLive(fixture.status)
        if (!needsCompleting) return fixture

        if (isFinal && pens) {
            return {
                ...fixture,
                status: 'STATUS_FINAL_PEN',
                home_score: 1,
                away_score: 1,
                home_winner: true,
                away_winner: false,
                home_shootout_score: 4,
                away_shootout_score: 3,
            }
        }
        return {
            ...fixture,
            status: 'STATUS_FULL_TIME',
            home_score: 2,
            away_score: 1,
            home_winner: true,
            away_winner: false,
        }
    })
}

// Largest-remainder rounding: floors each value, then hands the leftover
// (100 minus the sum of the floors) one-by-one to the values with the
// largest fractional part, so the result always sums to exactly 100 instead
// of drifting to 99 or 101 the way independent Math.round calls can.
function roundToHundred(values) {
  const floors = values.map(Math.floor)
  let remainder = 100 - floors.reduce((sum, v) => sum + v, 0)
  const order = values
    .map((v, i) => ({ i, frac: v - floors[i] }))
    .sort((a, b) => b.frac - a.frac)
  const result = [...floors]
  for (const { i } of order) {
    if (remainder <= 0) break
    result[i] += 1
    remainder -= 1
  }
  return result
}

/**
 * Predicts win/draw/loss probabilities for a given matchup.
 * @param {string} homeName - ESPN display name of the home team.
 * @param {string} awayName - ESPN display name of the away team.
 * @returns {Promise<{home: number, draw: number, away: number}>} Percentages (0-100) that always sum to exactly 100 (largest-remainder rounding).
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
  const [home, draw, away] = roundToHundred([
    data.home_win_prob * 100,
    data.draw_prob * 100,
    data.away_win_prob * 100,
  ])
  return { home, draw, away }
}

/** Fetches all 104 World Cup fixtures (group + knockout), merged and sorted by date, from `/schedule/all`. */
export async function getAllFixtures() {
  const response = await fetch(`${API_BASE}/schedule/all`)
  if (!response.ok) throw new Error('Failed to fetch all fixtures')
  const data = await response.json()
  return mockTournamentOver(data)
}

/** Fetches all 32 knockout stage fixtures from `/schedule/knockout`. */
export async function getKnockoutFixtures() {
  const response = await fetch(`${API_BASE}/schedule/knockout`)
  if (!response.ok) throw new Error('Failed to fetch knockout fixtures')
  const data = await response.json()
  return mockTournamentOver(data)
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
  const roundedHome = Math.round(homeAdj)
  return { home: roundedHome, away: 100 - roundedHome }
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