import { StatusBadge } from './StatusBadge.jsx';

const formatTime = (timestamp) => {
  if (!timestamp) return 'agora';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(timestamp));
};

export function ActivityPanel({ activities }) {
  if (!activities?.length) return null;

  return (
    <section className="activity-panel">
      <header>
        <div>
          <h2>Atividade em andamento</h2>
          <span>builds, deploys e pendencias abertas</span>
        </div>
      </header>
      <div className="activity-list">
        {activities.map((activity) => (
          <article className="activity-item" key={activity.id}>
            <div>
              <strong>{activity.project}</strong>
              <small>{activity.source} · {activity.title} · {activity.detail}</small>
            </div>
            <div className="activity-meta">
              <StatusBadge value={activity.state} />
              <small>{formatTime(activity.timestamp)}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
