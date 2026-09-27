import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {FileExecutionStore, hash, sealRecord} from '../../src/provenance.ts';
import {classifyResponse} from '../../src/execution-bridge.mjs';
import {compareEvidence} from '../../src/compare-evidence.mjs';

// Synthetic storage fixtures test the comparer; never actual Bob/demo evidence.
function make(id, state, overrides={}) {
  const directory = mkdtempSync(join(tmpdir(),'ctr-comparison-'));
  const store = new FileExecutionStore(directory);
  const build = overrides.build ?? (id === 'Before' ? 'a' : 'b').repeat(40);
  const definition = {id:'SyntheticChallenge',version:'1',...overrides.definition};
  const descriptor = {tool_id:'ContradictorHC',tool_build:build,adapter_id:'LocalBackendBridge',adapter_version:'1'};
  const raw = {request_id:id,status:'completed',exit_code:state === 'failed' ? 1 : 0,
    duration_ms:1,stderr:'',timed_out:false,process_error:null,
    stdout:JSON.stringify({schema_version:'contradictor.node-challenge.v1',cases:[{name:'synthetic',status:state}],
      summary:{tests:1,passed:state === 'passed'?1:0,failed:state === 'failed'?1:0,cancelled:0,skipped:0,todo:0}})};
  const classified = classifyResponse(raw,id);
  const result = {pass:state === 'passed',reason:classified.reason,report:overrides.report ?? classified.report};
  const request = {request_id:id};
  const output = {raw_response:raw,transport:{http_status:200},result,admission:{candidate_commit:build,files:[]}};
  const ref = store.putEvidence({probe_run_id:id,descriptor,definition,result,execution_state:state,
    steps:[{operation:'submit',arguments:[request],output}]});
  const time = overrides.time ?? (id === 'Before' ? '2026-09-25T12:00:00.000000Z' : '2026-09-25T12:01:00.000000Z');
  const r = store.append(sealRecord({schema_version:'contradictor.execution.v1',probe_run_id:id,probe_id:'SyntheticChallenge',
    probe_version:'1',probe_definition_hash:hash('contradictor.probe.v1',definition),probe_definition:definition,...descriptor,
    started_at:time,completed_at:time,baseline_input_hash:hash('contradictor.input.v1',request),transformed_input_hash:null,
    baseline_observation_hash:hash('contradictor.observation.v1',output),transformed_observation_hash:null,
    execution_state:state,relation_result:state === 'passed'?'pass':'fail',result_version:'1.0.0',result,evidence_refs:[ref],
    environment:{node:overrides.node??'26.5.0',bridge_node:'v26.5.0',platform:'win32'}}));
  return {directory,id,record:r};
}
const compare = (a,b) => compareEvidence(a.directory,a.id,b.directory,b.id);
test('same-challenge failure-to-pass comparison remains distinct from acceptance',()=>{
  const r = compare(make('Before','failed'),make('After','passed'));
  assert.equal(r.comparison,'failure_to_pass_evidence');
  assert.match(r.limitation,/BUILD acceptance require separate review/);
  assert.equal(Object.hasOwn(r,'accepted'),false);
});
test('changed challenge or same candidate cannot establish a repair',()=>{
  const a = make('Before','failed');
  assert.ok(compare(a,make('After','passed',{definition:{changed:true}})).reasons.includes('CHALLENGE_CHANGED'));
  assert.ok(compare(a,make('After','passed',{build:'a'.repeat(40)})).reasons.includes('NO_DISTINCT_REPAIRED_BUILD'));
});
test('no original failure or unsuccessful rerun remains unproven',()=>{
  assert.ok(compare(make('Before','passed'),make('After','passed')).reasons.includes('NO_INITIAL_CHALLENGE_FAILURE'));
  assert.ok(compare(make('Before','failed'),make('After','failed')).reasons.includes('RERUN_NOT_PASSED'));
});
test('runtime changes and reversed execution order are explicit',()=>{
  const a = make('Before','failed');
  assert.ok(compare(a,make('After','passed',{node:'different'})).reasons.includes('RUNTIME_CHANGED'));
  assert.ok(compare(a,make('After','passed',{time:'2026-09-25T11:00:00.000000Z'})).reasons.includes('RUN_ORDER_INVALID'));
});
test('missing and tampered artifacts fail closed before comparison',()=>{
  const a = make('Before','failed'), b = make('After','passed');
  assert.throws(()=>compareEvidence(a.directory,'Missing',b.directory,b.id),/MISSING_EXECUTION_RECORD/);
  const path = join(b.directory,'evidence',b.record.evidence_refs[0].evidence_id+'.json');
  const ev = JSON.parse(readFileSync(path,'utf8')); ev.result.pass = false; writeFileSync(path,JSON.stringify(ev));
  assert.throws(()=>compare(a,b),/EVIDENCE_MISMATCH/);
});
test('operator CLI emits comparison JSON from persisted artifacts',()=>{
  const a = make('Before','failed'), b = make('After','passed');
  const output = execFileSync(process.execPath,[fileURLToPath(new URL('../../scripts/compare-evidence.mjs',import.meta.url)),
    a.directory,a.id,b.directory,b.id],{encoding:'utf8',windowsHide:true});
  assert.equal(JSON.parse(output).comparison,'failure_to_pass_evidence');
});

test('comparison does not create a missing evidence store',()=>{
  const parent=mkdtempSync(join(tmpdir(),'ctr-missing-')), absent=join(parent,'absent');
  assert.throws(()=>compareEvidence(absent,'Before',absent,'After'),/MISSING_EXECUTION_STORE/);
  assert.equal(existsSync(absent),false);
});

test('internally sealed report drift still fails raw-response reconstruction',()=>{
  const a=make('Before','failed');
  const b=make('After','passed',{report:{schema_version:'contradictor.node-challenge.v1',
    cases:[{name:'forged replacement',status:'passed'}],
    summary:{tests:1,passed:1,failed:0,cancelled:0,skipped:0,todo:0}}});
  assert.throws(()=>compare(a,b),/EXECUTION_CLASSIFICATION_MISMATCH/);
});
