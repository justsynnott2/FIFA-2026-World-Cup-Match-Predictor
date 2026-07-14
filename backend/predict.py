import pandas as pd
from data import (
    model, competitive, elo_ratings_df,
    home_confederation_le, away_confederation_le,
    confederation_map, tournament_weights
)
from helpers import (
    get_form_last_10, get_goal_avg_last_10,
    head_to_head_last_10, get_elo_rating
)

# Loads the trained model (via data.py) and turns a (home_team, away_team) pair
# into win/draw/loss probabilities. Exports: predict_match.

def _raw_predict(home_team, away_team):
    """
    Builds the model's feature vector for one home/away direction and returns
    raw win/draw/loss probabilities for exactly that direction (not mirrored).
    Used directly for matches involving a host nation; predict_match calls this
    twice and averages for all other matchups (see below).
    """
    # Will base results off of current date, so we get the most recent data
    today = pd.Timestamp.today()

    # Grab all the features for this match based on the current date and the two teams
    home_form = get_form_last_10(home_team, today, competitive)
    away_form = get_form_last_10(away_team, today, competitive)

    home_goal_avg, home_concede_avg = get_goal_avg_last_10(home_team, today, competitive)
    away_goal_avg, away_concede_avg = get_goal_avg_last_10(away_team, today, competitive)

    home_h2h, away_h2h = head_to_head_last_10(home_team, away_team, today, competitive)

    # USA, Mexico, and Canada are the three co-hosts of the 2026 tournament, so
    # any match involving at least one of them has a real home-field effect
    # (crowd, travel, familiarity) even when the "home" designation is
    # otherwise arbitrary (e.g. group-draw seeding rather than an actual away
    # trip). Matches between two non-hosts are marked neutral so the model
    # doesn't apply a home-advantage signal to a matchup that doesn't have one.
    host_countries = ['United States', 'Mexico', 'Canada']
    if home_team in host_countries and away_team in host_countries:
        neutral = True
    elif home_team in host_countries or away_team in host_countries:
        neutral = False
    else:
        neutral = True

    home_elo = get_elo_rating(home_team, today, elo_ratings_df)
    away_elo = get_elo_rating(away_team, today, elo_ratings_df)
    elo_diff = home_elo - away_elo

    weight = tournament_weights.get('FIFA World Cup')

    home_confederation = confederation_map.get(home_team, 'Unknown')
    away_confederation = confederation_map.get(away_team, 'Unknown')
    home_confederation_encoded = home_confederation_le.transform([home_confederation])[0]
    away_confederation_encoded = away_confederation_le.transform([away_confederation])[0]

    feature_input = pd.DataFrame([{
        'home_form_last_10': home_form,
        'away_form_last_10': away_form,
        'home_goal_avg_last_10': home_goal_avg,
        'home_concede_avg_last_10': home_concede_avg,
        'away_goal_avg_last_10': away_goal_avg,
        'away_concede_avg_last_10': away_concede_avg,
        'home_h2h_last_10': home_h2h,
        'away_h2h_last_10': away_h2h,
        'neutral': neutral,
        'home_elo': home_elo,
        'away_elo': away_elo,
        'elo_diff': elo_diff,
        'match_weight': weight,
        'home_confederation_encoded': home_confederation_encoded,
        'away_confederation_encoded': away_confederation_encoded,
    }])

    # Predict probabilities for home win, draw, away win.
    # The model's classes are ordered [away_win, draw, home_win] (index 0/1/2),
    # hence the reversed indices below when mapping into named fields.
    proba = model.predict_proba(feature_input)[0]

    return {
        'home_team': home_team,
        'away_team': away_team,
        'home_win_prob': round(float(proba[2]), 4),
        'draw_prob': round(float(proba[1]), 4),
        'away_win_prob': round(float(proba[0]), 4),
    }

def predict_match(home_team, away_team):
    """
    Public entry point: predicts win/draw/loss probabilities for a matchup.

    For matches between two non-host nations, runs _raw_predict in both
    directions and averages the results (with home/away swapped back to match
    the caller's orientation) to cancel out any residual home-field signal the
    model learned, since which team is "home" for a neutral-site World Cup
    fixture is arbitrary. Host-nation matches skip the averaging so the model's
    real home-advantage signal for USA/Mexico/Canada is preserved.
    """
    if home_team == away_team:
        return {"message": "Home team and away team cannot be the same."}

    host_countries = ['United States', 'Mexico', 'Canada']
    home_is_host = home_team in host_countries
    away_is_host = away_team in host_countries

    # For non-host matches, average both directions to remove residual bias
    if home_is_host == away_is_host:
        pred1 = _raw_predict(home_team, away_team)
        pred2 = _raw_predict(away_team, home_team)
        return {
            'home_team': home_team,
            'away_team': away_team,
            'home_win_prob': round((pred1['home_win_prob'] + pred2['away_win_prob']) / 2, 4),
            'draw_prob': round((pred1['draw_prob'] + pred2['draw_prob']) / 2, 4),
            'away_win_prob': round((pred1['away_win_prob'] + pred2['home_win_prob']) / 2, 4),
        }
    else:
        return _raw_predict(home_team, away_team)