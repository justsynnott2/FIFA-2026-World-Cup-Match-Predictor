import time

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
