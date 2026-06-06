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
      { name: 'Curacao', code: 'CUW', confederation: 'CONCACAF' },
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

const groupDates = {
  A: ['Jun 11', 'Jun 13', 'Jun 19', 'Jun 20', 'Jun 25', 'Jun 25'],
  B: ['Jun 12', 'Jun 13', 'Jun 18', 'Jun 24', 'Jun 24', 'Jun 24'],
  C: ['Jun 13', 'Jun 14', 'Jun 19', 'Jun 20', 'Jun 24', 'Jun 24'],
  D: ['Jun 13', 'Jun 14', 'Jun 19', 'Jun 19', 'Jun 26', 'Jun 26'],
  E: ['Jun 14', 'Jun 14', 'Jun 20', 'Jun 21', 'Jun 25', 'Jun 25'],
  F: ['Jun 14', 'Jun 15', 'Jun 21', 'Jun 22', 'Jun 25', 'Jun 26'],
  G: ['Jun 15', 'Jun 16', 'Jun 21', 'Jun 22', 'Jun 27', 'Jun 27'],
  H: ['Jun 15', 'Jun 15', 'Jun 21', 'Jun 21', 'Jun 27', 'Jun 27'],
  I: ['Jun 16', 'Jun 16', 'Jun 23', 'Jun 23', 'Jun 26', 'Jun 27'],
  J: ['Jun 17', 'Jun 17', 'Jun 22', 'Jun 23', 'Jun 28', 'Jun 28'],
  K: ['Jun 18', 'Jun 18', 'Jun 23', 'Jun 24', 'Jun 27', 'Jun 27'],
  L: ['Jun 17', 'Jun 17', 'Jun 23', 'Jun 23', 'Jun 27', 'Jun 27'],
}

const fixturePattern = [
  [0, 1],
  [2, 3],
  [0, 2],
  [3, 1],
  [3, 0],
  [1, 2],
]

export const fixturesByGroup = groups.reduce((fixtures, group) => {
  fixtures[group.id] = fixturePattern.map(([homeIndex, awayIndex], index) => ({
    id: `${group.id}-${index + 1}`,
    group: group.id,
    date: `${groupDates[group.id][index]}, 2026`,
    venue: ['Mexico City', 'Toronto', 'New York/New Jersey', 'Los Angeles', 'Dallas', 'Seattle'][
      (group.id.charCodeAt(0) + index) % 6
    ],
    home: group.teams[homeIndex],
    away: group.teams[awayIndex],
  }))

  return fixtures
}, {})

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
