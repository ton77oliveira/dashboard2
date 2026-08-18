import { config } from '../config.js';

const toSessionLink = (session) => {
  if (!session.id || !config.opencode.publicUrl) return null;
  const serverKey = Buffer.from(config.opencode.publicUrl)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `${config.opencode.publicUrl}/server/${serverKey}/session/${session.id}`;
};

const extractRequests = (payload, type) => (payload?.data || []).map((request) => ({
  type,
  id: request.id || request.requestID || request.requestId || null,
  sessionId: request.sessionID || request.sessionId || request.session_id || request.session?.id || null,
  directory: request.location?.directory || request.directory || request.session?.location?.directory || '',
  title: request.title || request.message || request.permission || request.action || type,
}));

export const collectOpencode = async () => {
  try {
    if (!config.opencode.enabled) {
      throw new Error('OpenCode integration is disabled');
    }

    const [sessionsResponse, activeResponse, questionResponse, permissionResponse] = await Promise.all([
      fetch(`${config.opencode.apiUrl}/api/session?limit=1000`),
      fetch(`${config.opencode.apiUrl}/api/session/active`).catch(() => null),
      fetch(`${config.opencode.apiUrl}/api/question/request`).catch(() => null),
      fetch(`${config.opencode.apiUrl}/api/permission/request`).catch(() => null),
    ]);

    if (!sessionsResponse.ok) {
      throw new Error(`OpenCode sessions failed with HTTP ${sessionsResponse.status}`);
    }

    const sessionsPayload = await sessionsResponse.json();
    const activePayload = activeResponse?.ok ? await activeResponse.json() : { data: {} };
    const questionPayload = questionResponse?.ok ? await questionResponse.json() : { data: [] };
    const permissionPayload = permissionResponse?.ok ? await permissionResponse.json() : { data: [] };
    const requests = [
      ...extractRequests(questionPayload, 'question'),
      ...extractRequests(permissionPayload, 'permission'),
    ];
    const sessions = (sessionsPayload.data || []).map((session) => ({
      id: session.id,
      projectID: session.projectID,
      directory: session.location?.directory || '',
      subpath: session.subpath || '',
      agent: session.agent || '',
      title: session.title || '',
      createdAt: session.time?.created || null,
      updatedAt: session.time?.updated || null,
      link: toSessionLink(session),
      waitingUser: requests.some((request) => request.sessionId === session.id || (request.directory && request.directory === session.location?.directory)),
    }));

    return {
      sessions,
      active: activePayload.data || {},
      requests,
      error: null,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      sessions: [],
      active: {},
      requests: [],
      error: error.message,
      updatedAt: new Date().toISOString(),
    };
  }
};
