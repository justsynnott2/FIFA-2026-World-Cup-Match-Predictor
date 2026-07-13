import requests
from cache import _get_cached

# ESPN scoreboard/standings client: fetches raw ESPN data, flattens it into the
# shape the frontend expects, and caches both fetches at a 30s TTL. Exports:
# get_group_stage_fixtures, get_knockout_fixtures, get_all_fixtures,
# get_live_fixtures, get_upcoming_fixtures, get_recent_results, get_standings.

# ESPN's unofficial public API - no key required
ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"
ESPN_STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings"

# Date range covering the full group stage
GROUP_STAGE_DATE_RANGE = "20260611-20260627"
KNOCKOUT_DATE_RANGE = "20260628-20260719"

#ESPN MATCH STATUSES
STATUS_UPCOMING = {'STATUS_SCHEDULED'}
STATUS_FINAL = {'STATUS_FULL_TIME', 'STATUS_FINAL_AET','STATUS_FINAL_PEN'}


def _extract_group(alt_game_note):
    """Pulls the single-letter group (e.g. 'A') out of ESPN's free-text altGameNote field, or '' if absent."""
    marker = ', Group '
    idx = alt_game_note.find(marker)
    if idx == -1:
        return ''
    char = alt_game_note[idx + len(marker):]
    return char[0] if char else ''


def _normalize_event(raw_event):
    """
    Flattens a raw ESPN event object into a clean dict.
    ESPN nests a lot - this extracts only what the frontend needs.
    """
    competition = raw_event['competitions'][0]
    competitors = competition['competitors']

    # ESPN returns competitors as a list - find home and away by flag
    home_team = next(c for c in competitors if c['homeAway'] == 'home')
    away_team = next(c for c in competitors if c['homeAway'] == 'away')

    match_status = competition['status']['type']['name']
    venue = competition.get('venue', {})

    return {
        'fixture_id': raw_event['id'],
        'date': raw_event['date'],                                              # UTC ISO string e.g. "2026-06-13T01:00Z"
        'status': match_status,                                                 # STATUS_SCHEDULED, STATUS_FULL_TIME, etc.
        'detail': competition['status']['type'].get('detail', ''),             # Human readable e.g. "Sat, June 13th at 6:00 PM EDT"
        'clock': competition['status'].get('displayClock', ''),               # Match clock for live matches e.g. "45:00"
        'venue': venue.get('fullName'),
        'city': venue.get('address', {}).get('city'),
        'home_team': home_team['team']['displayName'],
        'home_code': home_team['team']['abbreviation'],
        'home_espn_id': home_team['team']['id'],
        'home_logo': home_team['team']['logo'],
        'home_score': home_team.get('score'),
        'home_form': home_team.get('form'),                                     # Last 5 results e.g. "WWLDD"
        'away_team': away_team['team']['displayName'],
        'away_code': away_team['team']['abbreviation'],
        'away_espn_id': away_team['team']['id'],
        'away_logo': away_team['team']['logo'],
        'away_score': away_team.get('score'),
        'away_form': away_team.get('form'),
        'home_winner': home_team.get('winner', False),
        'away_winner': away_team.get('winner', False),
        # Only populated by ESPN when a knockout match went to penalties
        # (status STATUS_FINAL_PEN); the regular home/away_score above stays
        # the 90/120-minute score. The frontend renders these as a separate
        # "(x-y pens)" line rather than folding them into the main score.
        'home_shootout_score': home_team.get('shootoutScore'),
        'away_shootout_score': away_team.get('shootoutScore'),
        'round': raw_event.get('season', {}).get('slug', ''),
        'group': _extract_group(competition.get('altGameNote', '')),
    }


def _fetch_group_stage():
    """Hits ESPN's scoreboard for the group-stage date range and normalizes every event."""
    response = requests.get(ESPN_BASE, params={'dates': GROUP_STAGE_DATE_RANGE, 'limit': 100})
    raw_events = response.json().get('events', [])
    return [_normalize_event(e) for e in raw_events]


def _fetch_knockout():
    """Hits ESPN's scoreboard for the knockout date range and normalizes every event."""
    response = requests.get(ESPN_BASE, params={'dates': KNOCKOUT_DATE_RANGE, 'limit': 100})
    raw_events = response.json().get('events', [])
    return [_normalize_event(e) for e in raw_events]


# 30s TTL: short enough that scores/status feel live while a match is in
# progress, long enough to avoid hammering ESPN's unofficial (rate-limited,
# undocumented) endpoint on every frontend poll. This is a second layer of
# throttling on top of the frontend's own dynamic polling interval
# (computeDelay in Fixtures.jsx, 30s-5min depending on match state) — either
# one alone would be enough to protect ESPN, but together they mean a burst of
# simultaneous frontend tabs still only hits ESPN once per 30s.
def get_group_stage_fixtures():
    """Returns all group stage fixtures cached at 30s TTL."""
    return _get_cached('group_stage_fixtures', ttl_seconds=30, fetch_fn=_fetch_group_stage)

def get_knockout_fixtures():
    """Returns all knockout stage fixtures cached at 30s TTL."""
    return _get_cached('knockout_fixtures', ttl_seconds=30, fetch_fn=_fetch_knockout)

def get_all_fixtures():
    """Returns all 104 World Cup fixtures merged and sorted by date. Not separately cached — sources are."""
    return sorted(get_group_stage_fixtures() + get_knockout_fixtures(), key=lambda f: f['date'])

def get_live_fixtures():
    """Returns all fixtures currently in progress (status not in the upcoming or final sets)."""
    return [f for f in get_all_fixtures() if f['status'] not in STATUS_FINAL | STATUS_UPCOMING]

def get_upcoming_fixtures():
    """Returns the next 5 scheduled fixtures, in whatever order get_all_fixtures produced (date-sorted)."""
    return [f for f in get_all_fixtures() if f['status'] in STATUS_UPCOMING][:5]

def get_recent_results():
    """Returns the last 5 completed fixtures with final scores, in date order (not most-recent-first)."""
    return [f for f in get_all_fixtures() if f['status'] in STATUS_FINAL][:5]


def _fetch_standings():
    """Hits ESPN's standings endpoint and flattens each group's entries into the shape the frontend expects."""
    response = requests.get(ESPN_STANDINGS_URL)
    data = response.json()
    result = {}
    for group in data.get('children', []):
        entries = []
        for entry in group.get('standings', {}).get('entries', []):
            team = entry['team']
            stats = {s['name']: s['value'] for s in entry.get('stats', []) if 'value' in s}
            entries.append({
                'espn_id': team['id'],
                'name': team['displayName'],
                'gp': int(stats.get('gamesPlayed', 0)),
                'w':  int(stats.get('wins', 0)),
                'd':  int(stats.get('ties', 0)),
                'l':  int(stats.get('losses', 0)),
                'gf': int(stats.get('pointsFor', 0)),
                'ga': int(stats.get('pointsAgainst', 0)),
                'gd': int(stats.get('pointDifferential', 0)),
                'points': int(stats.get('points', 0)),
            })
        result[group['name']] = entries
    return result

def get_standings():
    """Returns ESPN group standings keyed by group name (e.g. 'Group A'), cached at 30s TTL."""
    return _get_cached('standings', ttl_seconds=30, fetch_fn=_fetch_standings)
