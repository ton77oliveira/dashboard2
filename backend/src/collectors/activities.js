const itemId = (item) => item?.id || item?._id?.$oid || item?._id || null;

const updateTime = (update) => update.end_ts || update.start_ts || update.time?.end || update.time?.start || update.updated_at || update.created_at || null;

const updateState = (update) => {
  if (update.status === 'InProgress') return 'running';
  if (update.success === false || update.status === 'Failed') return 'failed';
  if (update.success === true || update.status === 'Complete') return 'completed';
  return String(update.status || 'recent').toLowerCase();
};

const actionLabel = (operation = '') => {
  if (/build/i.test(operation)) return 'Build';
  if (/deploy|pull|stack/i.test(operation)) return 'Deploy';
  if (/repo|clone|pull/i.test(operation)) return 'Repo';
  return operation || 'Komodo';
};

const isRelevantOperation = (operation = '') => /build|deploy|stack|repo|commit|clone|pull/i.test(operation);

export const collectActivities = (komodo, projects, opencode) => {
  const resourceToProject = new Map();
  for (const project of projects || []) {
    for (const id of [project.komodo?.stack, project.komodo?.deployment, project.komodo?.build, project.komodo?.repo].filter(Boolean)) {
      resourceToProject.set(id, project.name);
    }
  }

  const komodoActivities = (komodo.updates || [])
    .filter((update) => isRelevantOperation(update.operation))
    .map((update) => {
      const targetId = update.target?.id || update.target_id || update.targetId || null;
      const state = updateState(update);
      const time = updateTime(update);
      return {
        id: itemId(update) || `${update.operation}-${targetId}-${time}`,
        source: 'Komodo',
        project: resourceToProject.get(targetId) || update.target?.name || targetId || 'sem projeto',
        title: actionLabel(update.operation),
        detail: update.operation || '',
        state,
        timestamp: time,
      };
    })
    .filter((activity) => activity.state === 'running');

  const waitingActivities = (opencode.requests || []).map((request) => ({
    id: `opencode-${request.type}-${request.id || request.sessionId || request.directory}`,
    source: 'OpenCode',
    project: (projects || []).find((project) => project.path === request.directory || project.opencode?.link?.includes(request.sessionId))?.name || request.directory || 'sessao',
    title: 'Aguardando usuario',
    detail: request.title || request.type,
    state: 'waiting_user',
    timestamp: null,
  }));

  return [...waitingActivities, ...komodoActivities]
    .sort((a, b) => {
      const priority = { waiting_user: 0, running: 1, failed: 2, completed: 3 };
      return (priority[a.state] ?? 9) - (priority[b.state] ?? 9) || new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    })
    .slice(0, 12);
};
