import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const runCommand = async (command, args = [], timeout = 15000) => {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout,
      maxBuffer: 1024 * 1024,
    });

    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout?.trim?.() || '',
      stderr: error.stderr?.trim?.() || error.message,
    };
  }
};

export const remoteCommand = async ({ host, user, command, localHostnames = [] }) => {
  if (localHostnames.includes(host)) {
    return runCommand('sh', ['-lc', command]);
  }

  const target = user ? `${user}@${host}` : host;
  return runCommand('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', target, command], 20000);
};
