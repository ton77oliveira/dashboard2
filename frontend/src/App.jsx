import React, { useEffect, useState, useTransition } from 'react';
import { createRoot } from 'react-dom/client';
import { getSummary, refreshSummary } from './api.js';
import { ServerCard } from './components/ServerCard.jsx';
import { ProjectTable } from './components/ProjectTable.jsx';
import { ServerUsagePanel } from './components/ServerUsagePanel.jsx';
import { ActivityPanel } from './components/ActivityPanel.jsx';
import { PostePanel } from './components/PostePanel.jsx';
import './style.css';

const sortProjects = (projects, sortMode) => {
  const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');
  return [...projects].sort((a, b) => {
    if (sortMode === 'session') return (a.opencode?.minutes_since_update ?? Infinity) - (b.opencode?.minutes_since_update ?? Infinity) || byName(a, b);
    if (sortMode === 'modified') return (b.modifiedAt || 0) - (a.modifiedAt || 0) || byName(a, b);
    if (sortMode === 'created') return (b.createdAt || 0) - (a.createdAt || 0) || byName(a, b);
    return byName(a, b);
  });
};

function App() {
  const [summary, setSummary] = useState({ servers: [], projects: [], komodo: {} });
  const [sortMode, setSortMode] = useState('name');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const sortedProjects = sortProjects(summary.projects || [], sortMode);

  const load = async (force = false) => {
    try {
      const data = force ? await refreshSummary() : await getSummary();
      startTransition(() => {
        setSummary(data);
        setError('');
      });
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main>
      <button className="floating-refresh" onClick={() => load(true)} disabled={isPending}>{isPending ? 'Atualizando...' : 'Atualizar'}</button>

      {error ? <div className="alert">Erro: {error}</div> : null}
      {summary.komodo?.error ? <div className="alert">Komodo: {summary.komodo.error}</div> : null}

      <section className="server-grid">
        {(summary.servers || []).map((server) => <ServerCard key={server.name} server={server} />)}
      </section>

      <ActivityPanel activities={summary.activities || []} />
      <PostePanel poste={summary.poste} />

      <ProjectTable projects={sortedProjects} sortMode={sortMode} onSortModeChange={setSortMode} />
      <ServerUsagePanel servers={summary.servers || []} />
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
