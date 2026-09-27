import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {FileExecutionStore, canonical} from './provenance.ts';
import {classifyResponse} from './execution-bridge.mjs';

// Evidence comparison only. Does not issue BUILD acceptance or authorize a repair.
export function compareEvidence(beforeDirectory, beforeId, afterDirectory, afterId) {
  const read = (directory, id) => {
    if (!existsSync(join(directory,'records')) || !existsSync(join(directory,'evidence'))) throw new Error('MISSING_EXECUTION_STORE');
    const store = new FileExecutionStore(directory);
    const record = store.get(id);
    if (!record) throw new Error('MISSING_EXECUTION_RECORD: ' + id);
    const ev = store.readEvidence(record.evidence_refs[0]);
    const output = ev.steps?.[0]?.output;
    if (record.adapter_id !== 'LocalBackendBridge' || !output?.admission ||
        output.admission.candidate_commit !== record.tool_build) throw new Error('UNSUPPORTED_EXECUTION_EVIDENCE');
    // Recompute transport/report classification; do not trust a passed label alone.
    const actual = classifyResponse(output.raw_response, id);
    if (actual.state !== record.execution_state || actual.reason !== record.result.reason ||
        canonical(actual.report) !== canonical(record.result.report) ||
        !output.transport || output.transport.http_status !== 200) throw new Error('EXECUTION_CLASSIFICATION_MISMATCH');
    return record;
  };
  const before = read(beforeDirectory,beforeId);
  const after = read(afterDirectory,afterId);
  const reasons = [];
  if (before.probe_run_id === after.probe_run_id) reasons.push('SAME_RUN_ID');
  if (before.probe_definition_hash !== after.probe_definition_hash) reasons.push('CHALLENGE_CHANGED');
  if (before.tool_id !== after.tool_id || before.adapter_id !== after.adapter_id || before.adapter_version !== after.adapter_version) reasons.push('EXECUTION_BOUNDARY_CHANGED');
  if (before.tool_build === after.tool_build) reasons.push('NO_DISTINCT_REPAIRED_BUILD');
  if (before.environment.node !== after.environment.node || before.environment.bridge_node !== after.environment.bridge_node || before.environment.platform !== after.environment.platform) reasons.push('RUNTIME_CHANGED');
  if (before.completed_at > after.started_at) reasons.push('RUN_ORDER_INVALID');
  if (before.execution_state !== 'failed') reasons.push('NO_INITIAL_CHALLENGE_FAILURE');
  if (after.execution_state !== 'passed') reasons.push('RERUN_NOT_PASSED');
  return {schema_version:'contradictor.comparison.v1',
    comparison:reasons.length ? 'not_demonstrated' : 'failure_to_pass_evidence', reasons,
    before:{run_id:beforeId,build:before.tool_build,record_hash:before.record_hash},
    after:{run_id:afterId,build:after.tool_build,record_hash:after.record_hash},
    challenge_hash:before.probe_definition_hash,
    limitation:'Evidence comparison only. Independent challenge ownership, authorized Bob repair, complete input coverage and BUILD acceptance require separate review.'};
}
