import {readFileSync} from 'node:fs';
import {executeChallenge} from '../src/execution-bridge.mjs';
try {
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/run-challenge.mjs run-config.json');
  const record = await executeChallenge(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  console.log(JSON.stringify(record, null, 2));
  process.exitCode = record.execution_state === 'passed' ? 0 : record.execution_state === 'failed' ? 1 : 2;
} catch (e) { console.error(e.message); process.exitCode = 2; }
