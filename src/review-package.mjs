import {mkdirSync, writeFileSync, readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {FileExecutionStore, canonical} from './provenance.ts';
import {classifyResponse} from './execution-bridge.mjs';

/** Reopen persisted artifacts; no rerun, repair authorization, or acceptance decision. */
export function inspectExecution(directory, id) {
  if (!existsSync(join(directory,'records')) || !existsSync(join(directory,'evidence'))) throw new Error('MISSING_EXECUTION_STORE');
  const store = new FileExecutionStore(directory);
  const record = store.get(id);
  if (!record) throw new Error('MISSING_EXECUTION_RECORD');
  const evidence = record.evidence_refs.map(ref => store.readEvidence(ref));
  const output = evidence[0]?.steps?.[0]?.output;
  if (record.adapter_id !== 'LocalBackendBridge' || !output?.admission ||
      output.admission.candidate_commit !== record.tool_build) throw new Error('UNSUPPORTED_EXECUTION_EVIDENCE');
  const summary = {run_id:id, candidate_commit:record.tool_build, challenge_hash:record.probe_definition_hash,
    record_hash:record.record_hash, execution_state:record.execution_state,
    reason:record.result.reason, tests:record.result.report?.summary ?? null,
    started_at:record.started_at,completed_at:record.completed_at,
    disposition:'EXECUTION_EVIDENCE_ONLY', final_acceptance:'NOT_ISSUED'};
  // A successful/failing test result must be independently reconstructible.
  if (['passed','failed'].includes(record.execution_state)) {
    const actual = classifyResponse(output.raw_response,id);
    if (actual.state !== record.execution_state || canonical(actual.report) !== canonical(record.result.report) ||
        actual.reason !== record.result.reason || output.transport?.http_status !== 200) throw new Error('EXECUTION_CLASSIFICATION_MISMATCH');
  }
  return {summary,record,evidence};
}

/** Export only validated execution artifacts, never unrelated workspace files. */
export function exportReviewPackage(directory,id,destination) {
  const data = inspectExecution(directory,id);
  mkdirSync(destination); // Never overwrite an existing package.
  const artifacts = [{name:'record.json',value:data.record},{name:'summary.json',value:data.summary},
    ...data.record.evidence_refs.map((ref,i)=>({name:ref.evidence_id+'.json',value:data.evidence[i]}))];
  const files = artifacts.map(({name,value})=>{
    const path = join(destination,name);
    writeFileSync(path,canonical(value)+'\n',{flag:'wx'});
    return {file:name,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')};
  });
  writeFileSync(join(destination,'manifest.json'),JSON.stringify({schema_version:'contradictor.review-package.v1',
    files,run_id:id,record_hash:data.record.record_hash,acceptance:'NOT_ISSUED'},null,2)+'\n',{flag:'wx'});
  writeFileSync(join(destination,'README.md'),
    '# Execution evidence package\n\nThis is not BUILD acceptance. Verify file SHA-256 values against manifest.json. '+
    'The record and original evidence retain their domain-separated Contradictor hashes. '+
    'Human review still requires the frozen contract, independent challenge ownership, authorized repair and Bob session evidence, '+
    'complete input manifest, reproduction record and actual BUILD reviewer. Missing items must remain missing.\n',{flag:'wx'});
  return data.summary;
}
