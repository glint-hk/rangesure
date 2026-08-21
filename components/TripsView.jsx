'use client';
import { useTripHistory } from '@/lib/tripHistoryContext';
import { fmtNum, fmtRound } from '@/lib/format';

function formatTime(ts) {
  return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function TripsView() {
  const { trips, clearHistory } = useTripHistory();

  return (
    <div className="trips-view">
      <div className="fleet-header">
        <h2>Trip history</h2>
        {trips.length > 0 && (
          <button type="button" className="secondary-btn" onClick={clearHistory}>
            Clear history
          </button>
        )}
      </div>

      {trips.length === 0 ? (
        <div className="empty-state">
          No trips yet — trips you run on Plan Trip are logged here automatically. Fleet runs
          aren't logged (Fleet has its own dashboard).
        </div>
      ) : (
        <div className="table-scroll">
          <table className="fleet-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Route</th>
                <th>Distance (km)</th>
                <th>kWh/km</th>
                <th>₹/km</th>
                <th>Arrival (%)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id}>
                  <td>{formatTime(t.timestamp)}</td>
                  <td>
                    {t.origin} → {t.destination}
                  </td>
                  <td>{fmtNum(t.dist_km, 0)}</td>
                  <td>{fmtNum(t.kWh_per_km, 2)}</td>
                  <td>₹{fmtNum(t.cost_per_km, 2)}</td>
                  <td>{fmtRound(t.arrival_soc_pct)}%</td>
                  <td>
                    <span className={`badge ${t.feasible ? 'ok' : 'warn'}`}>
                      {t.feasible ? 'Feasible' : 'Needs charge'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
