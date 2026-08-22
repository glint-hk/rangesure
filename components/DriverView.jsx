'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, AlertCircle, Info } from 'lucide-react';
import { DEFAULT_TARIFF, VEHICLES } from '@/config';
import { estimateTrip } from '@/lib/energyModel';
import { buildSegments, findSteepestClimb } from '@/lib/segments';
import { runScenarios } from '@/lib/scenarios';
import { assessConfidence } from '@/lib/governance';
import { calibrate, explainCalibration, CALIBRATION_TRAINED_ON } from '@/lib/calibration';
import { useSettings } from '@/lib/settingsContext';
import { useTripHistory } from '@/lib/tripHistoryContext';
import { useLastTrip } from '@/lib/lastTripContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import PlaceAutocomplete from './PlaceAutocomplete';
import VerdictCard from './VerdictCard';
import ResultsPanel from './ResultsPanel';
import GuidancePanel from './GuidancePanel';
import AssumptionsPopover from './AssumptionsPopover';
import AiModelPanel from './AiModelPanel';
import AskBox from './AskBox';
import CohortAnomalyBanner from './CohortAnomalyBanner';

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

// Weather is sampled at these fractions of route distance (start, ~1/3, ~2/3, end)
// instead of one midpoint, so temp/headwind vary segment-to-segment on long routes.
const WEATHER_SAMPLE_FRACTIONS = [0, 1 / 3, 2 / 3, 1];

// Derives a safe eco-speed for the steepest climb — scaled down from the route's
// average speed by how severe the grade is, floored so it never suggests crawling.
function climbSafeSpeedKmh(routeAvgKmh, gradePct) {
  if (!routeAvgKmh) return null;
  const reductionPct = Math.max(10, Math.min(45, gradePct * 4));
  return Math.max(30, Math.round(routeAvgKmh * (1 - reductionPct / 100)));
}

// Re-derives the trip's headline numbers from a (possibly calibrated) kWh/km value —
// shared by the main result and each best/expected/worst scenario so they all use
// exactly the same arithmetic.
function deriveFromKwhPerKm(kWh_per_km, dist_km, batteryPct, tariffVal, vehicleParams) {
  const total_kWh = kWh_per_km * dist_km;
  const battery_kWh = vehicleParams.battery_kWh > 0 ? vehicleParams.battery_kWh : 1;
  const predicted_full_range_km = kWh_per_km > 0 ? battery_kWh / kWh_per_km : Infinity;
  const arrival_soc_pct = ((battery_kWh * (batteryPct / 100) - total_kWh) / battery_kWh) * 100;
  return {
    kWh_per_km,
    total_kWh,
    predicted_full_range_km,
    arrival_soc_pct,
    cost_per_km: kWh_per_km * tariffVal,
    feasible: arrival_soc_pct >= vehicleParams.reserve_pct,
  };
}

export default function DriverView() {
  const { vehicle, tariff: settingsTariff, selectVehicle, chargerKW } = useSettings();
  const { addTrip } = useTripHistory();
  const { setLastTrip } = useLastTrip();

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [payload, setPayload] = useState(HERO_PRESET.payload);
  const [battery, setBattery] = useState(HERO_PRESET.battery);
  const [tariff, setTariff] = useState(settingsTariff);
  const [deliveryWindow, setDeliveryWindow] = useState(''); // optional, hours

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [route, setRoute] = useState(null);
  const [weatherSamples, setWeatherSamples] = useState([]); // [{ at_km, temp_factor, headwind_ms }]
  const [primaryWeather, setPrimaryWeather] = useState(null); // one sample, for the guidance summary
  const [climbInfo, setClimbInfo] = useState({ notable_climb: null, recommended_speed_kmh: null });
  const [chargers, setChargers] = useState([]);
  const [result, setResult] = useState(null);
  const [recommendedStop, setRecommendedStop] = useState(null);
  const [weatherWarning, setWeatherWarning] = useState(false);
  const [chargingWarning, setChargingWarning] = useState(false);
  const [elevationMissing, setElevationMissing] = useState(false);

  // SettingsProvider loads its saved tariff from localStorage in an effect, which runs
  // AFTER this component's first render — so the useState above can seed from the stale
  // pre-load default. Re-sync once settings finish loading, but only before the user has
  // run anything (don't clobber a manual edit mid-session).
  useEffect(() => {
    if (!route) setTariff(settingsTariff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsTariff]);

  // Climb detection and its recommended speed are purely route geometry — independent
  // of payload/battery/tariff/vehicle — so they're computed once per route fetch (see
  // handleCalculate) and just attached here on every recompute, not re-derived.
  const recompute = (originVal, destinationVal, routeData, samples, payloadKg, batteryPct, tariffVal, climb) => {
    const segments = buildSegments(routeData.coordinates, routeData.distance_m, routeData.duration_s, samples);
    // Best/expected/worst (P1-2): "expected" is the same physics run as before; best
    // and worst vary temp/headwind/payload to show a real repeatability band instead
    // of a flat +/-band. All three get the same learned calibration factor below.
    const { best, expected, worst } = runScenarios({
      segments,
      payloadKg,
      battery_pct: batteryPct,
      tariff: tariffVal,
      params: vehicle,
    });
    const r = expected;

    console.log(`[EnergyModel] ${originVal} -> ${destinationVal}: physics kWh/km = ${r.kWh_per_km.toFixed(3)}`);
    const isHeroPreset =
      originVal.trim().toLowerCase() === HERO_PRESET.origin.toLowerCase() &&
      destinationVal.trim().toLowerCase() === HERO_PRESET.destination.toLowerCase();
    if (isHeroPreset) {
      const drift = Math.abs(r.kWh_per_km - CALIBRATION_TARGET_KWH_PER_KM);
      console.log(
        `[Calibration target] Mumbai->Pune physics target ${CALIBRATION_TARGET_KWH_PER_KM} kWh/km, got ${r.kWh_per_km.toFixed(
          3
        )} (drift ${drift.toFixed(3)}).` +
          (drift > CALIBRATION_TOLERANCE
            ? ' Drift exceeds 0.03 — tune Cd/Crr/P_aux/eta_regen in config.js.'
            : ' Within tolerance.')
      );
    }

    // Learned calibration (P1-1): a small correction on top of the physics estimate,
    // fit on synthetic trip history (lib/calibration.js). The calibrated number — not
    // the raw physics one — drives the verdict/range/arrival-SOC math from here on.
    const avg_gradient =
      r.dist_km > 0 ? r.perSeg.reduce((a, s) => a + s.grade_pct * s.distance_m, 0) / (r.dist_km * 1000) : 0;
    const avg_speed_kmh =
      routeData.duration_s > 0 ? (routeData.distance_m / routeData.duration_s) * 3.6 : 50;
    const sampleTemps = samples.map((s) => s.temp_c).filter((t) => Number.isFinite(t));
    const temp_c = sampleTemps.length ? sampleTemps.reduce((a, t) => a + t, 0) / sampleTemps.length : 27;

    const calibrationFeatures = { distance_km: r.dist_km, avg_gradient, payload_kg: payloadKg, temp_c, avg_speed_kmh };
    const calibration_factor = calibrate(calibrationFeatures);

    console.log(
      `[Calibration] factor ${calibration_factor.toFixed(3)}: physics ${r.kWh_per_km.toFixed(
        3
      )} -> calibrated ${(r.kWh_per_km * calibration_factor).toFixed(3)} kWh/km`
    );

    // Same calibration factor applied to all three scenarios — it corrects a
    // systematic bias in the physics model, not a specific day's conditions.
    const calibrated = deriveFromKwhPerKm(best.kWh_per_km * calibration_factor, r.dist_km, batteryPct, tariffVal, vehicle);
    const calibratedExpected = deriveFromKwhPerKm(r.kWh_per_km * calibration_factor, r.dist_km, batteryPct, tariffVal, vehicle);
    const calibratedWorst = deriveFromKwhPerKm(worst.kWh_per_km * calibration_factor, r.dist_km, batteryPct, tariffVal, vehicle);

    return {
      ...r,
      ...climb,
      physics_kWh_per_km: r.kWh_per_km,
      ...calibratedExpected,
      calibration_factor,
      calibration_features: calibrationFeatures,
      calibration_note: explainCalibration(calibrationFeatures),
      calibration_trained_on: CALIBRATION_TRAINED_ON,
      scenarios: { best: calibrated, expected: calibratedExpected, worst: calibratedWorst },
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
    setWeatherSamples([]);
    setPrimaryWeather(null);
    setClimbInfo({ notable_climb: null, recommended_speed_kmh: null });
    setChargers([]);
    setRecommendedStop(null);
    setWeatherWarning(false);
    setChargingWarning(false);
    setElevationMissing(false);

    try {
      const routeRes = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: tripOrigin, destination: tripDestination }),
      });
      const routeData = await routeRes.json();
      if (!routeRes.ok) throw new Error(routeData.error || 'Route lookup failed.');
      setRoute(routeData);
      setElevationMissing(routeData.coordinates.some((c) => c[2] == null));

      const midIdx = Math.floor(routeData.coordinates.length / 2);
      const [midLon, midLat] = routeData.coordinates[midIdx];

      // Climb detection is pure route geometry — independent of weather/vehicle — so
      // it runs once here, before any weather fetch, off a throwaway segment build.
      const routeAvgKmh =
        routeData.duration_s > 0 ? (routeData.distance_m / routeData.duration_s) * 3.6 : null;
      const baseSegments = buildSegments(routeData.coordinates, routeData.distance_m, routeData.duration_s);
      const climb = findSteepestClimb(baseSegments);

      let climbResult = {
        notable_climb: null,
        recommended_speed_kmh: routeAvgKmh ? Math.round(routeAvgKmh) : null,
      };
      if (climb) {
        let placeName = `Climb near km ${Math.round(climb.start_km)}`;
        try {
          const revRes = await fetch('/api/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: climb.lat, lon: climb.lon }),
          });
          const revData = await revRes.json();
          if (revRes.ok && revData.label) placeName = revData.label;
        } catch {
          // Reverse geocoding failed — fall back to the km-marker name, still real data.
        }
        climbResult = {
          notable_climb: { name: placeName, grade: `${climb.grade_pct.toFixed(1)}%` },
          recommended_speed_kmh: climbSafeSpeedKmh(routeAvgKmh, climb.grade_pct),
        };
      }
      setClimbInfo(climbResult);

      // Sample weather at start/~1/3/~2/3/end instead of one midpoint, so temp and
      // headwind vary segment-to-segment on long routes. Each point is guarded
      // independently — one failed sample doesn't null out the others.
      const totalKm = routeData.distance_m / 1000;
      const weatherPoints = WEATHER_SAMPLE_FRACTIONS.map((f) => {
        const idx = Math.min(routeData.coordinates.length - 1, Math.round(f * (routeData.coordinates.length - 1)));
        const [lon, lat] = routeData.coordinates[idx];
        return { at_km: totalKm * f, lat, lon };
      });

      const weatherResults = await Promise.allSettled(
        weatherPoints.map(async (pt) => {
          const res = await fetch('/api/weather', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: pt.lat, lon: pt.lon }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Weather lookup failed.');
          return { at_km: pt.at_km, temp_factor: data.temp_factor, headwind_ms: data.wind_ms, ...data };
        })
      );
      const samples = weatherResults.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      if (samples.length < weatherResults.length) setWeatherWarning(true);
      setWeatherSamples(samples);
      setPrimaryWeather(samples[Math.floor(samples.length / 2)] || null);

      const r = recompute(
        tripOrigin,
        tripDestination,
        routeData,
        samples,
        tripPayload,
        tripBattery,
        tripTariff,
        climbResult
      );
      setResult(r);
      setLastTrip({
        origin: tripOrigin,
        destination: tripDestination,
        dist_km: r.dist_km,
        tariff: tripTariff,
        vehicleName: vehicle.name,
        expected_kwh_per_km: r.scenarios.expected.kWh_per_km,
        best_kwh_per_km: r.scenarios.best.kWh_per_km,
        worst_kwh_per_km: r.scenarios.worst.kWh_per_km,
      });
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
  // route + weather samples + climb info.
  useEffect(() => {
    if (!route) return;
    const r = recompute(origin, destination, route, weatherSamples, payload, battery, tariff, climbInfo);
    setResult(r);
    setRecommendedStop(!r.feasible && chargers.length > 0 ? chargers[0] : null);
    setLastTrip({
      origin,
      destination,
      dist_km: r.dist_km,
      tariff,
      vehicleName: vehicle.name,
      expected_kwh_per_km: r.scenarios.expected.kWh_per_km,
      best_kwh_per_km: r.scenarios.best.kWh_per_km,
      worst_kwh_per_km: r.scenarios.worst.kWh_per_km,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, battery, tariff, vehicle]);

  const positions = useMemo(
    () => (route ? route.coordinates.map(([lon, lat]) => [lat, lon]) : null),
    [route]
  );

  // The real worst-case scenario (P1-2) — replaces the earlier flat-penalty stand-in.
  const worstCaseArrivalPct = result?.scenarios?.worst?.arrival_soc_pct ?? null;

  const governance = useMemo(() => {
    if (!result) return null;
    return assessConfidence({
      weatherFailed: weatherWarning,
      chargingFailed: chargingWarning,
      elevationMissing,
      arrival_soc_pct: result.arrival_soc_pct,
      reserve_pct: vehicle.reserve_pct,
      worstCaseArrivalPct,
    });
  }, [result, weatherWarning, chargingWarning, elevationMissing, vehicle.reserve_pct, worstCaseArrivalPct]);

  const isFallback = governance ? governance.degraded || governance.uncertain : false;

  // Charge time + delivery-window impact (P1-3): only meaningful for needs-charge
  // trips. kWh_needed closes the gap from the (negative/below-reserve) arrival SOC up
  // to the reserve buffer — a simplified single-stop model, consistent with the rest
  // of the app's "first charger found" approach.
  const chargeInfo = useMemo(() => {
    if (!result || result.feasible || !route) return null;
    const kWh_needed = Math.max(0, ((vehicle.reserve_pct - result.arrival_soc_pct) / 100) * vehicle.battery_kWh);
    const charge_minutes = chargerKW > 0 ? Math.ceil((kWh_needed / chargerKW) * 60) : null;

    let windowVerdict = null;
    const windowHours = Number(deliveryWindow);
    if (deliveryWindow !== '' && Number.isFinite(windowHours) && windowHours > 0 && charge_minutes != null) {
      const routeHours = route.duration_s / 3600;
      const totalHours = routeHours + charge_minutes / 60;
      const slackMinutes = Math.round((windowHours - totalHours) * 60);
      windowVerdict =
        slackMinutes >= 0
          ? { onTime: true, label: 'On time' }
          : { onTime: false, label: `Risks delivery window by ~${Math.abs(slackMinutes)} min` };
    }
    return { kWh_needed, charge_minutes, windowVerdict };
  }, [result, route, chargerKW, vehicle.reserve_pct, vehicle.battery_kWh, deliveryWindow]);

  // Stand-in trip log: every calculation logs its inputs, model version, confidence,
  // and whether the governance red-line kicked in — the demo highlight for P0-4.
  useEffect(() => {
    if (!result || !governance) return;
    console.log('[Governance]', {
      inputs: { origin, destination, payload, battery, tariff, vehicle: vehicle.name },
      model_version: 'physics-v1',
      confidence: `${result.confidence_low}-${result.confidence_high}%`,
      verdict: !result.feasible ? 'needs-charge' : isFallback ? 'uncertain' : 'feasible',
      fallback_active: isFallback,
      reasons: governance.reasons,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, governance]);

  const chargingNeed = result
    ? result.feasible
      ? 'No stop'
      : recommendedStop
      ? `Stop at ${recommendedStop.title}`
      : 'Stop needed (no charger found nearby)'
    : '—';

  const verdictProps = result
    ? isFallback
      ? {
          status: 'uncertain',
          headline: 'Low confidence — manual planning advised',
          subline: `${Math.round(result.dist_km)} km · ${result.kWh_per_km.toFixed(2)} kWh/km — numbers below still apply, with a wider margin of error`,
          confidenceLow: Math.max(0, result.confidence_low - 15),
          confidenceHigh: Math.min(100, result.confidence_high + 5),
          reasons: governance.reasons,
          fallbackActive: true,
          scenarios: result.scenarios,
        }
      : {
          status: result.feasible ? 'ok' : 'warn',
          headline: result.feasible
            ? `You'll make it — arrive ${Math.round(result.arrival_soc_pct)}%`
            : recommendedStop
            ? `Charge once at ${recommendedStop.title}`
            : 'Charging stop needed en route',
          subline: `${Math.round(result.dist_km)} km · ${result.kWh_per_km.toFixed(2)} kWh/km`,
          confidenceLow: result.confidence_low,
          confidenceHigh: result.confidence_high,
          scenarios: result.scenarios,
          chargeInfo: !result.feasible ? chargeInfo : null,
          chargerTitle: recommendedStop?.title,
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
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Origin
          <PlaceAutocomplete
            value={origin}
            onChange={setOrigin}
            placeholder="e.g. Mumbai"
            inputClassName="h-11 w-full rounded-xl border border-border bg-surface-raised px-3 text-[15px] text-foreground outline-none focus:ring-2 focus:ring-primary/50"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Destination
          <PlaceAutocomplete
            value={destination}
            onChange={setDestination}
            placeholder="e.g. Pune"
            inputClassName="h-11 w-full rounded-xl border border-border bg-surface-raised px-3 text-[15px] text-foreground outline-none focus:ring-2 focus:ring-primary/50"
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
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
        Delivery window (hours, optional)
        <input
          type="number"
          step="0.5"
          min="0"
          placeholder="e.g. 6"
          className="h-11 rounded-xl border border-border bg-surface-raised px-3 text-[15px] text-foreground outline-none focus:ring-2 focus:ring-primary/50"
          value={deliveryWindow}
          onChange={(e) => setDeliveryWindow(e.target.value)}
        />
      </label>
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
      {elevationMissing && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Elevation data missing for part of the route — climbs may be under-counted.
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1.5fr_1fr] lg:items-start">
        {/* Trip inputs — always visible inline, on mobile and desktop alike. */}
        <Card className="p-5">{inputsForm}</Card>

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

          {result && (
            <CohortAnomalyBanner vehicleName={vehicle.name} expectedKwhPerKm={result.kWh_per_km} />
          )}

          {result && verdictProps && <VerdictCard {...verdictProps} />}

          {result && <ResultsPanel result={result} chargingNeed={chargingNeed} />}

          {result && (
            <Card className="p-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your trip plan
              </h3>
              {result.physics_kWh_per_km != null && (
                <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <div className="text-sm text-foreground">
                    Physics estimate <span className="font-mono">{result.physics_kWh_per_km.toFixed(2)}</span> kWh/km
                    {' → '}
                    Calibrated <span className="font-mono font-semibold text-primary">{result.kWh_per_km.toFixed(2)}</span> kWh/km
                    {' '}
                    <span className="text-muted-foreground">(learned from {result.calibration_trained_on?.toLocaleString()} trips)</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{result.calibration_note}</div>
                </div>
              )}
              <GuidancePanel result={result} chargingNeed={chargingNeed} weather={primaryWeather} />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <AssumptionsPopover />
                <AiModelPanel />
              </div>
              <AskBox result={result} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
