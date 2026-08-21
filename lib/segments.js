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

export function buildSegments(geometry, totalDistanceM, totalDurationS) {
  const fallbackSpeed = 16.7; // ~60 km/h, used if ORS gives no duration
  const avgSpeed = totalDurationS > 0 ? totalDistanceM / totalDurationS : fallbackSpeed;

  const segments = [];
  for (let i = 0; i < geometry.length - 1; i++) {
    const [lon1, lat1, ele1] = geometry[i];
    const [lon2, lat2, ele2] = geometry[i + 1];
    const distance_m = haversineMeters(lat1, lon1, lat2, lon2);
    if (distance_m < 1) continue;
    segments.push({
      distance_m,
      delta_h: (ele2 ?? 0) - (ele1 ?? 0),
      avg_speed_ms: avgSpeed,
    });
  }
  return segments;
}
