'use client';
import { useState } from 'react';
import { estimateTrip } from '@/lib/energyModel';
import { buildSegments } from '@/lib/segments';
import { useSettings } from '@/lib/settingsContext';
import { fmtNum, fmtRound } from '@/lib/format';

const FLEET_PRESET = [
  { truck: 'Truck 01', origin: 'Mumbai', destination: 'Pune', payload: 4000, battery: 80 },
  { truck: 'Truck 02', origin: 'Delhi', destination: 'Jaipur', payload: 6000, battery: 90 },
  { truck: 'Truck 03', origin: 'Bengaluru', destination: 'Chennai', payload: 5000, battery: 75 },
  { truck: 'Truck 04', origin: 'Ahmedabad', destination: 'Surat', payload: 3000, battery: 85 },
  { truck: 'Truck 05', origin: 'Chennai', destination: 'Coimbatore', payload: 4500, battery: 70 },
  { truck: 'Truck 06', origin: 'Pune', destination: 'Nashik', payload: 3500, battery: 95 },
];

export default function FleetView() {
  const { vehicle, tariff } = useSettings();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState('truck');
  const [sortAsc, setSortAsc] = useState(true);

  const runFleet = async () => {
    setLoading(true);
    const results = [];
    // Sequential, not Promise.all — keeps us under ORS/OCM rate limits.
    for (const trip of FLEET_PRESET) {
      try {
        const routeRes = await fetch('/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ origin: trip.origin, destination: trip.destination }),
        });
        const routeData = await routeRes.json();
        if (!routeRes.ok) throw new Error(routeData.error || 'Route failed');
        const segments = buildSegments(routeData.coordinates, routeData.distance_m, routeData.duration_s);
        const r = estimateTrip({
          segments,
          payloadKg: trip.payload,
          battery_pct: trip.battery,
          tariff,
          params: vehicle,
        });
        results.push({ ...trip, ...r, error: null });
      } catch (err) {
        results.push({ ...trip, error: err.message || 'Failed to compute' });
      }
    }
    setRows(results);
    setLoading(false);
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sorted = [...rows].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortAsc ? va - vb : vb - va;
  });

  const validRows = rows.filter((r) => !r.error);
  const errorCount = rows.length - validRows.length;
  const needsChargeCount = validRows.filter((r) => !r.feasible).length;
  const totalEnergy = validRows.reduce((a, r) => a + (r.total_kWh || 0), 0);
  const avgCostPerKm = validRows.length
    ? validRows.reduce((a, r) => a + r.cost_per_km, 0) / validRows.length
    : 0;

  return (
    <div className="fleet-view">
      <div className="fleet-header">
        <h2>Fleet dashboard</h2>
        <button type="button" onClick={runFleet} disabled={loading}>
          {loading && <span className="spinner" aria-hidden="true" />}
          {loading ? 'Running fleet…' : 'Run fleet'}
        </button>
      </div>

      {rows.length === 0 && !loading && (
        <div className="empty-state">
          Click "Run fleet" to compute range and cost for 6 sample trucks using the same physics
          model as Plan Trip.
        </div>
      )}
      {loading && rows.length === 0 && (
        <div className="empty-state">
          <span className="spinner spinner-dark" aria-hidden="true" />
          Running each truck's route through the model…
        </div>
      )}

      {errorCount > 0 && (
        <div className="error-banner">
          {errorCount} of {rows.length} trucks failed to load — see the row for details.
        </div>
      )}

      {rows.length > 0 && (
        <div className="fleet-dashboard-strip">
          <div>
            <span className="stat-value">{fmtNum(totalEnergy, 1)}</span>
            <span className="stat-label">kWh total</span>
          </div>
          <div>
            <span className="stat-value">₹{fmtNum(avgCostPerKm, 2)}</span>
            <span className="stat-label">avg ₹/km</span>
          </div>
          <div>
            <span className="stat-value">{needsChargeCount}</span>
            <span className="stat-label">trips needing a charge stop</span>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="table-scroll">
        <table className="fleet-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('truck')}>Truck</th>
              <th>Route</th>
              <th onClick={() => toggleSort('dist_km')}>Distance (km)</th>
              <th onClick={() => toggleSort('kWh_per_km')}>kWh/km</th>
              <th onClick={() => toggleSort('cost_per_km')}>₹/km</th>
              <th onClick={() => toggleSort('predicted_full_range_km')}>Range (km)</th>
              <th onClick={() => toggleSort('arrival_soc_pct')}>Arrival (%)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.truck}>
                <td>{r.truck}</td>
                <td>
                  {r.origin} → {r.destination}
                </td>
                {r.error ? (
                  <td colSpan={6} className="row-error">
                    {r.error}
                  </td>
                ) : (
                  <>
                    <td>{fmtNum(r.dist_km, 0)}</td>
                    <td>{fmtNum(r.kWh_per_km, 2)}</td>
                    <td>₹{fmtNum(r.cost_per_km, 2)}</td>
                    <td>{fmtRound(r.predicted_full_range_km)}</td>
                    <td>{fmtRound(r.arrival_soc_pct)}%</td>
                    <td>
                      <span className={`badge ${r.feasible ? 'ok' : 'warn'}`}>
                        {r.feasible ? 'Feasible' : 'Needs charge'}
                      </span>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
