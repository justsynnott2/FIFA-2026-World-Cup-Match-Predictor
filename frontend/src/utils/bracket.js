export function getRealR32Matches(knockoutFixtures) {
  return knockoutFixtures.filter(f => f.round === 'round-of-32')
}

export function buildBracketState(knockoutFixtures) {
  const rounds = ['round-of-32', 'round-of-16', 'quarterfinals', 'semifinals', '3rd-place-match', 'final']
  const state = Object.fromEntries(rounds.map(r => [r, []]))
  for (const fixture of knockoutFixtures) {
    if (state[fixture.round] !== undefined) {
      state[fixture.round].push(fixture)
    }
  }
  return state
}

export function isRealTeam(espnId, logo) {
  return logo !== '' && logo != null
}

export const R32_FIXTURE_BY_MATCH_NUM = {
  1: '760486', 2: '760489', 3: '760488', 4: '760487',
  5: '760492', 6: '760490', 7: '760491', 8: '760495',
  9: '760494', 10: '760493', 11: '760496', 12: '760497',
  13: '760498', 14: '760500', 15: '760501', 16: '760499',
}

export const BRACKET_STRUCTURE = {
  left: {
    'round-of-32':   ['760489','760492','760486','760488','760496','760497','760494','760493'],
    'round-of-16':   ['760503','760502','760506','760507'],
    'quarterfinals': ['760510','760511'],
    'semifinals':    ['760514'],
  },
  right: {
    'round-of-32':   ['760487','760490','760491','760495','760500','760499','760498','760501'],
    'round-of-16':   ['760504','760505','760509','760508'],
    'quarterfinals': ['760512','760513'],
    'semifinals':    ['760515'],
  },
}

export function buildFixtureLookup(knockoutFixtures) {
  return Object.fromEntries(knockoutFixtures.map(f => [String(f.fixture_id), f]))
}

export function parsePlaceholderRef(teamName) {
  let m

  m = teamName?.match(/^Round of 32 (\d+) Winner$/)
  if (m) return { fixtureId: R32_FIXTURE_BY_MATCH_NUM[+m[1]], loser: false }

  m = teamName?.match(/^Round of 16 (\d+) Winner$/)
  if (m) {
    const ids = [...BRACKET_STRUCTURE.left['round-of-16'], ...BRACKET_STRUCTURE.right['round-of-16']].sort()
    return { fixtureId: ids[+m[1] - 1], loser: false }
  }

  m = teamName?.match(/^Quarterfinal (\d+) Winner$/)
  if (m) {
    const ids = [...BRACKET_STRUCTURE.left['quarterfinals'], ...BRACKET_STRUCTURE.right['quarterfinals']].sort()
    return { fixtureId: ids[+m[1] - 1], loser: false }
  }

  m = teamName?.match(/^Semifinal (\d+) Winner$/)
  if (m) {
    const ids = [...BRACKET_STRUCTURE.left['semifinals'], ...BRACKET_STRUCTURE.right['semifinals']].sort()
    return { fixtureId: ids[+m[1] - 1], loser: false }
  }

  m = teamName?.match(/^Semifinal (\d+) Loser$/)
  if (m) {
    const ids = [...BRACKET_STRUCTURE.left['semifinals'], ...BRACKET_STRUCTURE.right['semifinals']].sort()
    return { fixtureId: ids[+m[1] - 1], loser: true }
  }

  return null
}
