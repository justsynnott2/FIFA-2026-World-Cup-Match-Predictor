import time

# Generic in-process TTL cache used by fixtures.py and teams.py. Exports: _get_cached.

# Plain in-memory dict — not shared across worker processes and reset on every
# redeploy/restart. Fine here since every cached value is just a re-fetchable
# proxy of ESPN's API (see the per-endpoint TTL choices in fixtures.py/teams.py),
# not something that needs to survive a restart or be consistent across workers.
_cache = {}


def _get_cached(cache_key, ttl_seconds, fetch_fn):
    """
    Generic cache helper. Returns cached data if still fresh,
    otherwise calls fetch_fn to get new data and stores it.
    """
    cached_entry = _cache.get(cache_key)
    if cached_entry and (time.time() - cached_entry['timestamp']) < ttl_seconds:
        return cached_entry['data']

    fresh_data = fetch_fn()
    _cache[cache_key] = {'data': fresh_data, 'timestamp': time.time()}
    return fresh_data
