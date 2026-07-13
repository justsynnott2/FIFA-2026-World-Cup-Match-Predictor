from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
import os

from predict import predict_match
from fixtures import get_all_fixtures, get_group_stage_fixtures, get_knockout_fixtures, get_live_fixtures, get_upcoming_fixtures, get_recent_results, get_standings
from teams import get_team_squad, get_team_news

# FastAPI app: CORS setup plus every HTTP route the frontend calls (see
# frontend/src/utils/api.js). Prediction routes call into predict.py; schedule
# and team routes proxy ESPN's unofficial API through fixtures.py/teams.py,
# which cache responses in-process via cache.py.

app = FastAPI()

# Allow all origins for now - tighten this to the deployed frontend URL before going live
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://fifa-2026-world-cup-match-predictor.vercel.app",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MatchRequest(BaseModel):
    home_team: str
    away_team: str

@app.get("/")
def root():
    """Health check / welcome route."""
    return {"message": "Welcome to the Football Match Outcome Prediction API!"}

@app.post("/predict")
def predict(match_request: MatchRequest):
    """Predicts win/draw/loss probabilities for a given matchup.

    Not cached — always runs a fresh model inference, since inputs (team names)
    vary per request. Returns {home_team, away_team, home_win_prob, draw_prob,
    away_win_prob} on success, or {message} if home_team == away_team.
    """
    return predict_match(match_request.home_team, match_request.away_team)

@app.get("/schedule/all")
def all_fixtures():
    """Returns all 104 World Cup fixtures — group stage and knockout — with current status and scores.

    Merges the group-stage and knockout fetches, each cached 30s in fixtures.py;
    this endpoint itself does no additional caching.
    """
    return get_all_fixtures()

@app.get("/schedule/group")
def group_fixtures():
    """Returns all 72 group stage fixtures with current status and scores from ESPN.

    Cached 30s (see get_group_stage_fixtures in fixtures.py).
    """
    return get_group_stage_fixtures()


@app.get("/schedule/knockout")
def knockout_fixtures():
    """Returns all 32 knockout stage fixtures with current status and scores from ESPN.

    Cached 30s (see get_knockout_fixtures in fixtures.py).
    """
    return get_knockout_fixtures()

@app.get("/schedule/live")
def live_fixtures():
    """Returns all fixtures currently in progress, or an empty list if none.

    Derived by filtering the same 30s-cached fixture data used by /schedule/all.
    """
    return get_live_fixtures()

@app.get("/schedule/upcoming")
def upcoming_fixtures():
    """Returns the next 5 scheduled group stage fixtures from ESPN.

    Derived by filtering the same 30s-cached fixture data used by /schedule/all.
    """
    return get_upcoming_fixtures()

@app.get("/schedule/results")
def recent_results():
    """Returns the last 5 completed group stage fixtures with scores from ESPN.

    Derived by filtering the same 30s-cached fixture data used by /schedule/all.
    """
    return get_recent_results()

@app.get("/schedule/standings")
def group_standings():
    """Returns ESPN group standings keyed by group name (e.g. 'Group A' through 'Group L').

    Each group's value is a list of team entries (gp, w, d, l, gf, ga, gd, points).
    Cached 30s (see get_standings in fixtures.py).
    """
    return get_standings()

@app.get("/team/{espn_id}/squad")
def team_squad(espn_id: str):
    """Returns squad/roster grouped by position for a given ESPN team ID.

    Cached 600s per team ID (rosters rarely change mid-tournament). Fails soft:
    returns an empty roster shape rather than an error if ESPN's roster fetch fails.
    """
    return get_team_squad(espn_id)

@app.get("/team/{espn_id}/news")
def team_news(espn_id: str):
    """Returns latest news articles for a given ESPN team ID.

    Cached 300s per team ID. Fails soft: returns an empty list rather than an
    error if ESPN's news fetch fails.
    """
    return get_team_news(espn_id)