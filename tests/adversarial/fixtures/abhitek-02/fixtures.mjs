/**
 * ABHITEK-02 — Synthetic Fixtures for HC-B01 Independent Challenge
 *
 * All fixtures are derived from the DEMO-HC01 contract text and the
 * verified interface at candidate commit bda8813ad6be641ed1dbc5679a0e9f4ba1cf5da8.
 *
 * No fixture is copied from or inspired by Bob's test fixtures (tests/hc-b01/).
 * Field names and types confirmed from src/hc-schemas.ts and src/hc-validate.ts
 * at the exact candidate commit.
 */

// ── Shared constants ──────────────────────────────────────────────────────
const PLAN_ID        = 'ABHITEK-02-PLAN';
const PLAN_HASH      = 'sha256:' + 'a'.repeat(64);
const TARGET_TOOL_ID = 'ABHITEK-02-TOOL';
const TARGET_BUILD   = 'ABHITEK-02-BUILD-v1';
const PROFILE_ID     = 'ABHITEK-02-PROFILE';
const PROFILE_HASH   = 'sha256:' + 'b'.repeat(64);
const PROBE_LIB_VER  = '1.0.0';
const TIMESTAMP      = '2026-09-26T00:00:00.000000Z';

// Two distinct probe definitions for the two-item plan
const PROBE_1_ID     = 'ABHITEK-02-PROBE-1';
const PROBE_1_HASH   = 'sha256:' + '1'.repeat(64);
const ITEM_1_ID      = 'ABHITEK-02-ITEM-1';

const PROBE_2_ID     = 'ABHITEK-02-PROBE-2';
const PROBE_2_HASH   = 'sha256:' + '2'.repeat(64);
const ITEM_2_ID      = 'ABHITEK-02-ITEM-2';

// ── Plan Items ────────────────────────────────────────────────────────────
const PLAN_ITEM_1 = {
  plan_item_id: ITEM_1_ID,
  probe_id: PROBE_1_ID,
  probe_definition_hash: PROBE_1_HASH,
  rationale: 'ABHITEK-02 synthetic item 1',
};

const PLAN_ITEM_2 = {
  plan_item_id: ITEM_2_ID,
  probe_id: PROBE_2_ID,
  probe_definition_hash: PROBE_2_HASH,
  rationale: 'ABHITEK-02 synthetic item 2',
};

// ── Valid Two-Item Plan (fully authorized) ─────────────────────────────────
export const VALID_PLAN = {
  schema_version: 'contradictor.evaluation-plan.v1',
  plan_id: PLAN_ID,
  plan_version: '1.0.0',
  plan_hash: PLAN_HASH,
  target_tool_id: TARGET_TOOL_ID,
  target_build_id: TARGET_BUILD,
  profile_id: PROFILE_ID,
  profile_hash: PROFILE_HASH,
  probe_library_version: PROBE_LIB_VER,
  required_probes: [PLAN_ITEM_1, PLAN_ITEM_2],
  authorized_by: 'ABHITEK-02-AUTHORITY',
  authorized_at: TIMESTAMP,
};

// ── Valid Attempts (one per item, both passed) ─────────────────────────────
export const VALID_ATTEMPT_1 = {
  schema_version: 'contradictor.execution-attempt.v1',
  attempt_id: 'ABHITEK-02-ATTEMPT-1',
  plan_id: PLAN_ID,
  plan_hash: PLAN_HASH,
  plan_item_id: ITEM_1_ID,
  probe_id: PROBE_1_ID,
  probe_definition_hash: PROBE_1_HASH,
  target_tool_id: TARGET_TOOL_ID,
  target_build_id: TARGET_BUILD,
  execution_record_ref: 'sha256:' + 'e'.repeat(64),
  execution_state: 'passed',
  attempted_at: TIMESTAMP,
};

export const VALID_ATTEMPT_2 = {
  schema_version: 'contradictor.execution-attempt.v1',
  attempt_id: 'ABHITEK-02-ATTEMPT-2',
  plan_id: PLAN_ID,
  plan_hash: PLAN_HASH,
  plan_item_id: ITEM_2_ID,
  probe_id: PROBE_2_ID,
  probe_definition_hash: PROBE_2_HASH,
  target_tool_id: TARGET_TOOL_ID,
  target_build_id: TARGET_BUILD,
  execution_record_ref: 'sha256:' + 'f'.repeat(64),
  execution_state: 'passed',
  attempted_at: TIMESTAMP,
};

// ── Helper: create a plan variant with a custom authorized_by ──────────────
export function planWithAuth(authorizedBy) {
  const plan = { ...VALID_PLAN };
  if (authorizedBy === undefined) {
    delete plan.authorized_by;
  } else {
    plan.authorized_by = authorizedBy;
  }
  return plan;
}

// ── Helper: create a plan with empty required_probes ───────────────────────
export function emptyRequiredPlan(authorizedBy) {
  const plan = { ...VALID_PLAN, required_probes: [] };
  if (authorizedBy === undefined) {
    delete plan.authorized_by;
  } else {
    plan.authorized_by = authorizedBy;
  }
  return plan;
}

// ── Helper: create an attempt with one field overridden ────────────────────
export function attemptWith(itemIndex, overrides) {
  const base = itemIndex === 1 ? VALID_ATTEMPT_1 : VALID_ATTEMPT_2;
  return { ...base, ...overrides };
}

// ── Helper: create a valid attempt with a different attempt_id ─────────────
export function attemptWithDifferentId(itemIndex, newAttemptId) {
  const base = itemIndex === 1 ? VALID_ATTEMPT_1 : VALID_ATTEMPT_2;
  return { ...base, attempt_id: newAttemptId };
}

// ── Export constants for hash verification ─────────────────────────────────
export const CONSTANTS = {
  PLAN_ID, PLAN_HASH, TARGET_TOOL_ID, TARGET_BUILD,
  PROBE_1_ID, PROBE_1_HASH, ITEM_1_ID,
  PROBE_2_ID, PROBE_2_HASH, ITEM_2_ID,
  PLAN_ITEM_1, PLAN_ITEM_2,
};
