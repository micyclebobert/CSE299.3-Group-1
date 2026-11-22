#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const id = process.argv[2];
if (!id) {
  process.stderr.write('Usage: npm run retrive <id>\n');
  process.exit(1);
}

const logPath = path.join(process.cwd(), '.tmp', 'test_logs', `${id}.log`);
if (!fs.existsSync(logPath)) {
  process.stderr.write(`Log not found: ${logPath}\n`);
  process.exit(1);
}

process.stdout.write(fs.readFileSync(logPath, 'utf8'));
