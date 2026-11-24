import { execSync } from 'child_process';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export const candidateCommands = [
  'chromium',
  'chromium-browser',
  'google-chrome-stable',
  'google-chrome',
  'firefox',
  'firefox-esr',
];

const commonPaths = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/firefox',
  '/usr/bin/firefox-esr',
  '/opt/google/chrome/chrome',
];

function commandAvailable(cmd) {
  try {
    execSync(`command -v ${cmd} >/dev/null 2>&1`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function pathAvailable(p) {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function readVersion(binary) {
  try {
    const out = execSync(`${binary} --version`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim().split('\n')[0];
  } catch {
    return undefined;
  }
}

export function findBrowser() {
  const checked = [];
  for (const cmd of candidateCommands) {
    const found = commandAvailable(cmd);
    checked.push({ command: cmd, found, source: 'PATH' });
    if (found) return { binary: cmd, source: 'PATH', checked };
  }
  for (const p of commonPaths) {
    const found = pathAvailable(p);
    checked.push({ command: p, found, source: 'path' });
    if (found) return { binary: p, source: 'path', checked };
  }
  return { binary: null, source: null, checked };
}

export function probeBrowser() {
  const found = findBrowser();
  let version = undefined;
  let reason = 'no browser binary found';
  if (found.binary) {
    version = readVersion(found.binary);
    reason = 'browser runtime available';
  } else {
    const names = found.checked.map((c) => c.command).join(', ');
    reason = `no browser runtime available (checked ${names})`;
  }
  return {
    found: !!found.binary,
    binary: found.binary,
    version,
    source: found.source,
    candidatesChecked: found.checked,
    reason,
    node: { version: process.version, platform: process.platform, arch: process.arch },
    websocket: typeof WebSocket !== 'undefined',
    fetch: typeof fetch !== 'undefined',
  };
}

export function launchBrowser(binary, htmlFile, port) {
  const abs = path.resolve(process.cwd(), htmlFile);
  const fileUrl = abs.startsWith('/') ? `file://${abs}` : `file:///${abs}`;
  const args = [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    fileUrl,
  ];
  let stderrBuffer = '';
  const proc = spawn(binary, args, {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  proc.stderr.on('data', (d) => {
    stderrBuffer += d.toString('utf8');
  });
  return {
    proc,
    port,
    url: `http://127.0.0.1:${port}`,
    abs,
    fileUrl,
    stderr: () => stderrBuffer,
    kill: () => proc.kill('SIGTERM'),
  };
}
