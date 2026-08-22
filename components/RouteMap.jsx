'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Default marker icons reference bundled asset paths that break under Next.js —
// point them at the CDN copies instead, or markers silently don't render.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const chargerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [20, 33],
  iconAnchor: [10, 33],
});

// Recenters/fits the map whenever the route, charger set, or search center changes —
// covers Plan Trip (route line), Charging (chargers only, no route), and Charging's
// zero-results case (center on the searched place with no markers at all).
function ViewController({ routePositions, chargerPositions, centerFallback }) {
  const map = useMap();
  useEffect(() => {
    if (routePositions && routePositions.length > 1) {
      map.fitBounds(L.latLngBounds(routePositions), { padding: [30, 30] });
    } else if (chargerPositions.length > 1) {
      map.fitBounds(L.latLngBounds(chargerPositions), { padding: [40, 40] });
    } else if (chargerPositions.length === 1) {
      map.setView(chargerPositions[0], 12);
    } else if (centerFallback) {
      map.setView(centerFallback, 11);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(routePositions), JSON.stringify(chargerPositions), JSON.stringify(centerFallback)]);
  return null;
}

export default function RouteMap({
  positions,
  distanceKm,
  chargers = [],
  recommendedStop,
  center,
  emptyLabel = 'No trip planned yet',
}) {
  const hasRoute = positions && positions.length > 1;
  const chargerPositions = chargers.map((c) => [c.lat, c.lon]);
  const initialCenter = center || positions?.[0] || chargerPositions[0] || [22.5, 78.9]; // default: India

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {hasRoute ? (
        <div className="absolute right-3 top-3 z-[500] rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg">
          Recommended route · {Math.round(distanceKm)} km
        </div>
      ) : (
        <div className="absolute right-3 top-3 z-[500] rounded-full bg-background-alt/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-lg">
          {chargers.length > 0 ? `${chargers.length} charger${chargers.length === 1 ? '' : 's'} found` : emptyLabel}
        </div>
      )}
      <MapContainer center={initialCenter} zoom={hasRoute ? 7 : 5} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasRoute && (
          <>
            <Polyline positions={positions} color="#2563eb" weight={4} />
            <Marker position={positions[0]} />
            <Marker position={positions[positions.length - 1]} />
          </>
        )}
        {chargers.map((c) => (
          <Marker key={c.id ?? `${c.lat}-${c.lon}`} position={[c.lat, c.lon]} icon={chargerIcon}>
            <Popup>
              {c.title}
              {recommendedStop && recommendedStop.id === c.id ? ' — recommended stop' : ''}
            </Popup>
          </Marker>
        ))}
        <ViewController routePositions={positions} chargerPositions={chargerPositions} centerFallback={center} />
      </MapContainer>
    </div>
  );
}
