// Awards points based on a model prediction
// Mutates the points and probSum accumulators directly
function awardPointsFromPrediction(points, probSum, fixture, prediction) {
    // Accumulate win probabilities for tiebreaking
    probSum[fixture.home_code] += prediction.home
    probSum[fixture.away_code] += prediction.away

    // Award points based on predicted outcome
    if (prediction.draw > prediction.home && prediction.draw > prediction.away) {
        points[fixture.home_code] += 1
        points[fixture.away_code] += 1
    } else if (prediction.home >= prediction.away) {
        points[fixture.home_code] += 3
    } else {
        points[fixture.away_code] += 3
    }
}

// Awards points based on a real score from ESPN
// Mutates the points accumulator directly
function awardPointsFromResult(points, fixture) {
    const homeScore = parseInt(fixture.home_score)
    const awayScore = parseInt(fixture.away_score)

    if (homeScore > awayScore) {
        points[fixture.home_code] += 3
    } else if (homeScore < awayScore) {
        points[fixture.away_code] += 3
    } else {
        points[fixture.home_code] += 1
        points[fixture.away_code] += 1
    }
}

// Sorts and returns the final standings array
function buildStandings(group, points, probSum) {
    return group.teams
        .map((team) => ({
            ...team,
            points: points[team.code],
            probSum: Math.round(probSum[team.code] / 3),
        }))
        .sort((a, b) => b.points - a.points || b.probSum - a.probSum)
}

// Tab 1 — Live standings
// Completed fixtures use real scores
// In progress and upcoming fixtures use model predictions if available, otherwise skipped
export function computeLiveStandings(group, fixtures, predictions) {
    const points = Object.fromEntries(group.teams.map((team) => [team.code, 0]))
    const probSum = Object.fromEntries(group.teams.map((team) => [team.code, 0]))

    fixtures.forEach((fixture) => {
        if (fixture.status === 'STATUS_FULL_TIME') {
            // Real result — use actual score
            awardPointsFromResult(points, fixture)
        } else {
            // In progress or upcoming — use model prediction if available
            const prediction = predictions[fixture.fixture_id]
            if (!prediction) return
            awardPointsFromPrediction(points, probSum, fixture, prediction)
        }
    })

    return buildStandings(group, points, probSum)
}

// Tab 2 — Simulate standings
// All fixtures use model predictions regardless of real results
// Real scores are completely ignored
export function computeSimStandings(group, fixtures, predictions) {
    const points = Object.fromEntries(group.teams.map((team) => [team.code, 0]))
    const probSum = Object.fromEntries(group.teams.map((team) => [team.code, 0]))

    fixtures.forEach((fixture) => {
        const prediction = predictions[fixture.fixture_id]
        if (!prediction) return
        awardPointsFromPrediction(points, probSum, fixture, prediction)
    })

    return buildStandings(group, points, probSum)
}