const value = (number) => number ?? '-';

export function PostePanel({ poste }) {
  if (!poste?.available) {
    return <section className="poste-panel"><header><div><h2>Mail Server</h2><span>{poste?.error || 'metricas indisponiveis'}</span></div></header></section>;
  }

  const today = poste.today || {};
  const last30 = poste.last30 || {};
  const services = poste.services || {};
  const container = poste.container || {};
  return (
    <section className="poste-panel">
      <div className="mailserver-grid">
        <div className="mailserver-card service-card"><h3>Services status</h3><div className="service-list">{Object.entries(services).map(([name, up]) => <span key={name} className={up ? 'service-up' : 'service-down'}>{up ? '●' : '○'} {name}</span>)}</div><div className="container-usage"><span>CPU <b>{container.cpu || '-'}</b></span><span>MEM <b>{container.memory || '-'}</b></span><span>DISCO <b>{container.diskBytes ? `${(container.diskBytes / 1073741824).toFixed(1)} GB` : '-'}</b></span></div><div className="embedded-ips"><h3>Últimos Remote IPs</h3>{(poste.remoteIps || []).map((item) => <div className="user-row" key={item.ip}><span><b>{item.ip}</b>{item.reverse ? <small>{item.reverse}</small> : null}</span><small>{item.count} <i>↑</i></small></div>)}</div></div>
        <div className="mailserver-card"><h3>Top users</h3>{(poste.topUsers || []).map((user) => <div className="user-row" key={user.email}><span>{user.email}</span><small>in {user.received} · out {user.sent}</small></div>)}</div>
        <div className="mailserver-card latest-connection"><h3>Connections realtime</h3><div className="connections-list">{(poste.connections || []).map((connection) => <div className="connection-row" key={`${connection.uuid}-${connection.time}`}><time>{connection.time}</time><b>{connection.uuid}</b><span>{connection.endpoint}</span><em>{connection.details}</em></div>)}</div>{!poste.connections?.length ? <small>sem conexões registradas</small> : null}</div>
      </div>
      <div className="poste-metrics">
        <div><strong>{value(today.inbound)}/{value(last30.inbound)}</strong><span>recebidos hoje/30D</span></div>
        <div><strong>{value(today.outbound)}/{value(last30.outbound)}</strong><span>enviados hoje/30D</span></div>
        <div><strong>{value(today.quarantined)}/{value(last30.quarantined)}</strong><span>quarentena hoje/30D</span></div>
        <div><strong>{value(today.rejected)}/{value(last30.rejected)}</strong><span>rejeitados hoje/30D</span></div>
        <div><strong>{value(poste.domains)}</strong><span>dominios ativos</span></div>
        <div><strong>{value(poste.mailboxes)}</strong><span>caixas ativas</span></div>
        <div><strong>{value(poste.aliases)}</strong><span>aliases</span></div>
        <div><strong>{value(poste.dmarcReports)}</strong><span>relatorios DMARC</span></div>
        <div><strong>{value(poste.dmarcMessages)}</strong><span>mensagens DMARC</span></div>
        <div><strong>{value(poste.dmarcFail)}</strong><span>falhas DMARC</span></div>
      </div>
    </section>
  );
}
