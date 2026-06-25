// Awards points and blended prob based on a model prediction
function awardPointsFromPrediction(points, probSum, gameCount, fixture, prediction) {
    probSum[fixture.home_code] += prediction.home / 100
    probSum[fixture.away_code] += prediction.away / 100
    gameCount[fixture.home_code] += 1
    gameCount[fixture.away_code] += 1

    if (prediction.draw > prediction.home && prediction.draw > prediction.away) {
        points[fixture.home_code] += 1
        points[fixture.away_code] += 1
    } else if (prediction.home >= prediction.away) {
        points[fixture.home_code] += 3
    } else {
        points[fixture.away_code] += 3
    }
}

// Awards points and synthetic blended prob based on a real score from ESPN
function awardPointsFromResult(points, probSum, gameCount, fixture) {
    const homeScore = parseInt(fixture.home_score)
    const awayScore = parseInt(fixture.away_score)

    let homeProb
    if (homeScore > awayScore) {
        points[fixture.home_code] += 3
        homeProb = 1.0
    } else if (homeScore < awayScore) {
        points[fixture.away_code] += 3
        homeProb = 0.0
    } else {
        points[fixture.home_code] += 1
        points[fixture.away_code] += 1
        homeProb = 0.5
    }

    probSum[fixture.home_code] += homeProb
    probSum[fixture.away_code] += 1.0 - homeProb
    gameCount[fixture.home_code] += 1
    gameCount[fixture.away_code] += 1
}

// Sorts and returns the final standings array
// espnStandings is the array of ESPN entry objects for this group (optional)
function buildStandings(group, points, probSum, gameCount, espnStandings) {
    const espnByCode = espnStandings
        ? Object.fromEntries(espnStandings.filter(e => e.code).map(e => [e.code, e]))
        : {}

    return group.teams
        .map((team) => {
            const espn = espnByCode[team.code]
            const avgProb = gameCount[team.code] > 0
                ? probSum[team.code] / gameCount[team.code]
                : 0
            return {
                ...team,
                points: points[team.code],
                probSum: avgProb,
                gp: espn?.gp ?? null,
                w:  espn?.w  ?? null,
                d:  espn?.d  ?? null,
                l:  espn?.l  ?? null,
                gf: espn?.gf ?? null,
                ga: espn?.ga ?? null,
                gd: espn?.gd ?? null,
            }
        })
        .sort((a, b) =>
            b.points - a.points ||
            (b.gd ?? 0) - (a.gd ?? 0) ||
            b.probSum - a.probSum
        )
}

// Tab 1 — Live standings
// Completed fixtures use real scores; in-progress and upcoming use model predictions
export function computeLiveStandings(group, fixtures, predictions, espnStandings) {
    const points   = Object.fromEntries(group.teams.map((team) => [team.code, 0]))
    const probSum  = Object.fromEntries(group.teams.map((team) => [team.code, 0]))
    const gameCount = Object.fromEntries(group.teams.map((team) => [team.code, 0]))

    fixtures.forEach((fixture) => {
        if (fixture.status === 'STATUS_FULL_TIME') {
            awardPointsFromResult(points, probSum, gameCount, fixture)
        } else {
            const prediction = predictions[fixture.fixture_id]
            if (!prediction) return
            awardPointsFromPrediction(points, probSum, gameCount, fixture, prediction)
        }
    })

    return buildStandings(group, points, probSum, gameCount, espnStandings)
}

// Tab 2 — Simulate standings
// All fixtures use model predictions regardless of real results
export function computeSimStandings(group, fixtures, predictions, espnStandings) {
    const points   = Object.fromEntries(group.teams.map((team) => [team.code, 0]))
    const probSum  = Object.fromEntries(group.teams.map((team) => [team.code, 0]))
    const gameCount = Object.fromEntries(group.teams.map((team) => [team.code, 0]))

    fixtures.forEach((fixture) => {
        const prediction = predictions[fixture.fixture_id]
        if (!prediction) return
        awardPointsFromPrediction(points, probSum, gameCount, fixture, prediction)
    })

    return buildStandings(group, points, probSum, gameCount, espnStandings)
}
