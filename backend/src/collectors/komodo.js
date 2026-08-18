import { config } from '../config.js';

export const readKomodo = async (type, params = {}) => {
  if (!config.komodo.enabled) {
    throw new Error('Komodo integration is disabled');
  }

  if (!config.komodo.apiKey || !config.komodo.apiSecret) {
    throw new Error('Komodo API key/secret are not configured');
  }

  const response = await fetch(`${config.komodo.url}/read`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.komodo.apiKey,
      'x-api-secret': config.komodo.apiSecret,
    },
    body: JSON.stringify({ type, params }),
  });

  if (!response.ok) {
    throw new Error(`Komodo ${type} failed with HTTP ${response.status}`);
  }

  return response.json();
};

export const collectKomodo = async () => {
  try {
    const [stacks, deployments, builds, repos, servers] = await Promise.all([
      readKomodo('ListFullStacks'),
      readKomodo('ListFullDeployments'),
      readKomodo('ListFullBuilds'),
      readKomodo('ListRepos'),
      readKomodo('ListFullServers'),
    ]);

    const containersPromise = readKomodo('ListAllDockerContainers').catch((error) => ({ error: error.message, items: [] }));
    const updatesPromise = readKomodo('ListUpdates', { query: {}, page: 0, limit: 30 }).catch((error) => ({ error: error.message, items: [] }));
    const statsPromise = Promise.all((servers || []).map(async (server) => {
      const id = server._id?.$oid || server.id;
      try {
        return { serverId: id, name: server.name, stats: await readKomodo('GetSystemStats', { server: id }), error: null };
      } catch (error) {
        return { serverId: id, name: server.name, stats: null, error: error.message };
      }
    }));

    const stackActionStatesPromise = Promise.all((stacks || []).map(async (stack) => {
      const id = stack._id?.$oid || stack.id;
      try {
        return { id, name: stack.name, state: await readKomodo('GetStackActionState', { stack: id }), error: null };
      } catch (error) {
        return { id, name: stack.name, state: null, error: error.message };
      }
    }));
    const buildActionStatesPromise = Promise.all((builds || []).map(async (build) => {
      const id = build._id?.$oid || build.id;
      try {
        return { id, name: build.name, state: await readKomodo('GetBuildActionState', { build: id }), error: null };
      } catch (error) {
        return { id, name: build.name, state: null, error: error.message };
      }
    }));

    const [containers, updates, serverStats, stackActionStates, buildActionStates] = await Promise.all([
      containersPromise,
      updatesPromise,
      statsPromise,
      stackActionStatesPromise,
      buildActionStatesPromise,
    ]);

    return {
      stacks,
      deployments,
      builds,
      repos,
      servers,
      containers: Array.isArray(containers) ? containers : [],
      containersError: containers.error || null,
      updates: Array.isArray(updates) ? updates : updates.updates || updates.items || [],
      updatesError: updates.error || null,
      serverStats,
      stackActionStates,
      buildActionStates,
      error: null,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      stacks: [],
      deployments: [],
      builds: [],
      repos: [],
      servers: [],
      containers: [],
      containersError: null,
      updates: [],
      updatesError: null,
      serverStats: [],
      stackActionStates: [],
      buildActionStates: [],
      error: error.message,
      updatedAt: new Date().toISOString(),
    };
  }
};
