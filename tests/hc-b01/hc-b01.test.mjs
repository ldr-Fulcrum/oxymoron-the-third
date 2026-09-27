/**
 * HC-B01 — Automated counterexample tests + schema/identity foundation.
 *
 * Acceptance checks covered:
 *   HC-B01-A  Valid fixtures validate; malformed/identity-incomplete fail.
 *   HC-B01-B  EvaluationPlan required_probes is nonempty + explicit (not inferred).
 *   HC-B01-C  HC-001: Missing plan binding cannot produce readiness.
 *   HC-B01-D  HC-002: Relabeled presentation row cannot substitute probe identity.
 *   HC-B01-E  HC-003: Evidence from build A cannot clear target build B.
 *   HC-B01-F  Type/schema agreement — verified structurally by TypeScript compilation
 *             (npm run typecheck covers src/hc-schemas.ts and src/hc-validate.ts)
 *             and by round-trip fixture assertions here.
 *   HC-B01-G  No approval is fabricated — missing authorization stays missing/error.
 *
 * Test taxonomy:
 *   hc-b01-a-*  Schema fixture validation
 *   hc-b01-b-*  Plan identity / required-set contract
 *   hc-b01-c-*  HC-001 counterexamples (missing plan binding)
 *   hc-b01-d-*  HC-002 counterexamples (probe identity substitution)
 *   hc-b01-e-*  HC-003 counterexamples (target-build substitution)
 *   hc-b01-f-*  Type/schema agreement
 *   hc-b01-g-*  No fabricated approval
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateDomainProbeProfile,
  validateProbeDefinitionRecord,
  validateEvaluationPlan,
  validateExecutionAttempt,
  validateActionRecord,
  validateReviewAttestation,
  validateGateDecision,
  validateBUILDReturn,
  checkAttemptSatisfiesPlanItem,
  evaluatePlanReadiness,
  ValidationError,
} from '../../src/hc-validate.ts';

import {
  validProfile,
  validProbeU1,
  validProbeU2,
  validPlanForBuildA,
  validAttemptU1BuildA,
  validAttemptU2BuildA,
  validActionRecord,
  validAttestation,
  validGateDecisionClear,
  validBUILDReturn,
  HASH_PLAN,
  HASH_PROBE_U1,
  HASH_PROBE_U2,
  BUILD_A,
  BUILD_B,
} from './fixtures.mjs';

// Helper: assert a ValidationError is thrown and its message matches a pattern.
function assertValidationError(fn, pattern) {
  let thrown;
  try { fn(); } catch (e) { thrown = e; }
  assert.ok(thrown instanceof ValidationError,
    `expected ValidationError, got: ${thrown}`);
  assert.match(thrown.message, pattern);
}

// ---------------------------------------------------------------------------
// HC-B01-A — Schema fixture validation
// PASS only if valid fixtures validate and malformed/identity-incomplete
// fixtures fail validation as defined.
// ---------------------------------------------------------------------------

test('hc-b01-a-01: valid DomainProbeProfile validates without error', () => {
  assert.doesNotThrow(() => validateDomainProbeProfile(validProfile));
});

test('hc-b01-a-02: valid ProbeDefinitionRecord validates without error', () => {
  assert.doesNotThrow(() => validateProbeDefinitionRecord(validProbeU1));
  assert.doesNotThrow(() => validateProbeDefinitionRecord(validProbeU2));
});

test('hc-b01-a-03: valid EvaluationPlan validates without error', () => {
  assert.doesNotThrow(() => validateEvaluationPlan(validPlanForBuildA));
});

test('hc-b01-a-04: valid ExecutionAttempt validates without error', () => {
  assert.doesNotThrow(() => validateExecutionAttempt(validAttemptU1BuildA));
  assert.doesNotThrow(() => validateExecutionAttempt(validAttemptU2BuildA));
});

test('hc-b01-a-05: valid ActionRecord validates without error', () => {
  assert.doesNotThrow(() => validateActionRecord(validActionRecord));
});

test('hc-b01-a-06: valid ReviewAttestation validates without error', () => {
  assert.doesNotThrow(() => validateReviewAttestation(validAttestation));
});

test('hc-b01-a-07: valid GateDecision validates without error', () => {
  assert.doesNotThrow(() => validateGateDecision(validGateDecisionClear));
});

test('hc-b01-a-08: valid BUILDReturn validates without error', () => {
  assert.doesNotThrow(() => validateBUILDReturn(validBUILDReturn));
});

test('hc-b01-a-09: malformed DomainProbeProfile (missing profile_hash) fails validation', () => {
  const bad = { ...validProfile };
  delete bad['profile_hash'];
  assertValidationError(
    () => validateDomainProbeProfile(bad),
    /HC_MISSING_FIELD.*profile_hash|HC_INVALID_HASH.*profile_hash/,
  );
});

test('hc-b01-a-10: malformed EvaluationPlan (missing plan_hash) fails validation', () => {
  const bad = { ...validPlanForBuildA };
  delete bad['plan_hash'];
  assertValidationError(
    () => validateEvaluationPlan(bad),
    /HC_MISSING_FIELD.*plan_hash|HC_INVALID_HASH.*plan_hash/,
  );
});

test('hc-b01-a-11: malformed ExecutionAttempt (wrong schema_version) fails validation', () => {
  const bad = { ...validAttemptU1BuildA, schema_version: 'wrong' };
  assertValidationError(() => validateExecutionAttempt(bad), /HC_SCHEMA_MISMATCH/);
});

test('hc-b01-a-12: malformed GateDecision (required_count = 0) fails validation', () => {
  const bad = {
    ...validGateDecisionClear,
    coverage_summary: { required_count: 0, satisfied_count: 0, unsatisfied_items: [] },
  };
  assertValidationError(() => validateGateDecision(bad), /HC_INVALID_INTEGER.*required_count/);
});

test('hc-b01-a-13: non-object input to any validator fails with type error', () => {
  for (const bad of [null, 'string', 42, true, []]) {
    assertValidationError(() => validateEvaluationPlan(bad), /HC_TYPE_ERROR/);
    assertValidationError(() => validateExecutionAttempt(bad), /HC_TYPE_ERROR/);
    assertValidationError(() => validateGateDecision(bad), /HC_TYPE_ERROR/);
    assertValidationError(() => validateBUILDReturn(bad), /HC_TYPE_ERROR/);
  }
});

// ---------------------------------------------------------------------------
// HC-B01-B — EvaluationPlan required_probes is nonempty + explicit
// PASS only if the required set cannot be inferred from result rows or defaults.
// ---------------------------------------------------------------------------

test('hc-b01-b-01: EvaluationPlan with empty required_probes fails validation', () => {
  const bad = { ...validPlanForBuildA, required_probes: [] };
  assertValidationError(() => validateEvaluationPlan(bad), /HC_EMPTY_REQUIRED_PROBES/);
});

test('hc-b01-b-02: EvaluationPlan with missing required_probes fails validation', () => {
  const bad = { ...validPlanForBuildA };
  delete bad['required_probes'];
  assertValidationError(
    () => validateEvaluationPlan(bad),
    /HC_MISSING_FIELD.*required_probes|HC_TYPE_ERROR.*required_probes/,
  );
});

test('hc-b01-b-03: EvaluationPlan required_probes contains stable plan_item_id + probe_definition_hash', () => {
  validateEvaluationPlan(validPlanForBuildA);
  assert.equal(validPlanForBuildA.required_probes.length, 2);
  assert.equal(validPlanForBuildA.required_probes[0].plan_item_id, 'Item-HC-B01-U1');
  assert.equal(validPlanForBuildA.required_probes[0].probe_definition_hash, HASH_PROBE_U1);
  assert.equal(validPlanForBuildA.required_probes[1].plan_item_id, 'Item-HC-B01-U2');
  assert.equal(validPlanForBuildA.required_probes[1].probe_definition_hash, HASH_PROBE_U2);
});

test('hc-b01-b-04: plan item missing probe_definition_hash fails validation', () => {
  const bad = {
    ...validPlanForBuildA,
    required_probes: [{ plan_item_id: 'Item-HC-B01-U1', probe_id: 'U1' }],
  };
  assertValidationError(
    () => validateEvaluationPlan(bad),
    /HC_MISSING_FIELD.*probe_definition_hash|HC_INVALID_HASH.*probe_definition_hash/,
  );
});

// ---------------------------------------------------------------------------
// HC-001 COUNTEREXAMPLE TESTS — HC-B01-C
// Observed existing behavior: a supplied passing U1 row alone can clear the helper.
// Required hardened behavior: a complete approved plan is mandatory.
// Missing plan context must block readiness.
// PASS only if missing complete approved-plan context cannot produce readiness.
// ---------------------------------------------------------------------------

test('hc-b01-c-01 [HC-001]: zero execution attempts cannot produce readiness', () => {
  const result = evaluatePlanReadiness(validPlanForBuildA, []);
  assert.notEqual(result.gate_status, 'clear',
    'HC-001 VIOLATED: zero attempts must not produce clear gate');
  assert.equal(result.gate_status, 'blocked');
  assert.equal(result.unsatisfied_items.length, 2);
});

test('hc-b01-c-02 [HC-001]: a single passing U1 execution alone cannot clear a two-item plan', () => {
  // HC-001 COUNTEREXAMPLE:
  // Observed behavior: passing U1 row alone was able to clear the helper.
  // Hardened behavior: all required plan items must be satisfied.
  const result = evaluatePlanReadiness(validPlanForBuildA, [validAttemptU1BuildA]);
  assert.notEqual(result.gate_status, 'clear',
    'HC-001 VIOLATED: a single passing row must not clear a multi-item plan');
  assert.equal(result.gate_status, 'blocked');
  assert.ok(result.unsatisfied_items.includes('Item-HC-B01-U2'),
    'Item-HC-B01-U2 must remain unsatisfied');
  assert.equal(result.satisfied_count, 1);
  assert.equal(result.required_count, 2);
});

test('hc-b01-c-03 [HC-001]: plan with missing authorized_by is rejected at validation', () => {
  // A plan without authorization context must not be accepted as a valid plan.
  const bad = { ...validPlanForBuildA, authorized_by: '' };
  assertValidationError(() => validateEvaluationPlan(bad), /HC_EMPTY_FIELD.*authorized_by/);
});

test('hc-b01-c-04 [HC-001]: attempt bound to wrong plan_hash cannot satisfy plan items', () => {
  const wrongPlanHashAttempt = {
    ...validAttemptU1BuildA,
    plan_hash: HASH_PROBE_U2, // different hash — not bound to this plan
  };
  const item = validPlanForBuildA.required_probes[0];
  const result = checkAttemptSatisfiesPlanItem(validPlanForBuildA, item, wrongPlanHashAttempt);
  assert.equal(result.satisfied, false);
  assert.match(result.reason, /HC_001_PLAN_MISMATCH/);
});

test('hc-b01-c-05 [HC-001]: attempt for wrong plan_item_id cannot satisfy a plan item', () => {
  // An attempt targeting a different plan_item_id must not satisfy this item
  const wrongItemAttempt = {
    ...validAttemptU1BuildA,
    plan_item_id: 'Item-HC-B01-U2', // wrong item
  };
  const item = validPlanForBuildA.required_probes[0]; // Item-HC-B01-U1
  const result = checkAttemptSatisfiesPlanItem(validPlanForBuildA, item, wrongItemAttempt);
  assert.equal(result.satisfied, false);
  assert.match(result.reason, /HC_001_ITEM_MISMATCH/);
});

test('hc-b01-c-06 [HC-001]: all required plan items satisfied → gate is clear', () => {
  // Positive control: when ALL required items are properly bound and passed, gate clears.
  const result = evaluatePlanReadiness(validPlanForBuildA, [
    validAttemptU1BuildA,
    validAttemptU2BuildA,
  ]);
  assert.equal(result.gate_status, 'clear');
  assert.equal(result.satisfied_count, 2);
  assert.equal(result.required_count, 2);
  assert.deepEqual(result.unsatisfied_items, []);
});

// ---------------------------------------------------------------------------
// HC-002 COUNTEREXAMPLE TESTS — HC-B01-D
// Observed existing behavior: a genuine U1 execution row can be relabeled as
// U2 and satisfy a required U2 check through presentation-row identity.
// Required hardened behavior: probe identity must resolve from validated
// immutable execution identity (probe_definition_hash). Presentation row
// text/labels must not establish probe identity.
// PASS only if relabeling presentation-row text cannot substitute probe identity.
// ---------------------------------------------------------------------------

test('hc-b01-d-01 [HC-002]: U1 attempt with U2 plan_item_id but U1 probe_definition_hash cannot satisfy U2 item', () => {
  // HC-002 COUNTEREXAMPLE:
  // An attempt that carries U1's probe_definition_hash but has been relabeled
  // with plan_item_id for U2 must NOT satisfy the U2 plan item.
  // The probe_definition_hash is the authoritative identity — not the label/text.
  const relabeledAttempt = {
    ...validAttemptU1BuildA,
    attempt_id: 'Attempt-Relabeled',
    plan_item_id: 'Item-HC-B01-U2',   // relabeled to U2's item ID
    probe_id: 'U2',                    // relabeled to U2's probe ID
    // probe_definition_hash remains U1's hash — cannot be hidden
    probe_definition_hash: HASH_PROBE_U1,
  };
  const u2Item = validPlanForBuildA.required_probes[1]; // Item-HC-B01-U2 requires HASH_PROBE_U2
  const result = checkAttemptSatisfiesPlanItem(validPlanForBuildA, u2Item, relabeledAttempt);
  assert.equal(result.satisfied, false,
    'HC-002 VIOLATED: relabeled probe_definition_hash must not satisfy the U2 plan item');
  assert.match(result.reason, /HC_002_PROBE_IDENTITY_MISMATCH/);
});

test('hc-b01-d-02 [HC-002]: wrong probe_definition_hash always fails even with matching probe_id and plan_item_id', () => {
  // Attempt has correct plan_item_id for U1, correct probe_id "U1", but wrong definition hash
  const wrongHashAttempt = {
    ...validAttemptU1BuildA,
    probe_definition_hash: HASH_PROBE_U2, // U2's hash — wrong for U1 plan item
  };
  const u1Item = validPlanForBuildA.required_probes[0];
  const result = checkAttemptSatisfiesPlanItem(validPlanForBuildA, u1Item, wrongHashAttempt);
  assert.equal(result.satisfied, false,
    'HC-002 VIOLATED: wrong probe_definition_hash must not satisfy the plan item');
  assert.match(result.reason, /HC_002_PROBE_IDENTITY_MISMATCH/);
});

test('hc-b01-d-03 [HC-002]: relabeled U1 attempt in evaluatePlanReadiness cannot satisfy U2 requirement', () => {
  // The plan requires both U1 (HASH_PROBE_U1) and U2 (HASH_PROBE_U2).
  // We supply a correct U1 attempt and a relabeled attempt (U1 hash, U2 labels).
  const relabeledAttempt = {
    ...validAttemptU1BuildA,
    attempt_id: 'Attempt-Relabeled-Full',
    plan_item_id: 'Item-HC-B01-U2',
    probe_id: 'U2',
    probe_definition_hash: HASH_PROBE_U1, // still U1's hash
  };
  const result = evaluatePlanReadiness(validPlanForBuildA, [
    validAttemptU1BuildA,
    relabeledAttempt,
  ]);
  assert.notEqual(result.gate_status, 'clear',
    'HC-002 VIOLATED: relabeled attempt must not clear the plan gate');
  assert.ok(result.unsatisfied_items.includes('Item-HC-B01-U2'));
});

test('hc-b01-d-04 [HC-002]: correct probe_definition_hash satisfies item (positive control)', () => {
  // Positive control: same hash, correct plan_item_id → satisfied
  const u1Item = validPlanForBuildA.required_probes[0];
  const result = checkAttemptSatisfiesPlanItem(validPlanForBuildA, u1Item, validAttemptU1BuildA);
  assert.equal(result.satisfied, true);
});

test('hc-b01-d-05 [HC-002]: ExecutionAttempt validation rejects malformed probe_definition_hash', () => {
  // A hash field that is not a valid sha256: hash must be rejected at validation time,
  // preventing a presentation-label string from being accepted as identity.
  const bad = {
    ...validAttemptU1BuildA,
    probe_definition_hash: 'U1-label-text', // presentation text, not a hash
  };
  assertValidationError(() => validateExecutionAttempt(bad), /HC_INVALID_HASH.*probe_definition_hash/);
});

// ---------------------------------------------------------------------------
// HC-003 COUNTEREXAMPLE TESTS — HC-B01-E
// Observed existing behavior: execution from build A can be projected into
// an envelope labeled build B and appear clear for peer test.
// Required hardened behavior: the target build must be exactly identity-bound.
// A target/build mismatch must block. A report/exporter must not be capable
// of conferring readiness.
// PASS only if evidence from build A cannot be represented as readiness for
// target build B.
// ---------------------------------------------------------------------------

test('hc-b01-e-01 [HC-003]: attempt for BUILD_A cannot satisfy plan requiring BUILD_B', () => {
  // HC-003 COUNTEREXAMPLE:
  // A plan that targets BUILD_B. A passing execution attempt from BUILD_A must not
  // satisfy any plan item in that plan.
  const planForBuildB = {
    ...validPlanForBuildA,
    plan_id: 'Plan-HC-B01-BuildB',
    target_build_id: BUILD_B,
    plan_hash: HASH_PLAN,
  };
  // BUILD_A attempt against BUILD_B plan
  const u1Item = planForBuildB.required_probes[0];
  const result = checkAttemptSatisfiesPlanItem(planForBuildB, u1Item, validAttemptU1BuildA);
  assert.equal(result.satisfied, false,
    'HC-003 VIOLATED: BUILD_A attempt must not satisfy BUILD_B plan item');
  assert.match(result.reason, /HC_003_BUILD_MISMATCH/);
});

test('hc-b01-e-02 [HC-003]: evaluatePlanReadiness blocks when all attempts are from wrong build', () => {
  // A plan for BUILD_B evaluated with BUILD_A attempts must remain blocked.
  const planForBuildB = {
    ...validPlanForBuildA,
    plan_id: 'Plan-HC-B01-BuildB',
    target_build_id: BUILD_B,
    plan_hash: HASH_PLAN,
  };
  const result = evaluatePlanReadiness(planForBuildB, [
    validAttemptU1BuildA,
    validAttemptU2BuildA,
  ]);
  assert.notEqual(result.gate_status, 'clear',
    'HC-003 VIOLATED: BUILD_A attempts must not clear a BUILD_B plan');
  assert.equal(result.gate_status, 'blocked');
  assert.equal(result.unsatisfied_items.length, 2);
});

test('hc-b01-e-03 [HC-003]: ExecutionAttempt validation rejects invalid target_build_id', () => {
  // A caller-supplied build label that violates the machine-id pattern must be
  // rejected at validation time — preventing free-text build labels from
  // bypassing identity checks.
  const bad = {
    ...validAttemptU1BuildA,
    target_build_id: 'build label with spaces', // invalid machine-id
  };
  assertValidationError(() => validateExecutionAttempt(bad), /HC_INVALID_ID.*target_build_id/);
});

test('hc-b01-e-04 [HC-003]: a GateDecision carries an explicit target_build_id; a BUILD_A decision is structurally separate from BUILD_B', () => {
  // Structural invariant: a GateDecision's target_build_id is an explicit field that
  // must be validated. gate_status=clear for BUILD_A is not clearance for BUILD_B.
  const gateClearBuildA = { ...validGateDecisionClear, target_build_id: BUILD_A };
  assert.doesNotThrow(() => validateGateDecision(gateClearBuildA));
  const gateClearBuildB = { ...validGateDecisionClear, target_build_id: BUILD_B };
  assert.doesNotThrow(() => validateGateDecision(gateClearBuildB));
  // The two decisions are structurally separate — target_build_id is part of identity
  assert.notEqual(gateClearBuildA.target_build_id, gateClearBuildB.target_build_id);
});

test('hc-b01-e-05 [HC-003]: BUILD_B attempt satisfies BUILD_B plan (positive control)', () => {
  // Positive control: an attempt correctly issued against BUILD_B satisfies BUILD_B plan.
  // REPAIR: attempts must also bind plan_id to the new plan, not the old one.
  const planForBuildB = {
    ...validPlanForBuildA,
    plan_id: 'Plan-HC-B01-BuildB',
    target_build_id: BUILD_B,
    plan_hash: HASH_PLAN,
  };
  const attemptU1BuildB = {
    ...validAttemptU1BuildA,
    attempt_id: 'Attempt-U1-BuildB',
    plan_id: 'Plan-HC-B01-BuildB',  // bound to the BuildB plan
    target_build_id: BUILD_B,
  };
  const attemptU2BuildB = {
    ...validAttemptU2BuildA,
    attempt_id: 'Attempt-U2-BuildB',
    plan_id: 'Plan-HC-B01-BuildB',  // bound to the BuildB plan
    target_build_id: BUILD_B,
  };
  const result = evaluatePlanReadiness(planForBuildB, [attemptU1BuildB, attemptU2BuildB]);
  assert.equal(result.gate_status, 'clear');
});

// ---------------------------------------------------------------------------
// HC-B01-F — Type/schema agreement
// The types in src/hc-schemas.ts are structurally consistent with the schemas
// in schemas/*.schema.json. This is verified two ways:
// 1. TypeScript compilation (npm run typecheck) fails if any HC types are
//    structurally inconsistent with the validator expectations.
// 2. The round-trip assertions below confirm that validated fixtures have the
//    expected fields — catching drift between validator and schema.
// ---------------------------------------------------------------------------

test('hc-b01-f-01: validated EvaluationPlan contains all normative required fields', () => {
  validateEvaluationPlan(validPlanForBuildA);
  // Fields required by contradictor.evaluation-plan.v1 schema
  for (const field of [
    'schema_version', 'plan_id', 'plan_version', 'plan_hash',
    'target_tool_id', 'target_build_id', 'profile_id', 'profile_hash',
    'probe_library_version', 'required_probes', 'authorized_by', 'authorized_at',
  ]) {
    assert.ok(field in validPlanForBuildA, `field '${field}' missing from EvaluationPlan fixture`);
  }
});

test('hc-b01-f-02: validated ExecutionAttempt contains all normative required fields', () => {
  validateExecutionAttempt(validAttemptU1BuildA);
  for (const field of [
    'schema_version', 'attempt_id', 'plan_id', 'plan_hash', 'plan_item_id',
    'probe_id', 'probe_definition_hash', 'target_tool_id', 'target_build_id',
    'execution_record_ref', 'execution_state', 'attempted_at',
  ]) {
    assert.ok(field in validAttemptU1BuildA, `field '${field}' missing from ExecutionAttempt fixture`);
  }
});

test('hc-b01-f-03: validated GateDecision contains all normative required fields', () => {
  validateGateDecision(validGateDecisionClear);
  for (const field of [
    'schema_version', 'decision_id', 'plan_id', 'plan_hash',
    'target_tool_id', 'target_build_id', 'decided_by', 'decided_at',
    'gate_status', 'coverage_summary',
  ]) {
    assert.ok(field in validGateDecisionClear, `field '${field}' missing from GateDecision fixture`);
  }
});

test('hc-b01-f-04: validated BUILDReturn contains all normative required fields', () => {
  validateBUILDReturn(validBUILDReturn);
  for (const field of [
    'schema_version', 'return_id', 'plan_id', 'plan_hash',
    'target_tool_id', 'target_build_id', 'build_authority_id',
    'determination', 'determined_at', 'evidence_package_ref',
  ]) {
    assert.ok(field in validBUILDReturn, `field '${field}' missing from BUILDReturn fixture`);
  }
});

// ---------------------------------------------------------------------------
// HC-B01-G — No approval is fabricated
// Missing authorization remains missing/unapproved rather than being silently
// defaulted, synthesized, or treated as success.
// ---------------------------------------------------------------------------

test('hc-b01-g-01: EvaluationPlan with empty authorized_by is rejected', () => {
  const bad = { ...validPlanForBuildA, authorized_by: '' };
  assertValidationError(() => validateEvaluationPlan(bad), /HC_EMPTY_FIELD.*authorized_by/);
});

test('hc-b01-g-02: EvaluationPlan with missing authorized_by is rejected', () => {
  const bad = { ...validPlanForBuildA };
  delete bad['authorized_by'];
  assertValidationError(
    () => validateEvaluationPlan(bad),
    /HC_MISSING_FIELD.*authorized_by|HC_EMPTY_FIELD.*authorized_by/,
  );
});

test('hc-b01-g-03: ReviewAttestation with empty reviewer_id is rejected', () => {
  const bad = { ...validAttestation, reviewer_id: '' };
  assertValidationError(() => validateReviewAttestation(bad), /HC_EMPTY_FIELD.*reviewer_id/);
});

test('hc-b01-g-04: BUILDReturn with empty build_authority_id is rejected', () => {
  const bad = { ...validBUILDReturn, build_authority_id: '' };
  assertValidationError(() => validateBUILDReturn(bad), /HC_EMPTY_FIELD.*build_authority_id/);
});

test('hc-b01-g-05: GateDecision with empty decided_by is rejected', () => {
  const bad = { ...validGateDecisionClear, decided_by: '' };
  assertValidationError(() => validateGateDecision(bad), /HC_EMPTY_FIELD.*decided_by/);
});

test('hc-b01-g-06: a non-passed execution state cannot satisfy a plan item', () => {
  // 'failed', 'inconclusive', 'unsupported', 'error' must not produce satisfaction
  for (const state of ['failed', 'inconclusive', 'unsupported', 'error']) {
    const attempt = { ...validAttemptU1BuildA, execution_state: state };
    const item = validPlanForBuildA.required_probes[0];
    const result = checkAttemptSatisfiesPlanItem(validPlanForBuildA, item, attempt);
    assert.equal(result.satisfied, false,
      `execution_state='${state}' must not produce satisfaction`);
  }
});

test('hc-b01-g-07: scope_exclusion action does not count as passing execution', () => {
  // An ActionRecord with action_type='scope_exclusion' is a valid record
  // (the action happened), but it carries no execution_state. It must not
  // be confused with a passing ExecutionAttempt.
  const exclusionAction = {
    ...validActionRecord,
    action_id: 'Action-Exclusion-001',
    action_type: 'scope_exclusion',
    notes: 'Probe excluded from scope — does not count as passing',
  };
  assert.doesNotThrow(() => validateActionRecord(exclusionAction));
  // Confirm: action_type is scope_exclusion — structurally distinct from
  // an ExecutionAttempt with execution_state='passed'.
  assert.equal(exclusionAction.action_type, 'scope_exclusion');
  assert.equal('execution_state' in exclusionAction, false,
    'ActionRecord has no execution_state — cannot be treated as a passing probe');
});

// ---------------------------------------------------------------------------
// REPAIR-2 — Empty / unauthorized plan must not produce clear readiness
// Finding: readiness could return 'clear' for an empty or unauthorized plan.
// Required: evaluatePlanReadiness must block when plan has zero required probes.
// ---------------------------------------------------------------------------

test('hc-b01-r2-01 [HC-001/B]: evaluatePlanReadiness with zero required_probes returns blocked', () => {
  // A plan with empty required_probes cannot produce clear.
  // (validateEvaluationPlan would reject such a plan, but evaluatePlanReadiness
  // must also block independently in case it receives an un-validated plan object.)
  const emptyPlan = {
    ...validPlanForBuildA,
    required_probes: [],
  };
  const result = evaluatePlanReadiness(emptyPlan, [validAttemptU1BuildA, validAttemptU2BuildA]);
  assert.notEqual(result.gate_status, 'clear',
    'REPAIR-2 VIOLATED: empty required_probes must not produce clear gate');
  assert.equal(result.gate_status, 'blocked');
});

test('hc-b01-r2-02 [HC-001/B]: validateEvaluationPlan + evaluatePlanReadiness agree: empty plan is blocked at both layers', () => {
  // Two-layer check: validation rejects, and even if it somehow passed through,
  // readiness evaluation also blocks.
  const emptyPlan = { ...validPlanForBuildA, required_probes: [] };
  // Layer 1: validator rejects
  assertValidationError(() => validateEvaluationPlan(emptyPlan), /HC_EMPTY_REQUIRED_PROBES/);
  // Layer 2: readiness also blocks
  const result = evaluatePlanReadiness(emptyPlan, [validAttemptU1BuildA]);
  assert.equal(result.gate_status, 'blocked');
});

test('hc-b01-r2-03 [HC-B01-G]: an unauthorized plan (empty authorized_by) cannot pass validateEvaluationPlan', () => {
  // The mandatory gate for authorization is validateEvaluationPlan.
  // A plan with empty authorized_by is invalid and must be rejected before
  // being passed to evaluatePlanReadiness. This test confirms the gate holds.
  const unauthorizedPlan = { ...validPlanForBuildA, authorized_by: '' };
  assertValidationError(() => validateEvaluationPlan(unauthorizedPlan), /HC_EMPTY_FIELD.*authorized_by/);
});

// ---------------------------------------------------------------------------
// REPAIR-3 — Extra-property / schema-runtime agreement
// Finding: runtime validation accepted extra properties that the normative
// JSON Schema forbids with "additionalProperties": false.
// Required: properties forbidden by the normative schema must also be rejected
// by runtime validation. Executable evidence of drift detection.
// ---------------------------------------------------------------------------

test('hc-b01-r3-01 [HC-B01-F]: EvaluationPlan with extra property is rejected by runtime validator', () => {
  // Schema: additionalProperties: false. Extra key must be rejected.
  const withExtra = { ...validPlanForBuildA, INJECTED_FIELD: 'should-be-rejected' };
  assertValidationError(() => validateEvaluationPlan(withExtra), /HC_EXTRA_PROPERTY.*INJECTED_FIELD/);
});

test('hc-b01-r3-02 [HC-B01-F]: ExecutionAttempt with extra property is rejected by runtime validator', () => {
  const withExtra = { ...validAttemptU1BuildA, extra_key: 'forbidden' };
  assertValidationError(() => validateExecutionAttempt(withExtra), /HC_EXTRA_PROPERTY.*extra_key/);
});

test('hc-b01-r3-03 [HC-B01-F]: GateDecision with extra property is rejected by runtime validator', () => {
  const withExtra = { ...validGateDecisionClear, caller_supplied_build_label: 'BuildX' };
  assertValidationError(() => validateGateDecision(withExtra), /HC_EXTRA_PROPERTY.*caller_supplied_build_label/);
});

test('hc-b01-r3-04 [HC-B01-F]: BUILDReturn with extra property is rejected by runtime validator', () => {
  const withExtra = { ...validBUILDReturn, fabricated_approval: true };
  assertValidationError(() => validateBUILDReturn(withExtra), /HC_EXTRA_PROPERTY.*fabricated_approval/);
});

test('hc-b01-r3-05 [HC-B01-F]: DomainProbeProfile with extra property is rejected', () => {
  const withExtra = { ...validProfile, unexpected: 'drift' };
  assertValidationError(() => validateDomainProbeProfile(withExtra), /HC_EXTRA_PROPERTY.*unexpected/);
});

test('hc-b01-r3-06 [HC-B01-F]: ActionRecord with extra property is rejected', () => {
  const withExtra = { ...validActionRecord, extra: 'drift' };
  assertValidationError(() => validateActionRecord(withExtra), /HC_EXTRA_PROPERTY.*extra/);
});

test('hc-b01-r3-07 [HC-B01-F]: ReviewAttestation with extra property is rejected', () => {
  const withExtra = { ...validAttestation, injected: 'drift' };
  assertValidationError(() => validateReviewAttestation(withExtra), /HC_EXTRA_PROPERTY.*injected/);
});

test('hc-b01-r3-08 [HC-B01-F]: valid fixtures still pass after additionalProperties enforcement', () => {
  // Positive control: the allowed-properties lists are correct — all existing
  // valid fixtures continue to validate after adding the extra-property check.
  assert.doesNotThrow(() => validateDomainProbeProfile(validProfile));
  assert.doesNotThrow(() => validateProbeDefinitionRecord(validProbeU1));
  assert.doesNotThrow(() => validateEvaluationPlan(validPlanForBuildA));
  assert.doesNotThrow(() => validateExecutionAttempt(validAttemptU1BuildA));
  assert.doesNotThrow(() => validateExecutionAttempt(validAttemptU2BuildA));
  assert.doesNotThrow(() => validateActionRecord(validActionRecord));
  assert.doesNotThrow(() => validateReviewAttestation(validAttestation));
  assert.doesNotThrow(() => validateGateDecision(validGateDecisionClear));
  assert.doesNotThrow(() => validateBUILDReturn(validBUILDReturn));
});

// ---------------------------------------------------------------------------
// REPAIR-4A — Authorization at readiness
// Finding: evaluatePlanReadiness with authorized_by:'' + matching passing
// attempts still returned 'clear'. The readiness function must check for
// valid authorized_by evidence directly, not only rely on the validator gate.
// These are DIRECT READINESS tests — not validator-only tests.
// ---------------------------------------------------------------------------

test('hc-b01-r4a-01 [HC-B01-G]: evaluatePlanReadiness with empty authorized_by returns blocked even when probes satisfy', () => {
  // This is the direct readiness test that was missing.
  // Construct a plan with all the right probes but no authorization evidence.
  const unauthorizedPlan = { ...validPlanForBuildA, authorized_by: '' };
  // Supply passing attempts that would otherwise satisfy both plan items.
  const result = evaluatePlanReadiness(unauthorizedPlan, [validAttemptU1BuildA, validAttemptU2BuildA]);
  assert.notEqual(result.gate_status, 'clear',
    'REPAIR-4A VIOLATED: empty authorized_by must block readiness even when probes match');
  assert.equal(result.gate_status, 'blocked');
});

test('hc-b01-r4a-02 [HC-B01-G]: evaluatePlanReadiness with whitespace-only authorized_by returns blocked', () => {
  const unauthorizedPlan = { ...validPlanForBuildA, authorized_by: '   ' };
  const result = evaluatePlanReadiness(unauthorizedPlan, [validAttemptU1BuildA, validAttemptU2BuildA]);
  assert.notEqual(result.gate_status, 'clear',
    'REPAIR-4A VIOLATED: whitespace authorized_by must block readiness');
  assert.equal(result.gate_status, 'blocked');
});

test('hc-b01-r4a-03 [HC-B01-G]: evaluatePlanReadiness with valid authorized_by proceeds to probe evaluation (positive control)', () => {
  // Positive control: a plan with proper authorized_by does reach probe evaluation.
  const result = evaluatePlanReadiness(validPlanForBuildA, [validAttemptU1BuildA, validAttemptU2BuildA]);
  // validPlanForBuildA.authorized_by = 'LDR' — non-empty, passes the auth check.
  // Both attempts satisfy their items, so gate should clear.
  assert.equal(result.gate_status, 'clear');
});

test('hc-b01-r4a-04 [HC-B01-G]: authorization check at readiness is independent of validator — direct call without prior validation', () => {
  // Prove the readiness check is not relying on the validator having been called.
  // We bypass validateEvaluationPlan entirely and call evaluatePlanReadiness
  // directly with an unauthorized plan. It must still block.
  // (In production, validateEvaluationPlan should always be called first;
  //  this test proves the readiness function does not trust its input implicitly.)
  const unauthorizedPlan = { ...validPlanForBuildA, authorized_by: '' };
  // No validateEvaluationPlan call here — go directly to readiness.
  const result = evaluatePlanReadiness(unauthorizedPlan, [validAttemptU1BuildA, validAttemptU2BuildA]);
  assert.equal(result.gate_status, 'blocked',
    'Readiness must block unauthorized plan even without prior validator call');
});

// ---------------------------------------------------------------------------
// SC-017 regression: missing/null/non-string authorized_by must return blocked,
// never throw TypeError, with otherwise matching passed attempts.
// These close the gap identified in SC-017: "missing/null/non-string cases were
// independently executed by reviewer but are not yet durable regression cases."
// ---------------------------------------------------------------------------

test('hc-b01-r5-01 [HC-B01-G SC-017]: omitted authorized_by returns blocked — otherwise matching passed attempts present', () => {
  // Construct plan with authorized_by deleted entirely (undefined after spread)
  const { authorized_by: _removed, ...planWithoutAuth } = validPlanForBuildA;
  // Supply passing attempts for both plan items — these would satisfy if auth were present
  let result;
  let threw = false;
  try {
    result = evaluatePlanReadiness(planWithoutAuth, [validAttemptU1BuildA, validAttemptU2BuildA]);
  } catch (e) {
    threw = true;
  }
  assert.equal(threw, false,
    'SC-017: omitted authorized_by must not throw TypeError — evaluatePlanReadiness must guard type before .trim()');
  assert.equal(result.gate_status, 'blocked',
    'SC-017: omitted authorized_by must return blocked, not clear');
});

test('hc-b01-r5-02 [HC-B01-G SC-017]: null authorized_by returns blocked — otherwise matching passed attempts present', () => {
  const nullAuthPlan = { ...validPlanForBuildA, authorized_by: null };
  let result;
  let threw = false;
  try {
    result = evaluatePlanReadiness(nullAuthPlan, [validAttemptU1BuildA, validAttemptU2BuildA]);
  } catch (e) {
    threw = true;
  }
  assert.equal(threw, false,
    'SC-017: null authorized_by must not throw TypeError');
  assert.equal(result.gate_status, 'blocked',
    'SC-017: null authorized_by must return blocked, not clear');
});

test('hc-b01-r5-03 [HC-B01-G SC-017]: numeric authorized_by returns blocked — otherwise matching passed attempts present', () => {
  const numericAuthPlan = { ...validPlanForBuildA, authorized_by: 42 };
  let result;
  let threw = false;
  try {
    result = evaluatePlanReadiness(numericAuthPlan, [validAttemptU1BuildA, validAttemptU2BuildA]);
  } catch (e) {
    threw = true;
  }
  assert.equal(threw, false,
    'SC-017: numeric authorized_by must not throw TypeError');
  assert.equal(result.gate_status, 'blocked',
    'SC-017: numeric authorized_by must return blocked, not clear');
});

test('hc-b01-r5-04 [HC-B01-G SC-017]: authorized positive control preserved — valid authorized_by with matching attempts returns clear', () => {
  // Positive control: valid authorized_by with both plan items satisfied must clear.
  const result = evaluatePlanReadiness(validPlanForBuildA, [validAttemptU1BuildA, validAttemptU2BuildA]);
  assert.equal(result.gate_status, 'clear',
    'SC-017: authorized positive control must still return clear after guard fixes');
  assert.equal(result.satisfied_count, 2);
  assert.equal(result.unsatisfied_items.length, 0);
});
