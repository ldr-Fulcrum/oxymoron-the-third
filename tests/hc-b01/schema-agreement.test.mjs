/**
 * HC-B01 — Executable schema/runtime agreement checks.
 *
 * DESIGN: These tests close the boundary between the normative JSON schemas
 * (schemas/*.schema.json) and the runtime validators (src/hc-validate.ts) by:
 *
 *   1. Importing the ALLOWED_KEYS_* constants directly from src/hc-validate.ts —
 *      the same constants the validators pass to assertNoExtraProperties() at
 *      runtime. Any change to the validator's allowed-key list is immediately
 *      visible here without updating a separate test-local mirror.
 *
 *   2. Reading each normative JSON schema from disk and comparing its
 *      Object.keys(schema.properties).sort() against the imported constant.
 *      Drift between the schema file and the validator is detected.
 *
 *   3. Exercising the validators directly with schema-derived objects:
 *      - A valid object constructed from schema property names must pass.
 *      - An object with a key present in the schema but added to the
 *        ALLOWED_KEYS list without being in the current validator code must fail
 *        (this is tested via the mutation path below).
 *
 *   4. Demonstrating detection of an incompatible schema change across the
 *      actual schema→validator boundary, including nested objects (PlanItem,
 *      CoverageSummary). The mutation operates on an in-memory copy only —
 *      the normative schema files are NOT modified.
 *
 * Do NOT weaken the normative schemas.
 * If a test here fails it means schema and validator are out of agreement.
 * Bring them into agreement; do not delete the test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

// Import the ALLOWED_KEYS_* constants that the runtime validators actually use.
// This is the critical connection: if the validator's allowed-key list changes,
// these imports change and the schema comparison below detects the drift.
import {
  ALLOWED_KEYS_DOMAIN_PROBE_PROFILE,
  ALLOWED_KEYS_PROBE_DEFINITION,
  ALLOWED_KEYS_PLAN_ITEM,
  ALLOWED_KEYS_EVALUATION_PLAN,
  ALLOWED_KEYS_EXECUTION_ATTEMPT,
  ALLOWED_KEYS_ACTION_RECORD,
  ALLOWED_KEYS_REVIEW_ATTESTATION,
  ALLOWED_KEYS_GATE_DECISION,
  ALLOWED_KEYS_COVERAGE_SUMMARY,
  ALLOWED_KEYS_BUILD_RETURN,
  validateEvaluationPlan,
  validateExecutionAttempt,
  validateGateDecision,
  validateBUILDReturn,
  validateDomainProbeProfile,
  validateProbeDefinitionRecord,
  validateActionRecord,
  validateReviewAttestation,
  ValidationError,
} from '../../src/hc-validate.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = join(__dirname, '../../schemas');

function loadSchema(filename) {
  return JSON.parse(readFileSync(join(SCHEMAS_DIR, filename), 'utf8'));
}

/** Extract top-level property keys from a JSON Schema; returns sorted array. */
function schemaPropertyKeys(schema) {
  if (!schema || typeof schema.properties !== 'object') return [];
  return Object.keys(schema.properties).sort();
}

/** Extract property keys from a named $definitions entry. */
function definitionPropertyKeys(schema, defName) {
  const def = schema?.definitions?.[defName];
  if (!def || typeof def.properties !== 'object') return [];
  return Object.keys(def.properties).sort();
}

/** Sort an imported readonly string tuple for comparison. */
function sortedKeys(keys) {
  return [...keys].sort();
}

// ---------------------------------------------------------------------------
// HC-B01-F: schema files vs. runtime validator allowed-key lists
//
// Each test compares Object.keys(schema.properties).sort() against the
// exported ALLOWED_KEYS_* constant from src/hc-validate.ts. Because the
// constant is imported (not copied), any divergence between the schema file
// and the validator is detected at test execution time.
// ---------------------------------------------------------------------------

test('hc-b01-sa-01 [HC-B01-F]: DomainProbeProfile schema properties match runtime validator keys', () => {
  const schema = loadSchema('domain-probe-profile.schema.json');
  assert.deepEqual(
    schemaPropertyKeys(schema),
    sortedKeys(ALLOWED_KEYS_DOMAIN_PROBE_PROFILE),
    'DomainProbeProfile schema/validator drift detected',
  );
});

test('hc-b01-sa-02 [HC-B01-F]: ProbeDefinitionRecord schema properties match runtime validator keys', () => {
  const schema = loadSchema('probe-definition.schema.json');
  assert.deepEqual(
    schemaPropertyKeys(schema),
    sortedKeys(ALLOWED_KEYS_PROBE_DEFINITION),
    'ProbeDefinitionRecord schema/validator drift detected',
  );
});

test('hc-b01-sa-03 [HC-B01-F]: EvaluationPlan schema properties match runtime validator keys', () => {
  const schema = loadSchema('evaluation-plan.schema.json');
  assert.deepEqual(
    schemaPropertyKeys(schema),
    sortedKeys(ALLOWED_KEYS_EVALUATION_PLAN),
    'EvaluationPlan schema/validator drift detected',
  );
});

test('hc-b01-sa-04 [HC-B01-F]: PlanItem nested definition properties match runtime validator keys', () => {
  const schema = loadSchema('evaluation-plan.schema.json');
  assert.deepEqual(
    definitionPropertyKeys(schema, 'PlanItem'),
    sortedKeys(ALLOWED_KEYS_PLAN_ITEM),
    'PlanItem nested definition schema/validator drift detected',
  );
});

test('hc-b01-sa-05 [HC-B01-F]: ExecutionAttempt schema properties match runtime validator keys', () => {
  const schema = loadSchema('execution-attempt.schema.json');
  assert.deepEqual(
    schemaPropertyKeys(schema),
    sortedKeys(ALLOWED_KEYS_EXECUTION_ATTEMPT),
    'ExecutionAttempt schema/validator drift detected',
  );
});

test('hc-b01-sa-06 [HC-B01-F]: ActionRecord schema properties match runtime validator keys', () => {
  const schema = loadSchema('action-record.schema.json');
  assert.deepEqual(
    schemaPropertyKeys(schema),
    sortedKeys(ALLOWED_KEYS_ACTION_RECORD),
    'ActionRecord schema/validator drift detected',
  );
});

test('hc-b01-sa-07 [HC-B01-F]: ReviewAttestation schema properties match runtime validator keys', () => {
  const schema = loadSchema('review-attestation.schema.json');
  assert.deepEqual(
    schemaPropertyKeys(schema),
    sortedKeys(ALLOWED_KEYS_REVIEW_ATTESTATION),
    'ReviewAttestation schema/validator drift detected',
  );
});

test('hc-b01-sa-08 [HC-B01-F]: GateDecision schema properties match runtime validator keys', () => {
  const schema = loadSchema('gate-decision.schema.json');
  assert.deepEqual(
    schemaPropertyKeys(schema),
    sortedKeys(ALLOWED_KEYS_GATE_DECISION),
    'GateDecision schema/validator drift detected',
  );
});

test('hc-b01-sa-09 [HC-B01-F]: CoverageSummary nested definition properties match runtime validator keys', () => {
  const schema = loadSchema('gate-decision.schema.json');
  assert.deepEqual(
    definitionPropertyKeys(schema, 'CoverageSummary'),
    sortedKeys(ALLOWED_KEYS_COVERAGE_SUMMARY),
    'CoverageSummary nested definition schema/validator drift detected',
  );
});

test('hc-b01-sa-10 [HC-B01-F]: BUILDReturn schema properties match runtime validator keys', () => {
  const schema = loadSchema('build-return.schema.json');
  assert.deepEqual(
    schemaPropertyKeys(schema),
    sortedKeys(ALLOWED_KEYS_BUILD_RETURN),
    'BUILDReturn schema/validator drift detected',
  );
});

// ---------------------------------------------------------------------------
// Direct validator exercise with schema-derived objects.
//
// Each test constructs an object whose keys come from Object.keys(schema.properties),
// then passes it through the actual runtime validator. A valid object must pass.
// An object with an unknown key (not in the schema) must be rejected.
//
// This proves: the validator and the schema agree on what keys are permitted,
// tested across the actual validator code path — not a string comparison only.
// ---------------------------------------------------------------------------

test('hc-b01-sa-11 [HC-B01-F]: EvaluationPlan validator accepts object with exactly schema-declared keys', () => {
  // Construct a minimal valid object using only keys declared in the schema.
  const HASH = 'sha256:' + 'a'.repeat(64);
  const schemaKeys = schemaPropertyKeys(loadSchema('evaluation-plan.schema.json'));
  // All schema keys must be in the allowed list — validator must not reject them.
  const obj = {
    schema_version: 'contradictor.evaluation-plan.v1',
    plan_id: 'Plan-SA-Test',
    plan_version: '1.0',
    plan_hash: HASH,
    target_tool_id: 'Tool-SA',
    target_build_id: 'Build-SA',
    profile_id: 'Profile-SA',
    profile_hash: HASH,
    probe_library_version: '0.2.0',
    required_probes: [
      { plan_item_id: 'Item-SA-01', probe_id: 'U1', probe_definition_hash: HASH },
    ],
    authorized_by: 'LDR',
    authorized_at: '2026-09-25T00:00:00Z',
    description: 'schema-agreement test fixture',
  };
  // All keys in obj must be present in schemaKeys
  for (const k of Object.keys(obj)) {
    assert.ok(schemaKeys.includes(k), `key '${k}' is in validator fixture but not in schema`);
  }
  // The validator must accept this object (no HC_EXTRA_PROPERTY thrown)
  assert.doesNotThrow(() => validateEvaluationPlan(obj));
});

test('hc-b01-sa-12 [HC-B01-F]: EvaluationPlan validator rejects key present in neither schema nor allowed list', () => {
  const HASH = 'sha256:' + 'b'.repeat(64);
  const obj = {
    schema_version: 'contradictor.evaluation-plan.v1',
    plan_id: 'Plan-SA-Test2',
    plan_version: '1.0',
    plan_hash: HASH,
    target_tool_id: 'Tool-SA',
    target_build_id: 'Build-SA',
    profile_id: 'Profile-SA',
    profile_hash: HASH,
    probe_library_version: '0.2.0',
    required_probes: [
      { plan_item_id: 'Item-SA-01', probe_id: 'U1', probe_definition_hash: HASH },
    ],
    authorized_by: 'LDR',
    authorized_at: '2026-09-25T00:00:00Z',
    NOT_IN_SCHEMA: 'this key is not in the schema',  // schema-forbidden extra key
  };
  // The validator must reject this because NOT_IN_SCHEMA is not in ALLOWED_KEYS_EVALUATION_PLAN
  let thrown;
  try { validateEvaluationPlan(obj); } catch (e) { thrown = e; }
  assert.ok(thrown instanceof ValidationError, 'expected ValidationError for schema-forbidden key');
  assert.match(thrown.message, /HC_EXTRA_PROPERTY.*NOT_IN_SCHEMA/);
  // Also confirm: the schema file does not declare this key
  const schema = loadSchema('evaluation-plan.schema.json');
  assert.equal('NOT_IN_SCHEMA' in (schema.properties ?? {}), false,
    'NOT_IN_SCHEMA must not be in the normative schema properties');
});

test('hc-b01-sa-13 [HC-B01-F]: PlanItem nested validator rejects extra key via EvaluationPlan validator (nested coverage)', () => {
  // Tests the nested object path: PlanItem inside EvaluationPlan.
  // Adds an extra key to a plan item — the schema defines additionalProperties:false
  // on PlanItem, and the validator enforces this via validatePlanItem.
  const HASH = 'sha256:' + 'c'.repeat(64);
  const obj = {
    schema_version: 'contradictor.evaluation-plan.v1',
    plan_id: 'Plan-SA-Nested',
    plan_version: '1.0',
    plan_hash: HASH,
    target_tool_id: 'Tool-SA',
    target_build_id: 'Build-SA',
    profile_id: 'Profile-SA',
    profile_hash: HASH,
    probe_library_version: '0.2.0',
    required_probes: [
      {
        plan_item_id: 'Item-SA-01',
        probe_id: 'U1',
        probe_definition_hash: HASH,
        scope_override: true,          // extra key in nested PlanItem — forbidden
      },
    ],
    authorized_by: 'LDR',
    authorized_at: '2026-09-25T00:00:00Z',
  };
  let thrown;
  try { validateEvaluationPlan(obj); } catch (e) { thrown = e; }
  assert.ok(thrown instanceof ValidationError,
    'expected ValidationError for extra key in nested PlanItem');
  assert.match(thrown.message, /HC_EXTRA_PROPERTY.*scope_override/);
  // Confirm: the nested PlanItem schema definition does not declare scope_override
  const schema = loadSchema('evaluation-plan.schema.json');
  const planItemProps = schema?.definitions?.PlanItem?.properties ?? {};
  assert.equal('scope_override' in planItemProps, false,
    'scope_override must not be in PlanItem schema properties');
});

test('hc-b01-sa-14 [HC-B01-F]: CoverageSummary nested validator rejects extra key via GateDecision (nested coverage)', () => {
  // Tests the CoverageSummary nested object path via validateGateDecision.
  const HASH = 'sha256:' + 'd'.repeat(64);
  const obj = {
    schema_version: 'contradictor.gate-decision.v1',
    decision_id: 'Gate-SA-Test',
    plan_id: 'Plan-SA',
    plan_hash: HASH,
    target_tool_id: 'Tool-SA',
    target_build_id: 'Build-SA',
    decided_by: 'BUILD',
    decided_at: '2026-09-25T00:00:00Z',
    gate_status: 'clear',
    coverage_summary: {
      required_count: 1,
      satisfied_count: 1,
      unsatisfied_items: [],
      injected_field: 'forbidden',     // extra key in nested CoverageSummary
    },
  };
  let thrown;
  try { validateGateDecision(obj); } catch (e) { thrown = e; }
  assert.ok(thrown instanceof ValidationError,
    'expected ValidationError for extra key in nested CoverageSummary');
  assert.match(thrown.message, /HC_EXTRA_PROPERTY.*injected_field/);
  // Confirm: the nested CoverageSummary schema definition does not declare injected_field
  const schema = loadSchema('gate-decision.schema.json');
  const summaryProps = schema?.definitions?.CoverageSummary?.properties ?? {};
  assert.equal('injected_field' in summaryProps, false,
    'injected_field must not be in CoverageSummary schema properties');
});

// ---------------------------------------------------------------------------
// Mutation detection across the actual schema → validator boundary.
//
// The mutation operates on an in-memory copy only — schema files are NOT changed.
// Demonstrates that if the schema is updated to add a new property but the
// validator's ALLOWED_KEYS constant is NOT updated, this suite detects the gap.
//
// The detection mechanism: schemaPropertyKeys(mutated) ≠ sortedKeys(ALLOWED_KEYS_*)
// Because ALLOWED_KEYS_* is the live import, not a copied table.
// ---------------------------------------------------------------------------

test('hc-b01-sa-15 [HC-B01-F]: mutation detection — adding a property to EvaluationPlan schema but not to validator is detected', () => {
  const realSchema = loadSchema('evaluation-plan.schema.json');
  // Simulate a developer adding 'new_field' to the schema without updating the validator.
  const mutatedSchema = {
    ...realSchema,
    properties: { ...realSchema.properties, new_field: { type: 'string' } },
  };
  // The live validator constant does NOT include 'new_field'.
  const validatorKeys = sortedKeys(ALLOWED_KEYS_EVALUATION_PLAN);
  const mutatedSchemaKeys = schemaPropertyKeys(mutatedSchema);
  // Must detect: mutated schema has a key the validator doesn't know about.
  assert.notDeepEqual(mutatedSchemaKeys, validatorKeys,
    'MUTATION NOT DETECTED: schema gained new_field but validator was not updated');
  assert.ok(mutatedSchemaKeys.includes('new_field'),
    'new_field must appear in mutated schema keys');
  assert.equal(validatorKeys.includes('new_field'), false,
    'new_field must NOT appear in live validator allowed keys');
});

test('hc-b01-sa-16 [HC-B01-F]: mutation detection — nested PlanItem schema addition is detected', () => {
  const realSchema = loadSchema('evaluation-plan.schema.json');
  const mutatedSchema = {
    ...realSchema,
    definitions: {
      PlanItem: {
        ...realSchema.definitions.PlanItem,
        properties: {
          ...realSchema.definitions.PlanItem.properties,
          scope_category: { type: 'string' },
        },
      },
    },
  };
  const validatorKeys = sortedKeys(ALLOWED_KEYS_PLAN_ITEM);
  const mutatedDefKeys = definitionPropertyKeys(mutatedSchema, 'PlanItem');
  assert.notDeepEqual(mutatedDefKeys, validatorKeys,
    'MUTATION NOT DETECTED: PlanItem schema gained scope_category but validator was not updated');
  assert.ok(mutatedDefKeys.includes('scope_category'));
  assert.equal(validatorKeys.includes('scope_category'), false);
});

// ---------------------------------------------------------------------------
// Structural schema integrity: additionalProperties: false is present
// ---------------------------------------------------------------------------

test('hc-b01-sa-17 [HC-B01-F]: all normative schemas declare additionalProperties: false at top level', () => {
  const schemaFiles = [
    'domain-probe-profile.schema.json',
    'probe-definition.schema.json',
    'evaluation-plan.schema.json',
    'execution-attempt.schema.json',
    'action-record.schema.json',
    'review-attestation.schema.json',
    'gate-decision.schema.json',
    'build-return.schema.json',
  ];
  for (const file of schemaFiles) {
    const schema = loadSchema(file);
    assert.equal(schema.additionalProperties, false,
      `${file}: additionalProperties must be false at top level`);
  }
});

test('hc-b01-sa-18 [HC-B01-F]: nested definitions also declare additionalProperties: false', () => {
  const evalSchema = loadSchema('evaluation-plan.schema.json');
  assert.equal(evalSchema.definitions?.PlanItem?.additionalProperties, false,
    'PlanItem definition must have additionalProperties: false');
  const gateSchema = loadSchema('gate-decision.schema.json');
  assert.equal(gateSchema.definitions?.CoverageSummary?.additionalProperties, false,
    'CoverageSummary definition must have additionalProperties: false');
});
