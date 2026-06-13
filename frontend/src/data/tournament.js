// Group structure for the 2026 World Cup - 12 groups of 4 teams
// This is the source of truth for group membership and team metadata
// Dates, venues, and scores all come from ESPN via the backend
export const groups = [
  {
    id: 'A',
    teams: [
      { name: 'Mexico', code: 'MEX', confederation: 'CONCACAF' },
      { name: 'South Africa', code: 'RSA', confederation: 'CAF' },
      { name: 'Korea Republic', code: 'KOR', confederation: 'AFC' },
      { name: 'Czechia', code: 'CZE', confederation: 'UEFA' },
    ],
  },
  {
    id: 'B',
    teams: [
      { name: 'Canada', code: 'CAN', confederation: 'CONCACAF' },
      { name: 'Bosnia and Herzegovina', code: 'BIH', confederation: 'UEFA' },
      { name: 'Qatar', code: 'QAT', confederation: 'AFC' },
      { name: 'Switzerland', code: 'SUI', confederation: 'UEFA' },
    ],
  },
  {
    id: 'C',
    teams: [
      { name: 'Brazil', code: 'BRA', confederation: 'CONMEBOL' },
      { name: 'Morocco', code: 'MAR', confederation: 'CAF' },
      { name: 'Haiti', code: 'HAI', confederation: 'CONCACAF' },
      { name: 'Scotland', code: 'SCO', confederation: 'UEFA' },
    ],
  },
  {
    id: 'D',
    teams: [
      { name: 'United States', code: 'USA', confederation: 'CONCACAF' },
      { name: 'Paraguay', code: 'PAR', confederation: 'CONMEBOL' },
      { name: 'Australia', code: 'AUS', confederation: 'AFC' },
      { name: 'Turkiye', code: 'TUR', confederation: 'UEFA' },
    ],
  },
  {
    id: 'E',
    teams: [
      { name: 'Germany', code: 'GER', confederation: 'UEFA' },
      { name: 'Curaçao', code: 'CUW', confederation: 'CONCACAF' },
      { name: 'Ivory Coast', code: 'CIV', confederation: 'CAF' },
      { name: 'Ecuador', code: 'ECU', confederation: 'CONMEBOL' },
    ],
  },
  {
    id: 'F',
    teams: [
      { name: 'Netherlands', code: 'NED', confederation: 'UEFA' },
      { name: 'Japan', code: 'JPN', confederation: 'AFC' },
      { name: 'Sweden', code: 'SWE', confederation: 'UEFA' },
      { name: 'Tunisia', code: 'TUN', confederation: 'CAF' },
    ],
  },
  {
    id: 'G',
    teams: [
      { name: 'Belgium', code: 'BEL', confederation: 'UEFA' },
      { name: 'Egypt', code: 'EGY', confederation: 'CAF' },
      { name: 'Iran', code: 'IRN', confederation: 'AFC' },
      { name: 'New Zealand', code: 'NZL', confederation: 'OFC' },
    ],
  },
  {
    id: 'H',
    teams: [
      { name: 'Spain', code: 'ESP', confederation: 'UEFA' },
      { name: 'Cape Verde', code: 'CPV', confederation: 'CAF' },
      { name: 'Saudi Arabia', code: 'KSA', confederation: 'AFC' },
      { name: 'Uruguay', code: 'URU', confederation: 'CONMEBOL' },
    ],
  },
  {
    id: 'I',
    teams: [
      { name: 'France', code: 'FRA', confederation: 'UEFA' },
      { name: 'Senegal', code: 'SEN', confederation: 'CAF' },
      { name: 'Iraq', code: 'IRQ', confederation: 'AFC' },
      { name: 'Norway', code: 'NOR', confederation: 'UEFA' },
    ],
  },
  {
    id: 'J',
    teams: [
      { name: 'Argentina', code: 'ARG', confederation: 'CONMEBOL' },
      { name: 'Algeria', code: 'ALG', confederation: 'CAF' },
      { name: 'Austria', code: 'AUT', confederation: 'UEFA' },
      { name: 'Jordan', code: 'JOR', confederation: 'AFC' },
    ],
  },
  {
    id: 'K',
    teams: [
      { name: 'Portugal', code: 'POR', confederation: 'UEFA' },
      { name: 'DR Congo', code: 'COD', confederation: 'CAF' },
      { name: 'Uzbekistan', code: 'UZB', confederation: 'AFC' },
      { name: 'Colombia', code: 'COL', confederation: 'CONMEBOL' },
    ],
  },
  {
    id: 'L',
    teams: [
      { name: 'England', code: 'ENG', confederation: 'UEFA' },
      { name: 'Croatia', code: 'CRO', confederation: 'UEFA' },
      { name: 'Ghana', code: 'GHA', confederation: 'CAF' },
      { name: 'Panama', code: 'PAN', confederation: 'CONCACAF' },
    ],
  },
]

// Maps ESPN team names to the exact names the prediction model expects
// Only includes teams where the names differ between ESPN and the model's training data
export const ESPN_TO_MODEL_NAME = {
  'Türkiye': 'Turkey',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'Congo DR': 'Democratic Republic of Congo',
}

// Helper to normalize an ESPN team name to what the model expects
// Returns the original name if no mapping exists
export function toModelName(espnName) {
  return ESPN_TO_MODEL_NAME[espnName] ?? espnName
}

// All teams as a flat array with their group id attached — used by Overview and CustomMatch
export const allTeams = groups.flatMap((group) =>
  group.teams.map((team) => ({
    ...team,
    group: group.id,
  })),
)

export const bracketRounds = [
  { name: 'Round of 32', matches: 16 },
  { name: 'Round of 16', matches: 8 },
  { name: 'Quarterfinals', matches: 4 },
  { name: 'Semifinals', matches: 2 },
  { name: 'Final', matches: 1 },
]