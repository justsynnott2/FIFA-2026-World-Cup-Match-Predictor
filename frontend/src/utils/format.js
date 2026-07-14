// Shared date/label formatting helpers for fixture cards across Fixtures.jsx
// and TeamPage.jsx (and anywhere else that renders a fixture's round/date).
// Exports: formatMatchDate, KNOCKOUT_ROUND_LABELS, getFixtureLabel.

/**
 * Converts a UTC ISO date string to a readable local time, e.g. "Sat, Jun 13 · 6:00 PM".
 */
export function formatMatchDate(isoString) {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    })
}

export const KNOCKOUT_ROUND_LABELS = {
    'round-of-32':     'Round of 32',
    'round-of-16':     'Round of 16',
    'quarterfinals':   'Quarterfinals',
    'semifinals':      'Semifinals',
    'final':           'Final',
    '3rd-place-match': '3rd Place',
}

export function getFixtureLabel(fixture) {
    if (KNOCKOUT_ROUND_LABELS[fixture.round]) return KNOCKOUT_ROUND_LABELS[fixture.round]
    if (fixture.group) return 'Group ' + fixture.group
    return ''
}
