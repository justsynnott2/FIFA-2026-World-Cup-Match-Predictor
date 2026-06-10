import { groups, fixturesByGroup } from '../data/tournament'
import { mockPrediction, hashValue } from './prediction'

function computeGroupStandings(group) {
  const fixtures = fixturesByGroup[group.id]
  const points = Object.fromEntries(group.teams.map((team) => [team.code, 0]))

  fixtures.forEach((fixture) => {
    const prediction = mockPrediction(fixture.home, fixture.away)
    if (prediction.draw > prediction.home && prediction.draw > prediction.away) {
      points[fixture.home.code] += 1
      points[fixture.away.code] += 1
    } else if (prediction.home >= prediction.away) {
      points[fixture.home.code] += 3
    } else {
      points[fixture.away.code] += 3
    }
  })

  return group.teams
    .map((team) => ({
      ...team,
      points: points[team.code],
      gd: (hashValue(team.code) % 7) - 2,
    }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd)
}

// Returns 16 R32 match objects { teamA, teamB }
// Winners/runners-up of all 12 groups + best 8 third-place teams
export function buildR32Seedings() {
  const allStandings = groups.map((group) => computeGroupStandings(group))

  const winners = allStandings.map((s) => s[0])
  const runnersUp = allStandings.map((s) => s[1])
  const bestThird = allStandings
    .map((s) => s[2])
    .sort((a, b) => b.points - a.points || b.gd - a.gd)
    .slice(0, 8)

  // Groups A–L = indices 0–11
  return [
    { teamA: winners[0],  teamB: runnersUp[1]  }, // W_A vs R_B
    { teamA: winners[2],  teamB: runnersUp[3]  }, // W_C vs R_D
    { teamA: winners[4],  teamB: runnersUp[5]  }, // W_E vs R_F
    { teamA: winners[6],  teamB: runnersUp[7]  }, // W_G vs R_H
    { teamA: winners[8],  teamB: runnersUp[9]  }, // W_I vs R_J
    { teamA: winners[10], teamB: runnersUp[11] }, // W_K vs R_L
    { teamA: winners[1],  teamB: runnersUp[0]  }, // W_B vs R_A
    { teamA: winners[3],  teamB: runnersUp[2]  }, // W_D vs R_C
    { teamA: winners[5],  teamB: runnersUp[4]  }, // W_F vs R_E
    { teamA: winners[7],  teamB: runnersUp[6]  }, // W_H vs R_G
    { teamA: winners[9],  teamB: runnersUp[8]  }, // W_J vs R_I
    { teamA: winners[11], teamB: runnersUp[10] }, // W_L vs R_K
    { teamA: bestThird[0], teamB: bestThird[1] }, // T_1 vs T_2
    { teamA: bestThird[2], teamB: bestThird[3] }, // T_3 vs T_4
    { teamA: bestThird[4], teamB: bestThird[5] }, // T_5 vs T_6
    { teamA: bestThird[6], teamB: bestThird[7] }, // T_7 vs T_8
  ]
}
