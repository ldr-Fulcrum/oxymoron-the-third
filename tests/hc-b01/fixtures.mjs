/**
 * HC-B01 — Test fixtures: canonical valid objects for schema validation tests.
 *
 * These fixtures are used for:
 * - HC-B01-A: valid fixtures validate; malformed/identity-incomplete fail.
 * - HC-B01-B: required_probes is nonempty and stable.
 * - HC-B01-F: type/schema agreement (structural consistency confirmed by
 *             TypeScript compilation of corresponding typed declarations in
 *             tests/hc-b01/fixtures.types.ts which imports these same values
 *             with explicit type annotations).
 *
 * HC-B01-G: No approval is fabricated. authorized_by and reviewer_id are
 * explicit, nonempty, and not defaulted to anything representing auto-approval.
 */

// Stable synthetic hashes used across fixtures (not real probe hashes — 64 hex chars each)
export const HASH_PROFILE    = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const HASH_PLAN       = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
export const HASH_PROBE_U1   = 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
export const HASH_PROBE_U2   = 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
export const HASH_EXEC_RECORD = 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const HASH_EVIDENCE_PKG = 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

export const BUILD_A = 'BuildA-v1.0.0';
export const BUILD_B = 'BuildB-v2.0.0';
export const TOOL_ID = 'Fixture-Tool';

// ---------------------------------------------------------------------------
// Valid DomainProbeProfile fixture
// ---------------------------------------------------------------------------
export const validProfile = {
  schema_version: 'contradictor.domain-probe-profile.v1',
  profile_id: 'Profile-HC-B01',
  profile_version: '1.0',
  profile_hash: HASH_PROFILE,
  tool_id: TOOL_ID,
  probe_library_version: '0.2.0',
  description: 'HC-B01 test profile',
};

// ---------------------------------------------------------------------------
// Valid ProbeDefinitionRecord fixtures
// ---------------------------------------------------------------------------
export const validProbeU1 = {
  schema_version: 'contradictor.probe-definition.v1',
  probe_id: 'U1',
  probe_version: '0.2.0',
  probe_definition_hash: HASH_PROBE_U1,
  invariant_class: 'Insufficiency Gating',
  kind: 'categorical',
  label: 'Zero/Empty Evidence',
};

export const validProbeU2 = {
  schema_version: 'contradictor.probe-definition.v1',
  probe_id: 'U2',
  probe_version: '0.2.0',
  probe_definition_hash: HASH_PROBE_U2,
  invariant_class: 'Negation Sensitivity',
  kind: 'input-relation',
  label: 'Negation Sensitivity',
};

// ---------------------------------------------------------------------------
// Valid EvaluationPlan fixture (for BUILD_A)
// HC-B01-B: required_probes is nonempty and contains stable plan-item identities
// HC-B01-G: authorized_by is explicit, nonempty
// ---------------------------------------------------------------------------
export const validPlanForBuildA = {
  schema_version: 'contradictor.evaluation-plan.v1',
  plan_id: 'Plan-HC-B01-BuildA',
  plan_version: '1.0',
  plan_hash: HASH_PLAN,
  target_tool_id: TOOL_ID,
  target_build_id: BUILD_A,
  profile_id: 'Profile-HC-B01',
  profile_hash: HASH_PROFILE,
  probe_library_version: '0.2.0',
  required_probes: [
    {
      plan_item_id: 'Item-HC-B01-U1',
      probe_id: 'U1',
      probe_definition_hash: HASH_PROBE_U1,
      rationale: 'Required: U1 insufficiency gate',
    },
    {
      plan_item_id: 'Item-HC-B01-U2',
      probe_id: 'U2',
      probe_definition_hash: HASH_PROBE_U2,
      rationale: 'Required: U2 negation sensitivity',
    },
  ],
  authorized_by: 'LDR',
  authorized_at: '2026-09-25T00:00:00Z',
  description: 'HC-B01 test plan for BuildA',
};

// ---------------------------------------------------------------------------
// Valid ExecutionAttempt fixtures
// ---------------------------------------------------------------------------

/** A passing attempt for plan item U1, against BUILD_A. */
export const validAttemptU1BuildA = {
  schema_version: 'contradictor.execution-attempt.v1',
  attempt_id: 'Attempt-U1-BuildA',
  plan_id: 'Plan-HC-B01-BuildA',
  plan_hash: HASH_PLAN,
  plan_item_id: 'Item-HC-B01-U1',
  probe_id: 'U1',
  probe_definition_hash: HASH_PROBE_U1,
  target_tool_id: TOOL_ID,
  target_build_id: BUILD_A,
  execution_record_ref: HASH_EXEC_RECORD,
  execution_state: 'passed',
  attempted_at: '2026-09-25T01:00:00Z',
};

/** A passing attempt for plan item U2, against BUILD_A. */
export const validAttemptU2BuildA = {
  schema_version: 'contradictor.execution-attempt.v1',
  attempt_id: 'Attempt-U2-BuildA',
  plan_id: 'Plan-HC-B01-BuildA',
  plan_hash: HASH_PLAN,
  plan_item_id: 'Item-HC-B01-U2',
  probe_id: 'U2',
  probe_definition_hash: HASH_PROBE_U2,
  target_tool_id: TOOL_ID,
  target_build_id: BUILD_A,
  execution_record_ref: HASH_EXEC_RECORD,
  execution_state: 'passed',
  attempted_at: '2026-09-25T01:01:00Z',
};

// ---------------------------------------------------------------------------
// Valid ActionRecord fixture
// ---------------------------------------------------------------------------
export const validActionRecord = {
  schema_version: 'contradictor.action-record.v1',
  action_id: 'Action-HC-B01-001',
  plan_id: 'Plan-HC-B01-BuildA',
  plan_hash: HASH_PLAN,
  attempt_id: 'Attempt-U1-BuildA',
  action_type: 'probe_execution',
  actor: 'Contradictor-Kernel',
  performed_at: '2026-09-25T01:00:00Z',
};

// ---------------------------------------------------------------------------
// Valid ReviewAttestation fixture
// HC-B01-G: reviewer_id is explicit and nonempty
// ---------------------------------------------------------------------------
export const validAttestation = {
  schema_version: 'contradictor.review-attestation.v1',
  attestation_id: 'Attest-HC-B01-001',
  plan_id: 'Plan-HC-B01-BuildA',
  plan_hash: HASH_PLAN,
  plan_item_id: 'Item-HC-B01-U1',
  probe_definition_hash: HASH_PROBE_U1,
  target_build_id: BUILD_A,
  reviewer_id: 'BUILD-Reviewer-1',
  attestation_type: 'confirmed',
  attested_at: '2026-09-25T02:00:00Z',
};

// ---------------------------------------------------------------------------
// Valid GateDecision fixture
// ---------------------------------------------------------------------------
export const validGateDecisionClear = {
  schema_version: 'contradictor.gate-decision.v1',
  decision_id: 'Gate-HC-B01-001',
  plan_id: 'Plan-HC-B01-BuildA',
  plan_hash: HASH_PLAN,
  target_tool_id: TOOL_ID,
  target_build_id: BUILD_A,
  decided_by: 'BUILD',
  decided_at: '2026-09-25T03:00:00Z',
  gate_status: 'clear',
  coverage_summary: {
    required_count: 2,
    satisfied_count: 2,
    unsatisfied_items: [],
  },
};

// ---------------------------------------------------------------------------
// Valid BUILDReturn fixture
// HC-B01-G: build_authority_id is explicit and nonempty
// ---------------------------------------------------------------------------
export const validBUILDReturn = {
  schema_version: 'contradictor.build-return.v1',
  return_id: 'Return-HC-B01-001',
  plan_id: 'Plan-HC-B01-BuildA',
  plan_hash: HASH_PLAN,
  target_tool_id: TOOL_ID,
  target_build_id: BUILD_A,
  build_authority_id: 'BUILD',
  determination: 'accepted',
  determined_at: '2026-09-25T04:00:00Z',
  evidence_package_ref: HASH_EVIDENCE_PKG,
  limitations: [],
};
