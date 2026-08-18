import { config } from '../config.js';
import { remoteCommand } from '../utils/command.js';

const buildPosteScript = () => `<?php
$dataPath = ${JSON.stringify(config.poste.dataPath)};
$dmarcDomain = ${JSON.stringify(config.poste.dmarcDomain)};
$stateFile = $dataPath . '/log/dmarc/processed.json';
$maildir = $dmarcDomain ? $dataPath . '/domains/' . $dmarcDomain . '/dmarc/Maildir' : '';
@mkdir($dataPath . '/log/dmarc', 0750, true);
$domains = array_filter(array_map('trim', preg_split('/\\r?\\n/', (string)shell_exec("sqlite3 " . escapeshellarg($dataPath . "/users.db") . " 'select name from domains where disabled = 0;'"))));
$domainSet = array_fill_keys($domains, true);
$files = array_values(array_filter(array_merge(glob($dataPath . '/log/delivery/*-total') ?: [])));
$allFiles = $files;
usort($files, fn($a, $b) => filemtime($b) <=> filemtime($a));
$files = array_slice($files, 0, 30);

$aggregate = function (array $selected) use ($domainSet): array {
  $result = ['total' => 0, 'accepted' => 0, 'quarantined' => 0, 'rejected' => 0, 'inbound' => 0, 'outbound' => 0];
  foreach ($selected as $file) {
    foreach (@file($file, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
      if (!str_contains($line, ' -> ')) continue;
      $result['total']++;
      if (str_contains($line, '250 Message Queued')) $result['accepted']++;
      elseif (str_contains($line, 'Quarantined')) $result['quarantined']++;
      elseif (preg_match('/(^| )[45][0-9][0-9]([ :]|$)/', $line)) $result['rejected']++;
      $parts = explode(' -> ', $line, 2);
      preg_match('/<([^>]+)>/', $parts[0], $fromMatch);
      preg_match('/<([^>]+)>/', $parts[1], $toMatch);
      $from = strtolower($fromMatch[1] ?? '');
      $to = strtolower($toMatch[1] ?? '');
      $fromLocal = str_contains($from, '@') && isset($domainSet[substr(strrchr($from, '@'), 1)]);
      $toLocal = str_contains($to, '@') && isset($domainSet[substr(strrchr($to, '@'), 1)]);
      if ($toLocal && !$fromLocal) $result['inbound']++;
      if ($fromLocal && !$toLocal) $result['outbound']++;
    }
  }
  return $result;
};

$todayName = $dataPath . '/log/delivery/' . date('Y-m-d') . '-total';
$today = $aggregate(is_file($todayName) ? [$todayName] : []);
$last30 = $aggregate($files);
$quarantineTotal = $aggregate($allFiles)['quarantined'];
$domainsCount = (int)trim((string)shell_exec("sqlite3 " . escapeshellarg($dataPath . "/users.db") . " 'select count(*) from domains where disabled = 0;'"));
$mailboxes = (int)trim((string)shell_exec("sqlite3 " . escapeshellarg($dataPath . "/users.db") . " 'select count(*) from users where redirectOnly = 0 and discard = 0 and disabled = 0;'"));
$aliases = (int)trim((string)shell_exec("sqlite3 " . escapeshellarg($dataPath . "/users.db") . " 'select count(*) from users where redirectOnly = 1 and disabled = 0;'"));

$connections = [];
$remoteIps = [];
$remoteIpTimes = [];
$reverseCache = [];
$connectionFiles = glob($dataPath . '/log/delivery/conn/*/*/*') ?: [];
usort($connectionFiles, fn($a, $b) => filemtime($b) <=> filemtime($a));
foreach (array_slice($connectionFiles, 0, 100) as $file) {
  if (str_ends_with($file, '.results')) continue;
  $raw = trim((string)@file_get_contents($file));
  if (!$raw) continue;
  $uuid = basename($file);
  foreach (glob($dataPath . '/log/delivery/tx/*/*/' . $uuid . '.*') ?: [] as $txFile) $raw .= "\n" . (string)@file_get_contents($txFile);
  $ipParts = explode('connect ip=', $raw, 2);
  $ip = count($ipParts) === 2 ? trim(explode(' ', $ipParts[1], 2)[0], '"') : '';
  $reverse = $ip && filter_var($ip, FILTER_VALIDATE_IP) ? ($reverseCache[$ip] ?? gethostbyaddr($ip)) : '';
  if ($ip) $reverseCache[$ip] = $reverse;
  if ($reverse === $ip) $reverse = '';
  $endpoint = $ip ? ($reverse ? $reverse . ' / ' . $ip : $ip) : 'local';
  $port = '';
  $portParts = explode('local_port:', $raw, 2);
  if (count($portParts) === 2) $port = trim(explode(' ', $portParts[1], 2)[0]);
  $labels = [];
  foreach (['helo', 'tls', 'mail_from', 'rcpt_to', 'rspamd', 'clamd', 'queue', 'local_port'] as $label) if (str_contains($raw, $label)) $labels[] = $label;
  if (preg_match('/hook_mail params=<([^>]+)>/', $raw, $match)) $labels[] = 'mail_from: ' . $match[1];
  if (preg_match('/RCPT TO:<([^>]+)>/', $raw, $match)) $labels[] = 'rcpt_to: ' . $match[1];
  foreach (['fcrdns', 'karma', 'asn', 'geoip', 'bounce', 'srs', 'guard', 'local', 'disconnected'] as $label) if (str_contains(strtolower($raw), $label)) $labels[] = $label;
  $connections[] = ['time' => date('H:i:s', filemtime($file)), 'uuid' => substr($uuid, 0, 18) . '...', 'endpoint' => $endpoint . ($port ? ' -> ' . $port : ''), 'details' => implode('  ', array_unique($labels))];
  if ($ip) {
    $remoteIps[$ip] = ($remoteIps[$ip] ?? 0) + 1;
    $remoteIpTimes[$ip] = max($remoteIpTimes[$ip] ?? 0, filemtime($file));
  }
}
$remoteIpList = [];
foreach ($remoteIps as $ip => $count) {
  $reverse = $reverseCache[$ip] ?? gethostbyaddr($ip);
  $remoteIpList[] = ['ip' => $ip, 'reverse' => $reverse === $ip ? null : $reverse, 'count' => $count, 'lastSeen' => $remoteIpTimes[$ip] ?? 0];
}
usort($remoteIpList, fn($a, $b) => $b['lastSeen'] <=> $a['lastSeen']);

$users = [];
foreach ($files as $file) {
  foreach (@file($file, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
    if (!str_contains($line, ' -> ')) continue;
    $parts = explode(' -> ', $line, 2);
    preg_match('/<([^>]+)>/', $parts[0], $fromMatch);
    preg_match('/<([^>]+)>/', $parts[1], $toMatch);
    $from = strtolower($fromMatch[1] ?? '');
    $to = strtolower($toMatch[1] ?? '');
    if (str_contains($from, '@') && isset($domainSet[substr(strrchr($from, '@'), 1)])) $users[$from]['sent'] = ($users[$from]['sent'] ?? 0) + 1;
    if (str_contains($to, '@') && isset($domainSet[substr(strrchr($to, '@'), 1)])) $users[$to]['received'] = ($users[$to]['received'] ?? 0) + 1;
  }
}
$topUsers = [];
foreach ($users as $email => $counts) $topUsers[] = ['email' => $email, 'sent' => $counts['sent'] ?? 0, 'received' => $counts['received'] ?? 0, 'total' => ($counts['sent'] ?? 0) + ($counts['received'] ?? 0)];
usort($topUsers, fn($a, $b) => $b['total'] <=> $a['total']);
$services = [];
$tcpTable = (string)@shell_exec('cat /proc/net/tcp /proc/net/tcp6 2>/dev/null');
$portListening = function (int $port) use ($tcpTable): bool {
  $hexPort = str_pad(strtoupper(dechex($port)), 4, '0', STR_PAD_LEFT);
  return (bool)preg_match('/:' . $hexPort . '\\s/', $tcpTable);
};
foreach (['smtp' => [25, 465, 587], 'imap' => [143, 993], 'pop3' => [110, 995], 'webmail' => [443, 4190]] as $service => $ports) {
  $services[$service] = false;
  foreach ($ports as $port) if ($portListening($port)) { $services[$service] = true; break; }
}

$state = [];
if (is_file($stateFile)) $state = json_decode((string)file_get_contents($stateFile), true) ?: [];
$reportCount = count($state);
$reportMessages = 0;
$reportPass = 0;
$reportFail = 0;
$reportFiles = $maildir ? array_merge(glob($maildir . '/new/*') ?: [], glob($maildir . '/cur/*') ?: []) : [];
foreach ($reportFiles as $file) {
  if (!is_file($file) || isset($state[basename($file)])) continue;
  $raw = (string)file_get_contents($file);
  $xmls = [];
  if (preg_match_all('/<feedback\\b[\\s\\S]*?<\\/feedback>/i', $raw, $matches)) $xmls = $matches[0];
  foreach ($xmls as $xml) {
    $doc = @simplexml_load_string($xml);
    if (!$doc) continue;
    $reportCount++;
    foreach ($doc->record as $record) {
      $count = (int)($record->row->count ?? 0);
      $reportMessages += $count;
      $dkim = strtolower((string)($record->row->policy_evaluated->dkim ?? ''));
      $spf = strtolower((string)($record->row->policy_evaluated->spf ?? ''));
      if ($dkim === 'pass' || $spf === 'pass') $reportPass += $count;
      else $reportFail += $count;
    }
  }
  $state[basename($file)] = date('c');
}
file_put_contents($stateFile, json_encode($state, JSON_UNESCAPED_SLASHES));
$lastLog = $files[0] ?? '';
$lastLog = $lastLog ? preg_replace('/.*\\//', '', $lastLog) : null;
$lastLog = $lastLog ? preg_replace('/-total$/', '', $lastLog) : null;
echo json_encode([
  'today' => $today,
  'quarantineTotal' => $quarantineTotal,
  'last30' => $last30,
  'domains' => $domainsCount,
  'mailboxes' => $mailboxes,
  'aliases' => $aliases,
  'dmarcReports' => $reportCount,
  'dmarcMessages' => $reportMessages,
  'dmarcPass' => $reportPass,
  'dmarcFail' => $reportFail,
  'connections' => array_slice($connections, 0, 10),
  'remoteIps' => array_slice($remoteIpList, 0, 5),
  'topUsers' => array_slice($topUsers, 0, 10),
  'services' => $services,
  'lastLog' => $lastLog,
]);
?>`;

export const collectPoste = async () => {
  if (!config.poste.enabled) {
    return { available: false, error: null, updatedAt: new Date().toISOString() };
  }

  const script = Buffer.from(buildPosteScript()).toString('base64');
  const container = JSON.stringify(config.poste.container);
  const dataPath = JSON.stringify(config.poste.dataPath);
  const remoteScript = `container=${container}; data_path=${dataPath}; metrics=$(docker exec "$container" sh -lc "printf '%s' '${script}' | base64 -d | php"); stats=$(docker stats --no-stream --format '{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}' "$container" 2>/dev/null || true); disk=$(docker exec "$container" sh -lc "du -sb \"$data_path\" 2>/dev/null | cut -f1" 2>/dev/null || true); printf '%s\\n__POSTE_STATS__%s|%s' "$metrics" "$stats" "$disk"`;
  const result = await remoteCommand({ host: config.poste.host, user: config.poste.user, command: remoteScript, localHostnames: [] });
  if (!result.ok) return { available: false, error: result.stderr, updatedAt: new Date().toISOString() };
  try {
    const marker = '__POSTE_STATS__';
    const markerIndex = result.stdout.indexOf(marker);
    const json = markerIndex >= 0 ? result.stdout.slice(0, markerIndex).trim() : result.stdout.trim();
    const statsLine = markerIndex >= 0 ? result.stdout.slice(markerIndex + marker.length).trim() : '';
    const [cpu, memory, memoryPercent, disk] = (statsLine || '').split('|');
    return { available: true, ...JSON.parse(json), container: { cpu: cpu || null, memory: memory || null, memoryPercent: memoryPercent || null, diskBytes: Number(disk) || null }, error: null, updatedAt: new Date().toISOString() };
  } catch (error) {
    return { available: false, error: `Poste metrics parse failed: ${error.message}`, updatedAt: new Date().toISOString() };
  }
};
