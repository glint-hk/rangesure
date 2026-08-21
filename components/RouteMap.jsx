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

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [30, 30] });
    }
  }, [positions, map]);
  return null;
}

export default function RouteMap({ positions, distanceKm, chargers = [], recommendedStop }) {
  const hasRoute = positions && positions.length > 1;
  const center = positions?.[0] || [19.076, 72.8777]; // default: Mumbai

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {hasRoute && (
        <div className="map-badge">Recommended route · {Math.round(distanceKm)} km</div>
      )}
      <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasRoute && (
          <>
            <Polyline positions={positions} color="#2563eb" weight={4} />
            <Marker position={positions[0]} />
            <Marker position={positions[positions.length - 1]} />
            <FitBounds positions={positions} />
          </>
        )}
        {chargers.map((c) => (
          <Marker key={c.id} position={[c.lat, c.lon]} icon={chargerIcon}>
            <Popup>
              {c.title}
              {recommendedStop && recommendedStop.id === c.id ? ' — recommended stop' : ''}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
