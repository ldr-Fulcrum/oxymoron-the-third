// Creates a reviewable admission manifest. This command does not authorize or run a challenge.
import {readFileSync, writeFileSync, realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileHash} from '../src/execution-bridge.mjs';
if (process.argv.length !== 4) throw new Error('Usage: node scripts/prepare-challenge.mjs input.json config.json');
const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (!Array.isArray(input.source_files) || !input.source_files.length || !Array.isArray(input.fixture_files)) {
  throw new Error('Explicit source_files and fixture_files required');
}
const root = realpathSync(input.candidate_root);
const paths = [...new Set([input.test_file,...input.fixture_files,...input.source_files])];
const {source_files, ...config} = input;
config.candidate_root = root;
config.candidate_commit = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
config.node_executable = process.execPath;
config.files = paths.map(path => ({path,sha256:fileHash(resolve(root,path))}));
writeFileSync(process.argv[3], JSON.stringify(config,null,2)+'\n', {flag:'wx'});
console.log('Manifest written. Review file closure, candidate identity and authorization before execution.');
