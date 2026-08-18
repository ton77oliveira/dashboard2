export const cache = {
  servers: [],
  projects: [],
  activities: [],
  poste: {
    available: false,
    error: null,
    updatedAt: null,
  },
  opencode: {
    sessions: [],
    active: {},
    error: null,
    updatedAt: null,
  },
  komodo: {
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
    error: null,
    updatedAt: null,
  },
  lastRefresh: null,
};

export const setCache = (key, value) => {
  cache[key] = value;
  cache.lastRefresh = new Date().toISOString();
};
