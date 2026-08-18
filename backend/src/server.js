import Fastify from 'fastify';
import cors from '@fastify/cors';
import { cache, setCache } from './cache.js';
import { config } from './config.js';
import { collectKomodo } from './collectors/komodo.js';
import { collectOpencode } from './collectors/opencode.js';
import { collectProjects } from './collectors/projects.js';
import { collectServers } from './collectors/servers.js';
import { collectActivities } from './collectors/activities.js';
import { collectPoste } from './collectors/poste.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

const refreshKomodo = async () => {
  const komodo = await collectKomodo();
  setCache('komodo', komodo);
  refreshActivities();
  return komodo;
};

const refreshServers = async () => {
  const servers = await collectServers(cache.komodo);
  setCache('servers', servers);
  return servers;
};

const refreshActivities = () => {
  const activities = collectActivities(cache.komodo, cache.projects, cache.opencode);
  setCache('activities', activities);
  return activities;
};

const refreshProjects = async () => {
  const projects = await collectProjects(cache.komodo, cache.opencode);
  setCache('projects', projects.items || []);
  refreshActivities();
  cache.projectsError = projects.error;
  cache.projectsUpdatedAt = projects.updatedAt;
  return projects;
};

const refreshOpencode = async () => {
  const opencode = await collectOpencode();
  setCache('opencode', opencode);
  refreshActivities();
  return opencode;
};

const refreshPoste = async () => {
  const poste = await collectPoste();
  setCache('poste', poste);
  return poste;
};

const refreshAll = async () => {
  const [komodo, opencode] = await Promise.all([refreshKomodo(), refreshOpencode(), refreshPoste()]);
  const [servers, projects] = await Promise.all([
    collectServers(komodo),
    collectProjects(komodo, opencode),
  ]);

  setCache('servers', servers);
  setCache('projects', projects.items || []);
  setCache('activities', collectActivities(komodo, projects.items || [], opencode));
  cache.projectsError = projects.error;
  cache.projectsUpdatedAt = projects.updatedAt;

  return cache;
};

app.get('/api/health', async () => ({ ok: true, updatedAt: new Date().toISOString() }));
app.get('/api/servers', async () => cache.servers);
app.get('/api/projects', async () => ({ items: cache.projects, error: cache.projectsError || null, updatedAt: cache.projectsUpdatedAt || null }));
app.get('/api/summary', async () => cache);
app.post('/api/refresh', async () => refreshAll());

setInterval(refreshServers, config.refresh.serversMs).unref();
setInterval(refreshKomodo, config.refresh.komodoMs).unref();
setInterval(refreshProjects, config.refresh.projectsMs).unref();
setInterval(refreshOpencode, config.refresh.projectsMs).unref();
setInterval(refreshPoste, config.refresh.projectsMs).unref();

refreshAll().catch((error) => app.log.error(error));

await app.listen({ host: config.host, port: config.port });
