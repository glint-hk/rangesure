// A small, transparent learned correction on top of the physics baseline — fit once
// at module load on the synthetic trip history (data/tripHistory.js) via ordinary
// least squares (normal equations), no external ML library. This is the "data
// flywheel" from the deck: real Fleet Edge outcomes would replace TRIP_HISTORY and
// this file would keep working unchanged.
import { TRIP_HISTORY } from '@/data/tripHistory';

export const CALIBRATION_FEATURE_KEYS = ['distance_km', 'avg_gradient', 'payload_kg', 'temp_c', 'avg_speed_kmh'];

function designRow(features) {
  return [1, ...CALIBRATION_FEATURE_KEYS.map((k) => features[k] ?? 0)];
}

// Solves A x = b via Gaussian elimination with partial pivoting. Small (6x6) system —
// no need for a linear-algebra library.
function gaussianSolve(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const pivotVal = M[col][col] || 1e-9;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col] / pivotVal;
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-9));
}

// Fits correction_factor = actual_kwh_per_km / physics_kwh_per_km as a linear function
// of the features above, via the normal equations (X^T X) beta = X^T y.
function fitCoefficients(history) {
  const rows = history.map(designRow);
  const targets = history.map((r) => r.actual_kwh_per_km / r.physics_kwh_per_km);
  const p = rows[0].length;

  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    for (let a = 0; a < p; a++) {
      Xty[a] += row[a] * targets[i];
      for (let b = 0; b < p; b++) XtX[a][b] += row[a] * row[b];
    }
  }
  return gaussianSolve(XtX, Xty);
}

// Fit once at module load — the app ships "pre-trained" on the synthetic history.
const RAW_COEFFICIENTS = fitCoefficients(TRIP_HISTORY);

export const CALIBRATION_COEFFICIENTS = RAW_COEFFICIENTS.map((value, i) => ({
  name: i === 0 ? 'intercept' : CALIBRATION_FEATURE_KEYS[i - 1],
  value: Number(value.toFixed(6)),
}));

export const CALIBRATION_TRAINED_ON = TRIP_HISTORY.length;

// Predicts the correction_factor to multiply the physics kWh/km estimate by. Clamped
// to a sane range so a feature combination far outside the training distribution
// can't blow up the output.
export function calibrate(features) {
  const row = designRow(features);
  const raw = row.reduce((sum, x, i) => sum + x * RAW_COEFFICIENTS[i], 0);
  return Math.max(0.7, Math.min(1.5, raw));
}

// A one-line, human-readable takeaway for the current trip, derived from which
// learned coefficients are pushing the correction up given this trip's features —
// not hardcoded to the synthetic generator's bias formula, just read off the fit.
export function explainCalibration(features) {
  const byName = Object.fromEntries(CALIBRATION_COEFFICIENTS.map((c) => [c.name, c.value]));
  const drivers = [];
  if (byName.temp_c < 0 && features.temp_c < 15) drivers.push('cold temperatures');
  if (byName.temp_c > 0 && features.temp_c > 30) drivers.push('hot temperatures');
  if (byName.payload_kg > 0 && features.payload_kg > 3000) drivers.push('a heavy payload');
  if (byName.avg_gradient > 0 && features.avg_gradient > 3) drivers.push('a hilly route');

  const factor = calibrate(features);
  const pct = Math.round(Math.abs(factor - 1) * 100);
  if (!drivers.length || pct < 1) {
    return 'Conditions on this trip are close to typical — physics and the learned correction mostly agree.';
  }
  const direction = factor > 1 ? 'more' : 'less';
  return `${drivers.join(' + ')} use about ${pct}% ${direction} than physics alone predicts, based on ${CALIBRATION_TRAINED_ON.toLocaleString()} past trips.`;
}
