from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import os

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your frontend's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the model and data
BASE_DIR = os.path.dirname(os.path.dirname((os.path.abspath(__file__))))
MODELS_DIR = os.path.join(BASE_DIR, 'models')

model = joblib.load(os.path.join(MODELS_DIR, 'model.pkl'))
competitive = pd.read_csv(os.path.join(MODELS_DIR, 'competitive.csv'))
elo_ratings_df = pd.read_csv(os.path.join(MODELS_DIR, 'elo_ratings.csv'))
home_confederation_le = joblib.load(os.path.join(MODELS_DIR, 'home_confederation_le.pkl'))
away_confederation_le = joblib.load(os.path.join(MODELS_DIR, 'away_confederation_le.pkl'))

class MatchRequest(BaseModel):
    home_team: str
    away_team: str

@app.get("/")
def root():
    return {"message": "Welcome to the Football Match Outcome Prediction API!"}

@app.post("/predict")
def predict(req: MatchRequest):
    pass