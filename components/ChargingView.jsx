'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';

const RouteMap = dynamic(() => import('./RouteMap'), { ssr: false });

export default function ChargingView() {
  const [place, setPlace] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [center, setCenter] = useState(null);
  const [stations, setStations] = useState([]);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    const query = place.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const geoRes = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place: query }),
      });
      const geo = await geoRes.json();
      if (!geoRes.ok) throw new Error(geo.error || 'Location lookup failed.');
      setCenter([geo.lat, geo.lon]);

      const chargeRes = await fetch('/api/charging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: geo.lat, lon: geo.lon, distance_km: 50 }),
      });
      const chargeData = await chargeRes.json();
      if (!chargeRes.ok) throw new Error(chargeData.error || 'Charger lookup failed.');
      setStations(chargeData.stations || []);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStations([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="charging-view">
      <h2>Charging network</h2>
      <div className="charging-search">
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search a city, e.g. Pune"
        />
        <button type="button" onClick={search} disabled={loading || !place.trim()}>
          {loading && <span className="spinner" aria-hidden="true" />}
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {!searched && !error && (
        <div className="empty-state">Search a city to see nearby charging stations within ~50 km.</div>
      )}
      {searched && !loading && !error && stations.length === 0 && (
        <div className="empty-state">No charging stations found near "{place}".</div>
      )}

      {(center || stations.length > 0) && (
        <div className="charging-map-pane">
          <RouteMap
            positions={null}
            distanceKm={0}
            chargers={stations}
            recommendedStop={null}
            center={center}
            emptyLabel="Search a location to see chargers"
          />
        </div>
      )}

      {stations.length > 0 && (
        <ul className="charger-list">
          {stations.map((s) => (
            <li key={s.id ?? `${s.lat}-${s.lon}`}>{s.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
