'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Loader2,
  AlertCircle,
  MapPinned,
  Gauge,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Check,
  RefreshCw,
} from 'lucide-react';
import { DEFAULT_TARIFF, VEHICLES } from '@/config';
import { buildSegments, findSteepestClimb } from '@/lib/segments';
import { computeTrip, weatherPoints, chargerSearchPoints } from '@/lib/tripEngine';
import { assessConfidence, CONFIDENCE_COPY } from '@/lib/governance';
import { planChargingStops } from '@/lib/chargingPlan';
import { fmtNum } from '@/lib/format';
import { useSettings } from '@/lib/settingsContext';
import { useTripHistory } from '@/lib/tripHistoryContext';
import { useLastTrip } from '@/lib/lastTripContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InfoHint } from '@/components/ui/info-hint';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import PlaceAutocomplete from './PlaceAutocomplete';
import VerdictCard from './VerdictCard';
import ResultsPanel from './ResultsPanel';
import GuidancePanel from './GuidancePanel';
import AssumptionsPopover from './AssumptionsPopover';
import AiModelPanel from './AiModelPanel';
import AskBox from './AskBox';
import CohortAnomalyBanner from './CohortAnomalyBanner';
import EnergyBreakdown from './EnergyBreakdown';

const RouteMap = dynamic(() => import('./RouteMap'), { ssr: false });

// The reference trip shown to the board. Starts at 100% battery: on the real truck route
// the arrival margin at 80% is too thin, so a lower start would need a stop.
const HERO_PRESET = {
  label: 'Mumbai → Pune',
  origin: 'Mumbai',
  destination: 'Pune',
  payload: 4000,
  battery: 100,
  tariff: DEFAULT_TARIFF,
};

// A longer, lower-battery trip that exercises the charging-stop planner.
// Payload must never exceed the demo-default e-ICV 11T's payload_max_kg (4,000).
const NASHIK_PRESET = {
  label: 'Nashik run (needs charge)',
  origin: 'Mumbai',
  destination: 'Nashik',
  payload: 4000,
  battery: 40,
  tariff: DEFAULT_TARIFF,
};

// Live physics baseline for the Mumbai→Pune preset on the e-ICV 11T (4,000 kg, mild
// weather), re-measured after elevation smoothing and direction-aware wind were added
// (ORS truck route now 156 km). Logged as a drift check only — the model is never tuned
// to hit it; Cd/Crr/P_aux/eta_regen in config.js are the knobs if real data disagrees.
const CALIBRATION_TARGET_KWH_PER_KM = 0.93;
const CALIBRATION_TOLERANCE = 0.05;

// Average speed a truck does on a short detour to a charger and back.
const DETOUR_SPEED_KMH = 40;

const STAGES = [
  { key: 'route', label: 'Finding the route a heavy truck can take' },
  { key: 'details', label: 'Reading terrain, live weather and chargers along it' },
  { key: 'model', label: 'Running the physics model and AI calibration' },
];

const INPUT_CLASS =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-[13.5px] text-foreground shadow-[0_1px_1px_rgba(18,23,43,0.03)] outline-none transition-colors placeholder:text-muted-foreground/80 hover:border-[#d6d0c2] focus:border-accent/60 focus:ring-2 focus:ring-accent/20';

// Tracks the `lg` breakpoint so the "How we worked it out" panel renders once, in the
// right place for the layout (two mounted copies would double-fire the guidance fetch).
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mql.matches);
    const handler = (e) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

// A steady speed for the steepest climb — scaled down from the route's average speed by
// how severe the grade is, floored so it never suggests crawling.
function climbSafeSpeedKmh(routeAvgKmh, gradePct) {
  if (!routeAvgKmh) return null;
  const reductionPct = Math.max(10, Math.min(45, gradePct * 4));
  return Math.max(30, Math.round(routeAvgKmh * (1 - reductionPct / 100)));
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${url} failed`);
  return data;
}

function FieldLabel({ children, hint }) {
  return (
    <span className="flex items-center gap-1 text-[12px] font-medium text-foreground">
      {children}
      {hint && <InfoHint label={`About ${children}`}>{hint}</InfoHint>}
    </span>
  );
}

function ProgressCard({ stage }) {
  const activeIdx = STAGES.findIndex((s) => s.key === stage);
  return (
    <Card className="p-5">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Working it out</div>
      <ol className="space-y-3">
        {STAGES.map((s, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <li key={s.key} className="flex items-center gap-3 text-[13.5px]">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  done
                    ? 'border-success bg-success text-white'
                    : active
                    ? 'border-primary text-primary'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <span className="tabular text-[11px]">{i + 1}</span>
                )}
              </span>
              <span className={active ? 'font-medium text-foreground' : done ? 'text-foreground' : 'text-muted-foreground'}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">Usually takes 5–15 seconds. Accuracy comes before speed.</p>
    </Card>
  );
}

export default function DriverView({ onNavigate }) {
  const { vehicle, tariff: settingsTariff, selectVehicle, chargerKW } = useSettings();
  const { addTrip } = useTripHistory();
  const { setLastTrip } = useLastTrip();
  const isDesktop = useIsDesktop();

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [payload, setPayload] = useState(HERO_PRESET.payload);
  const [battery, setBattery] = useState(HERO_PRESET.battery);
  const [tariff, setTariff] = useState(settingsTariff);
  const [deliveryWindow, setDeliveryWindow] = useState(''); // optional, hours
  const [payloadClamped, setPayloadClamped] = useState(false);

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(null);
  const [error, setError] = useState(null);
  // Everything fetched for the current trip, committed in ONE state update so the page
  // never renders a half-finished result (e.g. a verdict before chargers have arrived).
  const [run, setRun] = useState(null);
  const runId = useRef(0);

  // SettingsProvider loads its saved tariff from localStorage after the first render, so
  // re-sync once it lands — but only before a trip has been run (never clobber an edit).
  useEffect(() => {
    if (!run) setTariff(settingsTariff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsTariff]);

  const handleCalculate = async (override) => {
    const trip = {
      origin: (override?.origin ?? origin).trim(),
      destination: (override?.destination ?? destination).trim(),
      payload: override?.payload ?? payload,
      battery: override?.battery ?? battery,
      tariff: override?.tariff ?? tariff,
    };
    if (!trip.origin || !trip.destination) {
      setError('Enter both a starting point and a destination.');
      return;
    }

    const id = ++runId.current;
    const stale = () => id !== runId.current;
    setLoading(true);
    setError(null);
    setRun(null);
    setStage('route');

    try {
      const route = await postJson('/api/route', { origin: trip.origin, destination: trip.destination });
      if (stale()) return;
      if (!route.coordinates?.length || route.distance_m < 500) {
        throw new Error('The start and destination are too close together to plan a truck trip.');
      }
      setStage('details');

      // Climb detection is pure geometry, so it's known before the weather arrives.
      const climbRaw = findSteepestClimb(buildSegments(route.coordinates, route.distance_m, route.duration_s));
      const wPoints = weatherPoints(route);

      const [climbName, weather, charging] = await Promise.allSettled([
        climbRaw ? postJson('/api/reverse-geocode', { lat: climbRaw.lat, lon: climbRaw.lon }) : Promise.resolve(null),
        postJson('/api/weather', { points: wPoints.map(({ lat, lon }) => ({ lat, lon })) }),
        postJson('/api/charging', { points: chargerSearchPoints(route), radius_km: 15 }),
      ]);
      if (stale()) return;
      setStage('model');

      const samples =
        weather.status === 'fulfilled' && Array.isArray(weather.value.samples)
          ? weather.value.samples.map((s, i) => ({ ...s, at_km: wPoints[i].at_km }))
          : [];
      const chargers = charging.status === 'fulfilled' ? charging.value.stations || [] : [];
      const climbLabel = climbName.status === 'fulfilled' && climbName.value?.label ? climbName.value.label : null;

      const nextRun = {
        origin: trip.origin,
        destination: trip.destination,
        route,
        samples,
        weatherFailed: samples.length === 0,
        chargers,
        chargingFailed: charging.status !== 'fulfilled',
        elevationMissing: route.coordinates.some((c) => c[2] == null),
        climb: climbRaw ? { ...climbRaw, name: climbLabel } : null,
      };

      // Log the trip with the same numbers the screen will show: calibrated energy, and the
      // arrival battery AFTER the charging plan — not a raw single-leg figure.
      const r = computeTrip({
        routeData: route,
        samples,
        payloadKg: trip.payload,
        batteryPct: trip.battery,
        tariff: trip.tariff,
        params: vehicle,
      });
      const plan = planChargingStops({
        perSeg: r.perSeg,
        calibrationFactor: r.calibration_factor,
        chargers,
        batteryKwh: vehicle.battery_kWh,
        startSocPct: trip.battery,
        reservePct: vehicle.reserve_pct,
        chargerKW,
      });

      setOrigin(trip.origin);
      setDestination(trip.destination);
      setRun(nextRun);
      addTrip({
        origin: trip.origin,
        destination: trip.destination,
        vehicleName: vehicle.name,
        payload: trip.payload,
        battery: trip.battery,
        tariff: trip.tariff,
        dist_km: r.dist_km,
        total_kWh: r.total_kWh,
        kWh_per_km: r.kWh_per_km,
        cost_per_km: r.cost_per_km,
        outcome: plan.status === 'ok' ? 'no-stop' : plan.status === 'needs-stop' ? 'stops' : 'not-possible',
        stops: plan.stops.length,
        arrival_soc_pct: plan.final_arrival_soc_pct,
      });
    } catch (err) {
      if (stale()) return;
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      if (!stale()) {
        setLoading(false);
        setStage(null);
      }
    }
  };

  const handleVehicleChange = (name) => {
    selectVehicle(name);
    const preset = VEHICLES.find((v) => v.name === name);
    if (preset) {
      setPayloadClamped(payload > preset.payload_max_kg);
      setPayload((p) => Math.max(0, Math.min(p, preset.payload_max_kg)));
    }
  };

  const applyPreset = (preset) => {
    setOrigin(preset.origin);
    setDestination(preset.destination);
    setPayload(Math.min(preset.payload, vehicle.payload_max_kg));
    setBattery(preset.battery);
    setTariff(preset.tariff);
    setPayloadClamped(false);
    handleCalculate({ ...preset, payload: Math.min(preset.payload, vehicle.payload_max_kg) });
  };

  // Recomputed instantly (no refetch) when payload, battery, tariff or vehicle change.
  const result = useMemo(() => {
    if (!run) return null;
    return computeTrip({
      routeData: run.route,
      samples: run.samples,
      payloadKg: payload,
      batteryPct: battery,
      tariff,
      params: vehicle,
    });
  }, [run, payload, battery, tariff, vehicle]);

  const chargePlan = useMemo(() => {
    if (!result) return null;
    return planChargingStops({
      perSeg: result.perSeg,
      calibrationFactor: result.calibration_factor,
      chargers: run.chargers,
      batteryKwh: vehicle.battery_kWh,
      startSocPct: battery,
      reservePct: vehicle.reserve_pct,
      chargerKW,
    });
  }, [result, run, vehicle.battery_kWh, vehicle.reserve_pct, battery, chargerKW]);

  const governance = useMemo(() => {
    if (!result) return null;
    return assessConfidence({
      weatherFailed: run.weatherFailed,
      chargingFailed: run.chargingFailed,
      elevationMissing: run.elevationMissing,
      arrival_soc_pct: result.arrival_soc_pct,
      reserve_pct: vehicle.reserve_pct,
      worstCaseArrivalPct: result.scenarios.worst.arrival_soc_pct,
    });
  }, [result, run, vehicle.reserve_pct]);

  // The Guarantee view prices the most recent trip — keep it in sync with what's on screen.
  useEffect(() => {
    if (!result) return;
    setLastTrip({
      origin: run.origin,
      destination: run.destination,
      dist_km: result.dist_km,
      tariff,
      payload,
      vehicleName: vehicle.name,
      expected_kwh_per_km: result.scenarios.expected.kWh_per_km,
      best_kwh_per_km: result.scenarios.best.kWh_per_km,
      worst_kwh_per_km: result.scenarios.worst.kWh_per_km,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // Developer trip log: model drift check + the governance decision for every calculation.
  useEffect(() => {
    if (!result || !governance) return;
    console.log(
      `[EnergyModel] ${run.origin} -> ${run.destination}: physics ${result.physics_kWh_per_km.toFixed(3)} × ${result.calibration_factor.toFixed(3)} = ${result.kWh_per_km.toFixed(3)} kWh/km`
    );
    const isHero =
      run.origin.toLowerCase() === HERO_PRESET.origin.toLowerCase() &&
      run.destination.toLowerCase() === HERO_PRESET.destination.toLowerCase();
    if (isHero) {
      const drift = Math.abs(result.physics_kWh_per_km - CALIBRATION_TARGET_KWH_PER_KM);
      console.log(
        `[Calibration target] ${CALIBRATION_TARGET_KWH_PER_KM} kWh/km, got ${result.physics_kWh_per_km.toFixed(3)} (drift ${drift.toFixed(3)}).` +
          (drift > CALIBRATION_TOLERANCE ? ` Drift exceeds ${CALIBRATION_TOLERANCE}: check config.js tuning knobs.` : ' Within tolerance.')
      );
    }
    console.log('[Governance]', {
      inputs: { origin: run.origin, destination: run.destination, payload, battery, tariff, vehicle: vehicle.name },
      model_version: 'physics-v2 (smoothed elevation, directional wind) + linear calibration',
      confidence: governance.level,
      plan: chargePlan?.status,
      reasons: governance.reasons,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, governance]);

  const positions = useMemo(() => (run ? run.route.coordinates.map(([lon, lat]) => [lat, lon]) : null), [run]);

  const routeChanged =
    run && (origin.trim().toLowerCase() !== run.origin.toLowerCase() || destination.trim().toLowerCase() !== run.destination.toLowerCase());

  // ---- Verdict --------------------------------------------------------------------
  const reserve = vehicle.reserve_pct;
  const climb = run?.climb
    ? {
        name: run.climb.name,
        grade_pct: run.climb.grade_pct,
        length_km: run.climb.length_km,
        rise_m: run.climb.rise_m,
        speed_kmh: climbSafeSpeedKmh(result?.avg_speed_kmh, run.climb.grade_pct),
      }
    : null;

  const timing = useMemo(() => {
    if (!result || !chargePlan || chargePlan.status === 'infeasible') return null;
    const detourMin = chargePlan.stops.reduce((a, s) => a + ((2 * s.detour_km) / DETOUR_SPEED_KMH) * 60, 0);
    const drive_min = result.duration_s / 60 + detourMin;
    const charge_min = chargePlan.total_charge_minutes;
    let windowVerdict = null;
    const windowHours = Number(deliveryWindow);
    if (deliveryWindow !== '' && Number.isFinite(windowHours) && windowHours > 0) {
      const slack = Math.round(windowHours * 60 - (drive_min + charge_min));
      windowVerdict =
        slack >= 0
          ? { onTime: true, label: `Within your ${fmtNum(windowHours, 1)} h window` }
          : { onTime: false, label: `Misses your ${fmtNum(windowHours, 1)} h window by ~${Math.abs(slack)} min` };
    }
    return { drive_min, charge_min, windowVerdict };
  }, [result, chargePlan, deliveryWindow]);

  let verdict = null;
  if (result && chargePlan && governance) {
    const confidence = { level: governance.level, ...CONFIDENCE_COPY[governance.level] };
    const finalPct = Math.round(Math.max(0, chargePlan.final_arrival_soc_pct ?? 0));
    if (chargePlan.status === 'infeasible') {
      verdict = {
        status: 'danger',
        headline: "Can't finish this trip as planned",
        subline:
          chargePlan.reserve_hit_km != null
            ? `The battery would reach the ${reserve}% reserve around km ${Math.round(chargePlan.reserve_hit_km)} of ${Math.round(
                result.dist_km
              )}, and no working charger is reachable before that.`
            : 'Even with four charging stops the battery would not last the distance.',
        reasons: governance.reasons,
        stops: chargePlan.stops,
        footnote: 'Try starting with more charge, carrying less load, or choosing a vehicle with a bigger battery.',
      };
    } else if (chargePlan.status === 'ok') {
      const headline =
        governance.level === 'high'
          ? "Yes, you'll make it without charging"
          : governance.level === 'medium'
          ? 'You should make it, with little to spare'
          : 'Probably yes, but some live data is missing';
      verdict = {
        status: governance.level === 'high' ? 'ok' : 'uncertain',
        headline,
        subline: `You'd arrive with about ${finalPct}% battery. ${reserve}% is always kept as a safety reserve.`,
        confidence,
        reasons: governance.reasons,
        band: {
          worst: result.scenarios.worst.arrival_soc_pct,
          expected: result.scenarios.expected.arrival_soc_pct,
          best: result.scenarios.best.arrival_soc_pct,
          reserve,
        },
        climb,
        timing,
      };
    } else {
      const n = chargePlan.stops.length;
      verdict = {
        status: governance.degraded ? 'uncertain' : 'warn',
        headline: n === 1 ? 'Yes, with one charging stop' : `Yes, with ${n} charging stops`,
        subline: `The battery alone won't cover ${Math.round(result.dist_km)} km. Charge as planned below and you'd arrive with about ${finalPct}%.`,
        confidence,
        reasons: governance.reasons,
        stops: chargePlan.stops,
        climb,
        timing,
      };
    }
  }

  // ---- Inputs ---------------------------------------------------------------------
  const inputsForm = (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Try an example
          <InfoHint label="About the examples">
            Each example fills in the form and runs it straight away. Mumbai → Pune is a full-battery trip over the
            Western Ghats; the Nashik run starts at 40%, so you can see the charging planner at work.
          </InfoHint>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => applyPreset(HERO_PRESET)} type="button" disabled={loading}>
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            {HERO_PRESET.label}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => applyPreset(NASHIK_PRESET)} type="button" disabled={loading}>
            {NASHIK_PRESET.label}
          </Button>
        </div>
      </div>
      <div className="h-px bg-border" />

      <div className="flex flex-col gap-1.5">
        <FieldLabel hint="The battery size, payload limit and range claim are representative of published specs for Indian e-trucks in each weight class. The physics settings (drag, rolling resistance and so on) are engineering estimates, editable in Settings.">
          Vehicle
        </FieldLabel>
        <Select value={vehicle.name} onValueChange={handleVehicleChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select vehicle" />
          </SelectTrigger>
          <SelectContent>
            {VEHICLES.map((v) => (
              <SelectItem key={v.name} value={v.name}>
                {v.name} · {v.battery_kWh} kWh battery · up to {v.payload_max_kg.toLocaleString('en-IN')} kg
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="flex flex-col gap-1.5">
        <FieldLabel>From</FieldLabel>
        <PlaceAutocomplete value={origin} onChange={setOrigin} placeholder="City or address, e.g. Mumbai" inputClassName={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1.5">
        <FieldLabel>To</FieldLabel>
        <PlaceAutocomplete
          value={destination}
          onChange={setDestination}
          onEnter={() => handleCalculate()}
          placeholder="City or address, e.g. Pune"
          inputClassName={INPUT_CLASS}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <FieldLabel hint={`Cargo weight, not counting the truck itself. The ${vehicle.name} can carry up to ${vehicle.payload_max_kg?.toLocaleString('en-IN')} kg.`}>
            Load (kg)
          </FieldLabel>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={vehicle.payload_max_kg}
            step={100}
            className={INPUT_CLASS}
            value={payload}
            onChange={(e) => {
              const raw = Number(e.target.value);
              const max = vehicle.payload_max_kg;
              setPayloadClamped(Number.isFinite(raw) && (raw > max || raw < 0));
              setPayload(Number.isFinite(raw) ? Math.max(0, Math.min(raw, max)) : 0);
            }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel hint="How full the battery is when the truck sets off.">Battery at start (%)</FieldLabel>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            className={INPUT_CLASS}
            value={battery}
            onChange={(e) => {
              const n = Number(e.target.value);
              setBattery(Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0);
            }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel hint="What you pay per unit (kWh) of electricity. Sets the energy cost per km.">Tariff (₹/kWh)</FieldLabel>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            className={INPUT_CLASS}
            value={tariff}
            onChange={(e) => {
              const n = Number(e.target.value);
              setTariff(Number.isFinite(n) ? Math.max(0, n) : 0);
            }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel hint="Optional. The hours you have to make the delivery. We check driving plus charging time against it.">
            Deadline (hours)
          </FieldLabel>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            placeholder="Optional"
            className={INPUT_CLASS}
            value={deliveryWindow}
            onChange={(e) => setDeliveryWindow(e.target.value)}
          />
        </label>
      </div>
      {payloadClamped && (
        <p className="-mt-2 text-xs text-warning">
          Load capped at the {vehicle.name}&apos;s limit of {vehicle.payload_max_kg?.toLocaleString('en-IN')} kg.
        </p>
      )}

      <Button size="lg" onClick={() => handleCalculate()} disabled={loading || !origin.trim() || !destination.trim()} type="button">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : routeChanged ? (
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        ) : null}
        {loading ? 'Working it out…' : routeChanged ? 'Plan this new route' : 'Plan trip'}
      </Button>
      {routeChanged && !loading && (
        <p className="-mt-1 text-xs leading-relaxed text-warning">
          You changed the route. The results still show {run.origin} → {run.destination} until you press the button.
        </p>
      )}
      {run && !routeChanged && !loading && (
        <p className="-mt-1 text-xs leading-relaxed text-muted-foreground">
          Changing the vehicle, load, battery or tariff updates the results instantly.
        </p>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.06] px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  );

  // "How we worked it out" — rendered once and placed by layout (see useIsDesktop).
  const tripPlanCard = result && (
    <Card className="p-5">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">How we worked it out</h3>
      <div className="mb-4 rounded-lg border border-border bg-surface-raised px-3.5 py-3 text-[13px] leading-relaxed text-foreground">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          Physics estimate <span className="tabular font-semibold">{result.physics_kWh_per_km.toFixed(2)}</span>
          <ArrowRight className="h-3 w-3 self-center text-muted-foreground" aria-hidden="true" />
          AI-calibrated <span className="tabular font-semibold text-primary">{result.kWh_per_km.toFixed(2)}</span> kWh/km
          <InfoHint label="Physics vs calibrated">
            The physics model calculates the energy from forces on every stretch of road. A learned correction,
            fitted on {result.calibration_trained_on.toLocaleString()} past trips, then adjusts for what physics
            misses in practice. The calibrated figure is the one used everywhere else.
          </InfoHint>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{result.calibration_note}</p>
      </div>

      <EnergyBreakdown breakdown={result.breakdown_kwh} totalKwh={result.total_kWh} />

      <div className="mt-5">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Driver notes</div>
        <GuidancePanel result={result} chargePlan={chargePlan} climb={climb} samples={run.samples} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <AssumptionsPopover />
        <AiModelPanel />
      </div>
      <AskBox result={result} chargePlan={chargePlan} />
    </Card>
  );

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-7 flex flex-col gap-2.5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            <span className="h-px w-6 bg-accent/60" />
            AI trip intelligence for electric trucks
          </div>
          <h1 className="font-display mt-2.5 max-w-3xl text-[32px] font-semibold leading-[1.05] text-foreground sm:text-[42px]">
            Will this e-truck make the trip, and what will each kilometre cost?
          </h1>
        </div>
        <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground lg:text-right">
          Enter a trip on the left. We read the real truck route, its hills, live weather and chargers along the way,
          then tell you whether the battery lasts, where to charge, and the cost per km.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1.5fr_1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-[22px] font-semibold leading-none text-foreground">Your trip</h2>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Step 1</span>
            </div>
            {inputsForm}
          </Card>
          {isDesktop && tripPlanCard}
        </div>

        {/* Mobile order: verdict + numbers, map, explanation. Desktop: map is the centre pane. */}
        <div className="order-2 h-[320px] overflow-hidden rounded-xl border border-border shadow-[0_1px_1px_rgba(18,23,43,0.03),0_8px_24px_-12px_rgba(18,23,43,0.15)] lg:order-none lg:h-[600px]">
          <RouteMap
            positions={positions}
            distanceKm={result?.dist_km ?? 0}
            chargers={run?.chargers ?? []}
            stopIds={chargePlan?.stops?.map((s) => s.charger.id) ?? []}
            emptyLabel={loading ? 'Planning the route…' : 'Your route will appear here'}
          />
        </div>

        <div className="order-1 flex flex-col gap-4 lg:order-none">
          {loading && <ProgressCard stage={stage} />}

          {!run && !loading && (
            <Card className="overflow-hidden">
              <div className="border-b border-border bg-surface-raised px-5 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">How it works</div>
                <h2 className="font-display mt-1 text-[22px] font-semibold leading-tight text-foreground">
                  From route to guaranteed price in three steps
                </h2>
              </div>
              <ol className="space-y-4 px-5 py-5">
                {[
                  { icon: MapPinned, title: 'Plan the trip', text: 'Pick a vehicle, enter where you are going, the load and the battery level.' },
                  { icon: Gauge, title: 'Get an honest verdict', text: 'Whether the battery lasts, where to charge if not, energy per km and the cost, each with a plain explanation.' },
                  { icon: ShieldCheck, title: 'Price a guarantee', text: 'Open Guarantee to turn the trip into a fixed ₹/km price you could commit to.' },
                ].map(({ icon: Icon, title, text }, i) => (
                  <li key={title} className="flex gap-3.5">
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-primary shadow-[0_1px_1px_rgba(18,23,43,0.04)]">
                      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                      <span className="tabular absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-background-alt text-[10px] font-semibold text-[#e2c47e]">
                        {i + 1}
                      </span>
                    </span>
                    <div>
                      <div className="text-[13.5px] font-medium text-foreground">{title}</div>
                      <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{text}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => applyPreset(HERO_PRESET)}
                className="group flex w-full items-center justify-between border-t border-border px-5 py-3.5 text-left text-[13px] font-medium text-primary transition-colors hover:bg-surface-raised"
              >
                Try it now: Mumbai → Pune
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </Card>
          )}

          {result && !loading && (
            <>
              <div className="text-[12.5px] text-muted-foreground">
                <span className="font-medium text-foreground">
                  {run.origin} → {run.destination}
                </span>{' '}
                · {vehicle.name} · {payload.toLocaleString('en-IN')} kg · starts at {battery}%
              </div>
              {verdict && <VerdictCard {...verdict} />}
              <ResultsPanel
                result={result}
                chargePlan={chargePlan}
                tariff={tariff}
                reservePct={reserve}
                batteryKwh={vehicle.battery_kWh}
              />
              <CohortAnomalyBanner vehicleName={vehicle.name} expectedKwhPerKm={result.kWh_per_km} />
              {chargePlan?.status !== 'infeasible' && onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('guarantee')}
                  className="group flex w-full items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3.5 text-left transition-colors hover:bg-primary/[0.08]"
                >
                  <span>
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Next step</span>
                    <span className="mt-0.5 block text-[13.5px] font-medium text-foreground">
                      Turn this trip into a guaranteed price per km
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              )}
              {!isDesktop && tripPlanCard}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
