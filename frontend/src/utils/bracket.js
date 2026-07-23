// Shapes ESPN knockout fixtures into the bracket layout TournamentBracket.jsx renders,
// and resolves the "Round of 16 3 Winner"-style placeholder names ESPN uses for
// matchups that haven't been determined yet into the real fixture that will fill them.
// Exports: getRealR32Matches, buildBracketState, isRealTeam, R32_FIXTURE_BY_MATCH_NUM,
// BRACKET_STRUCTURE, buildFixtureLookup, parsePlaceholderRef, getStructuralFeeders,
// resolveSlotTeam, getChampionSummary.

import { isMatchCompleted } from './matchStatus'

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

// Structural parent→child feeder mapping for Round of 16 through Semifinals,
// derived purely from BRACKET_STRUCTURE's array order (each side's round
// arrays are already listed in bracket visual order — a round's match at
// index n is fed by the previous round's matches at indices 2n and 2n+1 on
// the same side, hand-verified the same way BRACKET_STRUCTURE itself was).
// Computed once since BRACKET_STRUCTURE is static.
const STRUCTURAL_PARENT_MAP = (() => {
  const map = {}
  const rounds = ['round-of-32', 'round-of-16', 'quarterfinals', 'semifinals']
  for (const side of ['left', 'right']) {
    for (let r = 1; r < rounds.length; r++) {
      const parentIds = BRACKET_STRUCTURE[side][rounds[r - 1]]
      const childIds = BRACKET_STRUCTURE[side][rounds[r]]
      childIds.forEach((childId, n) => {
        map[childId] = {
          home: { fixtureId: parentIds[2 * n], loser: false },
          away: { fixtureId: parentIds[2 * n + 1], loser: false },
        }
      })
    }
  }
  return map
})()

/**
 * Structural equivalent of parsePlaceholderRef: given a fixture's round and
 * ID, returns { home: {fixtureId, loser}, away: {fixtureId, loser} } for the
 * two upstream fixtures that feed it, derived from BRACKET_STRUCTURE's array
 * order rather than by parsing ESPN's placeholder team-name text. Unlike
 * parsePlaceholderRef, this keeps working once ESPN backfills a fixture's
 * home_team/away_team with the real (already-decided) winner — exactly when
 * a from-scratch simulation most needs it, since it must ignore that real
 * value and resolve its own simulated winner for the same feeder fixture
 * instead. Round of 32 has no feeder (returns null). Final and 3rd-place
 * aren't part of BRACKET_STRUCTURE's per-side round arrays, so they're
 * special-cased directly: each side's semifinal winner feeds the final
 * (left → home, right → away, matching the convention runSimulation's
 * existing 3rd-place derivation already uses); the two semifinal losers
 * feed the 3rd-place match the same way.
 */
export function getStructuralFeeders(round, fixtureId) {
  if (round === 'round-of-32') return null

  if (round === 'final') {
    return {
      home: { fixtureId: BRACKET_STRUCTURE.left.semifinals[0], loser: false },
      away: { fixtureId: BRACKET_STRUCTURE.right.semifinals[0], loser: false },
    }
  }
  if (round === '3rd-place-match') {
    return {
      home: { fixtureId: BRACKET_STRUCTURE.left.semifinals[0], loser: true },
      away: { fixtureId: BRACKET_STRUCTURE.right.semifinals[0], loser: true },
    }
  }

  return STRUCTURAL_PARENT_MAP[fixtureId] ?? null
}

/**
 * Resolves what team occupies a bracket slot, at display time or during a
 * simulation walk. Real teams resolve immediately if `isSeeded` (Round of 32
 * — never a placeholder) or mode is 'live' (real results always trusted).
 * Otherwise (mode 'simulate' on a non-R32 slot) a real-looking value is
 * never trusted directly — it may just be ESPN having backfilled a
 * placeholder once that round was actually decided in reality, and the
 * Simulate tab must ignore real results — so resolution falls through to
 * placeholder parsing. If the raw team name is no longer literal placeholder
 * text (ESPN already backfilled it with the real result), `structuralRef` —
 * the caller-supplied output of getStructuralFeeders — is used instead, since
 * it doesn't depend on that text surviving. Returns null (renders as TBD) if
 * nothing resolves.
 */
export function resolveSlotTeam(teamName, teamCode, teamLogo, simState, fixtureLookup, mode, isSeeded = false, structuralRef = null) {
  const trustRawTeam = isSeeded || mode === 'live'
  if (trustRawTeam && isRealTeam(null, teamLogo)) {
    return { name: teamName, code: teamCode, logo: teamLogo }
  }
  const ref = parsePlaceholderRef(teamName) ?? structuralRef
  if (!ref) return null
  const { fixtureId, loser } = ref

  if (mode === 'live') {
    const srcFixture = fixtureLookup[fixtureId]
    if (srcFixture && isMatchCompleted(srcFixture.status)) {
      const homeWon = parseFloat(srcFixture.home_score) > parseFloat(srcFixture.away_score)
      const winner = homeWon
        ? { name: srcFixture.home_team, code: srcFixture.home_code, logo: srcFixture.home_logo }
        : { name: srcFixture.away_team, code: srcFixture.away_code, logo: srcFixture.away_logo }
      const loserTeam = homeWon
        ? { name: srcFixture.away_team, code: srcFixture.away_code, logo: srcFixture.away_logo }
        : { name: srcFixture.home_team, code: srcFixture.home_code, logo: srcFixture.home_logo }
      return loser ? loserTeam : winner
    }
  }

  const srcResult = simState[fixtureId]
  if (!srcResult) return null
  return loser ? srcResult.loser : srcResult.winner
}

const KNOCKOUT_ROUND_LABELS = {
  'round-of-32': 'R32',
  'round-of-16': 'R16',
  'quarterfinals': 'QF',
  'semifinals': 'SF',
  'final': 'Final',
}
const KNOCKOUT_ROUND_ORDER = Object.keys(KNOCKOUT_ROUND_LABELS)

/**
 * Computes a champion's whole-tournament summary: matches played/won, goals
 * scored (across every completed fixture involving them, including the
 * group stage), and their ordered knockout run from Round of 32 through the
 * Final (the 3rd-place match is deliberately excluded — a champion never
 * plays it). Lives here rather than in matchStatus.js because it needs this
 * module's knockout round ordering (KNOCKOUT_ROUND_ORDER, sharing the same
 * round-key set BRACKET_STRUCTURE etc. already use), and matchStatus.js
 * can't import from this module without creating a circular dependency —
 * this module already imports isMatchCompleted from matchStatus.js.
 */
export function getChampionSummary(allFixtures, espnId) {
  const empty = { played: 0, won: 0, goals: 0, run: [] }
  if (!espnId) return empty

  const teamFixtures = allFixtures.filter(
    f => isMatchCompleted(f.status) && (f.home_espn_id === espnId || f.away_espn_id === espnId)
  )

  let played = 0, won = 0, goals = 0
  for (const f of teamFixtures) {
    const isHome = f.home_espn_id === espnId
    const flagsPresent = f.home_winner != null || f.away_winner != null
    const homeWon = flagsPresent ? Boolean(f.home_winner) : f.home_score > f.away_score
    const teamWon = isHome ? homeWon : !homeWon

    played += 1
    if (teamWon) won += 1
    goals += Number(isHome ? f.home_score : f.away_score)
  }

  const knockoutFixtures = teamFixtures.filter(f => KNOCKOUT_ROUND_LABELS[f.round] !== undefined)
  const run = KNOCKOUT_ROUND_ORDER
    .map(round => knockoutFixtures.find(f => f.round === round))
    .filter(Boolean)
    .map(f => {
      const isHome = f.home_espn_id === espnId
      return {
        round: f.round,
        label: KNOCKOUT_ROUND_LABELS[f.round],
        opponent: isHome ? f.away_team : f.home_team,
        teamScore: isHome ? f.home_score : f.away_score,
        opponentScore: isHome ? f.away_score : f.home_score,
        isPens: f.status === 'STATUS_FINAL_PEN',
        teamShootout: isHome ? f.home_shootout_score : f.away_shootout_score,
        opponentShootout: isHome ? f.away_shootout_score : f.home_shootout_score,
      }
    })

  return { played, won, goals, run }
}
