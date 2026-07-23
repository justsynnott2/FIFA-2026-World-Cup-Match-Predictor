# FIFA World Cup 2026 Match Predictor

A full-stack web app that predicted and tracked the 2026 FIFA World Cup in real time. A FastAPI backend serves win/draw/loss probabilities from an XGBoost model, while a React frontend polls ESPN's unofficial public API for live scores, standings, and bracket progress.

**Live app:** [fifa-2026-world-cup-match-predictor.vercel.app](https://fifa-2026-world-cup-match-predictor.vercel.app)
**Backend:** FastAPI on Render (free tier)

The tournament finished on July 19, 2026. Spain beat Argentina 1-0 in the final, with England taking third place. The app now serves as a permanent record of that tournament: every page still works, showing final results, the completed bracket, and the model's calls on how it went.

---

## What it does

Six pages, one FastAPI backend:

- **Overview** — a champion-plus-model-call hero. Pulls the final fixture, shows the real result with the champion highlighted, and runs the model's own three-way prediction for that match so the two sit side by side.
- **Fixtures** — all 104 group and knockout matches, paginated, with a champion panel summarizing the winner's full run to the trophy (results, goals, knockout road).
- **Group Stage** — all 12 groups with live ESPN standings, expandable to each group's fixtures.
- **Tournament Bracket** — the full 32-match knockout tree from Round of 32 to final, plus a three-place podium (runner-up, champion, third).
- **Custom Match** — pick any two of the 48 nations and get a live model prediction, independent of the real schedule.
- **Team Page** — squad, news, and fixture history for a given team, keyed by ESPN team ID.

Every page that shows a prediction is drawing from the same `/predict` endpoint, so the model's logic lives in exactly one place.

---

## Architecture

```
frontend (React + Vite, on Vercel)
   |
   |  REST calls, 30s polling while matches are live
   v
backend (FastAPI, on Render)
   |
   |-- /predict            -> predict.py (XGBoost model)
   |-- /schedule/*          -> fixtures.py (ESPN scoreboard, cached 30s)
   |-- /team/{id}/squad     -> teams.py (ESPN roster, cached 600s)
   |-- /team/{id}/news      -> teams.py (ESPN news, cached 300s)
   v
ESPN unofficial public API (site.api.espn.com)
```

The backend never exposes ESPN calls directly to the client. Every ESPN fetch is proxied and cached in `cache.py`, a small in-process TTL dict keyed per resource. This keeps the free-tier Render instance from hammering an undocumented, rate-limited third-party API, and it means the frontend only ever talks to endpoints the backend controls.

### Endpoints

| Method | Route | Returns |
|---|---|---|
| POST | `/predict` | Win/draw/loss probabilities for any two teams |
| GET | `/schedule/all` | All 104 fixtures, group stage plus knockout |
| GET | `/schedule/group` | The 72 group stage fixtures |
| GET | `/schedule/knockout` | The 32 knockout fixtures |
| GET | `/schedule/live` | Fixtures currently in progress |
| GET | `/schedule/upcoming` | Next 5 scheduled fixtures |
| GET | `/schedule/results` | Last 5 completed fixtures |
| GET | `/schedule/standings` | Group standings, keyed by group name |
| GET | `/team/{espn_id}/squad` | Roster grouped by position |
| GET | `/team/{espn_id}/news` | Latest news for a team |

---

## The prediction model

An XGBoost classifier trained on historical international results, using Elo ratings, recent form, goal averages, and head-to-head history as features. A few decisions in how it's applied were more interesting than the model itself.

**Host advantage, done properly.** USA, Mexico, and Canada co-hosted the tournament, so a match involving one of them has a genuine home-field effect. But every other matchup is nominally "home vs away" only because ESPN's schedule assigns those labels arbitrarily, at a neutral venue. Feeding that arbitrary label straight into the model would let it apply a home-advantage signal to matches that don't have one. The fix: when both teams are hosts, or neither is, the backend runs the model in both directions and averages the result, cancelling out the spurious signal. When exactly one side is a host, the raw directional prediction is used, so the real home advantage is preserved.

**Penalty shootouts were deliberately scoped out.** A dedicated model for penalty outcomes was considered and dropped. There isn't enough shootout data to train something that would meaningfully beat a coin flip, and a bad model is worse than no model. Instead, knockout matches resolve on whichever of the three outcomes has the highest win probability, with draw probability mass redistributed proportionally between the two win shares. Completed knockout matches that went to penalties display the shootout score separately (`(4-3 pens)`) rather than folding it into the 90-minute result, and the model's own verdict logic treats a penalty-decided match as a correctly predicted draw, since the model was only ever predicting the 90/120-minute score.

**One choke point for predictions.** Every page that calls the model goes through a single `predictMatch` function on the frontend, which also normalizes team names before the request goes out. If ESPN's naming for a team ever drifts from the model's training data, there's exactly one place to fix it.

---

## Engineering notes

A few things worth knowing about how this was built, beyond what the code shows:

- **The bracket's slot numbers are opaque by design.** ESPN's Round of 32 slot numbering doesn't follow fixture ID or date order, and there's no way to derive it. The bracket structure is hardcoded from ESPN's own UI. Quarterfinals and semifinals don't need this, since those rounds do follow date order.
- **Status classification is an allowlist, not an exclusion list.** ESPN's match-status enum isn't a documented closed set. Instead of assuming "anything that isn't final or scheduled must be live," both the backend and frontend list the known live-phase statuses explicitly, so an unexpected status (postponed, canceled) doesn't get misreported as a match in progress.

---

## Known limitations

- Team name links throughout the app are click-only and not keyboard reachable. This is consistent across every page rather than an isolated bug, but it's a real gap.
- The Tournament Bracket page only fetches knockout fixtures, so it has no group-stage data. The podium doesn't need it, but any whole-tournament stat added to that page later would require a new fetch.

---

## Tech stack

**Backend:** FastAPI, XGBoost, scikit-learn, pandas, joblib, requests
**Frontend:** React 19, React Router v6, Vite
**Data:** ESPN's unofficial public API (no key required)
**Hosting:** Render (backend, free tier with a keep-alive ping) and Vercel (frontend)

## Running it locally

**Backend**

```bash
cd backend
pip install -r ../requirements.txt
uvicorn main:app --reload
```

Runs on `http://localhost:8000` by default.

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`. The frontend reads the backend URL from `VITE_API_BASE` (falls back to `http://localhost:8000` if unset), so point it at a deployed backend with a `.env` file if you don't want to run one locally:

```
VITE_API_BASE=https://your-backend-url.onrender.com
```

## Project structure

```
backend/
  main.py          FastAPI routes
  predict.py        Model inference, host-advantage handling
  fixtures.py        ESPN scoreboard/standings client
  teams.py           ESPN squad/news client
  cache.py           Generic in-process TTL cache
  models/            Trained model + encoders

frontend/src/
  pages/             Overview, Fixtures, GroupStage, TournamentBracket, CustomMatch, TeamPage
  components/         FixtureCard, LoadingState, PaginationControls, SegmentedProbabilityBar, Countdown
  utils/
    api.js            Single choke point for backend calls
    bracket.js         Hardcoded bracket structure, slot resolution
    matchStatus.js      Live/completed/tournament-over helpers
    standings.js        Group standings computation
    format.js           Shared formatting helpers
```
