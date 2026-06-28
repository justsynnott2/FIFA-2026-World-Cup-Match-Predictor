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
