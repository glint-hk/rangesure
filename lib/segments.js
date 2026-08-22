// Turns ORS route geometry ([lon, lat, elevation][]) into per-segment inputs for
// the energy model: distance (haversine), elevation delta, and average speed.
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

// weatherSamples (optional): [{ at_km, temp_factor, headwind_ms }], one per point
// sampled along the route (start/midpoints/end). Each segment gets the nearest
// sample by cumulative distance, instead of one uniform value for the whole route.
export function buildSegments(geometry, totalDistanceM, totalDurationS, weatherSamples = []) {
  const fallbackSpeed = 16.7; // ~60 km/h, used if ORS gives no duration
  const avgSpeed = totalDurationS > 0 ? totalDistanceM / totalDurationS : fallbackSpeed;

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
  for (let i = 0; i < geometry.length - 1; i++) {
    const [lon1, lat1, ele1] = geometry[i];
    const [lon2, lat2, ele2] = geometry[i + 1];
    const distance_m = haversineMeters(lat1, lon1, lat2, lon2);
    if (distance_m < 1) continue;

    const mid_km = (cumulative_m + distance_m / 2) / 1000;
    const sample = nearestSample(mid_km);
    const delta_h = (ele2 ?? 0) - (ele1 ?? 0);
    // Road grade, clamped ±30% — shared by the energy model's tractive-force calc and
    // climb detection below, so both agree on exactly the same number per segment.
    const grade_pct = Math.max(-30, Math.min(30, (delta_h / distance_m) * 100));

    segments.push({
      distance_m,
      delta_h,
      grade_pct,
      avg_speed_ms: avgSpeed,
      lat: lat1,
      lon: lon1,
      at_km: cumulative_m / 1000,
      temp_factor: sample?.temp_factor ?? 1,
      headwind_ms: sample?.headwind_ms ?? 0,
    });
    cumulative_m += distance_m;
  }
  return segments;
}

// Finds the steepest SUSTAINED climb on the route — a run of consecutive segments
// above NOTABLE_GRADE_PCT spanning at least MIN_RUN_METERS, ranked by average grade
// over the run (not a single spiky segment). Returns null if nothing qualifies.
const NOTABLE_GRADE_PCT = 2;
const MIN_RUN_METERS = 300;

export function findSteepestClimb(perSeg) {
  if (!perSeg || !perSeg.length) return null;

  let cumulative_m = 0;
  let run = null;
  let best = null;

  const closeRun = () => {
    if (run && run.distance_m >= MIN_RUN_METERS) {
      const avgGrade = run.weightedGradeSum / run.distance_m;
      if (!best || avgGrade > best.avgGrade) {
        best = { ...run, avgGrade };
      }
    }
    run = null;
  };

  for (const seg of perSeg) {
    if (seg.grade_pct > NOTABLE_GRADE_PCT) {
      if (!run) {
        run = {
          start_km: cumulative_m / 1000,
          distance_m: 0,
          weightedGradeSum: 0,
          maxGrade: -Infinity,
          steepestLat: seg.lat,
          steepestLon: seg.lon,
        };
      }
      run.distance_m += seg.distance_m;
      run.weightedGradeSum += seg.grade_pct * seg.distance_m;
      if (seg.grade_pct > run.maxGrade) {
        run.maxGrade = seg.grade_pct;
        run.steepestLat = seg.lat;
        run.steepestLon = seg.lon;
      }
      run.end_km = (cumulative_m + seg.distance_m) / 1000;
    } else {
      closeRun();
    }
    cumulative_m += seg.distance_m;
  }
  closeRun();

  if (!best) return null;
  return {
    start_km: best.start_km,
    end_km: best.end_km,
    length_km: best.distance_m / 1000,
    grade_pct: best.avgGrade,
    max_grade_pct: best.maxGrade,
    lat: best.steepestLat,
    lon: best.steepestLon,
  };
}
