import { useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet"

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/plan"

// A color per day so the map is readable
const DAY_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

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
      if (!response.ok) throw new Error(`Server responded ${response.status}`)
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Flatten all stops to compute the map's center
  const allStops = result
    ? result.itinerary.flatMap((d) => d.stops)
    : []
  const mapCenter =
    allStops.length > 0
      ? [
          allStops.reduce((s, p) => s + p.lat, 0) / allStops.length,
          allStops.reduce((s, p) => s + p.lon, 0) / allStops.length,
        ]
      : [35.0116, 135.7681] // default: Kyoto

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-bold text-emerald-400 text-center mb-1">
          WanderPlan
        </h1>
        <p className="text-slate-400 text-center mb-8">
          AI-optimized trip itineraries
        </p>

        {/* Input form */}
        <div className="max-w-2xl mx-auto bg-slate-800 rounded-xl p-6 space-y-4 mb-8">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Destination</label>
            <input
              className="w-full rounded-lg bg-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Days</label>
            <input
              type="number"
              min="1"
              max="7"
              className="w-full rounded-lg bg-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Interests</label>
            <input
              className="w-full rounded-lg bg-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 py-2 font-semibold text-slate-900 transition"
          >
            {loading ? "Planning your trip… (this takes ~20s)" : "Plan My Trip"}
          </button>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto bg-red-900/40 border border-red-500 rounded-lg p-4 text-red-200 mb-8">
            Something went wrong: {error}
          </div>
        )}

        {result && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: itinerary list */}
            <div className="space-y-4">
              {result.itinerary.map((day, i) => (
                <div key={day.day} className="bg-slate-800 rounded-xl p-4">
                  <h2
                    className="text-lg font-bold mb-2"
                    style={{ color: DAY_COLORS[i % DAY_COLORS.length] }}
                  >
                    Day {day.day}
                    <span className="text-slate-400 text-sm font-normal ml-2">
                      ~{Math.round(day.total_visit_minutes / 60 * 10) / 10} hrs
                    </span>
                  </h2>
                  <ol className="space-y-2">
                    {day.stops.map((stop, idx) => (
                      <li key={stop.name} className="flex gap-3">
                        <span
                          className="flex-shrink-0 w-6 h-6 rounded-full text-slate-900 text-sm font-bold flex items-center justify-center"
                          style={{ background: DAY_COLORS[i % DAY_COLORS.length] }}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-medium">{stop.name}</div>
                          <div className="text-slate-400 text-sm">
                            {stop.category} · {stop.visit_minutes} min
                          </div>
                          <div className="text-slate-500 text-sm">{stop.description}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>

            {/* Right: map */}
            <div className="bg-slate-800 rounded-xl overflow-hidden h-[600px] sticky top-4">
              <MapContainer center={mapCenter} zoom={12} scrollWheelZoom={true}>
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {result.itinerary.map((day, i) => (
                  <div key={day.day}>
                    {/* route line for the day */}
                    <Polyline
                      positions={day.stops.map((s) => [s.lat, s.lon])}
                      color={DAY_COLORS[i % DAY_COLORS.length]}
                    />
                    {/* markers */}
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
      </div>
    </div>
  )
}

export default App