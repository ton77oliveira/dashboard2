import { StatusBadge } from './StatusBadge.jsx';

const fmt = (value, suffix = '') => value === undefined || value === null ? '-' : `${value}${suffix}`;

const fmtBytes = (value) => {
  if (value === undefined || value === null) return '-';
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB/s`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB/s`;
  return `${value} B/s`;
};

export function ServerCard({ server }) {
  return (
    <article className="server-card">
      <header>
        <div>
          <h2>{server.name}</h2>
        </div>
        <StatusBadge value={Boolean(server.online)} />
      </header>

      {server.online ? (
        <div className="metrics compact-metrics">
          <div><strong>{fmt(server.cpuLoad)}</strong><span>CPU</span></div>
          <div><strong>{fmt(server.memory?.percent, '%')}</strong><span>memoria</span></div>
          <div><strong>{fmt(server.disk?.percent, '%')}</strong><span>disco</span></div>
          <div><strong>{fmt(server.temperatureC, '°C')}</strong><span>temp.</span></div>
          <div><strong>↓ {fmtBytes(server.network?.rxBps)}<br />↑ {fmtBytes(server.network?.txBps)}</strong><span>rede</span></div>
        </div>
      ) : <p className="error-text">{server.error || 'Servidor indisponivel'}</p>}
    </article>
  );
}
