'use client';

const NAV_ITEMS = [
  { key: 'plan', label: 'Plan Trip', enabled: true },
  { key: 'trips', label: 'Trips', enabled: true },
  { key: 'fleet', label: 'Fleet', enabled: true },
  { key: 'charging', label: 'Charging', enabled: true },
  { key: 'reports', label: 'Reports', enabled: true },
  { key: 'settings', label: 'Settings', enabled: true },
];

export default function Sidebar({ active, onSelect }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-title">
        Tata RangeSure
        <span className="sidebar-subtitle">EV Trip Planner</span>
      </div>
      <ul>
        {NAV_ITEMS.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={`sidebar-item${active === item.key ? ' active' : ''}${
                !item.enabled ? ' disabled' : ''
              }`}
              disabled={!item.enabled}
              onClick={() => item.enabled && onSelect(item.key)}
            >
              <span>{item.label}</span>
              {!item.enabled && <span className="soon-badge">Soon</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
