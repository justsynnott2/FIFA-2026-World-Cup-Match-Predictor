// Classifies ESPN's match status strings into live / completed, using
// allowlists rather than trying to detect "upcoming" and exclude it.
// Exports: STATUS_DELAYED, isMatchLive, isMatchCompleted.

// ESPN live match status strings — one for each phase of a match in progress
export const STATUS_DELAYED = 'STATUS_DELAYED'

// Allowlists, not an exclusion list: ESPN's status enum isn't a documented,
// closed set, so rather than assume "anything that isn't STATUS_SCHEDULED must
// be live or complete" (and risk misclassifying some status string we've never
// seen), each known live/complete value is listed explicitly. A status that
// falls through both lists is treated as "not live, not complete" — i.e.
// upcoming/unknown — rather than silently mis-bucketed as live or finished.
const LIVE_STATUSES = [
    'STATUS_FIRST_HALF',
    'STATUS_HALFTIME',
    'STATUS_SECOND_HALF',
    'STATUS_EXTRA_TIME',
    'STATUS_PENALTY',
    STATUS_DELAYED,
]

const COMPLETE_STATUSES = [
    'STATUS_FULL_TIME',
    'STATUS_FINAL_AET',
    'STATUS_FINAL_PEN'
]

// Returns true if a fixture is currently in progress (any live phase)
export function isMatchLive(status) {
    return LIVE_STATUSES.includes(status)
}

// Returns true if a fixture has been completed
export function isMatchCompleted(status) {
    return COMPLETE_STATUSES.includes(status)
}