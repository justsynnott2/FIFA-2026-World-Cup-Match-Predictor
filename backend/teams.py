import requests
from cache import _get_cached

POSITION_MAP = {'G': 'GK', 'D': 'DEF', 'M': 'MID', 'F': 'FWD'}


def get_team_squad(espn_id: str):
    """Returns squad grouped by position for a given ESPN team ID."""
    def fetch():
        try:
            url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/{espn_id}/roster"
            response = requests.get(url)
            data = response.json()
            athletes = data.get('athletes', [])
            if not athletes:
                raise ValueError('empty roster')

            team_data = data.get('team', {})
            logos = team_data.get('logos', [{}])
            team = {
                'name': team_data.get('displayName', ''),
                'logo': logos[0].get('href', '') if logos else '',
                'color': team_data.get('color', ''),
            }

            roster = {'GK': [], 'DEF': [], 'MID': [], 'FWD': []}
            for athlete in athletes:
                pos_abbr = athlete.get('position', {}).get('abbreviation', '')
                group = POSITION_MAP.get(pos_abbr, 'OTHER')
                if group not in roster:
                    continue
                headshot = athlete.get('headshot', {})
                roster[group].append({
                    'id': str(athlete.get('id', '')),
                    'name': athlete.get('displayName', ''),
                    'number': athlete.get('jersey', ''),
                    'photo': headshot.get('href', '') if headshot else '',
                })
            return {'team': team, 'roster': roster}
        except Exception:
            return {'team': {}, 'roster': {'GK': [], 'DEF': [], 'MID': [], 'FWD': []}}

    return _get_cached(f'squad_{espn_id}', ttl_seconds=600, fetch_fn=fetch)


def get_team_news(espn_id: str):
    """Returns latest news articles for a given ESPN team ID."""
    def fetch():
        try:
            url = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news"
            response = requests.get(url, params={'team': espn_id, 'limit': 20})
            data = response.json()
            articles = data.get('articles', [])

            return [
                {
                    'headline': a.get('headline', ''),
                    'description': a.get('description', ''),
                    'published': a.get('published', ''),
                    'link': a.get('links', {}).get('web', {}).get('href', ''),
                    'image': a.get('images', [{}])[0].get('url', '') if a.get('images') else '',
                }
                for a in articles
            ]
        except Exception:
            return []

    return _get_cached(f'news_{espn_id}', ttl_seconds=300, fetch_fn=fetch)
