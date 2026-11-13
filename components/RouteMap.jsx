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

// Custom div markers (no external marker PNGs): navy origin/destination, gold charge points.
const divIcon = (html, size) =>
  L.divIcon({ html, className: 'rs-marker', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
const originIcon = divIcon(
  '<span style="display:block;width:14px;height:14px;border-radius:50%;background:#fff;border:3.5px solid #1b2550;box-shadow:0 2px 6px rgba(13,18,38,.35)"></span>',
  14
);
const destinationIcon = divIcon(
  '<span style="display:block;width:18px;height:18px;border-radius:50%;background:#1b2550;border:3px solid #fff;box-shadow:0 0 0 2px #1b2550,0 4px 10px rgba(13,18,38,.4)"></span>',
  18
);
const boltSvg =
  '<svg viewBox="0 0 24 24" width="11" height="11"><path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="#0d1226"/></svg>';
const chargerIcon = divIcon(
  `<span style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#e2c47e;border:2px solid #fff;box-shadow:0 2px 6px rgba(13,18,38,.3)">${boltSvg}</span>`,
  20
);
const recommendedIcon = divIcon(
  `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#d4b066;border:3px solid #0d1226;box-shadow:0 0 0 4px rgba(212,176,102,.35),0 4px 12px rgba(13,18,38,.4)">${boltSvg}</span>`,
  28
);

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
    // isolation:isolate contains Leaflet's internal z-index (its zoom control sits at
    // z-index 1000, tile panes at 400+) to THIS box's own stacking context — otherwise
    // those values compare against the whole document's stacking order and paint over
    // higher app UI like the mobile trip-inputs Sheet (z-50), whose Portal renders
    // straight onto <body>.
    <div style={{ position: 'relative', height: '100%', width: '100%', isolation: 'isolate' }}>
      {hasRoute ? (
        <div className="tabular absolute right-3 top-3 z-[500] flex items-center gap-2 rounded-md bg-background-alt/90 px-3 py-1.5 text-[11px] font-medium tracking-wide text-white shadow-[0_8px_24px_-8px_rgba(13,18,38,0.5)] backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-[#d4b066]" />Recommended route · {Math.round(distanceKm)} km
        </div>
      ) : (
        <div className="absolute right-3 top-3 z-[500] rounded-md border border-border bg-surface/90 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-[0_4px_12px_-4px_rgba(18,23,43,0.15)] backdrop-blur">
          {chargers.length > 0 ? `${chargers.length} charger${chargers.length === 1 ? '' : 's'} found` : emptyLabel}
        </div>
      )}
      <MapContainer center={initialCenter} zoom={hasRoute ? 7 : 5} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasRoute && (
          <>
            <Polyline positions={positions} pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.95 }} />
            <Polyline positions={positions} pathOptions={{ color: '#1b2550', weight: 4.5, opacity: 1 }} />
            <Marker position={positions[0]} icon={originIcon} />
            <Marker position={positions[positions.length - 1]} icon={destinationIcon} />
          </>
        )}
        {chargers.map((c) => (
          <Marker key={c.id ?? `${c.lat}-${c.lon}`} position={[c.lat, c.lon]}
            icon={recommendedStop && recommendedStop.id === c.id ? recommendedIcon : chargerIcon}
            zIndexOffset={recommendedStop && recommendedStop.id === c.id ? 1000 : 0}
          >
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
