/**
 * HC-B01 — Runtime schema validation for HC-B01 identity objects.
 *
 * Validates external objects against the normative schemas without any
 * external JSON-schema library dependency (Node stdlib only).
 *
 * Validation principle:
 *   - A missing required field is always a hard error.
 *   - No implicit default may add approval, applicability, or success.
 *   - Proof of conformance: valid fixtures validate; malformed/identity-
 *     incomplete fixtures throw with a descriptive error.
 *
 * Schema sources: schemas/*.schema.json (normative)
 * Type sources:   src/hc-schemas.ts (mechanically consistent)
 */

import type {
  DomainProbeProfile,
  ProbeDefinitionRecord,
  EvaluationPlan,
  PlanItem,
  ExecutionAttempt,
  ActionRecord,
  ReviewAttestation,
  GateDecision,
  CoverageSummary,
  BUILDReturn,
} from './hc-schemas.ts';

// ---------------------------------------------------------------------------
// Primitive validators
// ---------------------------------------------------------------------------

const ID_RE = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/;
const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function assertPresent(v: unknown, path: string): void {
  if (v === undefined || v === null) throw new ValidationError(`HC_MISSING_FIELD: ${path} is required`);
}

function assertString(v: unknown, path: string): asserts v is string {
  assertPresent(v, path);
  if (typeof v !== 'string') throw new ValidationError(`HC_TYPE_ERROR: ${path} must be a string`);
}

function assertId(v: unknown, path: string): asserts v is string {
  assertString(v, path);
  if (!ID_RE.test(v)) throw new ValidationError(`HC_INVALID_ID: ${path} must match machine-id pattern`);
}

function assertHash(v: unknown, path: string): asserts v is string {
  assertString(v, path);
  if (!HASH_RE.test(v)) throw new ValidationError(`HC_INVALID_HASH: ${path} must be sha256:<64-hex>`);
}

function assertTimestamp(v: unknown, path: string): asserts v is string {
  assertString(v, path);
  if (!TIME_RE.test(v)) throw new ValidationError(`HC_INVALID_TIMESTAMP: ${path} must start with ISO-8601 datetime`);
}

function assertNonEmpty(v: unknown, path: string): asserts v is string {
  assertString(v, path);
  if (v.length === 0) throw new ValidationError(`HC_EMPTY_FIELD: ${path} must not be empty`);
}

function assertEnum<T extends string>(v: unknown, path: string, values: readonly T[]): asserts v is T {
  assertString(v, path);
  if (!values.includes(v as T)) throw new ValidationError(`HC_INVALID_ENUM: ${path} must be one of [${values.join(', ')}]; got '${v}'`);
}

function assertInteger(v: unknown, path: string, min: number): asserts v is number {
  assertPresent(v, path);
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min) throw new ValidationError(`HC_INVALID_INTEGER: ${path} must be an integer >= ${min}`);
}

function assertArray(v: unknown, path: string): asserts v is unknown[] {
  assertPresent(v, path);
  if (!Array.isArray(v)) throw new ValidationError(`HC_TYPE_ERROR: ${path} must be an array`);
}

/**
 * Rejects any property key present in obj that is not in allowed.
 * Enforces schema `additionalProperties: false` at runtime.
 */
function assertNoExtraProperties(obj: Record<string, unknown>, allowed: readonly string[], context: string): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) throw new ValidationError(`HC_EXTRA_PROPERTY: '${key}' is not allowed on ${context}`);
  }
}

// ---------------------------------------------------------------------------
// ValidationError
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ---------------------------------------------------------------------------
// Exported allowed-key lists — consumed by both validators and schema-agreement tests.
//
// INVARIANT: each list is the single authoritative source for what properties
// a validator accepts. The schema files in schemas/ must declare exactly these
// keys under "properties". Tests in tests/hc-b01/schema-agreement.test.mjs
// import these constants and compare them against the schema files directly —
// this means runtime-validator drift is visible in the same test run as
// schema-file drift.
// ---------------------------------------------------------------------------

export const ALLOWED_KEYS_DOMAIN_PROBE_PROFILE = ['schema_version','profile_id','profile_version','profile_hash','tool_id','probe_library_version','description'] as const;
export const ALLOWED_KEYS_PROBE_DEFINITION = ['schema_version','probe_id','probe_version','probe_definition_hash','invariant_class','kind','label','description'] as const;
export const ALLOWED_KEYS_PLAN_ITEM = ['plan_item_id','probe_id','probe_definition_hash','rationale'] as const;
export const ALLOWED_KEYS_EVALUATION_PLAN = ['schema_version','plan_id','plan_version','plan_hash','target_tool_id','target_build_id','profile_id','profile_hash','probe_library_version','required_probes','authorized_by','authorized_at','description'] as const;
export const ALLOWED_KEYS_EXECUTION_ATTEMPT = ['schema_version','attempt_id','plan_id','plan_hash','plan_item_id','probe_id','probe_definition_hash','target_tool_id','target_build_id','execution_record_ref','execution_state','attempted_at'] as const;
export const ALLOWED_KEYS_ACTION_RECORD = ['schema_version','action_id','plan_id','plan_hash','attempt_id','action_type','actor','performed_at','notes'] as const;
export const ALLOWED_KEYS_REVIEW_ATTESTATION = ['schema_version','attestation_id','plan_id','plan_hash','plan_item_id','probe_definition_hash','target_build_id','reviewer_id','attestation_type','attested_at','notes'] as const;
export const ALLOWED_KEYS_GATE_DECISION = ['schema_version','decision_id','plan_id','plan_hash','target_tool_id','target_build_id','decided_by','decided_at','gate_status','coverage_summary','notes'] as const;
export const ALLOWED_KEYS_COVERAGE_SUMMARY = ['required_count','satisfied_count','unsatisfied_items'] as const;
export const ALLOWED_KEYS_BUILD_RETURN = ['schema_version','return_id','plan_id','plan_hash','target_tool_id','target_build_id','build_authority_id','determination','determined_at','evidence_package_ref','limitations','notes'] as const;

// ---------------------------------------------------------------------------
// Object validators
// ---------------------------------------------------------------------------

/**
 * Validates a DomainProbeProfile against contradictor.domain-probe-profile.v1.
 * Throws ValidationError on any violation.
 */
export function validateDomainProbeProfile(obj: unknown): asserts obj is DomainProbeProfile {
  if (!isObj(obj)) throw new ValidationError('HC_TYPE_ERROR: DomainProbeProfile must be an object');
  assertNoExtraProperties(obj, ALLOWED_KEYS_DOMAIN_PROBE_PROFILE, 'DomainProbeProfile');
  assertPresent(obj['schema_version'], 'schema_version');
  if (obj['schema_version'] !== 'contradictor.domain-probe-profile.v1')
    throw new ValidationError(`HC_SCHEMA_MISMATCH: expected schema_version 'contradictor.domain-probe-profile.v1'`);
  assertId(obj['profile_id'], 'profile_id');
  assertNonEmpty(obj['profile_version'], 'profile_version');
  assertHash(obj['profile_hash'], 'profile_hash');
  assertId(obj['tool_id'], 'tool_id');
  assertNonEmpty(obj['probe_library_version'], 'probe_library_version');
}

/**
 * Validates a ProbeDefinitionRecord against contradictor.probe-definition.v1.
 * Throws ValidationError on any violation.
 */
export function validateProbeDefinitionRecord(obj: unknown): asserts obj is ProbeDefinitionRecord {
  if (!isObj(obj)) throw new ValidationError('HC_TYPE_ERROR: ProbeDefinitionRecord must be an object');
  assertNoExtraProperties(obj, ALLOWED_KEYS_PROBE_DEFINITION, 'ProbeDefinitionRecord');
  assertPresent(obj['schema_version'], 'schema_version');
  if (obj['schema_version'] !== 'contradictor.probe-definition.v1')
    throw new ValidationError(`HC_SCHEMA_MISMATCH: expected schema_version 'contradictor.probe-definition.v1'`);
  assertId(obj['probe_id'], 'probe_id');
  assertNonEmpty(obj['probe_version'], 'probe_version');
  assertHash(obj['probe_definition_hash'], 'probe_definition_hash');
  assertNonEmpty(obj['invariant_class'], 'invariant_class');
  assertEnum(obj['kind'], 'kind', ['input-relation', 'categorical', 'action-sequence', 'cross-surface'] as const);
}

/**
 * Validates a PlanItem (used inside EvaluationPlan).
 * plan_item_id + probe_definition_hash are the authoritative identity anchors.
 */
function validatePlanItem(obj: unknown, path: string): asserts obj is PlanItem {
  if (!isObj(obj)) throw new ValidationError(`HC_TYPE_ERROR: ${path} must be an object`);
  assertNoExtraProperties(obj, ALLOWED_KEYS_PLAN_ITEM, path);
  assertId(obj['plan_item_id'], `${path}.plan_item_id`);
  assertId(obj['probe_id'], `${path}.probe_id`);
  assertHash(obj['probe_definition_hash'], `${path}.probe_definition_hash`);
}

/**
 * Validates an EvaluationPlan against contradictor.evaluation-plan.v1.
 *
 * Key checks beyond schema structure:
 * - required_probes must be nonempty (missing plan context blocks readiness)
 * - authorized_by must be nonempty (missing authorization is not silently approved)
 * - Every plan item must have stable plan_item_id + probe_definition_hash
 *
 * Throws ValidationError on any violation.
 */
export function validateEvaluationPlan(obj: unknown): asserts obj is EvaluationPlan {
  if (!isObj(obj)) throw new ValidationError('HC_TYPE_ERROR: EvaluationPlan must be an object');
  assertNoExtraProperties(obj, ALLOWED_KEYS_EVALUATION_PLAN, 'EvaluationPlan');
  assertPresent(obj['schema_version'], 'schema_version');
  if (obj['schema_version'] !== 'contradictor.evaluation-plan.v1')
    throw new ValidationError(`HC_SCHEMA_MISMATCH: expected schema_version 'contradictor.evaluation-plan.v1'`);
  assertId(obj['plan_id'], 'plan_id');
  assertNonEmpty(obj['plan_version'], 'plan_version');
  assertHash(obj['plan_hash'], 'plan_hash');
  assertId(obj['target_tool_id'], 'target_tool_id');
  assertId(obj['target_build_id'], 'target_build_id');
  assertId(obj['profile_id'], 'profile_id');
  assertHash(obj['profile_hash'], 'profile_hash');
  assertNonEmpty(obj['probe_library_version'], 'probe_library_version');
  // HC-001 foundation: required_probes must be nonempty
  assertArray(obj['required_probes'], 'required_probes');
  if ((obj['required_probes'] as unknown[]).length === 0)
    throw new ValidationError('HC_EMPTY_REQUIRED_PROBES: required_probes must be nonempty — missing plan context blocks readiness');
  for (let i = 0; i < (obj['required_probes'] as unknown[]).length; i++) {
    validatePlanItem((obj['required_probes'] as unknown[])[i], `required_probes[${i}]`);
  }
  // HC-001 / HC-B01-G: authorized_by must be present and nonempty
  assertNonEmpty(obj['authorized_by'], 'authorized_by');
  assertTimestamp(obj['authorized_at'], 'authorized_at');
}

/**
 * Validates an ExecutionAttempt against contradictor.execution-attempt.v1.
 * probe_definition_hash must match the plan_item's hash to satisfy the plan item.
 * target_build_id must match the plan's target_build_id.
 * Throws ValidationError on any violation.
 */
export function validateExecutionAttempt(obj: unknown): asserts obj is ExecutionAttempt {
  if (!isObj(obj)) throw new ValidationError('HC_TYPE_ERROR: ExecutionAttempt must be an object');
  assertNoExtraProperties(obj, ALLOWED_KEYS_EXECUTION_ATTEMPT, 'ExecutionAttempt');
  assertPresent(obj['schema_version'], 'schema_version');
  if (obj['schema_version'] !== 'contradictor.execution-attempt.v1')
    throw new ValidationError(`HC_SCHEMA_MISMATCH: expected schema_version 'contradictor.execution-attempt.v1'`);
  assertId(obj['attempt_id'], 'attempt_id');
  assertId(obj['plan_id'], 'plan_id');
  assertHash(obj['plan_hash'], 'plan_hash');
  assertId(obj['plan_item_id'], 'plan_item_id');
  assertId(obj['probe_id'], 'probe_id');
  assertHash(obj['probe_definition_hash'], 'probe_definition_hash');
  assertId(obj['target_tool_id'], 'target_tool_id');
  assertId(obj['target_build_id'], 'target_build_id');
  assertHash(obj['execution_record_ref'], 'execution_record_ref');
  assertEnum(obj['execution_state'], 'execution_state',
    ['passed', 'failed', 'inconclusive', 'unsupported', 'error'] as const);
  assertTimestamp(obj['attempted_at'], 'attempted_at');
}

/**
 * Validates an ActionRecord against contradictor.action-record.v1.
 * Scope exclusions do not count as passing executions.
 */
export function validateActionRecord(obj: unknown): asserts obj is ActionRecord {
  if (!isObj(obj)) throw new ValidationError('HC_TYPE_ERROR: ActionRecord must be an object');
  assertNoExtraProperties(obj, ALLOWED_KEYS_ACTION_RECORD, 'ActionRecord');
  assertPresent(obj['schema_version'], 'schema_version');
  if (obj['schema_version'] !== 'contradictor.action-record.v1')
    throw new ValidationError(`HC_SCHEMA_MISMATCH: expected schema_version 'contradictor.action-record.v1'`);
  assertId(obj['action_id'], 'action_id');
  assertId(obj['plan_id'], 'plan_id');
  assertHash(obj['plan_hash'], 'plan_hash');
  assertId(obj['attempt_id'], 'attempt_id');
  assertEnum(obj['action_type'], 'action_type',
    ['probe_execution', 'review_requested', 'review_submitted', 'scope_exclusion', 'escalation'] as const);
  assertNonEmpty(obj['actor'], 'actor');
  assertTimestamp(obj['performed_at'], 'performed_at');
}

/**
 * Validates a ReviewAttestation against contradictor.review-attestation.v1.
 * reviewer_id must not be empty — fabricated reviewer identity is rejected.
 * attestation_type must be explicit — no implicit default adds approval.
 */
export function validateReviewAttestation(obj: unknown): asserts obj is ReviewAttestation {
  if (!isObj(obj)) throw new ValidationError('HC_TYPE_ERROR: ReviewAttestation must be an object');
  assertNoExtraProperties(obj, ALLOWED_KEYS_REVIEW_ATTESTATION, 'ReviewAttestation');
  assertPresent(obj['schema_version'], 'schema_version');
  if (obj['schema_version'] !== 'contradictor.review-attestation.v1')
    throw new ValidationError(`HC_SCHEMA_MISMATCH: expected schema_version 'contradictor.review-attestation.v1'`);
  assertId(obj['attestation_id'], 'attestation_id');
  assertId(obj['plan_id'], 'plan_id');
  assertHash(obj['plan_hash'], 'plan_hash');
  assertId(obj['plan_item_id'], 'plan_item_id');
  assertHash(obj['probe_definition_hash'], 'probe_definition_hash');
  assertId(obj['target_build_id'], 'target_build_id');
  assertNonEmpty(obj['reviewer_id'], 'reviewer_id');
  assertEnum(obj['attestation_type'], 'attestation_type',
    ['confirmed', 'rejected', 'inconclusive', 'deferred'] as const);
  assertTimestamp(obj['attested_at'], 'attested_at');
}

function validateCoverageSummary(obj: unknown, path: string): asserts obj is CoverageSummary {
  if (!isObj(obj)) throw new ValidationError(`HC_TYPE_ERROR: ${path} must be an object`);
  assertNoExtraProperties(obj, ALLOWED_KEYS_COVERAGE_SUMMARY, path);
  assertInteger(obj['required_count'], `${path}.required_count`, 1);
  assertInteger(obj['satisfied_count'], `${path}.satisfied_count`, 0);
  assertArray(obj['unsatisfied_items'], `${path}.unsatisfied_items`);
}

/**
 * Validates a GateDecision against contradictor.gate-decision.v1.
 * gate_status must be explicit — no implicit default produces 'clear'.
 * decided_by must not be empty.
 * coverage_summary.required_count must be >= 1.
 */
export function validateGateDecision(obj: unknown): asserts obj is GateDecision {
  if (!isObj(obj)) throw new ValidationError('HC_TYPE_ERROR: GateDecision must be an object');
  assertNoExtraProperties(obj, ALLOWED_KEYS_GATE_DECISION, 'GateDecision');
  assertPresent(obj['schema_version'], 'schema_version');
  if (obj['schema_version'] !== 'contradictor.gate-decision.v1')
    throw new ValidationError(`HC_SCHEMA_MISMATCH: expected schema_version 'contradictor.gate-decision.v1'`);
  assertId(obj['decision_id'], 'decision_id');
  assertId(obj['plan_id'], 'plan_id');
  assertHash(obj['plan_hash'], 'plan_hash');
  assertId(obj['target_tool_id'], 'target_tool_id');
  assertId(obj['target_build_id'], 'target_build_id');
  assertNonEmpty(obj['decided_by'], 'decided_by');
  assertTimestamp(obj['decided_at'], 'decided_at');
  assertEnum(obj['gate_status'], 'gate_status', ['clear', 'blocked', 'inconclusive', 'not_run'] as const);
  validateCoverageSummary(obj['coverage_summary'], 'coverage_summary');
}

/**
 * Validates a BUILDReturn against contradictor.build-return.v1.
 * build_authority_id must not be empty — fabricated authority identity is rejected.
 * determination must be explicit — no implicit default produces 'accepted'.
 */
export function validateBUILDReturn(obj: unknown): asserts obj is BUILDReturn {
  if (!isObj(obj)) throw new ValidationError('HC_TYPE_ERROR: BUILDReturn must be an object');
  assertNoExtraProperties(obj, ALLOWED_KEYS_BUILD_RETURN, 'BUILDReturn');
  assertPresent(obj['schema_version'], 'schema_version');
  if (obj['schema_version'] !== 'contradictor.build-return.v1')
    throw new ValidationError(`HC_SCHEMA_MISMATCH: expected schema_version 'contradictor.build-return.v1'`);
  assertId(obj['return_id'], 'return_id');
  assertId(obj['plan_id'], 'plan_id');
  assertHash(obj['plan_hash'], 'plan_hash');
  assertId(obj['target_tool_id'], 'target_tool_id');
  assertId(obj['target_build_id'], 'target_build_id');
  assertNonEmpty(obj['build_authority_id'], 'build_authority_id');
  assertEnum(obj['determination'], 'determination', ['accepted', 'rejected', 'blocked', 'inconclusive'] as const);
  assertTimestamp(obj['determined_at'], 'determined_at');
  assertHash(obj['evidence_package_ref'], 'evidence_package_ref');
}

// ---------------------------------------------------------------------------
// Plan-satisfaction checker — HC-B01 gate logic
// ---------------------------------------------------------------------------

/** Outcome of checking whether an execution attempt satisfies a plan item. */
export type SatisfactionResult =
  | { satisfied: true; plan_item_id: string }
  | { satisfied: false; plan_item_id: string; reason: string };

/**
 * Checks whether a validated ExecutionAttempt satisfies a specific PlanItem
 * in a validated EvaluationPlan.
 *
 * HC-002 enforcement: probe identity is validated via probe_definition_hash,
 * not presentation row text or label.
 *
 * HC-003 enforcement: target_build_id must match plan's target_build_id exactly.
 */
export function checkAttemptSatisfiesPlanItem(
  plan: EvaluationPlan,
  item: PlanItem,
  attempt: ExecutionAttempt,
): SatisfactionResult {
  // HC-003: build identity must match exactly
  if (attempt.target_build_id !== plan.target_build_id) {
    return {
      satisfied: false,
      plan_item_id: item.plan_item_id,
      reason: `HC_003_BUILD_MISMATCH: attempt.target_build_id '${attempt.target_build_id}' does not match plan.target_build_id '${plan.target_build_id}'`,
    };
  }
  // plan binding check
  if (attempt.plan_id !== plan.plan_id || attempt.plan_hash !== plan.plan_hash) {
    return {
      satisfied: false,
      plan_item_id: item.plan_item_id,
      reason: `HC_001_PLAN_MISMATCH: attempt is not bound to this plan`,
    };
  }
  // plan_item_id check
  if (attempt.plan_item_id !== item.plan_item_id) {
    return {
      satisfied: false,
      plan_item_id: item.plan_item_id,
      reason: `HC_001_ITEM_MISMATCH: attempt.plan_item_id '${attempt.plan_item_id}' does not match required item '${item.plan_item_id}'`,
    };
  }
  // HC-002: probe identity via probe_definition_hash — not label
  if (attempt.probe_definition_hash !== item.probe_definition_hash) {
    return {
      satisfied: false,
      plan_item_id: item.plan_item_id,
      reason: `HC_002_PROBE_IDENTITY_MISMATCH: attempt.probe_definition_hash '${attempt.probe_definition_hash}' does not match required '${item.probe_definition_hash}'`,
    };
  }
  // only a passed execution satisfies a plan item
  if (attempt.execution_state !== 'passed') {
    return {
      satisfied: false,
      plan_item_id: item.plan_item_id,
      reason: `attempt execution_state is '${attempt.execution_state}', not 'passed'`,
    };
  }
  return { satisfied: true, plan_item_id: item.plan_item_id };
}

/**
 * Evaluates whether all required plan items have been satisfied.
 *
 * HC-001: requires a complete approved plan — missing plan context blocks readiness.
 * HC-002: probe identity is probe_definition_hash, not presentation label.
 * HC-003: build identity must match exactly for every attempt.
 *
 * Returns a GateDecision-compatible summary. Never produces 'clear' unless all
 * required items are satisfied by matching attempts.
 */
export interface PlanReadinessResult {
  /** 'clear' only when all required items are satisfied. */
  gate_status: 'clear' | 'blocked' | 'inconclusive';
  required_count: number;
  satisfied_count: number;
  unsatisfied_items: string[];
  /** Per-item satisfaction detail. */
  details: SatisfactionResult[];
}

export function evaluatePlanReadiness(
  plan: EvaluationPlan,
  attempts: ExecutionAttempt[],
): PlanReadinessResult {
  // HC-001 / HC-B01-B: an empty required_probes list means the plan has no
  // approved required set — this must never produce 'clear'.
  if (plan.required_probes.length === 0) {
    return { gate_status: 'blocked', required_count: 0, satisfied_count: 0, unsatisfied_items: [], details: [] };
  }
  // HC-B01-G / HC-001 / DEMO-HC01-F9: authorization must be an own property.
  // An inherited prototype value cannot act as the plan's authorization.
  // Own-property presence is necessary but not sufficient — all existing
  // string/nonempty/whitespace/type checks still apply once presence is confirmed.
  // Cast to unknown before type checks to guard against callers that bypass
  // validateEvaluationPlan (e.g. passing null, a number, or a prototype value).
  // This does not grant approval authority — it checks for required evidence.
  const authBy: unknown = Object.hasOwn(plan, 'authorized_by')
    ? plan.authorized_by
    : undefined;
  if (typeof authBy !== 'string' || authBy.trim() === '') {
    return { gate_status: 'blocked', required_count: plan.required_probes.length, satisfied_count: 0, unsatisfied_items: plan.required_probes.map(i => i.plan_item_id), details: [] };
  }

  const details: SatisfactionResult[] = [];
  const unsatisfied: string[] = [];

  for (const item of plan.required_probes) {
    // Find the best matching attempt for this plan item
    const matching = attempts.filter(a => a.plan_item_id === item.plan_item_id);
    if (matching.length === 0) {
      details.push({
        satisfied: false,
        plan_item_id: item.plan_item_id,
        reason: 'no execution attempt found for this plan item',
      });
      unsatisfied.push(item.plan_item_id);
      continue;
    }
    // Check each matching attempt; accept first that satisfies
    let itemSatisfied = false;
    let lastResult: SatisfactionResult | undefined;
    for (const attempt of matching) {
      const result = checkAttemptSatisfiesPlanItem(plan, item, attempt);
      lastResult = result;
      if (result.satisfied) {
        details.push(result);
        itemSatisfied = true;
        break;
      }
    }
    if (!itemSatisfied) {
      details.push(lastResult!);
      unsatisfied.push(item.plan_item_id);
    }
  }

  const required_count = plan.required_probes.length;
  const satisfied_count = required_count - unsatisfied.length;
  const gate_status: PlanReadinessResult['gate_status'] =
    unsatisfied.length === 0 ? 'clear' : 'blocked';

  return { gate_status, required_count, satisfied_count, unsatisfied_items: unsatisfied, details };
}
