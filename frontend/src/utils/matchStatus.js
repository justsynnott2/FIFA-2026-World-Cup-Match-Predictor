// ESPN live match status strings — one for each phase of a match in progress
const LIVE_STATUSES = [
    'STATUS_FIRST_HALF',
    'STATUS_HALF_TIME',
    'STATUS_SECOND_HALF',
    'STATUS_EXTRA_TIME',
    'STATUS_PENALTY',
]

// Returns true if a fixture is currently in progress (any live phase)
export function isMatchLive(status) {
    return LIVE_STATUSES.includes(status)
}

// Returns true if a fixture has been completed
export function isMatchCompleted(status) {
    return status === 'STATUS_FULL_TIME'
}