import { useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet"

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/plan"

const DAY_COLORS = ["#2563EB", "#0D9488", "#EA580C", "#DB2777", "#7C3AED", "#CA8A04"]

function App() {
  const [city, setCity] = useState("Kyoto, Japan")
  const [days, setDays] = useState(3)
  const [interests, setInterests] = useState("temples, traditional food, gardens, not too rushed")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, days: Number(days), interests }),
      })
      if (!response.ok) throw new Error(`The planner is waking up — please try again in a moment.`)
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const allStops = result ? result.itinerary.flatMap((d) => d.stops) : []
  const mapCenter =
    allStops.length > 0
      ? [
          allStops.reduce((s, p) => s + p.lat, 0) / allStops.length,
          allStops.reduce((s, p) => s + p.lon, 0) / allStops.length,
        ]
      : [35.0116, 135.7681]

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-zinc-900 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
            <span className="font-semibold tracking-tight">WanderPlan</span>
          </div>
          <span className="text-sm text-zinc-500">AI itinerary optimizer</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Search form */}
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">
            Plan a trip worth taking.
          </h1>
          <p className="text-zinc-500 mb-8">
            Describe where you're going and what you love. We'll build an
            optimized day-by-day route.
          </p>

          <div className="grid sm:grid-cols-[1fr_auto] gap-3 mb-3">
            <input
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-zinc-900 transition"
              placeholder="Destination"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <input
              type="number"
              min="1"
              max="7"
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-zinc-900 transition w-full sm:w-24"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
          <input
            className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-zinc-900 transition mb-4"
            placeholder="What are you interested in?"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-lg bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 hover:bg-zinc-700 disabled:opacity-40 transition"
          >
            {loading ? "Planning…" : "Plan my trip"}
          </button>
        </div>

        {error && (
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 max-w-3xl">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="mt-16 border-t border-zinc-200 pt-16 text-center">
            <p className="text-zinc-400 text-sm">
              Your optimized itinerary and map will appear here.
            </p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-12 grid lg:grid-cols-[1fr_1.2fr] gap-10">
            {/* Itinerary */}
            <div>
              {result.itinerary.map((day, i) => (
                <div key={day.day} className="mb-10">
                  <div className="flex items-baseline gap-3 mb-4">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: DAY_COLORS[i % DAY_COLORS.length] }}
                    />
                    <h2 className="text-lg font-semibold tracking-tight">Day {day.day}</h2>
                    <span className="text-sm text-zinc-400">
                      {Math.round(day.total_visit_minutes / 60 * 10) / 10} hours
                    </span>
                  </div>
                  <div className="space-y-0">
                    {day.stops.map((stop, idx) => (
                      <div
                        key={stop.name}
                        className="flex gap-4 py-4 border-t border-zinc-100 first:border-t-0"
                      >
                        <span className="text-sm text-zinc-300 font-medium pt-0.5 w-4">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-medium">{stop.name}</div>
                          <div className="text-xs text-zinc-400 mt-0.5 mb-1">
                            {stop.category} · {stop.visit_minutes} min
                          </div>
                          <div className="text-sm text-zinc-500 leading-relaxed">
                            {stop.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Map */}
            <div className="rounded-xl overflow-hidden border border-zinc-200 h-[600px] lg:sticky lg:top-6">
              <MapContainer center={mapCenter} zoom={12} scrollWheelZoom={true}>
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {result.itinerary.map((day, i) => (
                  <div key={day.day}>
                    <Polyline
                      positions={day.stops.map((s) => [s.lat, s.lon])}
                      color={DAY_COLORS[i % DAY_COLORS.length]}
                      weight={3}
                      opacity={0.7}
                    />
                    {day.stops.map((stop, idx) => (
                      <Marker key={stop.name} position={[stop.lat, stop.lon]}>
                        <Popup>
                          <strong>Day {day.day} · Stop {idx + 1}</strong>
                          <br />
                          {stop.name}
                        </Popup>
                      </Marker>
                    ))}
                  </div>
                ))}
              </MapContainer>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App