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
  '<span style="display:block;width:14px;height:14px;border-radius:50%;background:#fff;border:3.5px solid #1e40af;box-shadow:0 2px 6px rgba(13,18,38,.35)"></span>',
  14
);
const destinationIcon = divIcon(
  '<span style="display:block;width:18px;height:18px;border-radius:50%;background:#1e40af;border:3px solid #fff;box-shadow:0 0 0 2px #1e40af,0 4px 10px rgba(13,18,38,.4)"></span>',
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
  // Tabs stay mounted while hidden; when this map's box becomes visible again (or the
  // layout changes size) Leaflet must re-measure, or it shows grey tiles and a wrong fit.
  useEffect(() => {
    const el = map.getContainer();
    if (typeof ResizeObserver === 'undefined' || !el) return;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
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
    // Keyed on cheap signatures (endpoints + counts), not a stringified 2,000-point route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    routePositions?.length,
    routePositions?.[0]?.join(),
    routePositions?.[routePositions.length - 1]?.join(),
    chargerPositions.length,
    chargerPositions[0]?.join(),
    centerFallback?.join(),
  ]);
  return null;
}

export default function RouteMap({
  positions,
  distanceKm,
  chargers = [],
  recommendedStop,
  stopIds = [],
  center,
  emptyLabel = 'No trip planned yet',
}) {
  const hasRoute = positions && positions.length > 1;
  const isStop = (c) => stopIds.includes(c.id) || (recommendedStop && recommendedStop.id === c.id);
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
          <span className="h-1.5 w-1.5 rounded-full bg-[#d4b066]" />Truck route · {Math.round(distanceKm)} km
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
            <Polyline positions={positions} pathOptions={{ color: '#1e40af', weight: 4.5, opacity: 1 }} />
            <Marker position={positions[0]} icon={originIcon} />
            <Marker position={positions[positions.length - 1]} icon={destinationIcon} />
          </>
        )}
        {chargers.map((c) => (
          <Marker
            key={c.id ?? `${c.lat}-${c.lon}`}
            position={[c.lat, c.lon]}
            icon={isStop(c) ? recommendedIcon : chargerIcon}
            zIndexOffset={isStop(c) ? 1000 : 0}
          >
            <Popup>
              <strong>{c.title}</strong>
              {isStop(c) ? ' · planned charging stop' : ''}
              {c.max_power_kw ? <br /> : null}
              {c.max_power_kw ? `Up to ${Math.round(c.max_power_kw)} kW${c.dc ? ' DC' : ''}` : ''}
            </Popup>
          </Marker>
        ))}
        <ViewController routePositions={positions} chargerPositions={chargerPositions} centerFallback={center} />
      </MapContainer>
      {(hasRoute || chargers.length > 0) && (
        <div className="absolute bottom-6 left-2 z-[500] flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-surface/90 px-2.5 py-1.5 text-[11px] text-foreground shadow-[0_4px_12px_-4px_rgba(18,23,43,0.2)] backdrop-blur">
          {hasRoute && (
            <>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-[2.5px] border-primary bg-white" />Start</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white" />Destination</span>
            </>
          )}
          {chargers.length > 0 && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#e2c47e]" />Charger</span>}
          {(stopIds.length > 0 || recommendedStop) && <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-background-alt bg-[#d4b066]" />Planned stop</span>}
        </div>
      )}
    </div>
  );
}
