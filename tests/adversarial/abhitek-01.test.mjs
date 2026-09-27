/**
 * ABHITEK-01 — Adversarial Validation Test Suite
 * Branch: abhitek/adversarial-validation
 *
 * Three boundaries challenged:
 *   Suite 1 — Missing & Deceitful Capabilities  (Tests 1.1 – 1.4)
 *   Suite 2 — Malformed Observations & Garbage  (Tests 2.1 – 2.4)
 *   Suite 3 — Cryptographic Integrity / Tamper  (Tests 3.1 – 3.4)
 *
 * Rules followed:
 *   - src/contradictor.ts and src/provenance.ts are NOT modified.
 *   - Acceptance semantics are NOT redefined.
 *   - Every assertion targets a precise, named code path.
 *   - Uses the same native node:test runner as kernel.test.mjs.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildUniversalProbes,
  runProbe,
  validateRecord,
  sealRecord,
  hash,
  timestamp,
  MemoryExecutionStore,
  FileExecutionStore,
} from '../../src/contradictor.ts';

// ── Shared fixtures (mirrors kernel.test.mjs exactly) ─────────────────────

const manifest = {
  toolName: 'Fixture',
  buildVersion: 'test-1',
  categories: ['Alpha', 'Beta'],
  knownRiskAreas: [],
  inputSurfaces: ['text'],
  probePolicy: { negation: true, monotonicity: true, replacementSubmissions: true },
};
const probes = buildUniversalProbes(manifest);
const p = n => probes[n - 1]; // p(1)=U1 … p(10)=U10 etc.

/** Build a valid observation; override any field via extra. */
const obs = (extra = {}) => ({
  status: 'ranked',
  rankedItems: [{ label: 'Alpha', rank: 1 }],
  renderedText: 'Alpha',
  observedAt: timestamp(), // 6-digit microsecond padded — always valid
  ...extra,
});

/**
 * Standard mock adapter factory — identical to the one in kernel.test.mjs
 * so our tests remain structurally consistent with the existing suite.
 */
function adapter(outputs = [], caps = ['ranked']) {
  let n = 0;
  const calls = [];
  return {
    descriptor: {
      tool_id: 'Fixture',
      tool_build: 'test-1',
      adapter_id: 'FixtureAdapter',
      adapter_version: '1.0.0',
      capabilities: caps,
    },
    calls,
    async newSession(s) { calls.push(['newSession', s]); },
    async submit(s) {
      calls.push(['submit', s]);
      const v = outputs[n++] ?? obs();
      return typeof v === 'function' ? v(s) : v;
    },
    async readLiveState() { calls.push(['read']); return outputs[n++] ?? obs(); },
    async approve() { calls.push(['approve']); return outputs[n++] ?? obs(); },
    async readExportedArtifact() { calls.push(['export']); return outputs[n++] ?? obs(); },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 1 — Missing & Deceitful Capabilities
// Target code: contradictor.ts lines 724-748 (capability gating)
// ══════════════════════════════════════════════════════════════════════════════

test('1.1: Phantom Export — declares export capability but method is absent', async () => {
  // U8 (Export/Naming Collision) requires ['export'].
  // Adapter descriptor says ['export'] but readExportedArtifact is undefined.
  // contradictor.ts:726 — typeof adapter.readExportedArtifact !== 'function' → missing.push('export')
  // contradictor.ts:748 — missing.length > 0 → state='unsupported', switch is skipped entirely.
  let callCount = 0;
  const phantomExport = {
    descriptor: {
      tool_id: 'Fixture', tool_build: 'test-1',
      adapter_id: 'PhantomExportAdapter', adapter_version: '1.0.0',
      capabilities: ['export'], // declared…
    },
    async newSession() { callCount++; },
    async submit()     { callCount++; return obs(); },
    async readLiveState() { callCount++; return obs(); },
    readExportedArtifact: undefined, // …but method is absent
  };

  const row = await runProbe(p(8), phantomExport);

  assert.equal(row.execution_state, 'unsupported',
    'Phantom export capability must yield unsupported, not a crash or false pass');
  assert.equal(callCount, 0,
    'Probe must abort BEFORE any adapter method is called (zero side-effects)');
  assert.match(row.actual, /Missing capabilities.*export/,
    'Evidence must name which capability was missing');
  assert.equal(row.blocksPeerTest, 'Yes',
    'Unsupported rows must always block peer testing');
});

test('1.2: Phantom Review — declares review capability but approve is null', async () => {
  // U9 (Approval/Review State Toggle) requires ['review'].
  // contradictor.ts:725 — typeof adapter.approve !== 'function' → missing.push('review')
  let callCount = 0;
  const phantomReview = {
    descriptor: {
      tool_id: 'Fixture', tool_build: 'test-1',
      adapter_id: 'PhantomReviewAdapter', adapter_version: '1.0.0',
      capabilities: ['review'], // declared…
    },
    async newSession() { callCount++; },
    async submit()     { callCount++; return obs(); },
    async readLiveState() { callCount++; return obs(); },
    approve: null, // …but approve is null (not a function)
  };

  const row = await runProbe(p(9), phantomReview);

  assert.equal(row.execution_state, 'unsupported');
  assert.equal(callCount, 0, 'Zero adapter calls when review capability is phantom');
  assert.equal(row.blocksPeerTest, 'Yes');
});

test('1.3: Partial Capability Trap — U10 needs export+semantic-export; only export declared', async () => {
  // U10 (Report Completeness) requires BOTH 'export' AND 'semantic-export'.
  // contradictor.ts:724 — filter finds 'semantic-export' missing from descriptor → state='unsupported'
  const partialAdapter = adapter([], ['export']); // only 'export' in descriptor

  const row = await runProbe(p(10), partialAdapter);

  assert.equal(row.execution_state, 'unsupported',
    'Must be unsupported when a multi-capability probe is only partially satisfied');
  assert.equal(partialAdapter.calls.length, 0,
    'Must abort before any tool interaction when any required capability is absent');
  assert.match(row.actual, /semantic-export/,
    'Evidence must identify the exact missing capability');
});

test('1.4: Stealth Implementation — working methods present but undeclared in descriptor', async () => {
  // Adapter has BOTH approve() and readExportedArtifact() working, but descriptor says capabilities:[].
  // The capability gating at contradictor.ts:724 gates on DECLARATIONS, never method presence.
  // U8 requires 'export'; filter(c => !descriptor.capabilities.includes(c)) → missing=['export']
  const stealthAdapter = adapter([], []); // fully implemented factory, but empty declared capabilities

  const row = await runProbe(p(8), stealthAdapter);

  assert.equal(row.execution_state, 'unsupported',
    'Undeclared capabilities must not permit probe execution even if methods exist');
  assert.equal(stealthAdapter.calls.length, 0,
    'Undeclared adapter methods must never be invoked');
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 2 — Malformed Observations & Garbage Output
// Target code: contradictor.ts lines 728-764 (Proxy + outer try/catch)
// ══════════════════════════════════════════════════════════════════════════════

test('2.1: Timestamp Poisoning — five non-compliant observedAt formats all rejected', async () => {
  // contradictor.ts:738 — !TIME.test(value.observedAt) → throw INVALID_OBSERVATION
  // TIME regex (/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/) requires 6 microsecond digits.
  // Standard new Date().toISOString() only has 3 — it fails silently in production adapters.
  const badTimestamps = [
    new Date().toISOString(),           // 3-digit ms: '...123Z'  (most likely real-world bug)
    '2026-09-25T12:00:00Z',            // no fractional seconds
    'yesterday',                        // free-text — no structure at all
    String(Date.now()),                 // unix epoch as string
    '2026-09-25 12:00:00.000000',      // space separator, no Z suffix
  ];

  for (const badTs of badTimestamps) {
    const badObs = { status: 'ranked', rankedItems: [{ label: 'Alpha', rank: 1 }], observedAt: badTs };
    // caps:[] avoids rank validation so only timestamp check fires
    const row = await runProbe(p(1), adapter([badObs], []));

    assert.equal(row.execution_state, 'error',
      `Timestamp "${badTs}" must be caught as an error, not passed or crashed`);
    assert.notEqual(row.codexReady, 'Yes',
      'Error state must never produce codexReady=Yes (would mislead the repair actor)');
    assert.equal(row.blocksPeerTest, 'Yes',
      'Every error row must block peer testing');
  }
});

test('2.2: Rank Poisoning — seven illegal rankedItems variants all rejected', async () => {
  // contradictor.ts:739 — checks: !Array.isArray, null item, !isSafeInteger, rank<1, !string label
  // All must throw INVALID_RANKED_OBSERVATION → caught at line 764 → execution_state:'error'
  const illegalRanks = [
    { desc: 'rank 0',              items: [{ label: 'Alpha', rank: 0 }] },
    { desc: 'rank -1',             items: [{ label: 'Alpha', rank: -1 }] },
    { desc: 'rank 1.5 (float)',    items: [{ label: 'Alpha', rank: 1.5 }] },
    { desc: 'rank NaN',            items: [{ label: 'Alpha', rank: NaN }] },
    { desc: 'rank 2**53+1 (unsafe)', items: [{ label: 'Alpha', rank: 2 ** 53 + 1 }] },
    { desc: 'non-string label',    items: [{ label: 12345, rank: 1 }] },
    { desc: 'null item in array',  items: [null] },
  ];

  for (const { desc, items } of illegalRanks) {
    const badObs = { status: 'ranked', rankedItems: items, observedAt: timestamp() };
    // caps:['ranked'] activates the rank validation branch at line 739
    const row = await runProbe(p(1), adapter([badObs], ['ranked']));

    assert.equal(row.execution_state, 'error',
      `${desc} — must be rejected as error, not a valid observation`);
    assert.notEqual(row.execution_state, 'passed',
      `${desc} — illegal rank must never produce a passing result`);
  }
});

test('2.3: Unusable Status — error and unknown observations never become usable', async () => {
  // contradictor.ts:741 — status==='error'||status==='unknown' → throw UNUSABLE_OBSERVATION
  // The outer catch (line 764) records execution_state='error'.
  // 'error' is NOT a product defect (the adapter/tool errored, not Contradictor) —
  // so codexReady must NOT be 'Yes'.
  for (const status of ['error', 'unknown']) {
    const row = await runProbe(p(1), adapter([{ status, observedAt: timestamp() }], []));

    assert.equal(row.execution_state, 'error',
      `status:'${status}' from the tool must yield execution_state:'error'`);
    assert.notEqual(row.exposure, 'Pass — No Issue',
      `status:'${status}' must never be classified as Pass — No Issue`);
    assert.notEqual(row.codexReady, 'Yes',
      'Unusable tool status is not a confirmed product bug; codexReady must not be Yes');
    assert.match(row.actual, new RegExp(`UNUSABLE_OBSERVATION:${status}`),
      'Exact unusable status must be recorded in the evidence string');
  }
});

test('2.4: Hostile Unicode — lone surrogate \\uD800 in observation caught by canonicalizer', async () => {
  // When the proxy calls immutable(value) at contradictor.ts:736, canonical() walks all strings.
  // canonical() → str(s) → s.isWellFormed() → false (lone surrogate) → throws INVALID_UNICODE
  // Caught by proxy inner catch (line 744), rethrown, caught by outer catch (line 764).
  // CRITICAL: must not crash the Node.js process — must be contained as execution_state:'error'.
  const surrogateObs = {
    status: 'ranked',
    rankedItems: [{ label: 'Alpha', rank: 1 }],
    renderedText: 'Malformed \uD800 payload', // lone high surrogate — not well-formed Unicode
    observedAt: timestamp(),
  };

  const row = await runProbe(p(1), adapter([surrogateObs], ['ranked']));

  assert.equal(row.execution_state, 'error',
    'Lone surrogate in observation must be caught as error, not crash the process');
  assert.ok(row.execution_record,
    'An execution record must still be persisted even when the error is in observation content');
  assert.equal(row.blocksPeerTest, 'Yes',
    'Error rows must block peer testing');
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 3 — Cryptographic Integrity & Evidence Tampering
// Target code: provenance.ts lines 71-128 (sealRecord, validateRecord, validateEvidence,
//              MemoryExecutionStore, FileExecutionStore)
// ══════════════════════════════════════════════════════════════════════════════

test('3.1: Record body mutation — any single field change breaks the record hash', async () => {
  // provenance.ts:83-84 — record_hash is SHA-256 of the full body (sans record_hash itself).
  // Any mutation to any field changes the body → recomputed hash diverges → RECORD_HASH_MISMATCH.
  const store = new MemoryExecutionStore();
  const row = await runProbe(
    p(1),
    adapter([obs({ status: 'insufficient_evidence', rankedItems: [] })]),
    { store }
  );
  const rec = row.execution_record;

  // Attack A: change a descriptor field
  assert.throws(
    () => validateRecord({ ...rec, tool_build: 'tampered-build' }),
    /MISMATCH/,
    'Tampered tool_build must invalidate the record hash'
  );

  // Attack B: change probe version metadata
  assert.throws(
    () => validateRecord({ ...rec, probe_version: 'injected-0.0.0' }),
    /MISMATCH/,
    'Tampered probe_version must invalidate the record hash'
  );

  // Attack C: inject an extra field that was never part of the original body
  assert.throws(
    () => validateRecord({ ...rec, injected_payload: 'backdoor' }),
    /MISMATCH/,
    'Extra injected field must change canonical body and break the hash'
  );
});

test('3.2: Rehashed forgery — re-sealed record with forged observation hash fails evidence check', async () => {
  // The attacker:
  //   1. Takes a legitimate sealed execution record.
  //   2. Modifies baseline_observation_hash to claim a different observation was seen.
  //   3. Re-seals it with sealRecord() so the record_hash is self-consistent.
  //   4. Attempts store.append() — validateEvidence() compares the claimed hash against the
  //      actual stored steps → EVIDENCE_PAIR_MISMATCH (provenance.ts:98).
  const store = new MemoryExecutionStore();
  await runProbe(
    p(1),
    adapter([obs({ status: 'insufficient_evidence', rankedItems: [] })]),
    { store, probe_run_id: 'PR-Forge' }
  );
  const original = store.get('PR-Forge');

  // Strip record_hash and forge the observation hash
  const { record_hash, ...body } = original;
  const forgedBody = {
    ...body,
    baseline_observation_hash: hash('contradictor.observation.v1', { status: 'forged_pass', observedAt: timestamp() }),
  };
  const resealed = sealRecord(forgedBody); // self-consistent record_hash now matches forged body

  // validateRecord(resealed) passes (it has a correct hash for the forged body).
  // store.append() calls validateEvidence() which cross-checks against actual stored steps
  // and detects the observation hash mismatch.
  assert.throws(
    () => store.append(resealed),
    /EVIDENCE_PAIR_MISMATCH/,
    'A re-sealed forged record must be caught when evidence cross-check runs'
  );
});

test('3.3: Disk-level record tampering — mutating persisted JSON is caught on next read', async () => {
  // FileExecutionStore.get() at provenance.ts:126 calls validateRecord() on the parsed JSON.
  // If the file on disk was tampered, the recomputed hash won't match → MISMATCH thrown.
  const root = mkdtempSync(join(tmpdir(), 'adversarial-'));
  try {
    const store = new FileExecutionStore(root);
    await runProbe(
      p(1),
      adapter([obs({ status: 'insufficient_evidence', rankedItems: [] })]),
      { store, probe_run_id: 'PR-DiskTamper' }
    );

    // Directly mutate the serialised record file on disk
    const recordFile = join(root, 'records', 'PR-DiskTamper.json');
    const onDisk = JSON.parse(readFileSync(recordFile, 'utf8'));
    onDisk.tool_build = 'disk-tampered'; // silent field mutation
    writeFileSync(recordFile, JSON.stringify(onDisk));

    // Next legitimate read must detect the integrity violation
    assert.throws(
      () => store.get('PR-DiskTamper'),
      /MISMATCH/,
      'A disk-tampered record file must be detected and rejected on the next read'
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('3.4: Time-travel inversion — completed_at earlier than started_at is immediately rejected', async () => {
  // provenance.ts:76 — r.completed_at < r.started_at → throw INVALID_RECORD (string comparison
  // works correctly for ISO-8601 timestamps with the same date prefix).
  // sealRecord() computes and embeds record_hash, then calls validateRecord() — which catches this.
  const store = new MemoryExecutionStore();
  const row = await runProbe(
    p(1),
    adapter([obs({ status: 'insufficient_evidence', rankedItems: [] })]),
    { store }
  );
  const original = store.get(row.execution_record.probe_run_id);
  const { record_hash, ...body } = original;

  // Forge: completed 1 second BEFORE started — temporal impossibility
  const timeForged = {
    ...body,
    started_at:   '2026-09-25T12:00:00.000000Z',
    completed_at: '2026-09-25T11:59:59.000000Z', // strictly less than started_at
  };

  assert.throws(
    () => sealRecord(timeForged),
    /INVALID_RECORD/,
    'A record where completed_at precedes started_at must be rejected by sealRecord'
  );
});
