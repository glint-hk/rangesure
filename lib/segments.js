// Turns ORS route geometry ([lon, lat, elevation][]) into per-segment inputs for
// the energy model: distance (haversine), elevation delta, grade, heading, average speed,
// and the weather that applies to that stretch of road.
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Compass heading of travel from point 1 to point 2, degrees clockwise from north.
function bearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Headwind component of the wind for a truck travelling on `headingDeg`. Meteorological
// wind direction is where the wind blows FROM, so wind from straight ahead (same angle as
// the heading) is a full headwind (+), from behind a tailwind (−), from the side ~0.
export function headwindComponent(windMs, windFromDeg, headingDeg) {
  if (!Number.isFinite(windMs) || !Number.isFinite(windFromDeg)) return 0;
  return windMs * Math.cos(((windFromDeg - headingDeg) * Math.PI) / 180);
}

// SRTM-derived elevation has metre-scale noise between neighbouring points. Summed point
// to point, that noise invents hundreds of metres of fake climbing on flat roads (e.g.
// Delhi→Jaipur: +179 m net, but 1,287 m "climbed" raw). A distance-weighted moving average
// over ~300 m removes the jitter while keeping real ghat gradients intact.
export const ELEVATION_SMOOTHING_M = 300;

export function smoothElevation(geometry, windowM = ELEVATION_SMOOTHING_M) {
  if (!geometry?.length || windowM <= 0) return geometry;
  const cum = [0];
  for (let i = 1; i < geometry.length; i++) {
    const [lon1, lat1] = geometry[i - 1];
    const [lon2, lat2] = geometry[i];
    cum.push(cum[i - 1] + haversineMeters(lat1, lon1, lat2, lon2));
  }
  const half = windowM / 2;
  return geometry.map((pt, i) => {
    if (pt[2] == null) return pt;
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && cum[i] - cum[j] <= half; j--) {
      if (geometry[j][2] != null) {
        sum += geometry[j][2];
        n++;
      }
    }
    for (let j = i + 1; j < geometry.length && cum[j] - cum[i] <= half; j++) {
      if (geometry[j][2] != null) {
        sum += geometry[j][2];
        n++;
      }
    }
    return [pt[0], pt[1], n ? sum / n : pt[2]];
  });
}

// weatherSamples (optional): [{ at_km, temp_factor, wind_ms, wind_from_deg, wet }], one per
// point sampled along the route. Each segment gets the nearest sample by distance, and its
// own headwind from that sample's wind vs. the segment's heading.
export function buildSegments(geometry, totalDistanceM, totalDurationS, weatherSamples = []) {
  const fallbackSpeed = 16.7; // ~60 km/h, used if ORS gives no duration
  const avgSpeed = totalDurationS > 0 ? totalDistanceM / totalDurationS : fallbackSpeed;
  const smoothed = smoothElevation(geometry);

  const sortedSamples = [...weatherSamples].sort((a, b) => a.at_km - b.at_km);
  const nearestSample = (at_km) => {
    if (!sortedSamples.length) return null;
    let best = sortedSamples[0];
    let bestDist = Math.abs(sortedSamples[0].at_km - at_km);
    for (const s of sortedSamples) {
      const d = Math.abs(s.at_km - at_km);
      if (d < bestDist) {
        best = s;
        bestDist = d;
      }
    }
    return best;
  };

  const segments = [];
  let cumulative_m = 0;
  for (let i = 0; i < smoothed.length - 1; i++) {
    const [lon1, lat1, ele1] = smoothed[i];
    const [lon2, lat2, ele2] = smoothed[i + 1];
    const distance_m = haversineMeters(lat1, lon1, lat2, lon2);
    if (distance_m < 1) continue;

    const mid_km = (cumulative_m + distance_m / 2) / 1000;
    const sample = nearestSample(mid_km);
    // Missing elevation on either end counts as flat rather than a fake drop to sea level.
    const delta_h = ele1 != null && ele2 != null ? ele2 - ele1 : 0;
    // Road grade, clamped ±30% — shared by the energy model's tractive-force calc and
    // climb detection below, so both agree on exactly the same number per segment.
    const grade_pct = Math.max(-30, Math.min(30, (delta_h / distance_m) * 100));
    const heading_deg = bearingDeg(lat1, lon1, lat2, lon2);

    segments.push({
      distance_m,
      delta_h,
      grade_pct,
      heading_deg,
      avg_speed_ms: avgSpeed,
      lat: lat1,
      lon: lon1,
      at_km: cumulative_m / 1000,
      temp_factor: sample?.temp_factor ?? 1,
      headwind_ms: sample ? headwindComponent(sample.wind_ms, sample.wind_from_deg, heading_deg) : 0,
      wet: Boolean(sample?.wet),
    });
    cumulative_m += distance_m;
  }
  return segments;
}

// Total metres climbed (sum of positive elevation gains) after smoothing — shown to the
// user so "hilly" is a number, not an adjective.
export function totalClimbM(segments) {
  return segments.reduce((a, s) => a + Math.max(0, s.delta_h), 0);
}

// Finds the route's BIGGEST sustained climb — the stretch that gains the most height,
// which is what drains the battery and what a driver should prepare for. A climb is a run
// of segments steeper than CLIMB_GRADE_PCT; short flat or slightly downhill breaks (up to
// MAX_DIP_M) inside a ghat don't split it into fragments. Returns null if nothing gains at
// least MIN_RISE_M.
const CLIMB_GRADE_PCT = 1.5;
const MAX_DIP_M = 400;
const MIN_RISE_M = 40;
const MIN_LENGTH_M = 500;

export function findSteepestClimb(perSeg) {
  if (!perSeg || !perSeg.length) return null;

  let cumulative_m = 0;
  let run = null;
  let dip = null; // a non-climbing stretch inside a run, kept only if the climb resumes
  let best = null;

  const closeRun = () => {
    if (run && run.rise_m >= MIN_RISE_M && run.distance_m >= MIN_LENGTH_M && (!best || run.rise_m > best.rise_m)) {
      best = run;
    }
    run = null;
    dip = null;
  };

  for (const seg of perSeg) {
    if (seg.grade_pct > CLIMB_GRADE_PCT) {
      if (!run) {
        run = { start_km: cumulative_m / 1000, distance_m: 0, rise_m: 0, maxGrade: -Infinity, lat: seg.lat, lon: seg.lon };
      } else if (dip) {
        run.distance_m += dip.distance_m;
        run.rise_m += dip.rise_m;
        dip = null;
      }
      run.distance_m += seg.distance_m;
      run.rise_m += seg.delta_h;
      if (seg.grade_pct > run.maxGrade) {
        run.maxGrade = seg.grade_pct;
        run.lat = seg.lat;
        run.lon = seg.lon;
      }
      run.end_km = (cumulative_m + seg.distance_m) / 1000;
    } else if (run) {
      dip = dip || { distance_m: 0, rise_m: 0 };
      dip.distance_m += seg.distance_m;
      dip.rise_m += seg.delta_h;
      if (dip.distance_m > MAX_DIP_M) closeRun();
    }
    cumulative_m += seg.distance_m;
  }
  closeRun();

  if (!best) return null;
  return {
    start_km: best.start_km,
    end_km: best.end_km,
    length_km: best.distance_m / 1000,
    rise_m: best.rise_m,
    grade_pct: (best.rise_m / best.distance_m) * 100,
    max_grade_pct: best.maxGrade,
    lat: best.lat,
    lon: best.lon,
  };
}
