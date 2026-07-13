// Shapes ESPN knockout fixtures into the bracket layout TournamentBracket.jsx renders,
// and resolves the "Round of 16 3 Winner"-style placeholder names ESPN uses for
// matchups that haven't been determined yet into the real fixture that will fill them.
// Exports: getRealR32Matches, buildBracketState, isRealTeam, R32_FIXTURE_BY_MATCH_NUM,
// BRACKET_STRUCTURE, buildFixtureLookup, parsePlaceholderRef.

/** Returns only the Round of 32 fixtures from the full knockout fixture list. */
export function getRealR32Matches(knockoutFixtures) {
  return knockoutFixtures.filter(f => f.round === 'round-of-32')
}

/**
 * Buckets knockout fixtures by round into a fixed-shape object so the bracket
 * renderer can always index by round name, even before some rounds have fixtures.
 */
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

// A slot is a real team once ESPN has assigned it a logo; before that it's still
// showing a placeholder name like "Group A Winner" or "Round of 16 3 Winner".
export function isRealTeam(espnId, logo) {
  return logo !== '' && logo != null
}

// Maps ESPN's official Round of 32 match numbers (1-16, as ESPN itself labels
// them in its bracket UI) to the ESPN fixture ID that match is played under.
// This has to be hardcoded: ESPN's fixture IDs are opaque, sequentially-issued
// numbers with no encoded bracket position, so there is no way to derive "fixture
// 760489 is R32 match #2" programmatically — it was read off ESPN's bracket
// graphic by hand, once, before the tournament. This mapping only exists for
// Round of 32, because that's the round where placeholder names use a raw match
// number (e.g. "Round of 32 2 Winner") instead of team names. From Round of 16
// onward, placeholder resolution instead sorts fixture IDs within each region
// (see parsePlaceholderRef below) because ESPN's IDs happen to sort correctly
// for those later rounds, so hand-verifying another 16 matches wasn't needed.
export const R32_FIXTURE_BY_MATCH_NUM = {
  1: '760486', 2: '760489', 3: '760488', 4: '760487',
  5: '760492', 6: '760490', 7: '760491', 8: '760495',
  9: '760494', 10: '760493', 11: '760496', 12: '760497',
  13: '760498', 14: '760500', 15: '760501', 16: '760499',
}

// Which fixture IDs sit in which round, split into the bracket's left/right
// halves for rendering. Also hand-verified against ESPN's bracket UI for the
// same reason as R32_FIXTURE_BY_MATCH_NUM above.
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

/** Indexes knockout fixtures by fixture ID (as a string) for O(1) lookup by ID. */
export function buildFixtureLookup(knockoutFixtures) {
  return Object.fromEntries(knockoutFixtures.map(f => [String(f.fixture_id), f]))
}

/**
 * Reverse-resolves an ESPN placeholder team name (e.g. "Round of 16 3 Winner",
 * "Semifinal 1 Loser") into the fixture ID whose result will fill that slot,
 * plus whether it's the winner or loser of that fixture that advances.
 * Returns null if teamName isn't a recognized placeholder pattern (i.e. it's
 * already a real team name).
 */
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
