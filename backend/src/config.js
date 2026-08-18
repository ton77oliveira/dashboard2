const list = (value, fallback = []) => {
  if (!value) return fallback;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const mapValue = (value, fallback = {}) => {
  if (!value) return fallback;
  return Object.fromEntries(value.split(',').map((item) => item.trim().split('=')).filter(([key, val]) => key && val));
};

const numberValue = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const booleanValue = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

export const config = {
  host: process.env.HOST || '0.0.0.0',
  port: numberValue(process.env.PORT, 4000),
  komodo: {
    enabled: booleanValue(process.env.KOMODO_ENABLED, Boolean(process.env.KOMODO_URL && process.env.KOMODO_API_KEY && process.env.KOMODO_API_SECRET)),
    url: process.env.KOMODO_URL || '',
    apiKey: process.env.KOMODO_API_KEY || '',
    apiSecret: process.env.KOMODO_API_SECRET || '',
  },
  opencode: {
    enabled: booleanValue(process.env.OPENCODE_ENABLED, Boolean(process.env.OPENCODE_API_URL || process.env.OPENCODE_URL)),
    apiUrl: process.env.OPENCODE_API_URL || process.env.OPENCODE_URL || '',
    publicUrl: process.env.OPENCODE_PUBLIC_URL || process.env.OPENCODE_URL || process.env.OPENCODE_API_URL || '',
  },
  servers: list(process.env.SERVERS, []),
  serverHosts: mapValue(process.env.SERVER_HOSTS, {}),
  serverUsers: mapValue(process.env.SERVER_USERS, {}),
  localServerName: process.env.LOCAL_SERVER_NAME || '',
  sshUser: process.env.SSH_USER || process.env.USER || '',
  projectsEnabled: booleanValue(process.env.PROJECTS_ENABLED, Boolean(process.env.PROJECTS_HOST && process.env.PROJECTS_PATH)),
  projectsHost: process.env.PROJECTS_HOST || '',
  projectsPath: process.env.PROJECTS_PATH || '',
  poste: {
    enabled: booleanValue(process.env.POSTE_ENABLED, Boolean(process.env.POSTE_HOST)),
    host: process.env.POSTE_HOST || '',
    user: process.env.POSTE_USER || process.env.SSH_USER || '',
    container: process.env.POSTE_CONTAINER || 'poste-io-mail-1',
    dataPath: process.env.POSTE_DATA_PATH || '/data',
    dmarcDomain: process.env.POSTE_DMARC_DOMAIN || '',
  },
  refresh: {
    serversMs: numberValue(process.env.REFRESH_SERVERS_SECONDS, 10) * 1000,
    komodoMs: numberValue(process.env.REFRESH_KOMODO_SECONDS, 10) * 1000,
    projectsMs: numberValue(process.env.REFRESH_PROJECTS_SECONDS, 60) * 1000,
  },
};
