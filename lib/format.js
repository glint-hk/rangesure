// Guards number formatting against Infinity/NaN reaching the screen — reachable via
// Settings (e.g. a 0 drivetrain efficiency) or a degenerate trip (origin === destination).
export function fmtNum(n, digits = 0) {
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
}

export function fmtRound(n) {
  return Number.isFinite(n) ? Math.round(n) : '—';
}
