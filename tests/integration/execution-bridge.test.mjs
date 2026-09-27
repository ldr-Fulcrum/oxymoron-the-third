import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync} from 'node:fs';
import {resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {executeChallenge, classifyResponse, fileHash} from '../../src/execution-bridge.mjs';
import {FileExecutionStore} from '../../src/provenance.ts';
import {inspectExecution,exportReviewPackage} from '../../src/review-package.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const temp = mkdtempSync(resolve(root, '.bridge-test-'));
const commit = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
let child, endpoint;
before(async () => {
  const python = process.env.PYTHON || resolve(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
  // The server is an independent process, not a nested Node test worker.
  const backendEnv = {...process.env}; delete backendEnv.NODE_TEST_CONTEXT;
  child = spawn(python, ['tests/integration/start_backend.py'], {cwd:root,env:backendEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});
  const port = await new Promise((done, fail) => {
    let output = '', errors = '';
    // Fresh Python environments can exceed ten seconds importing dependencies.
    // This bounds server setup only; challenge execution deadlines stay unchanged.
    const timer = setTimeout(() => fail(new Error('Backend startup timeout after 30s: '+errors)),30000);
    child.once('error', e => {clearTimeout(timer); fail(e);});
    child.once('exit', code => {clearTimeout(timer); fail(new Error('Backend exited '+code+': '+errors));});
    child.stderr.on('data', d => {errors += d;});
    child.stdout.on('data', d => {output += d; if (/^\d+\r?\n/.test(output)) {clearTimeout(timer);done(Number(output.trim()));}});
  });
  endpoint = `http://127.0.0.1:${port}/execute`;
  for (let i=0;i<100;i++) {
    try {if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return;} catch {}
    await delay(50);
  }
  throw new Error('Backend not healthy');
});
after(() => {child?.kill();});

function config(id, body, timeout=3000) {
  const file = resolve(temp, id+'.test.mjs');
  writeFileSync(file, "import {test} from 'node:test'; import assert from 'node:assert/strict';\n"+body);
  const path = relative(root,file).replaceAll('\\','/');
  return {run_id:id,challenge_id:'BridgePlumbing',candidate_root:root,candidate_commit:commit,
    files:[{path,sha256:fileHash(file)}],test_file:path,fixture_files:[],
    node_executable:process.execPath,endpoint,timeout_ms:timeout,evidence_root:resolve(temp,'evidence')};
}

test('real HTTP execution persists successful challenge and reopens independently; duplicate never reruns', async () => {
  const c = config('Run-pass', "test('synthetic positive',()=>assert.equal(2+2,4));");
  const r = await executeChallenge(c);
  assert.equal(r.execution_state,'passed');
  const store = new FileExecutionStore(resolve(c.evidence_root,c.run_id));
  assert.equal(store.get(c.run_id).record_hash,r.record_hash);
  const ev = store.readEvidence(r.evidence_refs[0]);
  assert.equal(ev.steps[0].output.raw_response.exit_code,0);
  assert.equal(ev.steps[0].output.result.report.summary.passed,1);
  const runDir = resolve(c.evidence_root,c.run_id);
  const packageDir = resolve(temp,'review-package');
  assert.equal(inspectExecution(runDir,c.run_id).summary.final_acceptance,'NOT_ISSUED');
  exportReviewPackage(runDir,c.run_id,packageDir);
  assert.equal(JSON.parse(readFileSync(resolve(packageDir,'manifest.json'),'utf8')).acceptance,'NOT_ISSUED');
  assert.throws(()=>exportReviewPackage(runDir,c.run_id,packageDir),/EEXIST/);
  const cli = execFileSync(process.execPath,['scripts/inspect-evidence.mjs',runDir,c.run_id],{cwd:root,encoding:'utf8',windowsHide:true});
  assert.equal(JSON.parse(cli).record_hash,r.record_hash);
  await assert.rejects(executeChallenge(c), /EEXIST/);
});
test('real assertion failure is failed with raw evidence, never accepted', async () => {
  const r = await executeChallenge(config('Run-fail', "test('synthetic failure',()=>assert.equal(1,2));"));
  assert.equal(r.execution_state,'failed');
  assert.equal(r.result.report.summary.failed,1);
});
test('skipped required execution is inconclusive', async () => {
  const r = await executeChallenge(config('Run-skip', "test.skip('synthetic skipped',()=>{});"));
  assert.equal(r.execution_state,'inconclusive');
});
test('backend timeout is error, not product failure', async () => {
  const r = await executeChallenge(config('Run-timeout', "test('slow',async()=>await new Promise(r=>setTimeout(r,5000)));",100));
  assert.equal(r.execution_state,'error');
});
test('file and candidate identity mismatch fail before execution', async () => {
  const c = config('Run-mismatch', "test('ok',()=>{});");
  await assert.rejects(executeChallenge({...c,candidate_commit:'0'.repeat(40)}),/CANDIDATE_COMMIT_MISMATCH/);
  writeFileSync(resolve(root,c.test_file),'// different bytes');
  await assert.rejects(executeChallenge(c),/FILE_HASH_MISMATCH/);
});
test('tampered evidence is rejected by a fresh store', async () => {
  const c = config('Run-tamper', "test('ok',()=>{});");
  const r = await executeChallenge(c);
  const path = resolve(c.evidence_root,c.run_id,'evidence',r.evidence_refs[0].evidence_id+'.json');
  const ev = JSON.parse(readFileSync(path,'utf8'));
  assert.equal(typeof ev.result.pass, 'boolean');
  // Always mutate the evidence, including when the original execution failed.
  ev.result.pass = !ev.result.pass;
  writeFileSync(path,JSON.stringify(ev));
  assert.throws(()=>new FileExecutionStore(resolve(c.evidence_root,c.run_id)).get(c.run_id),/EVIDENCE_MISMATCH/);
});
test('candidate mutation during execution is error', async () => {
  const c = config('Run-change', "import {writeFileSync} from 'node:fs'; test('changes itself',()=>writeFileSync(new URL(import.meta.url),'// modified'));");
  assert.equal((await executeChallenge(c)).execution_state,'error');
});
test('raw backend process error preserved; malformed/mismatched responses cannot pass', async () => {
  const raw = await (await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({request_id:'Missing',executable:'no-such-contradictor-executable',args:[],timeout_ms:1000})})).json();
  assert.equal(raw.process_error,'EXECUTABLE_NOT_FOUND');
  assert.equal(classifyResponse(raw,'Missing').state,'error');
  assert.equal(classifyResponse({...raw,status:'completed',exit_code:0,process_error:null,stdout:'not json'},'Missing').state,'error');
  assert.equal(classifyResponse(raw,'Other').state,'error');
});
test('actual HC-B01 builder regression suite traverses HTTP and preserved evidence', async () => {
  const c = config('Run-hc-real', "test('placeholder never invoked',()=>{});");
  c.test_file = 'tests/hc-b01/hc-b01.test.mjs';
  c.fixture_files = ['tests/hc-b01/fixtures.mjs'];
  c.files = [c.test_file,...c.fixture_files,'src/hc-validate.ts','src/hc-schemas.ts'].map(path=>({path,sha256:fileHash(resolve(root,path))}));
  c.timeout_ms = 15000;
  const r = await executeChallenge(c);
  assert.equal(r.execution_state,'passed');
  assert.equal(r.result.report.summary.tests,63);
});
test('transport failure and report/exit disagreement never pass', async () => {
  const c = config('Run-no-server', "test('ok',()=>{});");
  c.endpoint = 'http://127.0.0.1:9/execute';
  assert.equal((await executeChallenge(c)).execution_state,'error');
  const response = {request_id:'Mismatch',duration_ms:0,timed_out:false,status:'completed',process_error:null,
    exit_code:1,stderr:'',stdout:JSON.stringify({schema_version:'contradictor.node-challenge.v1',
      cases:[{name:'ok',status:'passed'}],summary:{tests:1,passed:1,failed:0,cancelled:0,skipped:0,todo:0}})};
  assert.equal(classifyResponse(response,'Mismatch').state,'error');
});
test('inflated or contradictory case totals cannot pass', () => {
  const report = {schema_version:'contradictor.node-challenge.v1',cases:[{name:'only one',status:'passed'}],
    summary:{tests:100,passed:100,failed:0,cancelled:0,skipped:0,todo:0}};
  const raw = {request_id:'R',status:'completed',exit_code:0,stderr:'',duration_ms:1,timed_out:false,process_error:null,stdout:JSON.stringify(report)};
  assert.equal(classifyResponse(raw,'R').state,'error');
  report.summary.tests = 1; report.summary.passed = 1; report.cases[0].status = 'skipped';
  assert.equal(classifyResponse({...raw,stdout:JSON.stringify(report)},'R').state,'error');
});
test('suite wrappers are not counted as extra assertion cases', async () => {
  const c = config('Run-suite', "import {describe} from 'node:test'; describe('group',()=>{test('a',()=>{});test('b',()=>{});});");
  const r = await executeChallenge(c);
  assert.equal(r.execution_state,'passed');
  assert.equal(r.result.report.summary.tests,2);
  assert.equal(r.result.report.cases.length,2);
});

test('execution uses fresh connections across idle socket closure and never retries a dropped POST', async () => {
  // Independent server process closes idle sockets while admission can block
  // this event loop. Its final request is deliberately dropped after receipt.
  const server = spawn(process.execPath, ['-e', `
    let count = 0;
    require('node:http').createServer((req,res) => {
      if(req.method==='GET') {
        res.setHeader('Keep-Alive','timeout=600'); res.end('healthy');
        setTimeout(()=>req.socket.destroy(),100); return;
      }
      let body=''; req.on('data',b=>body+=b); req.on('end',()=>{
        console.log(JSON.stringify({request:++count,connection:req.headers.connection,port:req.socket.remotePort}));
        if(count===4) { req.socket.destroy(); return; }
        const report={schema_version:'contradictor.node-challenge.v1',cases:[{name:'ok',status:'passed'}],
          summary:{tests:1,passed:1,failed:0,cancelled:0,skipped:0,todo:0}};
        res.setHeader('Content-Type','application/json');
        res.setHeader('Keep-Alive','timeout=600');
        res.end(JSON.stringify({request_id:JSON.parse(body).request_id,status:'completed',exit_code:0,
          stdout:JSON.stringify(report),stderr:'',timed_out:false,duration_ms:1,process_error:null}));
        setTimeout(()=>req.socket.destroy(),100);
      });
    }).listen(0,'127.0.0.1',function(){console.log(JSON.stringify({port:this.address().port}));});
  `], {windowsHide:true,stdio:['ignore','pipe','pipe']});
  const requests=[];
  try {
    const port=await new Promise((ok,fail)=>{
      const timer=setTimeout(()=>fail(new Error('Socket fixture startup timeout')),30000);
      let buffer='';
      server.once('error',e=>{clearTimeout(timer);fail(e);});
      server.stdout.on('data',b=>{
        buffer+=b;
        while(buffer.includes('\n')) {
          const i=buffer.indexOf('\n'), row=JSON.parse(buffer.slice(0,i)); buffer=buffer.slice(i+1);
          if(row.request) requests.push(row);
          else {clearTimeout(timer);ok(row.port);}
        }
      });
    });
    // Populate fetch's pool as an operator health check would, then leave its
    // close events pending while the independent server expires the sockets.
    for(let i=0;i<2;i++) await (await fetch(`http://127.0.0.1:${port}/health`)).text();
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,500);
    for(let i=0;i<4;i++) {
      const c=config('Run-connection-'+i,"test('ok',()=>{});");
      c.endpoint=`http://127.0.0.1:${port}/execute`;
      const result=await executeChallenge(c);
      assert.equal(result.execution_state,i===3?'error':'passed');
      if(i===3) assert.match(result.result.reason,/TRANSPORT_ERROR/);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,500);
    }
    await delay(100);
    assert.equal(requests.length,4,'one POST per run, including the dropped request');
    assert.equal(new Set(requests.map(r=>r.port)).size,4,'dedicated socket per POST');
    assert.ok(requests.every(r=>r.connection==='close'),'no pooled execution sockets');
  } finally {server.kill();}
});
