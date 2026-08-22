// Guards number formatting against Infinity/NaN reaching the screen — reachable via
// Settings (e.g. a 0 drivetrain efficiency) or a degenerate trip (origin === destination).
export function fmtNum(n, digits = 0) {
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
}

export function fmtRound(n) {
  return Number.isFinite(n) ? Math.round(n) : '—';
}

// Strips common markdown tokens (**, *, #, `) from LLM-generated guidance text so
// bullets never render literal asterisks/hashes when the model doesn't fully honor
// a "plain text" instruction.
export function stripMarkdown(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`{1,3}/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\*\*/g, '')
    .trim();
}
