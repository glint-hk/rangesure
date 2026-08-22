'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import PlaceAutocomplete from './PlaceAutocomplete';

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

  return (
    <div className="mx-auto max-w-5xl">
      <h2 className="mb-4 text-lg font-bold text-foreground">Charging network</h2>
      <div className="relative mb-4">
        <PlaceAutocomplete
          value={place}
          onChange={setPlace}
          onEnter={() => {
            const query = place.trim();
            if (query.length < MIN_QUERY_LENGTH) return;
            clearTimeout(debounceRef.current);
            runSearch(query);
          }}
          placeholder="Type a city, e.g. Pune"
          inputClassName="h-11 w-full rounded-xl border border-border bg-surface-raised px-3.5 pr-10 text-[15px] text-foreground outline-none focus:ring-2 focus:ring-primary/50"
        />
        {loading && (
          <Loader2
            className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary"
            aria-hidden="true"
          />
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {!searched && !error && (
        <Card className="mb-4 border-dashed p-5 text-sm text-muted-foreground">
          Start typing a city (3+ letters) to see nearby charging stations within ~50 km.
        </Card>
      )}
      {searched && !loading && !error && stations.length === 0 && (
        <Card className="mb-4 border-dashed p-5 text-sm text-muted-foreground">
          No charging stations found near "{place.trim()}".
        </Card>
      )}

      {(center || stations.length > 0) && (
        <div className="mb-4 h-[320px] overflow-hidden rounded-2xl border border-border">
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
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stations.map((s) => (
            <li
              key={s.id ?? `${s.lat}-${s.lon}`}
              className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
            >
              {s.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
