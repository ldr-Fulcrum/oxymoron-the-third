import {compareEvidence} from '../src/compare-evidence.mjs';
try {
  if (process.argv.length !== 6) throw new Error('Usage: node scripts/compare-evidence.mjs BEFORE_DIRECTORY BEFORE_RUN_ID AFTER_DIRECTORY AFTER_RUN_ID');
  const result = compareEvidence(...process.argv.slice(2));
  console.log(JSON.stringify(result,null,2));
  process.exitCode = result.comparison === 'failure_to_pass_evidence' ? 0 : 1;
} catch (e) { console.error(e.message); process.exitCode = 2; }
