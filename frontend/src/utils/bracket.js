import { groups } from '../data/tournament'
import { predictMatch, getAllFixtures } from './api'
import { computeSimStandings } from './standings'

// Filters all ESPN fixtures down to just the 6 belonging to a specific group
// Matches by checking if both teams are in the group's team list
function getFixturesForGroup(group, allFixtures) {
  const groupCodes = new Set(group.teams.map((team) => team.code))
  return allFixtures.filter(
    (fixture) => groupCodes.has(fixture.home_code) && groupCodes.has(fixture.away_code)
  )
}

// Returns 16 R32 match objects { teamA, teamB }
// Winners/runners-up of all 12 groups + best 8 third-place teams
// Uses pure model predictions — real results are ignored for bracket seeding
export async function buildR32Seedings() {
  // Fetch all group stage fixtures from ESPN once, then filter per group
  const allFixtures = await getAllFixtures()

  const allStandings = await Promise.all(
    groups.map(async (group) => {
      const groupFixtures = getFixturesForGroup(group, allFixtures)

      // Sim all fixtures in the group and map fixture_id → prediction
      const predictionResults = await Promise.all(
        groupFixtures.map((fixture) => predictMatch(fixture.home_team, fixture.away_team))
      )
      const predictions = Object.fromEntries(
        groupFixtures.map((fixture, i) => [fixture.fixture_id, predictionResults[i]])
      )

      return computeSimStandings(group, groupFixtures, predictions)
    })
  )

  const winners = allStandings.map((standings) => standings[0])
  const runnersUp = allStandings.map((standings) => standings[1])
  const bestThird = allStandings
    .map((standings) => standings[2])
    .sort((a, b) => b.points - a.points || b.probSum - a.probSum)
    .slice(0, 8)

  // Groups A–L = indices 0–11
  return [
    { teamA: winners[0], teamB: runnersUp[1] }, // W_A vs R_B
    { teamA: winners[2], teamB: runnersUp[3] }, // W_C vs R_D
    { teamA: winners[4], teamB: runnersUp[5] }, // W_E vs R_F
    { teamA: winners[6], teamB: runnersUp[7] }, // W_G vs R_H
    { teamA: winners[8], teamB: runnersUp[9] }, // W_I vs R_J
    { teamA: winners[10], teamB: runnersUp[11] }, // W_K vs R_L
    { teamA: winners[1], teamB: runnersUp[0] }, // W_B vs R_A
    { teamA: winners[3], teamB: runnersUp[2] }, // W_D vs R_C
    { teamA: winners[5], teamB: runnersUp[4] }, // W_F vs R_E
    { teamA: winners[7], teamB: runnersUp[6] }, // W_H vs R_G
    { teamA: winners[9], teamB: runnersUp[8] }, // W_J vs R_I
    { teamA: winners[11], teamB: runnersUp[10] }, // W_L vs R_K
    { teamA: bestThird[0], teamB: bestThird[1] }, // T_1 vs T_2
    { teamA: bestThird[2], teamB: bestThird[3] }, // T_3 vs T_4
    { teamA: bestThird[4], teamB: bestThird[5] }, // T_5 vs T_6
    { teamA: bestThird[6], teamB: bestThird[7] }, // T_7 vs T_8
  ]
}