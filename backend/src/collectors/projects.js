import { hostname } from 'node:os';
import { config } from '../config.js';
import { remoteCommand } from '../utils/command.js';

const localHostnames = () => ['localhost', hostname(), config.localServerName].filter(Boolean);

const extractDomains = (labels = '') => {
  const domains = new Set();
  const pattern = /Host\(([^)]+)\)/g;
  let match = pattern.exec(labels);

  while (match) {
    match[1]
      .split(',')
      .map((item) => item.trim().replace(/^['"`]/, '').replace(/['"`]$/, ''))
      .filter(Boolean)
      .forEach((domain) => domains.add(domain));
    match = pattern.exec(labels);
  }

  return [...domains];
};

const itemId = (item) => item?.id || item?._id?.$oid || item?._id || null;

const stackText = (stack) => [
  stack?.config?.file_contents,
  stack?.info?.deployed_config,
  ...(stack?.info?.deployed_contents || []).map((item) => item.contents),
  ...(stack?.info?.remote_contents || []).map((item) => item.contents),
].filter(Boolean).join('\n');

const actionInProgress = (state) => Boolean(state && Object.values(state).some(Boolean));

const publicationStatus = ({ stack, build, komodo }) => {
  const stackState = (komodo.stackActionStates || []).find((item) => item.id === itemId(stack))?.state;
  const buildState = (komodo.buildActionStates || []).find((item) => item.id === itemId(build))?.state;

  if (buildState?.building) return { state: 'building', label: 'build em andamento' };
  if (stackState?.deploying) return { state: 'deploying', label: 'deploy em andamento' };
  if (stackState?.pulling) return { state: 'pulling', label: 'pull em andamento' };
  if (actionInProgress(stackState)) return { state: 'publishing', label: 'publicando' };
  return { state: 'idle', label: 'sem publicação' };
};

const opencodeForProject = (path, opencode) => {
  const sessions = (opencode.sessions || [])
    .filter((session) => session.directory === path)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const latest = sessions[0];
  if (!latest) return null;

  const minutesSinceUpdate = latest.updatedAt ? Math.round((Date.now() - latest.updatedAt) / 60000) : null;
  let state = 'session';
  if (minutesSinceUpdate !== null && minutesSinceUpdate <= 15) state = 'recent';
  if (minutesSinceUpdate !== null && minutesSinceUpdate <= 3) state = 'active_recent';
  if (latest.waitingUser) state = 'waiting_user';

  return {
    state,
    sessions: sessions.length,
    agent: latest.agent,
    task: latest.title,
    updated_at: latest.updatedAt ? new Date(latest.updatedAt).toISOString() : null,
    minutes_since_update: minutesSinceUpdate,
    link: latest.link,
  };
};

const parseSdd = (entry) => ({
  specs: {
    total: entry.specsTotal || 0,
    pending: entry.specTasksPending || 0,
    done: entry.specTasksDone || 0,
  },
  tasks: {
    pending: entry.tasksPending || 0,
    done: entry.tasksDone || 0,
  },
});

const parseProjectStatus = (content) => {
  if (!content) return null;
  const checked = (content.match(/- \[[xX]\]/g) || []).length;
  const unchecked = (content.match(/- \[ \]/g) || []).length;
  const total = checked + unchecked;
  const readField = (field) => content.match(new RegExp(`^${field}:\\s*(.+)$`, 'im'))?.[1]?.trim() || '';

  return {
    state: readField('Estado') || 'informado',
    phase: readField('Fase'),
    priority: readField('Prioridade'),
    updatedAt: readField('Última atualização') || readField('Ultima atualização'),
    progress: total ? Math.round((checked / total) * 100) : null,
  };
};

const matchKomodo = (name, komodo) => {
  const byName = (items = []) => items.find((item) => item.name === name || item.info?.name === name || item.config?.name === name);
  const stack = byName(komodo.stacks);
  const deployment = byName(komodo.deployments);
  const build = byName(komodo.builds);
  const repo = byName(komodo.repos);
  const labels = [
    deployment?.config?.labels,
    deployment?.deployment?.config?.labels,
    stackText(stack),
  ].filter(Boolean).join('\n');

  const publication = publicationStatus({ stack, build, komodo });

  return {
    linked: Boolean(stack || deployment || build || repo),
    stack: itemId(stack),
    deployment: itemId(deployment),
    build: itemId(build),
    repo: itemId(repo),
    serverId: deployment?.config?.server_id || stack?.config?.server_id || null,
    domains: extractDomains(labels),
    publication,
  };
};

const fallbackProjectsFromKomodo = (komodo) => {
  const names = new Set();
  for (const collection of [komodo.stacks, komodo.deployments, komodo.builds, komodo.repos]) {
    for (const item of collection || []) {
      const name = item.name || item.info?.name || item.config?.name;
      if (name) names.add(name);
    }
  }

  return [...names].sort().map((name) => ({
    name,
    path: null,
    status: null,
    opencode: null,
    sdd: null,
    komodo: matchKomodo(name, komodo),
  }));
};

const buildProjectsScript = () => `
const fs = require('fs');
const path = '${config.projectsPath}';
const walk = (dir, limit = 500) => {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (files.length >= limit) break;
    const file = dir + '/' + entry.name;
    if (entry.isDirectory()) files = files.concat(walk(file, limit - files.length));
    else files.push(file);
  }
  return files;
};
const countChecks = (files) => files.reduce((acc, file) => {
  const content = fs.readFileSync(file, 'utf8');
  acc.done += (content.match(/- \\[[xX]\\]/g) || []).length;
  acc.pending += (content.match(/- \\[ \\]/g) || []).length;
  return acc;
}, { done: 0, pending: 0 });
const newestMtime = (dir) => Math.max(fs.statSync(dir).mtimeMs, ...walk(dir).map((file) => fs.statSync(file).mtimeMs));
const out = fs.readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => {
  const dir = path + '/' + entry.name;
  const dirStat = fs.statSync(dir);
  const statusFile = dir + '/PROJECT_STATUS.md';
  const openCodeFile = dir + '/.opencode/status.json';
  const specDirs = fs.existsSync(dir + '/specs') ? fs.readdirSync(dir + '/specs', { withFileTypes: true }).filter((item) => item.isDirectory() && !item.name.startsWith('_')) : [];
  const specTaskFiles = specDirs.map((item) => dir + '/specs/' + item.name + '/tasks.md').filter(fs.existsSync);
  const taskFiles = ['BACKLOG.md', 'IN_PROGRESS.md', 'TODO.md'].map((item) => dir + '/tasks/' + item).filter(fs.existsSync);
  const specCounts = countChecks(specTaskFiles);
  const taskCounts = countChecks(taskFiles);

  return {
    name: entry.name,
    path: dir,
    modifiedAt: newestMtime(dir),
    createdAt: dirStat.birthtimeMs || dirStat.ctimeMs,
    status: fs.existsSync(statusFile) ? fs.readFileSync(statusFile, 'utf8') : '',
    opencode: fs.existsSync(openCodeFile) ? fs.readFileSync(openCodeFile, 'utf8') : '',
    specsTotal: specDirs.length,
    specTasksDone: specCounts.done,
    specTasksPending: specCounts.pending,
    tasksDone: taskCounts.done,
    tasksPending: taskCounts.pending,
  };
});
console.log(JSON.stringify(out));
`;

export const collectProjects = async (komodo, opencodeData = { sessions: [] }) => {
  if (!config.projectsEnabled || !config.projectsHost || !config.projectsPath) {
    return {
      error: config.projectsEnabled ? 'Projects host/path are not configured' : null,
      updatedAt: new Date().toISOString(),
      items: fallbackProjectsFromKomodo(komodo),
    };
  }

  const encodedScript = Buffer.from(buildProjectsScript()).toString('base64');
  const script = `node -e "eval(Buffer.from('${encodedScript}','base64').toString())"`;
  const result = await remoteCommand({
    host: config.projectsHost,
    user: config.sshUser,
    command: script,
    localHostnames: localHostnames(),
  });

  if (!result.ok) {
    return {
      error: result.stderr,
      updatedAt: new Date().toISOString(),
      items: fallbackProjectsFromKomodo(komodo),
    };
  }

  const entries = JSON.parse(result.stdout);
  return {
    error: null,
    updatedAt: new Date().toISOString(),
    items: entries.map((entry) => {
      let opencode = null;
      try {
        opencode = entry.opencode ? JSON.parse(entry.opencode) : opencodeForProject(entry.path, opencodeData);
      } catch {
        opencode = { state: 'invalid_status_file' };
      }

      return {
        name: entry.name,
        path: entry.path,
        modifiedAt: entry.modifiedAt || null,
        createdAt: entry.createdAt || null,
        status: parseProjectStatus(entry.status),
        opencode,
        sdd: parseSdd(entry),
        komodo: matchKomodo(entry.name, komodo),
      };
    }),
  };
};
