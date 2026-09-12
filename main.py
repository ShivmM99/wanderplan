import os
import json
import time
import httpx
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from anthropic import Anthropic
from sklearn.cluster import KMeans

load_dotenv()

app = FastAPI(title="WanderPlan")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

anthropic_client = Anthropic()

DAILY_BUDGET_MINUTES = 8 * 60 

class PlanRequest(BaseModel):
    city: str
    days: int
    interests: str

def generate_candidates(city, days, interests):
    prompt = f"""You are a travel expert planning a trip to {city} for {days} days.
The traveler is interested in: {interests}.

Suggest between {days * 3} and {days * 4} real, specific attractions or places
worth visiting in {city} that match these interests.

Respond with ONLY a valid JSON array, no other text before or after.
Each element must be an object with exactly these keys:
- "name": the specific place name (string)
- "category": one short category label like "temple", "museum", "food", "park", "landmark" (string)
- "visit_minutes": estimated time to spend there, as a number (integer)
- "description": one short sentence on why it fits their interests (string)

Example format:
[
  {{"name": "Kinkaku-ji", "category": "temple", "visit_minutes": 60, "description": "Iconic golden temple set on a reflecting pond."}}
]"""

    message = anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    return json.loads(raw)

#Geocoding via Nominatim

def geocode_places(places, city):
    """Turn place names into lat/long. Respects Nominatim's 1 req/sec limit."""
    geocoded = []
    headers = {"User-Agent": "WanderPlan/1.0 (student project)"}

    with httpx.Client(timeout=15, headers=headers) as client:
        for place in places:
            query = f"{place['name']}, {city}"
            try:
                resp = client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": query, "format": "json", "limit": 1},
                )
                results = resp.json()
                if results:
                    place["lat"] = float(results[0]["lat"])
                    place["lon"] = float(results[0]["lon"])
                    geocoded.append(place)
            except Exception:
                pass 
            time.sleep(1.1) 

    return geocoded

#Travel-time matrix 

def get_travel_matrix(places):
    """Get pairwise travel times (seconds) between all places from OSRM."""
    coords = ";".join(f"{p['lon']},{p['lat']}" for p in places)
    url = f"https://router.project-osrm.org/table/v1/driving/{coords}"

    with httpx.Client(timeout=20) as client:
        resp = client.get(url, params={"annotations": "duration"})
        data = resp.json()

    return data.get("durations")

#The optimizer

def cluster_into_days(places, num_days):
    """Group places into day-clusters by geography, then balance by time budget."""
    coords = np.array([[p["lat"], p["lon"]] for p in places])

    #Geographic KMeans
    k = min(num_days, len(places))
    kmeans = KMeans(n_clusters=k, n_init=10, random_state=42)
    labels = kmeans.fit_predict(coords)

    days = [[] for _ in range(k)]
    for place, label in zip(places, labels):
        days[label].append(place)

    def day_minutes(day):
        return sum(p["visit_minutes"] for p in day)

    for _ in range(len(places)): 
        over = [i for i, d in enumerate(days) if day_minutes(d) > DAILY_BUDGET_MINUTES]
        if not over:
            break
        src = max(over, key=lambda i: day_minutes(days[i]))
        dst = min(range(k), key=lambda i: day_minutes(days[i]))
        if src == dst or not days[src]:
            break
        moved = max(days[src], key=lambda p: p["visit_minutes"])
        days[src].remove(moved)
        days[dst].append(moved)

    return days

def order_within_day(day, all_places, matrix):
    """Nearest-neighbor ordering of stops within a single day."""
    if len(day) <= 1:
        return day

    index_of = {id(p): all_places.index(p) for p in day}
    remaining = day[:]
    ordered = [remaining.pop(0)] 

    while remaining:
        last_idx = index_of[id(ordered[-1])]
        nearest = min(remaining, key=lambda p: matrix[last_idx][index_of[id(p)]])
        remaining.remove(nearest)
        ordered.append(nearest)

    return ordered

@app.post("/plan")
async def plan_trip(req: PlanRequest):
    # Get candidate attractions from Claude
    try:
        candidates = generate_candidates(req.city, req.days, req.interests)
    except Exception as e:
        raise HTTPException(500, f"Error generating candidates: {e}")

    geocoded = geocode_places(candidates, req.city)
    if len(geocoded) < 2:
        raise HTTPException(500, "Could not geocode enough places to plan a route.")

    try:
        matrix = get_travel_matrix(geocoded)
    except Exception as e:
        raise HTTPException(500, f"Error getting travel times: {e}")

    # Cluster into days
    day_clusters = cluster_into_days(geocoded, req.days)

    itinerary = []
    for i, day in enumerate(day_clusters):
        ordered = order_within_day(day, geocoded, matrix) if matrix else day
        itinerary.append({
            "day": i + 1,
            "stops": ordered,
            "total_visit_minutes": sum(p["visit_minutes"] for p in ordered),
        })

    return {
        "city": req.city,
        "days": req.days,
        "interests": req.interests,
        "geocoded_count": len(geocoded),
        "itinerary": itinerary,
    }

@app.get("/")
def health():
    return {"status": "ok"}