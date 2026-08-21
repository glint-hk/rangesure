'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const RouteMap = dynamic(() => import('./RouteMap'), { ssr: false });

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 450;

export default function ChargingView() {
  const [place, setPlace] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [center, setCenter] = useState(null);
  const [stations, setStations] = useState([]);
  const [searched, setSearched] = useState(false);
  const requestId = useRef(0);
  const debounceRef = useRef(null);

  // Guarded by requestId so a slow response from an earlier keystroke can never
  // overwrite the result of a more recent one.
  const runSearch = async (query) => {
    const id = ++requestId.current;
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
      if (id !== requestId.current) return; // superseded by a newer search
      if (!geoRes.ok) throw new Error(geo.error || 'Location lookup failed.');
      setCenter([geo.lat, geo.lon]);

      const chargeRes = await fetch('/api/charging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: geo.lat, lon: geo.lon, distance_km: 50 }),
      });
      const chargeData = await chargeRes.json();
      if (id !== requestId.current) return;
      if (!chargeRes.ok) throw new Error(chargeData.error || 'Charger lookup failed.');
      setStations(chargeData.stations || []);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err.message || 'Something went wrong. Please try again.');
      setStations([]);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  // Debounced search-as-you-type — waits for a pause in typing so every keystroke
  // doesn't fire a request, and requires a few characters before bothering ORS at all.
  useEffect(() => {
    const query = place.trim();
    clearTimeout(debounceRef.current);

    if (query.length < MIN_QUERY_LENGTH) {
      requestId.current += 1; // invalidate any in-flight search
      setLoading(false);
      setSearched(false);
      setError(null);
      setStations([]);
      setCenter(null);
      return;
    }

    debounceRef.current = setTimeout(() => runSearch(query), DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place]);

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    const query = place.trim();
    if (query.length < MIN_QUERY_LENGTH) return;
    clearTimeout(debounceRef.current);
    runSearch(query); // search immediately, skip the debounce wait
  };

  return (
    <div className="charging-view">
      <h2>Charging network</h2>
      <div className="charging-search">
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a city, e.g. Pune"
        />
        {loading && <span className="spinner spinner-dark" aria-hidden="true" />}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {!searched && !error && (
        <div className="empty-state">
          Start typing a city (3+ letters) to see nearby charging stations within ~50 km.
        </div>
      )}
      {searched && !loading && !error && stations.length === 0 && (
        <div className="empty-state">No charging stations found near "{place.trim()}".</div>
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
