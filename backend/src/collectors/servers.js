import { hostname } from 'node:os';
import { config } from '../config.js';
import { remoteCommand } from '../utils/command.js';

const serverId = (server) => server._id?.$oid || server.id || server._id;

const parsePercent = (value) => Number.parseFloat(String(value || '0').replace('%', '')) || 0;

const parseMemoryMb = (value) => {
  const first = String(value || '0B').split('/')[0]?.trim() || '0B';
  const amount = Number.parseFloat(first) || 0;
  if (first.includes('GiB')) return amount * 1024;
  if (first.includes('MiB')) return amount;
  if (first.includes('KiB')) return amount / 1024;
  if (first.includes('GB')) return amount * 1000;
  if (first.includes('MB')) return amount;
  if (first.includes('KB')) return amount / 1000;
  return amount / 1024 / 1024;
};

const previousNetwork = new Map();

const localHostnames = () => ['localhost', hostname(), config.localServerName].filter(Boolean);

const formatNetworkRate = (server, network) => {
  if (!network) return null;

  const now = Date.now();
  const previous = previousNetwork.get(server);
  previousNetwork.set(server, { ...network, timestamp: now });

  if (!previous?.timestamp) return { rxBps: null, txBps: null };

  const seconds = Math.max((now - previous.timestamp) / 1000, 1);
  return {
    rxBps: Math.max(0, Math.round((network.rxBytes - previous.rxBytes) / seconds)),
    txBps: Math.max(0, Math.round((network.txBytes - previous.txBytes) / seconds)),
  };
};

const parseHostExtras = (payload, server) => {
  const data = JSON.parse(payload || '{}');
  return {
    temperatureC: data.temperatureC ?? null,
    network: formatNetworkRate(server, data.network),
  };
};

const metricHost = (server) => config.serverHosts[server] || server;
const metricUser = (server) => config.serverUsers[server] || config.sshUser;

const collectHostExtras = async (server, host, user) => {
  const script = `sh -lc 'max=""; for f in /sys/class/hwmon/*/temp*_input /sys/class/thermal/*/temp; do [ -r "$f" ] || continue; raw=$(cat "$f" 2>/dev/null || true); [ -n "$raw" ] || continue; if [ "$raw" -gt 1000 ] 2>/dev/null; then c=$((raw / 1000)); else c=$raw; fi; if [ "$c" -ge 10 ] 2>/dev/null && [ "$c" -le 120 ] 2>/dev/null; then [ -z "$max" ] || [ "$c" -gt "$max" ] && max="$c"; fi; done; rx=0; tx=0; for iface in /sys/class/net/*; do [ -d "$iface" ] || continue; name=\${iface##*/}; case "$name" in lo|docker*|veth*|br-*|virbr*|ifb*) continue;; esac; if [ -r "$iface/statistics/rx_bytes" ]; then v=$(cat "$iface/statistics/rx_bytes" 2>/dev/null || echo 0); rx=$((rx + v)); fi; if [ -r "$iface/statistics/tx_bytes" ]; then v=$(cat "$iface/statistics/tx_bytes" 2>/dev/null || echo 0); tx=$((tx + v)); fi; done; printf "{\\"temperatureC\\":%s,\\"network\\":{\\"rxBytes\\":%s,\\"txBytes\\":%s}}\\n" "\${max:-null}" "$rx" "$tx"'`;
  const result = await remoteCommand({ host, user, command: script, localHostnames: localHostnames() });
  if (!result.ok) return { temperatureC: null, network: null };

  try {
    return parseHostExtras(result.stdout, server);
  } catch {
    return { temperatureC: null, network: null };
  }
};

const fromKomodo = (name, komodo, extras = {}) => {
  const server = (komodo.servers || []).find((item) => item.name === name);
  const id = server ? serverId(server) : null;
  const stat = (komodo.serverStats || []).find((item) => item.name === name || item.serverId === id);

  if (!server || !stat || !stat.stats) return null;

  const containers = (komodo.containers || [])
    .filter((container) => container.server_id === id && container.state === 'running' && container.stats)
    .map((container) => ({
      name: container.name,
      cpu: parsePercent(container.stats.cpu_perc),
      memory: container.stats.mem_usage || '0B',
      memoryMb: parseMemoryMb(container.stats.mem_usage),
    }));

  const disk = (stat.stats.disks || [])[0];

  return {
    name,
    online: true,
    source: 'komodo',
    cpuLoad: Math.round((stat.stats.cpu_perc || 0) * 10) / 10,
    loadAverage: stat.stats.load_average || null,
    memory: {
      usedMb: Math.round((stat.stats.mem_used_gb || 0) * 1024),
      totalMb: Math.round((stat.stats.mem_total_gb || 0) * 1024),
      percent: stat.stats.mem_total_gb ? Math.round((stat.stats.mem_used_gb / stat.stats.mem_total_gb) * 100) : 0,
    },
    disk: {
      usedGb: Math.round(disk?.used_gb || 0),
      totalGb: Math.round(disk?.total_gb || 0),
      percent: disk?.total_gb ? Math.round((disk.used_gb / disk.total_gb) * 100) : 0,
    },
    temperatureC: extras.temperatureC ?? null,
    network: extras.network ?? null,
    topCpu: [...containers].sort((a, b) => b.cpu - a.cpu).slice(0, 3),
    topMemory: [...containers].sort((a, b) => b.memoryMb - a.memoryMb).slice(0, 3),
    updatedAt: new Date().toISOString(),
  };
};

const parseLocalMetrics = (payload) => {
  const data = JSON.parse(payload);
  const memUsed = Number(data.memTotalKb || 0) - Number(data.memAvailableKb || 0);
  const memTotal = Number(data.memTotalKb || 0);
  const diskUsed = Number(data.diskUsedKb || 0);
  const diskTotal = Number(data.diskTotalKb || 0);

  return {
    cpuLoad: Number(data.load1 || 0),
    memory: {
      usedMb: Math.round(memUsed / 1024),
      totalMb: Math.round(memTotal / 1024),
      percent: memTotal ? Math.round((memUsed / memTotal) * 100) : 0,
    },
    disk: {
      usedGb: Math.round(diskUsed / 1024 / 1024),
      totalGb: Math.round(diskTotal / 1024 / 1024),
      percent: diskTotal ? Math.round((diskUsed / diskTotal) * 100) : 0,
    },
  };
};

const parseLocalContainers = (stdout) => {
  if (!stdout) return [];

  return stdout.split('\n').filter(Boolean).map((line) => {
    const [name, cpu, mem] = line.split('|');
    return {
      name,
      cpu: parsePercent(cpu),
      memory: mem || '0B',
      memoryMb: parseMemoryMb(mem || '0B'),
    };
  });
};

const collectWithCommandFallback = async (server, host, user, extras = {}) => {
  const metricsScript = `node -e "const fs=require('fs');const os=require('os');const mem=Object.fromEntries(fs.readFileSync('/proc/meminfo','utf8').split('\\n').filter(Boolean).map(l=>l.split(/:\\s+/)).map(([k,v])=>[k,parseInt(v)]));const df=require('child_process').execSync('df -k / --output=size,used | tail -n +2').toString().trim().split(/\\s+/);console.log(JSON.stringify({load1:os.loadavg()[0],memTotalKb:mem.MemTotal,memAvailableKb:mem.MemAvailable,diskTotalKb:df[0],diskUsedKb:df[1]}));"`;
  const dockerStats = "docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}' 2>/dev/null || true";

  const [metricsResult, containersResult] = await Promise.all([
    remoteCommand({ host, user, command: metricsScript, localHostnames: localHostnames() }),
    remoteCommand({ host, user, command: dockerStats, localHostnames: localHostnames() }),
  ]);

  if (!metricsResult.ok) {
    return {
      name: server,
      online: false,
      source: 'command',
      error: metricsResult.stderr,
      updatedAt: new Date().toISOString(),
      topCpu: [],
      topMemory: [],
    };
  }

  const containers = parseLocalContainers(containersResult.stdout);

  return {
    name: server,
    online: true,
    source: 'command',
    ...parseLocalMetrics(metricsResult.stdout),
    temperatureC: extras.temperatureC ?? null,
    network: extras.network ?? null,
    topCpu: [...containers].sort((a, b) => b.cpu - a.cpu).slice(0, 3),
    topMemory: [...containers].sort((a, b) => b.memoryMb - a.memoryMb).slice(0, 3),
    updatedAt: new Date().toISOString(),
  };
};

export const collectServer = async (server, komodo) => {
  const host = metricHost(server);
  const user = metricUser(server);
  const extras = await collectHostExtras(server, host, user);
  return fromKomodo(server, komodo, extras) || collectWithCommandFallback(server, host, user, extras);
};

export const collectServers = async (komodo) => Promise.all(config.servers.map((server) => collectServer(server, komodo)));
