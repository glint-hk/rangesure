'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { DEFAULT_TARIFF } from '@/config';
import { estimateTrip } from '@/lib/energyModel';
import { buildSegments } from '@/lib/segments';
import { useSettings } from '@/lib/settingsContext';
import { useTripHistory } from '@/lib/tripHistoryContext';
import ResultsPanel from './ResultsPanel';
import GuidancePanel from './GuidancePanel';
import AssumptionsPopover from './AssumptionsPopover';

const RouteMap = dynamic(() => import('./RouteMap'), { ssr: false });

// The reference trip shown to the board (slide 9). Starts at 100% battery — the real
// ORS driving-hgv route (165 km via the old ghat road, not the 148 km expressway
// assumption) arrives with only ~12% at a full charge, so 80% would need a stop too.
const HERO_PRESET = {
  label: 'Mumbai → Pune',
  origin: 'Mumbai',
  destination: 'Pune',
  payload: 4000,
  battery: 100,
  tariff: DEFAULT_TARIFF,
};

// A longer, lower-battery trip that should trip the charging-stop path in the demo.
const NASHIK_PRESET = {
  label: 'Nashik run (needs charge)',
  origin: 'Mumbai',
  destination: 'Nashik',
  payload: 6000,
  battery: 20,
  tariff: DEFAULT_TARIFF,
};

// Recalibrated from the deck's original 0.82 kWh/km target after live verification:
// ORS's driving-hgv profile (the only profile this project's ORS key can access) routes
// Mumbai->Pune via the old ghat road, not the expressway the deck assumed — 165 km with
// ~2,000 m of real climbing, vs. the deck's 148 km. ~1.06 kWh/km is the honest live
// baseline for THIS route; Cd/Crr/P_aux/eta_regen in config.js are still there to tune if
// the live number drifts from that going forward (e.g. after an ORS/OSM data change).
const CALIBRATION_TARGET_KWH_PER_KM = 1.06;
const CALIBRATION_TOLERANCE = 0.05;

// Picks the steepest segment above a "notable" grade threshold, for the guidance
// layer to reference. Returns null if nothing on the route is steep enough to call out.
const NOTABLE_GRADE_PCT = 2;
function findNotableClimb(perSeg) {
  if (!perSeg || !perSeg.length) return null;
  let cumulative_m = 0;
  let best = null;
  for (const seg of perSeg) {
    if (seg.grade_pct > NOTABLE_GRADE_PCT && (!best || seg.grade_pct > best.grade_pct)) {
      best = { grade_pct: seg.grade_pct, at_km: cumulative_m / 1000 };
    }
    cumulative_m += seg.distance_m;
  }
  if (!best) return null;
  return {
    name: `Climb near km ${Math.round(best.at_km)}`,
    grade: `${best.grade_pct.toFixed(1)}%`,
  };
}

export default function DriverView() {
  const { vehicle, tariff: settingsTariff } = useSettings();
  const { addTrip } = useTripHistory();

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [payload, setPayload] = useState(HERO_PRESET.payload);
  const [battery, setBattery] = useState(HERO_PRESET.battery);
  const [tariff, setTariff] = useState(settingsTariff);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [route, setRoute] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [chargers, setChargers] = useState([]);
  const [result, setResult] = useState(null);
  const [recommendedStop, setRecommendedStop] = useState(null);
  const [weatherWarning, setWeatherWarning] = useState(false);
  const [chargingWarning, setChargingWarning] = useState(false);

  // SettingsProvider loads its saved tariff from localStorage in an effect, which runs
  // AFTER this component's first render — so the useState above can seed from the stale
  // pre-load default. Re-sync once settings finish loading, but only before the user has
  // run anything (don't clobber a manual edit mid-session).
  useEffect(() => {
    if (!route) setTariff(settingsTariff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsTariff]);

  const recompute = (originVal, destinationVal, routeData, weather, payloadKg, batteryPct, tariffVal) => {
    const segments = buildSegments(routeData.coordinates, routeData.distance_m, routeData.duration_s).map(
      (s) => ({
        ...s,
        temp_factor: weather?.temp_factor || 1,
        headwind_ms: weather?.wind_ms || 0,
      })
    );
    const r = estimateTrip({
      segments,
      payloadKg,
      battery_pct: batteryPct,
      tariff: tariffVal,
      params: vehicle,
    });

    console.log(`[EnergyModel] ${originVal} -> ${destinationVal}: kWh/km = ${r.kWh_per_km.toFixed(3)}`);
    const isHeroPreset =
      originVal.trim().toLowerCase() === HERO_PRESET.origin.toLowerCase() &&
      destinationVal.trim().toLowerCase() === HERO_PRESET.destination.toLowerCase();
    if (isHeroPreset) {
      const drift = Math.abs(r.kWh_per_km - CALIBRATION_TARGET_KWH_PER_KM);
      console.log(
        `[Calibration] Mumbai->Pune target ${CALIBRATION_TARGET_KWH_PER_KM} kWh/km, got ${r.kWh_per_km.toFixed(
          3
        )} (drift ${drift.toFixed(3)}).` +
          (drift > CALIBRATION_TOLERANCE
            ? ' Drift exceeds 0.03 — tune Cd/Crr/P_aux/eta_regen in config.js.'
            : ' Within tolerance.')
      );
    }

    return {
      ...r,
      notable_climb: findNotableClimb(r.perSeg),
      recommended_speed_kmh:
        routeData.duration_s > 0 ? Math.round((routeData.distance_m / routeData.duration_s) * 3.6) : null,
    };
  };

  // Accepts an optional override so preset buttons can fill fields and run in one click
  // without waiting on a state update to land first.
  const handleCalculate = async (override) => {
    const tripOrigin = override?.origin ?? origin;
    const tripDestination = override?.destination ?? destination;
    const tripPayload = override?.payload ?? payload;
    const tripBattery = override?.battery ?? battery;
    const tripTariff = override?.tariff ?? tariff;

    setLoading(true);
    setError(null);
    setResult(null);
    setRoute(null);
    setWeatherData(null);
    setChargers([]);
    setRecommendedStop(null);
    setWeatherWarning(false);
    setChargingWarning(false);

    try {
      const routeRes = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: tripOrigin, destination: tripDestination }),
      });
      const routeData = await routeRes.json();
      if (!routeRes.ok) throw new Error(routeData.error || 'Route lookup failed.');
      setRoute(routeData);

      const midIdx = Math.floor(routeData.coordinates.length / 2);
      const [midLon, midLat] = routeData.coordinates[midIdx];

      let weather = null;
      try {
        const weatherRes = await fetch('/api/weather', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: midLat, lon: midLon }),
        });
        weather = await weatherRes.json();
        if (!weatherRes.ok) {
          weather = null;
          setWeatherWarning(true);
        }
      } catch {
        weather = null;
        setWeatherWarning(true);
      }
      setWeatherData(weather);

      const r = recompute(tripOrigin, tripDestination, routeData, weather, tripPayload, tripBattery, tripTariff);
      setResult(r);
      addTrip({
        origin: tripOrigin,
        destination: tripDestination,
        payload: tripPayload,
        battery: tripBattery,
        tariff: tripTariff,
        dist_km: r.dist_km,
        total_kWh: r.total_kWh,
        kWh_per_km: r.kWh_per_km,
        predicted_full_range_km: r.predicted_full_range_km,
        arrival_soc_pct: r.arrival_soc_pct,
        cost_per_km: r.cost_per_km,
        feasible: r.feasible,
      });

      try {
        const chargingRes = await fetch('/api/charging', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: midLat, lon: midLon, distance_km: r.dist_km }),
        });
        const chargingData = await chargingRes.json();
        if (!chargingRes.ok) throw new Error('charging lookup failed');
        const stations = chargingData.stations || [];
        setChargers(stations);
        setRecommendedStop(!r.feasible && stations.length > 0 ? stations[0] : null);
      } catch {
        setChargers([]);
        setChargingWarning(true);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset) => {
    setOrigin(preset.origin);
    setDestination(preset.destination);
    setPayload(preset.payload);
    setBattery(preset.battery);
    setTariff(preset.tariff);
    handleCalculate(preset);
  };

  // Recompute live on slider changes — no refetch, reuses the already-fetched route + weather.
  useEffect(() => {
    if (!route) return;
    const r = recompute(origin, destination, route, weatherData, payload, battery, tariff);
    setResult(r);
    setRecommendedStop(!r.feasible && chargers.length > 0 ? chargers[0] : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, battery, tariff]);

  const positions = useMemo(
    () => (route ? route.coordinates.map(([lon, lat]) => [lat, lon]) : null),
    [route]
  );

  const chargingNeed = result
    ? result.feasible
      ? 'No stop'
      : recommendedStop
      ? `Stop at ${recommendedStop.title}`
      : 'Stop needed (no charger found nearby)'
    : '—';

  return (
    <div className="driver-view">
      <div className="driver-form">
        <div className="preset-row">
          <button className="preset-btn" onClick={() => applyPreset(HERO_PRESET)} type="button">
            {HERO_PRESET.label}
          </button>
          <button className="preset-btn" onClick={() => applyPreset(NASHIK_PRESET)} type="button">
            {NASHIK_PRESET.label}
          </button>
        </div>
        <div className="form-row">
          <label>
            Origin
            <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g. Mumbai" />
          </label>
          <label>
            Destination
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Pune"
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Payload (kg)
            <input type="number" value={payload} onChange={(e) => setPayload(Number(e.target.value))} />
          </label>
          <label>
            Battery (%)
            <input
              type="number"
              min="0"
              max="100"
              value={battery}
              onChange={(e) => setBattery(Number(e.target.value))}
            />
          </label>
          <label>
            Tariff (₹/kWh)
            <input type="number" step="0.1" value={tariff} onChange={(e) => setTariff(Number(e.target.value))} />
          </label>
        </div>
        <button
          className="calculate-btn"
          onClick={() => handleCalculate()}
          disabled={loading || !origin || !destination}
        >
          {loading && <span className="spinner" aria-hidden="true" />}
          {loading ? 'Optimising…' : 'Optimise Trip'}
        </button>
        {error && <div className="error-banner">{error}</div>}
        {weatherWarning && (
          <div className="warning-note">Live weather unavailable — using default conditions.</div>
        )}
        {chargingWarning && (
          <div className="warning-note">Couldn't fetch nearby chargers — charger markers may be incomplete.</div>
        )}
      </div>

      <div className="driver-body">
        <div className="map-pane">
          <RouteMap
            positions={positions}
            distanceKm={result?.dist_km || (route ? route.distance_m / 1000 : 0)}
            chargers={chargers}
            recommendedStop={recommendedStop}
          />
        </div>
        <div className="side-pane">
          {!result && !loading && (
            <div className="empty-state">
              Pick a preset above, or enter a trip and hit "Optimise Trip" to see the route,
              energy use, and driver guidance.
            </div>
          )}
          {loading && !result && (
            <div className="empty-state">
              <span className="spinner spinner-dark" aria-hidden="true" />
              Calculating route and energy use…
            </div>
          )}
          <ResultsPanel result={result} chargingNeed={chargingNeed} />
          {result && (
            <div className="trip-plan-panel">
              <h3>YOUR TRIP PLAN</h3>
              <GuidancePanel result={result} chargingNeed={chargingNeed} weather={weatherData} />
              <div className="confidence-line">
                Confidence: {result.confidence_low}–{result.confidence_high}%
              </div>
              <AssumptionsPopover />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
