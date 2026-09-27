/**
 * ABHITEK-02 — Independent Adversarial Challenge for HC-B01 (DEMO-HC01)
 * Branch: abhitek/hc-b01-challenge
 *
 * Candidate under test: Bob HC-B01, commit bda8813ad6be641ed1dbc5679a0e9f4ba1cf5da8
 * Requirement: DEMO-HC01 (frozen)
 *
 * Six test families:
 *   Family A — Authorization Blocking           (12 cases)
 *   Family B — Empty Required Set               (2 cases)
 *   Family C — Identity Mismatches              (4 cases × 2 levels)
 *   Family D — Authorized Positive Control      (2 cases)
 *   Family E — Ambiguous / Escalated            (1 observational case)
 *   Family F — Aggressive Edge Cases            (9 cases)
 *
 * Rules:
 *   - src/* files are NOT modified.
 *   - Tests derived from DEMO-HC01 contract text only, NOT from Bob's tests.
 *   - Each case states hypothesis BEFORE asserting.
 *   - Uses native node:test runner.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluatePlanReadiness,
  checkAttemptSatisfiesPlanItem,
} from '../../src/hc-validate.ts';

import {
  VALID_PLAN,
  VALID_ATTEMPT_1,
  VALID_ATTEMPT_2,
  planWithAuth,
  emptyRequiredPlan,
  attemptWith,
  attemptWithDifferentId,
  CONSTANTS,
} from './fixtures/abhitek-02/fixtures.mjs';

// ══════════════════════════════════════════════════════════════════════════════
// Helper: assert that evaluatePlanReadiness does NOT throw and returns BLOCKED.
// This enforces the DEMO-HC01 requirement: "no uncontrolled TypeError or crash"
// separately from the gate_status check.
// ══════════════════════════════════════════════════════════════════════════════

function assertBlockedNoThrow(plan, attempts, caseId) {
  let result;
  assert.doesNotThrow(() => {
    result = evaluatePlanReadiness(plan, attempts);
  }, `${caseId}: evaluatePlanReadiness must not throw`);
  assert.equal(
    result.gate_status,
    'blocked',
    `${caseId}: gate_status must be 'blocked', got '${result?.gate_status}'`
  );
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// FAMILY A — Authorization Blocking
// DEMO-HC01 requirement 1: Return BLOCKED when authorized_by is absent, null,
// non-string, empty, or whitespace-only. No uncontrolled TypeError or crash.
// ══════════════════════════════════════════════════════════════════════════════

test('A1: authorized_by missing (undefined) → BLOCKED, no throw', async () => {
  // Hypothesis: a plan with authorized_by deleted should return BLOCKED.
  const plan = planWithAuth(undefined);
  assertBlockedNoThrow(plan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2], 'A1');
});

test('A2: authorized_by is null → BLOCKED, no throw', async () => {
  // Hypothesis: null is not a string → BLOCKED.
  const plan = planWithAuth(null);
  assertBlockedNoThrow(plan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2], 'A2');
});

test('A3: authorized_by is number (42) → BLOCKED, no throw', async () => {
  // Hypothesis: number is not a string → BLOCKED.
  const plan = planWithAuth(42);
  assertBlockedNoThrow(plan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2], 'A3');
});

test('A4: authorized_by is object ({}) → BLOCKED, no throw', async () => {
  // Hypothesis: object is not a string → BLOCKED.
  // Note: this case is the canary for check-ordering regressions —
  // if code called .trim() before the typeof check, {}.trim would be undefined
  // and throw. This case catches that ordering bug.
  const plan = planWithAuth({});
  assertBlockedNoThrow(plan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2], 'A4');
});

test('A5: authorized_by is boolean (false) → BLOCKED, no throw', async () => {
  // Hypothesis: boolean is not a string → BLOCKED.
  const plan = planWithAuth(false);
  assertBlockedNoThrow(plan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2], 'A5');
});

test('A6: authorized_by is empty string ("") → BLOCKED, no throw', async () => {
  // Hypothesis: empty string trims to '' → BLOCKED.
  const plan = planWithAuth('');
  assertBlockedNoThrow(plan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2], 'A6');
});

test('A7: authorized_by is single space (" ") → BLOCKED, no throw', async () => {
  // Hypothesis: " ".trim() === '' → BLOCKED.
  const plan = planWithAuth(' ');
  assertBlockedNoThrow(plan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2], 'A7');
});

test('A8: authorized_by is tabs-only ("\\t\\t") → BLOCKED, no throw', async () => {
  // Hypothesis: "\t\t".trim() === '' → BLOCKED.
  const plan = planWithAuth('\t\t');
  assertBlockedNoThrow(plan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2], 'A8');
});

test('A9: authorized_by is newlines-only ("\\n\\n") → BLOCKED, no throw', async () => {
  // Hypothesis: "\n\n".trim() === '' → BLOCKED.
  const plan = planWithAuth('\n\n');
  assertBlockedNoThrow(plan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2], 'A9');
});

test('A10: authorized_by is mixed whitespace (" \\t\\n ") → BLOCKED, no throw', async () => {
  // Hypothesis: " \t\n ".trim() === '' → BLOCKED.
  const plan = planWithAuth(' \t\n ');
  assertBlockedNoThrow(plan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2], 'A10');
});

test('A11: authorized_by is array (["Alice"]) → BLOCKED, no throw', async () => {
  // Hypothesis: array is not a string → typeof check fails → BLOCKED.
  const plan = planWithAuth(['Alice']);
  assertBlockedNoThrow(plan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2], 'A11');
});

test('A12: authorized_by is non-breaking space ("\\u00A0") → BLOCKED, no throw', async () => {
  // Hypothesis: \u00A0 is a Unicode whitespace character.
  // JS .trim() removes it → trims to '' → BLOCKED.
  const plan = planWithAuth('\u00A0');
  assertBlockedNoThrow(plan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2], 'A12');
});

// ══════════════════════════════════════════════════════════════════════════════
// FAMILY B — Empty Required Set
// DEMO-HC01 requirement 3: Never allow an empty required set to clear.
// ══════════════════════════════════════════════════════════════════════════════

test('B1: empty required_probes with valid authorization → BLOCKED', async () => {
  // Hypothesis: zero required items → BLOCKED even with valid authorized_by.
  const plan = emptyRequiredPlan('ABHITEK-02-AUTHORITY');
  const result = assertBlockedNoThrow(plan, [], 'B1');
  assert.equal(result.required_count, 0, 'B1: required_count should be 0');
});

test('B2: empty required_probes with missing authorization → BLOCKED', async () => {
  // Hypothesis: zero required items AND no authorization → still BLOCKED.
  const plan = emptyRequiredPlan(undefined);
  assert.strictEqual('authorized_by' in plan, false, 'B2: authorized_by must be genuinely absent');
  assertBlockedNoThrow(plan, [], 'B2');
});

// ══════════════════════════════════════════════════════════════════════════════
// FAMILY C — Identity Mismatches
// DEMO-HC01 requirement 4: Wrong plan ID/hash, wrong probe-definition hash,
// or wrong target build must fail the item.
//
// Each mismatch tested at TWO levels:
//   1. checkAttemptSatisfiesPlanItem → { satisfied: false }
//   2. evaluatePlanReadiness → gate_status: 'blocked'
// ══════════════════════════════════════════════════════════════════════════════

test('C1: wrong plan_id on attempt → item NOT satisfied, plan BLOCKED', async () => {
  // Hypothesis: attempt bound to a different plan_id should not satisfy the item.
  const badAttempt = attemptWith(1, { plan_id: 'WRONG-PLAN-ID' });

  // Level 1: item-level check
  const itemResult = checkAttemptSatisfiesPlanItem(
    VALID_PLAN, VALID_PLAN.required_probes[0], badAttempt
  );
  assert.equal(itemResult.satisfied, false, 'C1-item: should not be satisfied');
  assert.equal(itemResult.plan_item_id, CONSTANTS.ITEM_1_ID, 'C1-item: should reference correct item');

  // Level 2: plan-level check
  const planResult = evaluatePlanReadiness(VALID_PLAN, [badAttempt, VALID_ATTEMPT_2]);
  assert.equal(planResult.gate_status, 'blocked', 'C1-plan: gate should be blocked');
  assert.ok(
    planResult.unsatisfied_items.includes(CONSTANTS.ITEM_1_ID),
    'C1-plan: unsatisfied_items should include the failed item'
  );
});

test('C2: wrong plan_hash on attempt → item NOT satisfied, plan BLOCKED', async () => {
  // Hypothesis: attempt with mismatched plan_hash should not satisfy the item.
  const badAttempt = attemptWith(1, { plan_hash: 'sha256:' + 'x'.repeat(64) });

  // Level 1: item-level check
  const itemResult = checkAttemptSatisfiesPlanItem(
    VALID_PLAN, VALID_PLAN.required_probes[0], badAttempt
  );
  assert.equal(itemResult.satisfied, false, 'C2-item: should not be satisfied');

  // Level 2: plan-level check
  const planResult = evaluatePlanReadiness(VALID_PLAN, [badAttempt, VALID_ATTEMPT_2]);
  assert.equal(planResult.gate_status, 'blocked', 'C2-plan: gate should be blocked');
  assert.ok(
    planResult.unsatisfied_items.includes(CONSTANTS.ITEM_1_ID),
    'C2-plan: unsatisfied_items should include the failed item'
  );
});

test('C3: wrong probe_definition_hash on attempt → item NOT satisfied, plan BLOCKED', async () => {
  // Hypothesis: attempt with wrong probe identity hash should not satisfy the item.
  const badAttempt = attemptWith(1, { probe_definition_hash: 'sha256:' + 'y'.repeat(64) });

  // Level 1: item-level check
  const itemResult = checkAttemptSatisfiesPlanItem(
    VALID_PLAN, VALID_PLAN.required_probes[0], badAttempt
  );
  assert.equal(itemResult.satisfied, false, 'C3-item: should not be satisfied');

  // Level 2: plan-level check
  const planResult = evaluatePlanReadiness(VALID_PLAN, [badAttempt, VALID_ATTEMPT_2]);
  assert.equal(planResult.gate_status, 'blocked', 'C3-plan: gate should be blocked');
  assert.ok(
    planResult.unsatisfied_items.includes(CONSTANTS.ITEM_1_ID),
    'C3-plan: unsatisfied_items should include the failed item'
  );
});

test('C4: wrong target_build_id on attempt → item NOT satisfied, plan BLOCKED', async () => {
  // Hypothesis: attempt against a different build should not satisfy the item.
  const badAttempt = attemptWith(1, { target_build_id: 'WRONG-BUILD-v99' });

  // Level 1: item-level check
  const itemResult = checkAttemptSatisfiesPlanItem(
    VALID_PLAN, VALID_PLAN.required_probes[0], badAttempt
  );
  assert.equal(itemResult.satisfied, false, 'C4-item: should not be satisfied');

  // Level 2: plan-level check
  const planResult = evaluatePlanReadiness(VALID_PLAN, [badAttempt, VALID_ATTEMPT_2]);
  assert.equal(planResult.gate_status, 'blocked', 'C4-plan: gate should be blocked');
  assert.ok(
    planResult.unsatisfied_items.includes(CONSTANTS.ITEM_1_ID),
    'C4-plan: unsatisfied_items should include the failed item'
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// FAMILY D — Authorized Positive Control
// DEMO-HC01 requirement 2: A fully correct, fully authorized two-item plan
// with both attempts matching and passed must return CLEAR.
// ══════════════════════════════════════════════════════════════════════════════

test('D1: fully valid two-item plan, both attempts passed → CLEAR', async () => {
  // Hypothesis: valid plan + valid authorization + two matching passed attempts → CLEAR.
  const result = evaluatePlanReadiness(VALID_PLAN, [VALID_ATTEMPT_1, VALID_ATTEMPT_2]);
  assert.equal(result.gate_status, 'clear', 'D1: gate_status must be clear');
  assert.equal(result.required_count, 2, 'D1: required_count must be 2');
  assert.equal(result.satisfied_count, 2, 'D1: satisfied_count must be 2');
  assert.equal(result.unsatisfied_items.length, 0, 'D1: no unsatisfied items');
});

test('D2: same valid plan, different attempt_id — satisfaction not keyed to attempt identity', async () => {
  // Hypothesis: changing attempt_id (but keeping everything else correct) should still CLEAR.
  // This proves the positive control isn't fragile / hardcoded to specific attempt IDs.
  const altAttempt1 = attemptWithDifferentId(1, 'ABHITEK-02-ALT-ATTEMPT-1');
  const altAttempt2 = attemptWithDifferentId(2, 'ABHITEK-02-ALT-ATTEMPT-2');
  const result = evaluatePlanReadiness(VALID_PLAN, [altAttempt1, altAttempt2]);
  assert.equal(result.gate_status, 'clear', 'D2: gate_status must be clear');
  assert.equal(result.satisfied_count, 2, 'D2: satisfied_count must be 2');
});

// ══════════════════════════════════════════════════════════════════════════════
// FAMILY E — Ambiguous / Escalated (ARCH DECISION REQUIRED)
// Cases where expected behavior is not clearly specified by the contract.
// These are observational — they record actual behavior without asserting
// pass/fail on the gate outcome.
// ══════════════════════════════════════════════════════════════════════════════

test('E1 [OBSERVATIONAL]: authorized_by is zero-width space ("\\u200B") — behavior recorded', async () => {
  // Observation: \u200B (zero-width space) is NOT classified as Unicode White_Space.
  // JS .trim() does NOT remove it → "\u200B".trim() === "\u200B" (non-empty).
  // So typeof === 'string' (true) && .trim() !== '' (true) → auth check passes.
  //
  // The contract says "whitespace-only" should block. Whether zero-width space
  // counts as "whitespace" is a policy question the contract doesn't answer.
  //
  // This test records actual behavior without asserting correctness.
  const plan = planWithAuth('\u200B');
  let result;
  let threw = false;
  try {
    result = evaluatePlanReadiness(plan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2]);
  } catch (e) {
    threw = true;
  }
  // Record observation (the test itself always passes — it's observational)
  console.log(`E1 OBSERVATION: threw=${threw}, gate_status=${result?.gate_status}`);
  assert.equal(threw, false, 'E1: must not throw regardless of policy decision');
});

// ══════════════════════════════════════════════════════════════════════════════
// FAMILY F — Aggressive Edge Cases
// These go beyond the basic four families to stress-test boundaries the
// contract implies but doesn't explicitly enumerate.
// ══════════════════════════════════════════════════════════════════════════════

// ── F1–F4: Non-passed execution states must NEVER satisfy a plan item ─────
// The contract says "matching passed attempts" — only 'passed' should work.

test('F1: execution_state "failed" must not satisfy a plan item', async () => {
  const failedAttempt = attemptWith(1, { execution_state: 'failed' });
  const itemResult = checkAttemptSatisfiesPlanItem(
    VALID_PLAN, VALID_PLAN.required_probes[0], failedAttempt
  );
  assert.equal(itemResult.satisfied, false, 'F1: failed attempt must not satisfy');

  const planResult = evaluatePlanReadiness(VALID_PLAN, [failedAttempt, VALID_ATTEMPT_2]);
  assert.equal(planResult.gate_status, 'blocked', 'F1: plan must be blocked');
});

test('F2: execution_state "error" must not satisfy a plan item', async () => {
  const errorAttempt = attemptWith(1, { execution_state: 'error' });
  const itemResult = checkAttemptSatisfiesPlanItem(
    VALID_PLAN, VALID_PLAN.required_probes[0], errorAttempt
  );
  assert.equal(itemResult.satisfied, false, 'F2: error attempt must not satisfy');

  const planResult = evaluatePlanReadiness(VALID_PLAN, [errorAttempt, VALID_ATTEMPT_2]);
  assert.equal(planResult.gate_status, 'blocked', 'F2: plan must be blocked');
});

test('F3: execution_state "inconclusive" must not satisfy a plan item', async () => {
  const inconclusiveAttempt = attemptWith(1, { execution_state: 'inconclusive' });
  const itemResult = checkAttemptSatisfiesPlanItem(
    VALID_PLAN, VALID_PLAN.required_probes[0], inconclusiveAttempt
  );
  assert.equal(itemResult.satisfied, false, 'F3: inconclusive attempt must not satisfy');

  const planResult = evaluatePlanReadiness(VALID_PLAN, [inconclusiveAttempt, VALID_ATTEMPT_2]);
  assert.equal(planResult.gate_status, 'blocked', 'F3: plan must be blocked');
});

test('F4: execution_state "unsupported" must not satisfy a plan item', async () => {
  const unsupportedAttempt = attemptWith(1, { execution_state: 'unsupported' });
  const itemResult = checkAttemptSatisfiesPlanItem(
    VALID_PLAN, VALID_PLAN.required_probes[0], unsupportedAttempt
  );
  assert.equal(itemResult.satisfied, false, 'F4: unsupported attempt must not satisfy');

  const planResult = evaluatePlanReadiness(VALID_PLAN, [unsupportedAttempt, VALID_ATTEMPT_2]);
  assert.equal(planResult.gate_status, 'blocked', 'F4: plan must be blocked');
});

// ── F5: Cross-item swap — attempt_1's hash on attempt_2 and vice versa ────

test('F5: cross-item swap — swapped probe_definition_hash between items → both BLOCKED', async () => {
  // Hypothesis: give attempt_1 the hash that belongs to item_2 and vice versa.
  // Both should fail because each attempt's probe_definition_hash won't match
  // the plan item it claims to satisfy.
  const swapped1 = attemptWith(1, { probe_definition_hash: CONSTANTS.PROBE_2_HASH });
  const swapped2 = attemptWith(2, { probe_definition_hash: CONSTANTS.PROBE_1_HASH });

  const planResult = evaluatePlanReadiness(VALID_PLAN, [swapped1, swapped2]);
  assert.equal(planResult.gate_status, 'blocked', 'F5: swapped hashes must block');
  assert.equal(planResult.unsatisfied_items.length, 2, 'F5: both items unsatisfied');
});

// ── F6: One item satisfied, one completely missing ────────────────────────

test('F6: only one of two required items has an attempt → BLOCKED', async () => {
  // Hypothesis: providing attempt only for item_1, nothing for item_2.
  // The gate must not clear with partial coverage.
  const planResult = evaluatePlanReadiness(VALID_PLAN, [VALID_ATTEMPT_1]);
  assert.equal(planResult.gate_status, 'blocked', 'F6: partial coverage must block');
  assert.equal(planResult.satisfied_count, 1, 'F6: only 1 satisfied');
  assert.equal(planResult.required_count, 2, 'F6: 2 required');
  assert.ok(
    planResult.unsatisfied_items.includes(CONSTANTS.ITEM_2_ID),
    'F6: item_2 should be in unsatisfied list'
  );
});

// ── F7: Duplicate attempt — same attempt submitted twice for different items ─

test('F7: same attempt submitted twice cannot satisfy two different items', async () => {
  // Hypothesis: attempt_1 is bound to item_1. Submitting it twice should NOT
  // make it also satisfy item_2 (different plan_item_id).
  const planResult = evaluatePlanReadiness(VALID_PLAN, [VALID_ATTEMPT_1, VALID_ATTEMPT_1]);
  assert.equal(planResult.gate_status, 'blocked', 'F7: duplicate attempt must not satisfy two items');
  assert.ok(
    planResult.unsatisfied_items.includes(CONSTANTS.ITEM_2_ID),
    'F7: item_2 should remain unsatisfied'
  );
});

// ── F8: authorized_by as falsy number 0 ──────────────────────────────────

test('F8: authorized_by is falsy number (0) → BLOCKED, no throw', async () => {
  // Hypothesis: 0 is falsy AND not a string → typeof check fails → BLOCKED.
  // This is distinct from A3 (42) because 0 is falsy in JS — a naive
  // `if (!plan.authorized_by)` check would catch 0 but for the wrong reason.
  const plan = planWithAuth(0);
  assertBlockedNoThrow(plan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2], 'F8');
});

// ── F9: Prototype inheritance / own-property authorization enforcement ─────
// DEMO-CONTRACT-01-v2 / DEMO-HC01-F9 (LDR approved 2026-09-26)

test('F9: prototype chain inheritance of authorized_by must be BLOCKED (own-property enforcement)', async () => {
  const proto = { authorized_by: 'INJECTED-VIA-PROTOTYPE' };

  // 1. Preserve an own-property authorized positive control:
  // Assert that the otherwise identical plan with its own authorization clears.
  const ownAuthPlan = Object.create(proto);
  Object.assign(ownAuthPlan, VALID_PLAN);
  ownAuthPlan.authorized_by = 'ABHITEK-02-AUTHORITY';

  // Verify own-property presence explicitly:
  assert.strictEqual(
    Object.hasOwn(ownAuthPlan, 'authorized_by'),
    true,
    'F9 positive control: authorized_by must be an own property'
  );
  let controlResult;
  assert.doesNotThrow(() => {
    controlResult = evaluatePlanReadiness(ownAuthPlan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2]);
  }, 'F9 positive control: must not throw');
  assert.strictEqual(
    controlResult?.gate_status,
    'clear',
    'F9 positive control: own-property authorized_by must produce gate_status: "clear"'
  );

  // 2. Stimulus: plan with authorization ONLY on prototype:
  const plan = Object.create(proto);
  Object.assign(plan, VALID_PLAN);
  delete plan.authorized_by; // ensure absent from own properties

  // Verify own-property absence explicitly:
  assert.strictEqual(
    Object.hasOwn(plan, 'authorized_by'),
    false,
    'F9 stimulus precondition: authorized_by must NOT be an own property'
  );
  assert.strictEqual(
    'authorized_by' in plan,
    true,
    'F9 stimulus precondition: authorized_by must be inherited from prototype'
  );
  assert.strictEqual(
    plan.authorized_by,
    'INJECTED-VIA-PROTOTYPE',
    'F9 stimulus precondition: prototype value must resolve on property access'
  );

  // 3. Behavioral assertion: prototype-only authorization blocks without throwing.
  // Under DEMO-CONTRACT-01-v2, evaluatePlanReadiness must return blocked.
  let result;
  assert.doesNotThrow(() => {
    result = evaluatePlanReadiness(plan, [VALID_ATTEMPT_1, VALID_ATTEMPT_2]);
  }, 'F9: must not throw an uncontrolled exception');

  assert.strictEqual(
    result?.gate_status,
    'blocked',
    'F9: prototype-inherited authorized_by must produce gate_status: "blocked"'
  );
});
