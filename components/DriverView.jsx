'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { SlidersHorizontal, Loader2, AlertCircle, Info } from 'lucide-react';
import { DEFAULT_TARIFF, VEHICLES } from '@/config';
import { estimateTrip } from '@/lib/energyModel';
import { buildSegments } from '@/lib/segments';
import { useSettings } from '@/lib/settingsContext';
import { useTripHistory } from '@/lib/tripHistoryContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import VerdictCard from './VerdictCard';
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
  const { vehicle, tariff: settingsTariff, selectVehicle } = useSettings();
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
  const [sheetOpen, setSheetOpen] = useState(false);

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
    setSheetOpen(false);

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

  const handleVehicleChange = (name) => {
    selectVehicle(name);
    const preset = VEHICLES.find((v) => v.name === name);
    if (preset) setPayload((p) => Math.min(p, preset.payload_max_kg));
  };

  const applyPreset = (preset) => {
    setOrigin(preset.origin);
    setDestination(preset.destination);
    setPayload(preset.payload);
    setBattery(preset.battery);
    setTariff(preset.tariff);
    handleCalculate(preset);
  };

  // Recompute live on slider/vehicle changes — no refetch, reuses the already-fetched
  // route + weather.
  useEffect(() => {
    if (!route) return;
    const r = recompute(origin, destination, route, weatherData, payload, battery, tariff);
    setResult(r);
    setRecommendedStop(!r.feasible && chargers.length > 0 ? chargers[0] : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, battery, tariff, vehicle]);

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

  const verdictProps = result
    ? {
        status: result.feasible ? 'ok' : 'warn',
        headline: result.feasible
          ? `You'll make it — arrive ${Math.round(result.arrival_soc_pct)}%`
          : recommendedStop
          ? `Charge once at ${recommendedStop.title}`
          : 'Charging stop needed en route',
        subline: `${Math.round(result.dist_km)} km · ${result.kWh_per_km.toFixed(2)} kWh/km`,
        confidenceLow: result.confidence_low,
        confidenceHigh: result.confidence_high,
      }
    : null;

  const inputsForm = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => applyPreset(HERO_PRESET)} type="button">
          {HERO_PRESET.label}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => applyPreset(NASHIK_PRESET)} type="button">
          {NASHIK_PRESET.label}
        </Button>
      </div>
      <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
        <div className="flex items-center gap-1.5">
          Vehicle
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Tata Motors CV, Auto Expo 2025 / 2026 delivery releases (estimated physics params).
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Select value={vehicle.name} onValueChange={handleVehicleChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select vehicle" />
          </SelectTrigger>
          <SelectContent>
            {VEHICLES.map((v) => (
              <SelectItem key={v.name} value={v.name}>
                {v.name} · {v.battery_kWh} kWh · {v.payload_max_kg.toLocaleString()} kg payload
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Origin
          <input
            className="h-11 rounded-xl border border-border bg-surface-raised px-3 text-[15px] text-foreground outline-none focus:ring-2 focus:ring-primary/50"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="e.g. Mumbai"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Destination
          <input
            className="h-11 rounded-xl border border-border bg-surface-raised px-3 text-[15px] text-foreground outline-none focus:ring-2 focus:ring-primary/50"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Pune"
          />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Payload (kg, max {vehicle.payload_max_kg?.toLocaleString()})
          <input
            type="number"
            max={vehicle.payload_max_kg}
            className="h-11 rounded-xl border border-border bg-surface-raised px-3 text-[15px] text-foreground outline-none focus:ring-2 focus:ring-primary/50"
            value={payload}
            onChange={(e) => setPayload(Math.min(Number(e.target.value), vehicle.payload_max_kg))}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Battery (%)
          <input
            type="number"
            min="0"
            max="100"
            className="h-11 rounded-xl border border-border bg-surface-raised px-3 text-[15px] text-foreground outline-none focus:ring-2 focus:ring-primary/50"
            value={battery}
            onChange={(e) => setBattery(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Tariff (₹/kWh)
          <input
            type="number"
            step="0.1"
            className="h-11 rounded-xl border border-border bg-surface-raised px-3 text-[15px] text-foreground outline-none focus:ring-2 focus:ring-primary/50"
            value={tariff}
            onChange={(e) => setTariff(Number(e.target.value))}
          />
        </label>
      </div>
      <Button
        size="lg"
        onClick={() => handleCalculate()}
        disabled={loading || !origin || !destination}
        type="button"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {loading ? 'Optimising…' : 'Optimise Trip'}
      </Button>
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
      {weatherWarning && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Live weather unavailable — using default conditions.
        </div>
      )}
      {chargingWarning && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Couldn't fetch nearby chargers — charger markers may be incomplete.
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl">
      {/* Mobile: collapsible inputs sheet */}
      <div className="mb-4 lg:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="secondary" className="w-full justify-between" type="button">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                {origin && destination ? `${origin} → ${destination}` : 'Plan a trip'}
              </span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" title="Trip details">
            {inputsForm}
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1.5fr_1fr] lg:items-start">
        {/* Desktop: inline inputs pane */}
        <Card className="hidden p-5 lg:block">{inputsForm}</Card>

        {/* Mobile order: verdict, metrics, map, guidance. Desktop: map is the center pane. */}
        <div className="order-2 h-[320px] overflow-hidden rounded-2xl border border-border lg:order-none lg:h-[560px]">
          <RouteMap
            positions={positions}
            distanceKm={result?.dist_km || (route ? route.distance_m / 1000 : 0)}
            chargers={chargers}
            recommendedStop={recommendedStop}
          />
        </div>

        <div className="order-1 flex flex-col gap-4 lg:order-none">
          {!result && !loading && (
            <Card className="flex items-center gap-2 border-dashed p-5 text-sm text-muted-foreground">
              Pick a preset above, or enter a trip and hit "Optimise Trip" to see the route, energy
              use, and driver guidance.
            </Card>
          )}
          {loading && !result && (
            <Card className="p-5">
              <Skeleton className="mb-3 h-6 w-2/3" />
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </Card>
          )}

          {result && verdictProps && <VerdictCard {...verdictProps} />}

          {result && <ResultsPanel result={result} chargingNeed={chargingNeed} />}

          {result && (
            <Card className="p-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your trip plan
              </h3>
              <GuidancePanel result={result} chargingNeed={chargingNeed} weather={weatherData} />
              <AssumptionsPopover />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
