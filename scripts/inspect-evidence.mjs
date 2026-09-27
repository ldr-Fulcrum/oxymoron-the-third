import {inspectExecution,exportReviewPackage} from '../src/review-package.mjs';
try {
  const [directory,id,destination] = process.argv.slice(2);
  if (!directory || !id || process.argv.length > 5) throw new Error('Usage: node scripts/inspect-evidence.mjs RUN_DIRECTORY RUN_ID [NEW_PACKAGE_DIRECTORY]');
  const summary = destination ? exportReviewPackage(directory,id,destination) : inspectExecution(directory,id).summary;
  console.log(JSON.stringify(summary,null,2));
} catch(e) { console.error(e.message); process.exitCode=2; }
