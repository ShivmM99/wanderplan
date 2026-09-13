# WanderPlan

**Live app:** https://wanderplan-alpha.vercel.app
**Source:** https://github.com/ShivmM99/wanderplan

WanderPlan turns a plain-language travel wish — a city, a trip length, and a few interests — into an optimized, day-by-day itinerary plotted on an interactive map. You describe the kind of trip you want; it decides *what* to see, *which days* to see it on, and *in what order*, so you spend time at places instead of crisscrossing the city.

> **Note on the first load:** the backend runs on a free tier that sleeps when idle, and geocoding is intentionally rate-limited to respect OpenStreetMap's usage policy. The first plan after a period of inactivity can take 30–60 seconds. Subsequent plans are faster.

## What it does

1. You enter a destination, number of days, and your interests (e.g. "temples, traditional food, gardens, not too rushed").
2. A large language model turns that fuzzy description into **structured data** — a list of real, specific attractions, each tagged with a category and an estimated visit time.
3. The backend geocodes each place, computes travel times between every pair, and runs an optimizer that groups the attractions into days and orders each day for minimal travel.
4. The result renders as a clean itinerary alongside a map, with each day color-coded and its route drawn.

## How generative AI is used

The language model does the part that is genuinely hard to formalize: understanding an open-ended human description and producing structured, machine-usable output. It is prompted to return a strict JSON array of attractions — name, category, visit duration, and a one-line rationale — with no prose, so the rest of the pipeline can consume it directly.

This is a deliberate division of labor. The model handles fuzzy language understanding; a classic algorithm handles the optimization the model cannot do reliably. The AI is load-bearing, not decorative — without it, there is no candidate set to optimize.

## The optimization

Grouping attractions into days is a constrained clustering problem, closely related to the travelling salesman problem. WanderPlan:

- **Clusters geographically** using K-means over the attractions' coordinates, so each day covers a tight area.
- **Balances by time budget** with a rebalancing pass that moves stops off any day exceeding a realistic daily activity budget, so no single day is overloaded.
- **Orders within each day** with a nearest-neighbor heuristic over the travel-time matrix, so stops flow sensibly.

## Tech stack

- **Frontend:** React, Vite, Tailwind CSS, Leaflet (OpenStreetMap tiles)
- **Backend:** Python, FastAPI
- **AI:** Anthropic API (structured candidate generation)
- **Geospatial:** Nominatim (geocoding) and OSRM (travel-time matrix) — both free, OpenStreetMap-based
- **Optimization:** scikit-learn (K-means), NumPy, custom heuristics
- **Deployment:** Vercel (frontend), Render (backend)

## Running locally

Backend:

```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# add ANTHROPIC_API_KEY to a .env file
uvicorn main:app --reload
```

Frontend:

```
cd frontend
npm install
npm run dev
```

The frontend expects the backend at `http://127.0.0.1:8000` by default, or set `VITE_API_URL` to point elsewhere.

## Known limitations & future work

- **Geocoding coverage.** Vague place names (e.g. a category rather than a specific venue) sometimes fail to resolve and are skipped, which can shorten a day. A fallback that asks the model for coordinates directly would improve coverage.
- **No opening-hours constraints yet.** The optimizer respects a daily time budget but does not yet account for when places are actually open. Adding time-window constraints would turn the day-grouping into a fuller scheduling problem.
- **Public routing servers.** Uses the public OSRM and Nominatim instances, which are rate-limited and meant for light use. A production version would self-host these.
- **Further optimization axes.** Cost, weather, opening hours, and preferred pace could be weighted into the objective, making it a true multi-variable optimizer.

## Author

Built solo by Shivm Mehta.
