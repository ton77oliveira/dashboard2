export function ServerUsagePanel({ servers }) {
  return (
    <section className="usage-panel">
      <header>
        <h2>Top CPU e memoria</h2>
        <span>{servers.length} servidores</span>
      </header>
      <div className="usage-grid">
        {servers.map((server) => (
          <article className="usage-card" key={server.name}>
            <h3>{server.name}</h3>
            <div className="usage-columns">
              <div className="container-list">
                <h4>Top CPU</h4>
                {(server.topCpu || []).map((item) => <p key={`cpu-${server.name}-${item.name}`}>{item.name}<span>{item.cpu}%</span></p>)}
              </div>
              <div className="container-list">
                <h4>Top memoria</h4>
                {(server.topMemory || []).map((item) => <p key={`mem-${server.name}-${item.name}`}>{item.name}<span>{item.memory}</span></p>)}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
