/**
 * HC-B01 — Schema-bound TypeScript types for Contradictor identity objects.
 *
 * These types derive from and must remain mechanically consistent with the
 * normative JSON schemas in schemas/. External objects entering the system
 * must be runtime-validated before use (see hc-validate.ts).
 *
 * FORBIDDEN GATE AUTHORITY INPUTS — these must not be used to derive identity:
 *   - presentation_rows
 *   - default_required_set
 *   - caller_supplied_build_label
 *
 * No implicit default may add approval, applicability, or success.
 */

// ---------------------------------------------------------------------------
// Shared primitive types
// ---------------------------------------------------------------------------

/** SHA-256 content hash in the format sha256:<64-hex-chars> */
export type SHA256Hash = `sha256:${string}`;

/** ISO-8601 timestamp prefix — must start with YYYY-MM-DDTHH:MM:SS */
export type ISOTimestamp = string;

/** Machine-safe identifier: ^[A-Za-z][A-Za-z0-9._:-]{0,127}$ */
export type MachineId = string;

// ---------------------------------------------------------------------------
// DomainProbeProfile
// schema: schemas/domain-probe-profile.schema.json
// $id: contradictor.domain-probe-profile.v1
// ---------------------------------------------------------------------------

/**
 * Identity and metadata for a domain-specific probe profile.
 * Profile name alone does not establish scope approval.
 */
export interface DomainProbeProfile {
  readonly schema_version: 'contradictor.domain-probe-profile.v1';
  /** Stable machine identifier for this profile. */
  readonly profile_id: MachineId;
  readonly profile_version: string;
  /** Content hash of the canonical form of this profile (excluding this field).
   *  Establishes immutable identity — not the profile name. */
  readonly profile_hash: SHA256Hash;
  readonly tool_id: MachineId;
  readonly probe_library_version: string;
  readonly description?: string;
}

// ---------------------------------------------------------------------------
// ProbeDefinition
// schema: schemas/probe-definition.schema.json
// $id: contradictor.probe-definition.v1
// ---------------------------------------------------------------------------

/**
 * Immutable identity record for a single probe.
 * probe_definition_hash is the authoritative identity anchor —
 * label and description are informational only.
 */
export interface ProbeDefinitionRecord {
  readonly schema_version: 'contradictor.probe-definition.v1';
  readonly probe_id: MachineId;
  readonly probe_version: string;
  /** Canonical hash of the probe definition body.
   *  This is the authoritative immutable identity — not the probe label or text. */
  readonly probe_definition_hash: SHA256Hash;
  readonly invariant_class: string;
  readonly kind: 'input-relation' | 'categorical' | 'action-sequence' | 'cross-surface';
  /** Human-readable label. Informational only — must not be used as identity. */
  readonly label?: string;
  readonly description?: string;
}

// ---------------------------------------------------------------------------
// EvaluationPlan + PlanItem
// schema: schemas/evaluation-plan.schema.json
// $id: contradictor.evaluation-plan.v1
// ---------------------------------------------------------------------------

/**
 * A PlanItem binds a required probe to its immutable definition identity.
 * plan_item_id is stable across plan versions.
 * probe_definition_hash anchors the exact probe version.
 *
 * Readiness must NOT be inferred from result rows — only from required_probes.
 */
export interface PlanItem {
  readonly plan_item_id: MachineId;
  readonly probe_id: MachineId;
  /** Authoritative probe identity. Not the probe label. */
  readonly probe_definition_hash: SHA256Hash;
  readonly rationale?: string;
}

/**
 * An approved EvaluationPlan binds a nonempty, explicitly enumerated
 * required probe set to stable plan-item identities.
 *
 * INVARIANTS:
 * - required_probes must be nonempty — an empty set means readiness cannot be determined.
 * - Required coverage comes from required_probes, NOT from result rows, default
 *   library lists, or presentation output.
 * - plan_id + plan_hash establish immutable plan identity.
 * - authorized_by must be nonempty — missing authorization is not silently approved.
 */
export interface EvaluationPlan {
  readonly schema_version: 'contradictor.evaluation-plan.v1';
  readonly plan_id: MachineId;
  readonly plan_version: string;
  /** Canonical hash of the plan body (excluding this field). Immutable plan identity. */
  readonly plan_hash: SHA256Hash;
  readonly target_tool_id: MachineId;
  /** Exact build identity this plan applies to.
   *  A mismatch between target_build_id and the build under test must block readiness. */
  readonly target_build_id: MachineId;
  readonly profile_id: MachineId;
  /** Hash of the DomainProbeProfile this plan was derived from. */
  readonly profile_hash: SHA256Hash;
  readonly probe_library_version: string;
  /**
   * Nonempty, explicitly enumerated list of required probes.
   * MUST NOT be empty. MUST NOT be inferred from result rows or defaults.
   */
  readonly required_probes: readonly PlanItem[];
  /** Must not be empty — missing authorization is not silently approved. */
  readonly authorized_by: string;
  readonly authorized_at: ISOTimestamp;
  readonly description?: string;
}

// ---------------------------------------------------------------------------
// ExecutionAttempt
// schema: schemas/execution-attempt.schema.json
// $id: contradictor.execution-attempt.v1
// ---------------------------------------------------------------------------

/**
 * Records an attempted execution of a plan item against a specific build.
 * Probe identity is established by plan_item_id + probe_definition_hash,
 * NOT by presentation row text or label.
 */
export interface ExecutionAttempt {
  readonly schema_version: 'contradictor.execution-attempt.v1';
  readonly attempt_id: MachineId;
  readonly plan_id: MachineId;
  /** Hash of the EvaluationPlan this attempt is bound to. */
  readonly plan_hash: SHA256Hash;
  /** Identifies the specific plan item this attempt satisfies. */
  readonly plan_item_id: MachineId;
  readonly probe_id: MachineId;
  /** The immutable probe identity. Must match the plan_item's probe_definition_hash. */
  readonly probe_definition_hash: SHA256Hash;
  readonly target_tool_id: MachineId;
  /** Must match the plan's target_build_id exactly. A mismatch blocks satisfaction. */
  readonly target_build_id: MachineId;
  /** record_hash of the ProbeExecutionRecord this attempt is grounded in. */
  readonly execution_record_ref: SHA256Hash;
  /** not_run is not valid — an attempt record implies execution was performed. */
  readonly execution_state: 'passed' | 'failed' | 'inconclusive' | 'unsupported' | 'error';
  readonly attempted_at: ISOTimestamp;
}

// ---------------------------------------------------------------------------
// ActionRecord
// schema: schemas/action-record.schema.json
// $id: contradictor.action-record.v1
// ---------------------------------------------------------------------------

/**
 * Records a discrete action taken during an evaluation session.
 * Scope exclusions do NOT count as passing executions.
 */
export interface ActionRecord {
  readonly schema_version: 'contradictor.action-record.v1';
  readonly action_id: MachineId;
  readonly plan_id: MachineId;
  readonly plan_hash: SHA256Hash;
  readonly attempt_id: MachineId;
  readonly action_type:
    | 'probe_execution'
    | 'review_requested'
    | 'review_submitted'
    | 'scope_exclusion'
    | 'escalation';
  readonly actor: string;
  readonly performed_at: ISOTimestamp;
  readonly notes?: string;
}

// ---------------------------------------------------------------------------
// ReviewAttestation
// schema: schemas/review-attestation.schema.json
// $id: contradictor.review-attestation.v1
// ---------------------------------------------------------------------------

/**
 * A human reviewer's attestation for a specific plan item execution.
 * attestation_type must be an explicit determination — missing or defaulted
 * approval is not valid. Fabricated reviewer identity is prohibited.
 */
export interface ReviewAttestation {
  readonly schema_version: 'contradictor.review-attestation.v1';
  readonly attestation_id: MachineId;
  readonly plan_id: MachineId;
  readonly plan_hash: SHA256Hash;
  readonly plan_item_id: MachineId;
  /** Must match the plan item's probe_definition_hash. */
  readonly probe_definition_hash: SHA256Hash;
  /** Must match the plan's target_build_id. */
  readonly target_build_id: MachineId;
  /** Must not be empty. Fabricated or defaulted reviewer identity is not valid. */
  readonly reviewer_id: string;
  /** Explicit determination. No implicit default may add approval or success. */
  readonly attestation_type: 'confirmed' | 'rejected' | 'inconclusive' | 'deferred';
  readonly attested_at: ISOTimestamp;
  readonly notes?: string;
}

// ---------------------------------------------------------------------------
// GateDecision
// schema: schemas/gate-decision.schema.json
// $id: contradictor.gate-decision.v1
// ---------------------------------------------------------------------------

/** Coverage data for a gate decision. */
export interface CoverageSummary {
  /** Total required probes per the approved plan. Must be at least 1. */
  readonly required_count: number;
  readonly satisfied_count: number;
  /** plan_item_ids that have not been satisfied. */
  readonly unsatisfied_items: readonly MachineId[];
}

/**
 * A gate decision records whether a build cleared a specific evaluation plan gate.
 * Bound to an exact plan_hash and target_build_id — neither can be substituted.
 * Missing approved plan → status must be 'blocked' or 'inconclusive', never 'clear'.
 * Exporters/reports cannot confer gate clearance.
 */
export interface GateDecision {
  readonly schema_version: 'contradictor.gate-decision.v1';
  readonly decision_id: MachineId;
  readonly plan_id: MachineId;
  /** Immutable plan identity this decision is bound to. */
  readonly plan_hash: SHA256Hash;
  readonly target_tool_id: MachineId;
  /** Exact build identity. A gate decision for build A cannot clear build B. */
  readonly target_build_id: MachineId;
  /** Must not be fabricated or defaulted. */
  readonly decided_by: string;
  readonly decided_at: ISOTimestamp;
  /**
   * No implicit default may produce 'clear'.
   * Missing plan or build mismatch must produce 'blocked' or 'inconclusive'.
   */
  readonly gate_status: 'clear' | 'blocked' | 'inconclusive' | 'not_run';
  readonly coverage_summary: CoverageSummary;
  readonly notes?: string;
}

// ---------------------------------------------------------------------------
// BUILDReturn
// schema: schemas/build-return.schema.json
// $id: contradictor.build-return.v1
// ---------------------------------------------------------------------------

/**
 * The independent BUILD acceptance determination for a completed evidence package.
 * Only the assigned BUILD authority produces this.
 * Bob/implementation actors must NOT fabricate or self-issue a BUILDReturn.
 * determination must be explicit — no implicit default may produce 'accepted'.
 */
export interface BUILDReturn {
  readonly schema_version: 'contradictor.build-return.v1';
  readonly return_id: MachineId;
  readonly plan_id: MachineId;
  /** Immutable plan identity this return is bound to. */
  readonly plan_hash: SHA256Hash;
  readonly target_tool_id: MachineId;
  /** Exact build identity. Cannot be substituted. */
  readonly target_build_id: MachineId;
  /** Identity of the independent BUILD authority. Must not be fabricated or defaulted. */
  readonly build_authority_id: string;
  /**
   * Explicit determination. No implicit default may produce 'accepted'.
   * Implementation actors must not self-issue.
   */
  readonly determination: 'accepted' | 'rejected' | 'blocked' | 'inconclusive';
  readonly determined_at: ISOTimestamp;
  /** Hash reference to the evidence package this determination is based on. */
  readonly evidence_package_ref: SHA256Hash;
  readonly limitations?: readonly string[];
  readonly notes?: string;
}
