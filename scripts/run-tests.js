#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const MAX_LOGS = 10;

const root = process.cwd();
const tmpDir = path.join(root, '.tmp');
const logDir = path.join(tmpDir, 'test_logs');

fs.mkdirSync(tmpDir, { recursive: true });
fs.mkdirSync(logDir, { recursive: true });

const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const logPath = path.join(logDir, `${id}.log`);

const shortout = process.argv.slice(2).includes('shortout');

const stdoutChunks = [];
const stderrChunks = [];

function escapeRegExp(s) {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

function glob(pattern) {
  if (!/[*?[]/.test(pattern)) return [pattern];
  const slash = pattern.lastIndexOf('/');
  const dir = slash === -1 ? '.' : pattern.slice(0, slash);
  const base = pattern.slice(slash + 1);
  const re = new RegExp(
    '^' + escapeRegExp(base).replace(/\*/g, '.*').replace(/\?/g, '[^/]') + '$'
  );
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return entries.filter((e) => re.test(e)).map((e) => path.join(dir, e));
}

const rawArgs = process.argv.slice(2).filter((a) => a !== 'shortout');
const files = [];
for (const arg of rawArgs) {
  for (const g of glob(arg)) {
    files.push(g);
  }
}

const nodeArgs = ['--test', ...files];

const child = spawn('node', nodeArgs, {
  stdio: ['inherit', 'pipe', 'pipe'],
});

child.stdout.on('data', (d) => {
  stdoutChunks.push(d);
  if (!shortout) process.stdout.write(d);
});
child.stderr.on('data', (d) => {
  stderrChunks.push(d);
  if (!shortout) process.stderr.write(d);
});

function finish(code) {
  const fullOut = Buffer.concat(stdoutChunks).toString('utf8');
  const fullErr = Buffer.concat(stderrChunks).toString('utf8');
  const full = fullOut + fullErr;

  const logStream = fs.createWriteStream(logPath, { encoding: 'utf8' });
  logStream.write(full);
  logStream.end(() => {
    const entries = fs.readdirSync(logDir)
      .filter((f) => f.endsWith('.log'))
      .map((f) => ({
        name: f,
        mtime: fs.statSync(path.join(logDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const f of entries.slice(MAX_LOGS)) {
      fs.unlinkSync(path.join(logDir, f.name));
    }

    if (shortout) {
      const lines = full.split(/\r?\n/);
      const errorIds = lines.filter((l) =>
        /^not ok/.test(l) || /^# fail [1-9]/.test(l) || /^# tests/.test(l)
      );
      const tail = lines.slice(-15);
      const seen = new Set();
      const deduped = [...errorIds, ...tail].filter((l) => {
        if (seen.has(l)) return false;
        seen.add(l);
        return true;
      });
      if (deduped.length > 0) {
        process.stdout.write(deduped.join('\n') + '\n');
      } else {
        process.stdout.write('(no error identifiers found)\n');
      }
      process.stdout.write(
        `\nFull output retained; use 'npm run retrive ${id}' to revisit it.\n`
      );
    } else {
      console.log(`\nUse 'npm run retrive ${id}' to revisit the full output of this test`);
    }

    process.exit(code === null ? 1 : code);
  });
}

child.on('close', finish);
child.on('error', () => finish(1));
