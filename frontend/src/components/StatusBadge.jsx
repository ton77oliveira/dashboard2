const labels = {
  true: 'ok',
  false: 'offline',
  running: 'rodando',
  waiting_user: 'aguardando usuario',
  blocked: 'bloqueado',
  completed: 'concluido',
  failed: 'falhou',
  idle: 'idle',
  building: 'building',
  deploying: 'deploying',
  pulling: 'pulling',
  publishing: 'publicando',
  recent: 'recente',
  active_recent: 'ativo recente',
  session: 'sessão',
};

export function StatusBadge({ value }) {
  const key = String(value ?? 'idle');
  return <span className={`badge badge-${key.replaceAll('_', '-')}`}>{labels[key] || key}</span>;
}
