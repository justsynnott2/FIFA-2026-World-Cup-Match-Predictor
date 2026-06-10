export const contenderCodes = ['ARG', 'BRA', 'FRA', 'ESP', 'ENG', 'POR', 'GER', 'NED']

export function hashValue(value) {
  return [...value].reduce((total, char) => total + char.charCodeAt(0), 0)
}

export function mockPrediction(home, away) {
  const homeSeed = hashValue(home.code)
  const awaySeed = hashValue(away.code)
  const favoriteBoost = contenderCodes.includes(home.code) ? 16 : 0
  const awayBoost = contenderCodes.includes(away.code) ? 16 : 0
  const rawHome = 32 + (homeSeed % 18) + favoriteBoost
  const rawAway = 30 + (awaySeed % 18) + awayBoost
  const rawDraw = 22 + ((homeSeed + awaySeed) % 12)
  const total = rawHome + rawAway + rawDraw

  return {
    home: Math.round((rawHome / total) * 100),
    draw: Math.round((rawDraw / total) * 100),
    away: Math.max(1, 100 - Math.round((rawHome / total) * 100) - Math.round((rawDraw / total) * 100)),
  }
}
