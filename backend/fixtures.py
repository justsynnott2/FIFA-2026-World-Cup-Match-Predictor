import requests
from cache import _get_cached

# ESPN's unofficial public API - no key required
ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"
ESPN_STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings"

# Date range covering the full group stage
GROUP_STAGE_DATE_RANGE = "20260611-20260627"


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
    }


def _fetch_all_group_stage():
    """
    Fetches all group stage fixtures from ESPN in a single request.
    The date range query returns events with their current status,
    so completed matches show STATUS_FULL_TIME and upcoming show STATUS_SCHEDULED.
    """
    response = requests.get(ESPN_BASE, params={'dates': GROUP_STAGE_DATE_RANGE, 'limit': 100})
    response_data = response.json()
    raw_events = response_data.get('events', [])
    return [_normalize_event(raw_event) for raw_event in raw_events]


def get_all_fixtures():
    """
    Returns all group stage fixtures, using cache to avoid hammering ESPN.
    TTL is 5 minutes - short enough to reflect results soon after they happen.
    """
    return _get_cached('all_fixtures', ttl_seconds=30, fetch_fn=_fetch_all_group_stage)

def get_live_fixtures():
    """Returns all fixtures currently in progress."""
    all_fixtures = get_all_fixtures()
    return [f for f in all_fixtures if f['status'] not in ('STATUS_FULL_TIME', 'STATUS_SCHEDULED')]

def get_upcoming_fixtures():
    """Returns in-progress and upcoming scheduled fixtures (excludes completed)."""
    all_fixtures = get_all_fixtures()
    return [fixture for fixture in all_fixtures if fixture['status'] == 'STATUS_SCHEDULED'][:5]


def get_recent_results():
    """Returns the last 10 completed fixtures with final scores."""
    all_fixtures = get_all_fixtures()
    completed_fixtures = [fixture for fixture in all_fixtures if fixture['status'] == 'STATUS_FULL_TIME']
    return completed_fixtures[-5:]


def _fetch_standings():
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
    return _get_cached('standings', ttl_seconds=30, fetch_fn=_fetch_standings)
