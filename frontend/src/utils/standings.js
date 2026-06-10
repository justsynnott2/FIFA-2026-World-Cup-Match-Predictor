import { fixturesByGroup } from '../data/tournament'

export function computeStandings(group, predictions) {
    const fixtures = fixturesByGroup[group.id]
    const points = Object.fromEntries(group.teams.map((t) => [t.code, 0]))
    const probSum = Object.fromEntries(group.teams.map((t) => [t.code, 0])) // ← tiebreaker

    fixtures.forEach((fixture) => {
        const prediction = predictions[fixture.id]
        if (!prediction) return

        probSum[fixture.home.code] += prediction.home  // ← accumulate win prob
        probSum[fixture.away.code] += prediction.away

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
            probSum: Math.round(probSum[team.code] / 3),
        }))
        .sort((a, b) => b.points - a.points || b.probSum - a.probSum)
}