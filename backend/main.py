from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
import os

from predict import predict_match
from fixtures import get_upcoming_fixtures, get_recent_results

app = FastAPI()

# Allow all origins for now - tighten this to the deployed frontend URL before going live
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    """Predicts win/draw/loss probabilities for a given matchup."""
    return predict_match(match_request.home_team, match_request.away_team)

@app.get("/schedule/upcoming")
def upcoming_fixtures():
    """Returns the next 10 scheduled group stage fixtures from ESPN."""
    return get_upcoming_fixtures()

@app.get("/schedule/results")
def recent_results():
    """Returns the last 10 completed group stage fixtures with scores from ESPN."""
    return get_recent_results()