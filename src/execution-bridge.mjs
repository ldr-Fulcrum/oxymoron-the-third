import {createHash} from 'node:crypto';
import {readFileSync, realpathSync, mkdirSync} from 'node:fs';
import {resolve, relative, isAbsolute, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {FileExecutionStore, hash, sealRecord, timestamp, assertId} from './provenance.ts';

const reporter = fileURLToPath(new URL('../scripts/challenge-reporter.mjs', import.meta.url));
export const fileHash = path => 'sha256:' + createHash('sha256').update(readFileSync(path)).digest('hex');

// A POST can already have executed when its response is lost. Use a dedicated
// socket, including on the first request after health checks, and never retry.
function submitOnce(endpoint, request, timeoutMs) {
  return new Promise((done, fail) => {
    const req = httpRequest(endpoint, {method:'POST', agent:false,
      headers:{'Content-Type':'application/json', Connection:'close'},
      signal:AbortSignal.timeout(timeoutMs)}, response => {
      let body='';
      response.setEncoding('utf8');
      response.on('data', chunk => {body+=chunk;});
      response.once('error',fail);
      response.once('end',()=>done({http_status:response.statusCode,body}));
    });
    req.once('error',fail);
    req.end(JSON.stringify(request));
  });
}

function checkedFiles(root, entries) {
  if (!Array.isArray(entries) || !entries.length) throw new Error('EMPTY_FILE_MANIFEST');
  const seen = new Set();
  return entries.map(entry => {
    if (!entry || typeof entry.path !== 'string' || seen.has(entry.path)) throw new Error('INVALID_FILE_MANIFEST');
    seen.add(entry.path);
    const path = realpathSync(resolve(root, entry.path));
    const rel = relative(root, path);
    if (isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep)) throw new Error('FILE_OUTSIDE_CANDIDATE');
    if (fileHash(path) !== entry.sha256) throw new Error('FILE_HASH_MISMATCH: ' + entry.path);
    return path;
  });
}

export function classifyResponse(raw, requestId) {
  const problem = message => ({state: 'error', report: null, reason: message});
  if (!raw || raw.request_id !== requestId || typeof raw.stdout !== 'string' ||
      typeof raw.stderr !== 'string' || !Number.isSafeInteger(raw.duration_ms) || raw.duration_ms < 0 ||
      typeof raw.timed_out !== 'boolean') return problem('INVALID_BACKEND_RESPONSE');
  if (raw.status !== 'completed' || raw.timed_out || raw.process_error !== null ||
      ![0, 1].includes(raw.exit_code)) return problem('EXECUTION_ERROR_OR_TIMEOUT');
  let report;
  try { report = JSON.parse(raw.stdout); } catch { return problem('MALFORMED_CHALLENGE_REPORT'); }
  const s = report?.summary;
  if (report?.schema_version !== 'contradictor.node-challenge.v1' || !Array.isArray(report.cases) || !s ||
      !['tests','passed','failed','cancelled','skipped','todo'].every(k => Number.isSafeInteger(s[k]) && s[k] >= 0) ||
      s.tests !== s.passed + s.failed + s.cancelled + s.skipped + s.todo ||
      report.cases.some(c => !c || typeof c.name !== 'string' || !['passed','failed','cancelled','skipped','todo'].includes(c.status))) {
    return problem('INVALID_CHALLENGE_REPORT');
  }
  if (report.cases.length !== s.tests || ['passed','failed','cancelled','skipped','todo'].some(
    status => report.cases.filter(c => c.status === status).length !== s[status])) return problem('CASE_SUMMARY_DISAGREEMENT');
  if (!s.tests || !report.cases.length || s.cancelled || s.skipped || s.todo) {
    return {state: 'inconclusive', report, reason: 'INCOMPLETE_REQUIRED_EXECUTION'};
  }
  if (s.failed > 0 && raw.exit_code === 1 && report.cases.some(c => c.status === 'failed')) {
    return {state: 'failed', report, reason: 'CHALLENGE_ASSERTION_FAILURE_REQUIRES_REVIEW'};
  }
  if (s.passed === s.tests && raw.exit_code === 0 && report.cases.every(c => c.status === 'passed')) {
    return {state: 'passed', report, reason: 'CHALLENGE_TESTS_PASSED_NOT_BUILD_ACCEPTANCE'};
  }
  return problem('EXIT_REPORT_DISAGREEMENT');
}

/** Local trusted execution. Manifest proves named bytes, not host trust or full dependency closure. */
export async function executeChallenge(config) {
  assertId(config.run_id); assertId(config.challenge_id);
  const endpoint = new URL(config.endpoint);
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || endpoint.pathname !== '/execute' ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('LOOPBACK_EXECUTE_REQUIRED');
  if (!Number.isSafeInteger(config.timeout_ms) || config.timeout_ms <= 0 || config.timeout_ms > 120000) throw new Error('INVALID_TIMEOUT');
  if (!/^[a-f0-9]{40}$/.test(config.candidate_commit)) throw new Error('INVALID_CANDIDATE_COMMIT');
  const root = realpathSync(config.candidate_root);
  const head = () => execFileSync('git', ['rev-parse','HEAD'], {cwd: root, encoding:'utf8', windowsHide:true}).trim();
  if (head() !== config.candidate_commit) throw new Error('CANDIDATE_COMMIT_MISMATCH');
  const files = checkedFiles(root, config.files);
  if (!config.files.some(x => x.path === config.test_file)) throw new Error('UNBOUND_CHALLENGE_FILE');
  const testFile = files[config.files.findIndex(x => x.path === config.test_file)];
  const executable = realpathSync(config.node_executable);
  const nodeVersion = execFileSync(executable, ['--version'], {encoding:'utf8', windowsHide:true}).trim();
  if (!Array.isArray(config.fixture_files)) throw new Error('FIXTURE_MANIFEST_REQUIRED');
  const challengePaths = [config.test_file, ...config.fixture_files];
  if (new Set(challengePaths).size !== challengePaths.length ||
      challengePaths.some(path => !config.files.some(f => f.path === path))) throw new Error('UNBOUND_FIXTURE');
  // Candidate bytes belong to admission evidence, not the frozen challenge identity.
  const definition = {id: config.challenge_id, version:'1',
    challenge_files:challengePaths.map(path => config.files.find(f => f.path === path)),
    test_file:config.test_file, reporter_sha256:fileHash(reporter), timeout_ms:config.timeout_ms};
  const descriptor = {tool_id:'ContradictorHC', tool_build:config.candidate_commit,
    adapter_id:'LocalBackendBridge', adapter_version:'1'};
  // Reserve a run before any subprocess side effect. A duplicate never reruns, even after interruption.
  const outputRoot = resolve(config.evidence_root);
  mkdirSync(outputRoot, {recursive:true});
  mkdirSync(resolve(outputRoot, config.run_id));
  const store = new FileExecutionStore(resolve(outputRoot, config.run_id));
  const request = {request_id:config.run_id, executable,
    args:['--test', '--test-reporter', pathToFileURL(reporter).href, testFile], timeout_ms:config.timeout_ms};
  const started = timestamp();
  let raw = null, transport = null, outcome;
  try {
    transport = await submitOnce(endpoint,request,config.timeout_ms + 10000);
    raw = JSON.parse(transport.body);
    outcome = transport.http_status >= 200 && transport.http_status < 300
      ? classifyResponse(raw, config.run_id) : {state:'error',report:null,reason:'HTTP_ERROR'};
  } catch (e) {
    outcome = {state:'error', report:null, reason:'TRANSPORT_ERROR: ' + e.message};
  }
  try {
    if (head() !== config.candidate_commit) throw new Error('CANDIDATE_CHANGED_DURING_RUN');
    checkedFiles(root, config.files);
    if (fileHash(reporter) !== definition.reporter_sha256) throw new Error('REPORTER_CHANGED_DURING_RUN');
  } catch (e) { outcome = {state:'error',report:outcome.report,reason:e.message}; }
  const result = {pass:outcome.state === 'passed', reason:outcome.reason, report:outcome.report};
  const observation = {raw_response:raw, transport, result, admission:{candidate_commit:config.candidate_commit, files:config.files}};
  const evidence = store.putEvidence({probe_run_id:config.run_id, descriptor, definition, result,
    execution_state:outcome.state, steps:[{operation:'submit', arguments:[request], output:observation}]});
  const record = sealRecord({schema_version:'contradictor.execution.v1',probe_run_id:config.run_id,
    probe_id:config.challenge_id,probe_version:'1',probe_definition_hash:hash('contradictor.probe.v1',definition),
    probe_definition:definition,...descriptor,started_at:started,completed_at:timestamp(),
    baseline_input_hash:hash('contradictor.input.v1',request),transformed_input_hash:null,
    baseline_observation_hash:hash('contradictor.observation.v1',observation),transformed_observation_hash:null,
    execution_state:outcome.state,relation_result:outcome.state === 'passed' ? 'pass' : outcome.state === 'failed' ? 'fail' : 'inconclusive',
    result_version:'1.0.0',result,evidence_refs:[evidence],
    environment:{node:nodeVersion,bridge_node:process.version,platform:process.platform,
      candidate_root:root,trust:'local-trusted-prototype'}});
  store.append(record);
  // Read through a fresh store: return persisted evidence, not the in-memory construction.
  return new FileExecutionStore(resolve(outputRoot, config.run_id)).get(config.run_id);
}
