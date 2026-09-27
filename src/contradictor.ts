/** Contradictor R0 — Metamorphic Pre-Validation Kernel, candidate.
 * Observes declared behavioral relations; does not approve releases or own domain semantics.
 * ASMP supplies continuity/admission elsewhere. No ASMP or Leviathan integration is implemented.
 * Severity is unassigned; domain/ARC review supplies severity independently.
 * Node-only local execution. The original browser checklist is not wired to this module.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { canonical, hash, timestamp, immutable, assertId, sealRecord, MemoryExecutionStore, validateRecord, TIME } from './provenance.ts';
import type { ExecutionState, ExecutionStore, ProbeExecutionRecord } from './provenance.ts';
export * from './provenance.ts';
export const PROBE_LIBRARY_VERSION = '0.2.0';
const libraryProbes=new WeakSet<object>();
// Pins executable bytes, including closures, not merely a human-readable probe ID.
const LIBRARY_HASH = 'sha256:' + createHash('sha256').update(readFileSync(new URL(import.meta.url))).update(readFileSync(new URL('./provenance.ts',import.meta.url))).digest('hex');
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RowClass =
  | 'Universal'
  | 'Logic/Scoring'
  | 'UX/Flow'
  | 'Data Integrity'
  | 'Export/Report'
  | 'State Management'
  | 'Feature Gap';

export type ExposureType =
  | ''
  | 'Bug'
  | 'Data Inconsistency'
  | 'Feature Gap'
  | 'Design Decision Needed'
  | 'UX Defect'
  | 'Pass — No Issue';

export type Severity = '' | 'Blocker' | 'High' | 'Medium' | 'Low';
export type YesNo = '' | 'Yes' | 'No';
export type CodexReadiness = '' | 'Yes' | 'No — needs spec' | 'N/A — not yet run';

/** One finding/test row. The unit The Contradictor operates on. */
export interface ContradictorRow {
  testId: string;
  rowClass: RowClass;
  target: string;
  repro: string;
  expected: string;
  actual: string;
  exposure: ExposureType;
  severity: Severity;
  blocksPeerTest: YesNo;
  codexReady: CodexReadiness;
  notes: string;
  row_origin: 'planned'|'executed'|'manual_observation'|'imported';
  execution_state: ExecutionState;
  execution_record?: ProbeExecutionRecord;
}

export interface RiskArea {
  area: string;
  why: string;
}

/**
 * The manifest a domain tool provides when it's about to go through a
 * break-it pass. Analogous in spirit to a Leviathan capture manifest, but
 * this is The Contradictor's own contract until Codex's Stage 2 audit
 * confirms whether it should literally match the real schema instead.
 */
export interface ToolManifest {
  toolName: string;
  buildVersion: string;
  categories: string[];
  knownRiskAreas: RiskArea[];
  inputSurfaces: string[];
  /** Domain owner explicitly opts into semantic assumptions; absent means inconclusive. */
  probePolicy?: { negation?: boolean; monotonicity?: boolean; replacementSubmissions?: boolean };
}

/**
 * The nine invariant classes this layer can test without ever knowing a
 * tool's internal scoring formula. See the CODIFICATION PRINCIPLE doc above.
 */
export type InvariantClass =
  | 'Input Robustness'
  | 'Determinism'
  | 'Evidence Monotonicity'
  | 'Negation Sensitivity'
  | 'Density/Saturation'
  | 'Tie Stability'
  | 'Insufficiency Gating'
  | 'State Idempotence'
  | 'Export Fidelity'
  | 'Session Isolation';

/**
 * Normalized contract every ToolAdapter must produce from a tool's raw
 * output. Base fields are shared; capability fields are optional. Adapters must not
 * fabricate missing observations. Semantic snapshots belong to the domain profile.
 */
export interface ToolObservation {
  /**
   * Categorical state. Every domain tool's adapter must map its own
   * internal states onto this fixed set — never a raw score.
   *
   * PATCHED against FrictionMap's observed real output contract
   * (ffc-frictionmap-observed-output-contract.md, frozen). The engine
   * surfaces four distinct states, not two — 'insufficient_evidence' and
   * 'no_supported_friction' are NOT interchangeable in real output (one
   * followed a "1 candidate extracted" notice with a fully-rendered signal
   * card still present; the other followed explicit dedup/low-information
   * exclusion with zero cards rendered). 'near_tie_review_required' is a
   * real, distinct state — not inferred, observed live on isolated
   * single-topic input, not just multi-signal input. Do not collapse these
   * back into a smaller set without re-checking the frozen contract.
   */
  status:
    | (string & {})
    | 'ranked'
    | 'insufficient_evidence'
    | 'no_supported_friction'
    | 'near_tie_review_required'
    | 'contradiction_flagged'
    | 'error'
    | 'unknown';
  /** Ordinal rank only (1 = primary). Probes never read the underlying
   * numeric score — only relative position. */
  rankedItems?: { label: string; rank: number }[];
  /** Rendered text, for surface-level checks that don't need structured
   * parsing (content presence, wrap/overflow smell tests). */
  renderedText?: string;
  /** Whether a "pending / needs review" indicator is visibly present. */
  pendingReviewIndicator?: boolean;
  /** Filename of the last export produced in this session, if any. */
  exportFilename?: string;
  /** Opaque subject/session identifier, for isolation checks. */
  subjectId?: string;
  observedAt: string;
  /** Adapter-defined current result text; excludes navigation/history/legends. */
  currentResultText?: string;
  /** Actual render instrumentation, not a string-search inference. */
  rendering?: { scriptExecuted: boolean; markupInterpreted: boolean; renderingBroken: boolean };
  /** Same versioned, complete domain projection on live and export surfaces. */
  semanticSnapshot?: { schema: string; data: Record<string, unknown> };
  rawEvidence?: { media_type: string; content: string }[];
}

/**
 * The only tool-specific code Contradictor ever needs. Everything else in
 * this file — invariant classes, probes, the runner — is written once and
 * reused unchanged for every new tool. Implementing this interface (e.g. a
 * Playwright-driven FrictionMapAdapter) is the entire integration cost of
 * pointing Contradictor at a new engine.
 */
export type Capability = 'ranked'|'review'|'export'|'rendering'|'current-result'|'semantic-export'|'subject';
export interface BaseAdapter {
  descriptor: { tool_id:string; tool_build:string; adapter_id:string; adapter_version:string; capabilities:Capability[] };
  newSession(subjectLabel:string):Promise<void>;
  submit(input:string):Promise<ToolObservation>;
  readLiveState():Promise<ToolObservation>;
}
export interface ReviewCapability { approve():Promise<ToolObservation>; }
export interface ExportCapability { readExportedArtifact():Promise<ToolObservation>; }
export type ToolAdapter = BaseAdapter & Partial<ReviewCapability & ExportCapability>;

export interface RelationResult {
  pass: boolean;
  evidence: string;
  /** Set when this probe structurally cannot resolve pass/fail without
   * knowing the tool's internal formula (e.g. density direction). Still
   * blocks peer testing — routes to human confirmation instead of a false
   * pass. Never conflate this with `pass: true`. */
  needsManualConfirmation?: boolean;
}

interface BaseProbe {
  id: string;
  probe_version?: string;
  requiredCapabilities?: Capability[];
  definitionContext?: unknown;
  invariantClass: InvariantClass;
  target: string;
  /** Human-readable statement of what a passing engine does. Same field
   * used to derive the descriptive UNIVERSAL_PATTERNS view below. */
  expected: string;
}

/** Baseline input -> transformed input; relation over their two observations.
 * Covers Negation Sensitivity, Density/Saturation, Evidence Monotonicity,
 * Tie Stability. Closures are built per-manifest by buildUniversalProbes,
 * so no manifest threading is needed in the call signatures themselves. */
export interface InputRelationProbe extends BaseProbe {
  kind: 'input-relation';
  baselineInput(): string;
  transform(baselineInput: string): string;
  relation(baseline: ToolObservation, transformed: ToolObservation): RelationResult;
}

/** One fixed/special input; assertion on its observation alone. Covers
 * Insufficiency Gating, malformed/oversized input smell tests. */
export interface CategoricalProbe extends BaseProbe {
  kind: 'categorical';
  input(): string;
  assertion(observation: ToolObservation): RelationResult;
}

/** A scripted sequence of adapter calls; assertion over the sequence.
 * Covers Determinism, State Idempotence, Session Isolation. */
export interface ActionSequenceProbe extends BaseProbe {
  kind: 'action-sequence';
  run(adapter: ToolAdapter): Promise<RelationResult>;
}

/** One input, two different adapter read-surfaces compared. Covers Export
 * Fidelity. */
export interface CrossSurfaceProbe extends BaseProbe {
  kind: 'cross-surface';
  input(): string;
  relation(surfaceA: ToolObservation, surfaceB: ToolObservation): RelationResult;
}

export type Probe = InputRelationProbe | CategoricalProbe | ActionSequenceProbe | CrossSurfaceProbe;

export interface UniversalPattern {
  id: string;
  invariantClass: InvariantClass;
  target: string;
  expected: string;
}

/**
 * Best-effort envelope shape for handing a completed pass back to a
 * Leviathan-style pipeline. Field names mirror the real leviathan-intake-v1
 * sample where a direct analogue exists (schema_version, classification_state,
 * promotion_default, routing_hints, sensitivity). NOT confirmed against the
 * real compiler — treat as a proposal, not a contract, until Stage 2 runs.
 */
export interface ContradictorManifestEnvelope {
  schema_version: 'contradictor-v2';
  integration_status: 'unverified';
  layer_name: 'The Contradictor';
  tool_name: string;
  build_version: string;
  classification_state: 'not_run' | 'blocked' | 'clear_for_peer_test';
  promotion_default: 'candidate_only'; // never auto-promotes findings to canon fixes
  sensitivity: 'normal';
  routing_hints: string[]; // e.g. ['blocks_peer_test', 'needs_spec_decision']
  finding_count: number;
  blocking_count: number;
  needs_spec_count: number;
}

// ---------------------------------------------------------------------------
// Behavioral probe library — applicability depends on capabilities and domain policy.
// This is what Leviathan's existing 8 layers cannot do on their own: they
// classify and route what arrives, but nothing today judges whether a new
// tool is structurally sound before it reaches a human. This is that gap.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Executable Universal Probes — one metamorphic relation per invariant
// class, built fresh per-manifest so phrasing reads like plausible messy
// operator notes for that domain, never like synthetic QA fuzz strings.
// This is the ONLY place invariant classes turn into runnable code. Add a
// new invariant class here once; every future tool inherits it via its
// ToolAdapter where the required capabilities and semantic policy exist.
// ---------------------------------------------------------------------------

function uncertain(evidence:string):RelationResult { return {pass:false,needsManualConfirmation:true,evidence}; }

function genericClaim(category: string): string {
  return `There's a real, recurring problem with ${category.toLowerCase()} — it's been slowing the team down for weeks now.`;
}
function genericNegatedClaim(category: string): string {
  return `We do not have any issues with ${category.toLowerCase()}. That has never been a problem for this team.`;
}
function repeatedClaim(category: string, times: number): string {
  const sentence = `Yet again, ${category.toLowerCase()} caused a delay today.`;
  return Array(times).fill(sentence).join(' ');
}

export function buildUniversalProbes(manifest: ToolManifest): Probe[] {
  manifest=immutable(manifest);
  const catA = manifest.categories[0] ?? 'Category A';
  const catB = manifest.categories[1] ?? catA;

  const probes: Probe[] = [
    {
      id: 'U1 — Zero/Empty Evidence',
      invariantClass: 'Insufficiency Gating',
      kind: 'categorical',
      target: 'Fallback / insufficient-evidence path',
      expected:
        'Empty or neutral input returns an explicit non-ranked state (insufficient_evidence or no_supported_friction). Never fabricates a ranked result from unmatched text.',
      input: () => '',
      assertion: (obs) => ({
        pass: ['insufficient_evidence','no_supported_friction'].includes(obs.status) && !(obs.rankedItems?.length),
        evidence: `Empty evidence returned ${obs.status}; only explicit insufficiency with no ranked output satisfies this fixture.`,
      }),
    },
    {
      id: 'U2 — Negation Trap',
      invariantClass: 'Negation Sensitivity',
      kind: 'input-relation',
      target: 'Signal extraction, context handling',
      expected:
        'Explicitly negated claims do not silently rank as positive evidence. At minimum, flagged for human review.',
      baselineInput: () => genericClaim(catA),
      transform: () => genericNegatedClaim(catA),
      relation: (baseline, transformed) => {
        if (!manifest.probePolicy?.negation) return uncertain('Domain negation policy is not declared.');
        if (baseline.status!=='ranked'||!baseline.rankedItems?.some(r=>r.label===catA)) return uncertain('Affirmative fixture did not establish the target signal.');
        if (transformed.status==='contradiction_flagged') return {pass:true,evidence:'Negation explicitly flagged.'};
        if (['error','unknown'].includes(transformed.status)) return uncertain('Negated fixture produced no usable semantic observation.');
        const positive=transformed.rankedItems?.some(r=>r.label===catA);
        return {pass:!positive && ['ranked','insufficient_evidence','no_supported_friction'].includes(transformed.status),evidence:`Target positive ranking after negation: ${!!positive}; status=${transformed.status}.`};
      },
    },
    {
      id: 'U3 — Score/Rank Tie Collision',
      invariantClass: 'Tie Stability',
      kind: 'input-relation',
      target: 'Scoring + ranking logic',
      expected: 'Ties resolve via a defined secondary sort, never raw input order, OR are surfaced through an explicit tie state — never silently hidden.',
      baselineInput: () => `${genericClaim(catA)} ${genericClaim(catB)}`,
      transform: () => `${genericClaim(catB)} ${genericClaim(catA)}`,
      relation: (baseline, transformed) => {
        // Per the frozen FrictionMap contract, a real near-tie state exists
        // and renders NO ranked items at all — comparing rankedItems[0] in
        // that state compares undefined to undefined, a false pass. Handle
        // it explicitly: both landing in the tie-review state IS the
        // invariant being satisfied (ties surfaced, not silently resolved).
        const bTie = baseline.status === 'near_tie_review_required';
        const tTie = transformed.status === 'near_tie_review_required';
        if (bTie && tTie) {
          return { pass: true, evidence: 'Both orderings correctly surfaced an explicit tie-review state rather than silently picking a winner.' };
        }
        if (bTie !== tTie) {
          return {
            pass: false,
            evidence: `Tie state inconsistent across reordering: baseline status=${baseline.status}, transformed status=${transformed.status}. Reordering the same two claims should not change whether a tie is detected.`,
          };
        }
        if (baseline.status!=='ranked'||transformed.status!=='ranked'||!baseline.rankedItems?.length||!transformed.rankedItems?.length) return uncertain('Tie fixture produced no comparable ranks.');
        const bTop = baseline.rankedItems[0]?.label;
        const tTop = transformed.rankedItems[0]?.label;
        return bTop === tTop
          ? { pass: true, evidence: `Same top finding ("${bTop}") regardless of which category was mentioned first.` }
          : {
              pass: false,
              evidence: `Top finding flipped from "${bTop}" to "${tTop}" purely from reordering the same two claims — resolution is input-order-dependent.`,
            };
      },
    },
    {
      id: 'U4 — Dilution / Keyword Stuffing',
      invariantClass: 'Density/Saturation',
      kind: 'input-relation',
      target: 'Scoring density / anchor quality',
      expected:
        'Observe repetition response; domain review must decide whether deduplication or density sensitivity is correct.',
      baselineInput: () => genericClaim(catA),
      transform: () => repeatedClaim(catA, 50),
      relation: (baseline, transformed) => {
        const identical =
          (baseline.renderedText ?? '').trim() === (transformed.renderedText ?? '').trim() &&
          baseline.rankedItems?.length === transformed.rankedItems?.length;
        return identical
          ? {
              pass: false,
              needsManualConfirmation: true,
              evidence:
                '50x repetition produced output structurally identical to a single mention — no density signal detected.',
            }
          : {
              pass: true,
              needsManualConfirmation: true,
              evidence:
                'Output differed between single mention and 50x repetition. This probe only confirms the engine notices density at all — whether the direction/magnitude is correct needs human confirmation; no formula-level oracle exists here.',
            };
      },
    },
    {
      id: 'U5 — Oversized Input',
      invariantClass: 'Insufficiency Gating',
      kind: 'categorical',
      target: 'Input length handling',
      expected: 'Observe oversized-input handling; domain limit and completeness policy require review.',
      input: () => (genericClaim(catA) + ' ').repeat(4000),
      assertion: (obs) => uncertain(`Oversized-input observation: ${obs.status}. Input limit and full-processing oracle are not declared; no automatic safety conclusion.`),
    },
    {
      id: 'U6 — Malformed / Special-Character Input',
      invariantClass: 'Input Robustness',
      kind: 'categorical',
      target: 'Input sanitization, rendering',
      expected: 'This special-character fixture does not execute script, interpret injected markup or break the instrumented rendering surface.',
      input: () => `${genericClaim(catA)} 🔥🔥 <script>alert(1)</script> — 混乱混乱 — \`\`\`inline code\`\`\` — ${'\u200B'.repeat(5)}`,
      assertion: (obs) => {
        if (!obs.rendering || !['scriptExecuted','markupInterpreted','renderingBroken'].every(k=>typeof (obs.rendering as any)[k]==='boolean')) return uncertain('No instrumented rendering evidence; text cannot prove injection safety.');
        return {pass:!obs.rendering.scriptExecuted&&!obs.rendering.markupInterpreted&&!obs.rendering.renderingBroken,evidence:'Instrumented script, markup interpretation and rendering-break flags evaluated for this fixture only.'};
      },
    },
    {
      id: 'U7 — Rapid Resubmit / State Leak',
      invariantClass: 'Session Isolation',
      kind: 'action-sequence',
      target: 'Session/run state',
      expected: 'Back-to-back runs do not silently blend prior state into the new result unless comparison is an intended feature.',
      run: async (adapter) => {
        if (!manifest.probePolicy?.replacementSubmissions) return uncertain('Replacement-submission semantics not declared.');
        const marker='Marker-'+randomUUID();
        await adapter.newSession('probe-u7');
        const first=await adapter.submit(`${genericClaim(catA)} ${marker}`);
        const second=await adapter.submit(genericClaim(catB));
        if (!first.currentResultText?.includes(marker)||typeof second.currentResultText!=='string') return uncertain('Marker positive control/current-result surface unavailable.');
        return {pass:!second.currentResultText.includes(marker),evidence:'Unique marker checked in current result only, excluding taxonomy and history.'};
      },
    },
    {
      id: 'U8 — Export / Naming Collision',
      invariantClass: 'Session Isolation',
      kind: 'action-sequence',
      target: 'Export/file naming',
      expected: 'Two different sessions produce distinguishable nonempty export filenames; this does not prove storage overwrite prevention.',
      run: async (adapter) => {
        await adapter.newSession('subject-A');
        await adapter.submit(genericClaim(catA));
        const exportA = await adapter.readExportedArtifact!();
        await adapter.newSession('subject-B');
        await adapter.submit(genericClaim(catB));
        const exportB = await adapter.readExportedArtifact!();
        if (!exportA.exportFilename?.trim() || !exportB.exportFilename?.trim()) return uncertain('Export filename missing; distinguishability unproven.');
        const collided = !!exportA.exportFilename && exportA.exportFilename === exportB.exportFilename;
        return collided
          ? { pass: false, evidence: `Both sessions exported to the same filename: "${exportA.exportFilename}".` }
          : {
              pass: true,
              evidence: `Distinct export filenames: "${exportA.exportFilename ?? 'n/a'}" vs "${exportB.exportFilename ?? 'n/a'}".`,
            };
      },
    },
    {
      id: 'U9 — Approval / Review State Toggle',
      invariantClass: 'State Idempotence',
      kind: 'action-sequence',
      target: 'Human-review workflow',
      expected: 'The pending indicator clears and remains clear on repeated approval; side-effect idempotency and durability require domain tests.',
      run: async (adapter) => {
        await adapter.newSession('probe-u9');
        const before=await adapter.submit(genericClaim(catA));
        if(before.pendingReviewIndicator!==true) return uncertain('Review fixture did not start pending.');
        await adapter.approve!();
        const afterFirst = await adapter.readLiveState();
        await adapter.approve!(); // must be idempotent
        const afterSecond = await adapter.readLiveState();
        const pass = afterFirst.pendingReviewIndicator===false && afterSecond.pendingReviewIndicator===false;
        return {
          pass,
          evidence: pass
            ? 'Pending-review indicator cleared after approval and stayed cleared on re-approve.'
            : `Pending-review indicator persisted (after first approve=${afterFirst.pendingReviewIndicator}, after second=${afterSecond.pendingReviewIndicator}).`,
        };
      },
    },
    {
      id: 'U10 — Report Completeness',
      invariantClass: 'Export Fidelity',
      kind: 'cross-surface',
      target: 'Report/export generation',
      expected: 'Live and exported versioned semantic snapshots match exactly; fields outside the declared snapshot schema are not validated.',
      input: () => genericClaim(catA),
      relation: (live, exported) => {
        if (!live.semanticSnapshot || !exported.semanticSnapshot || !Object.keys(live.semanticSnapshot.data).length || !Object.keys(exported.semanticSnapshot.data).length) return uncertain('Complete versioned semantic snapshots missing or empty.');
        return {pass:canonical(live.semanticSnapshot)===canonical(exported.semanticSnapshot),evidence:'Compared full declared semantic snapshots, including array order and extra/missing fields. Scope is the adapter snapshot schema.'};
      },
    },
    {
      id: 'U11 — Layout Risk Heuristic (manual confirmation)',
      invariantClass: 'Export Fidelity',
      kind: 'categorical',
      target: 'UI rendering, print/PDF layout',
      expected: 'Long text wraps within its container in-app and in print/PDF — no clipping or overflow.',
      input: () => genericClaim(catA),
      assertion: (obs) => {
        const longestToken = (obs.renderedText ?? '').split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '');
        return {
          pass: longestToken.length < 60,
          needsManualConfirmation: true,
          evidence:
            longestToken.length >= 60
              ? `Longest unbroken token in rendered text is ${longestToken.length} characters — possible overflow risk, but this is a text-only proxy. Requires visual/screenshot confirmation, not resolvable from headless text alone.`
              : 'No suspiciously long unbroken tokens detected. Still requires visual confirmation — this is a proxy check, not a layout guarantee.',
        };
      },
    },
    {
      id: 'U12 — Multi-Client / Session Isolation',
      invariantClass: 'Session Isolation',
      kind: 'action-sequence',
      target: 'Session/data isolation',
      expected: 'Two sequential client runs do not bleed data into each other and remain independently identifiable.',
      run: async (adapter) => {
        const marker = 'Marker-'+randomUUID();
        await adapter.newSession('subject-A-full');
        const obsA=await adapter.submit(`${genericClaim(catA)} Reference token: ${marker}.`);
        await adapter.newSession('subject-B-full');
        const obsB = await adapter.submit(genericClaim(catB));
        if (!obsA.currentResultText?.includes(marker)||typeof obsB.currentResultText!=='string'||!obsA.subjectId||!obsB.subjectId) return uncertain('Marker positive control or subject identity unavailable.');
        const bled = obsB.currentResultText.includes(marker) || obsA.subjectId===obsB.subjectId;
        return bled
          ? { pass: false, evidence: `Subject B's output contained subject A's unique marker "${marker}" — session data bled across subjects.` }
          : { pass: true, evidence: 'No cross-subject content bleed detected via marker token.' };
      },
    },
    {
      id: 'U13 — Evidence Monotonicity',
      invariantClass: 'Evidence Monotonicity',
      kind: 'input-relation',
      target: 'Score recalculation on evidence change',
      expected:
        "Adding supporting evidence for a category never lowers that category's rank on re-run; the rank should hold or improve, not degrade.",
      baselineInput: () => genericClaim(catA),
      transform: (base) =>
        `${base} On top of that, ${catA.toLowerCase()} also caused a second, completely separate incident this week.`,
      relation: (baseline, transformed) => {
        if(!manifest.probePolicy?.monotonicity) return uncertain('Domain has not declared ordinal monotonicity for this evidence fixture.');
        const rankIn = (obs: ToolObservation) => obs.rankedItems?.find((r) => r.label === catA)?.rank;
        const baseRank = rankIn(baseline);
        const transformedRank = rankIn(transformed);
        if (baseRank === undefined || transformedRank === undefined) {
          return {
            pass: false,
            needsManualConfirmation: true,
            evidence: `Could not locate "${catA}" in ranked output on one or both runs (baseline rank=${baseRank}, transformed rank=${transformedRank}).`,
          };
        }
        return transformedRank <= baseRank
          ? { pass: true, evidence: `"${catA}" rank held or improved (${baseRank} -> ${transformedRank}) after adding supporting evidence.` }
          : {
              pass: false,
              evidence: `"${catA}" rank got WORSE (${baseRank} -> ${transformedRank}) after adding supporting evidence for the same category — this is the exact defect already found manually (F4).`,
            };
      },
    },
  ];
  const caps: Record<string, Capability[]> = {U1:[],U2:['ranked'],U3:['ranked'],U4:['ranked'],U5:[],U6:['rendering'],U7:['current-result'],U8:['export'],U9:['review'],U10:['export','semantic-export'],U11:[],U12:['current-result','subject'],U13:['ranked']};
  return probes.map(p=>{const bound=Object.freeze({...p,probe_version:'0.2.0',requiredCapabilities:Object.freeze(caps[p.id.split(' ')[0]]) as unknown as Capability[],definitionContext:manifest});libraryProbes.add(bound);return bound;});

}

const GENERIC_PLACEHOLDER_MANIFEST: ToolManifest = {
  toolName: 'Generic Tool',
  buildVersion: 'n/a',
  categories: ['Category A', 'Category B'],
  knownRiskAreas: [],
  inputSurfaces: [],
};

/** Descriptive view derived from the executable probes — single source of
 * truth, no drift between "what we document" and "what we actually run". */
export const UNIVERSAL_PATTERNS: readonly UniversalPattern[] = buildUniversalProbes(GENERIC_PLACEHOLDER_MANIFEST).map(
  (p) => ({ id: p.id, invariantClass: p.invariantClass, target: p.target, expected: p.expected })
);

const EXPOSURE_ROUTING: ExposureType[] = [
  'Bug',
  'Data Inconsistency',
  'Feature Gap',
  'UX Defect',
];

// ---------------------------------------------------------------------------
// Row generation
// ---------------------------------------------------------------------------

function blankRow(overrides: Partial<ContradictorRow> = {}): ContradictorRow {
  return {
    testId: '',
    rowClass: 'Universal',
    target: '',
    repro: '',
    expected: '',
    actual: '',
    exposure: '',
    severity: '',
    blocksPeerTest: '',
    codexReady: '',
    notes: '',
    row_origin: 'planned',
    execution_state: 'not_run',
    ...overrides,
  };
}

/** Always-present rows: the fixed 13-pattern library, queued and unrun. */
export function generateUniversalRows(): ContradictorRow[] {
  return UNIVERSAL_PATTERNS.map((p) =>
    blankRow({
      testId: p.id,
      rowClass: 'Universal',
      target: p.target,
      expected: p.expected,
      actual: 'Not yet run.',
      blocksPeerTest: 'Yes',
      codexReady: 'N/A — not yet run',
    })
  );
}

/**
 * Tool-specific rows derived from a manifest: one Clean-case row per
 * declared category, one Adversarial row per declared risk area, plus the
 * fixed universal set. This is the "plug the system data in, get the
 * checklist filled with the data points that need input" mechanism.
 */
export function generateFromManifest(
  manifest: ToolManifest,
  includeManifestRows = true
): ContradictorRow[] {
  const rows: ContradictorRow[] = [];

  if (includeManifestRows) {
    for (const category of manifest.categories) {
      rows.push(
        blankRow({
          testId: `Clean — ${category}`,
          rowClass: 'Logic/Scoring',
          target: category,
          repro: `Single obvious signal for ${category}, nothing else.`,
          expected: `Primary finding = ${category}. No other category flagged.`,
        })
      );
    }
    for (const risk of manifest.knownRiskAreas) {
      rows.push(
        blankRow({
          testId: `Risk — ${risk.area}`,
          rowClass: 'Data Integrity',
          target: risk.area,
          actual: risk.why,
          blocksPeerTest: 'Yes',
        })
      );
    }
  }

  return [...rows, ...generateUniversalRows()];
}

// ---------------------------------------------------------------------------
// Classification / routing helpers — the "scores and routes" part of the
// boundary. No function here decides a fix.
// ---------------------------------------------------------------------------

/** A row blocks peer testing if explicitly marked so, or if its exposure
 * type is one that inherently should (bug/inconsistency/gap/UX defect). */
export function blocksPeerTest(row: ContradictorRow): boolean {
  try {if(row.execution_record)validateRecord(row.execution_record);}catch{return true;}
  return row.execution_record?.execution_state!==row.execution_state || row.row_origin!=='executed' || row.execution_state!=='passed' || !row.execution_record || row.blocksPeerTest === 'Yes' || EXPOSURE_ROUTING.includes(row.exposure);
}

export function isCodexReadyNow(row: ContradictorRow): boolean {
  return row.row_origin==='executed' && row.execution_state==='failed' && row.codexReady === 'Yes';
}

export function needsSpecDecision(row: ContradictorRow): boolean {
  return row.codexReady === 'No — needs spec';
}

export function filterBlocking(rows: ContradictorRow[]): ContradictorRow[] {
  return rows.filter(blocksPeerTest);
}

export function filterNeedsSpec(rows: ContradictorRow[]): ContradictorRow[] {
  return rows.filter(needsSpecDecision);
}

export function filterCodexReady(rows: ContradictorRow[]): ContradictorRow[] {
  return rows.filter((r) => blocksPeerTest(r) && isCodexReadyNow(r));
}

// ---------------------------------------------------------------------------
// Probe execution — turns a Probe + a ToolAdapter into a real ContradictorRow
// with an actual, observed result. This is the "executed by you" layer: no
// hypothesis rows past this point, only what the adapter actually returned.
// ---------------------------------------------------------------------------

export function relationResultToRow(probe: Probe, record: ProbeExecutionRecord): ContradictorRow {
  const result=record.result as RelationResult;
  const passed=record.execution_state==='passed', failed=record.execution_state==='failed';
  return immutable(blankRow({testId:probe.id,rowClass:'Universal',target:probe.target,expected:probe.expected,actual:result.evidence,
    exposure:passed?'Pass — No Issue':failed?'Bug':'Design Decision Needed',severity:'',
    blocksPeerTest:passed?'No':'Yes',codexReady:failed?'Yes':passed?'':'No — needs spec',
    row_origin:'executed',execution_state:record.execution_state,execution_record:record,
    notes:'Severity unassigned. This result is an observation, not authority or release approval.'}));
}
export interface RunOptions { store?:ExecutionStore; probe_run_id?:string; }
export function probeDefinition(probe:Probe):unknown {
  return {probe_id:probe.id.split(' ')[0],title:probe.id,probe_version:probe.probe_version??'custom-unversioned',
    kind:probe.kind,invariantClass:probe.invariantClass,target:probe.target,expected:probe.expected,
    requiredCapabilities:probe.requiredCapabilities??[],context:probe.definitionContext??null,library_version:PROBE_LIBRARY_VERSION,library_hash:LIBRARY_HASH};
}
/** Custom probes must provide a content digest for their executable module in definitionContext.
 * Library probes bind the actual library source bytes. No function-string hashing is claimed. */
export async function runProbe(probe:Probe,adapter:ToolAdapter,options:RunOptions={}):Promise<ContradictorRow> {
  const store=options.store??new MemoryExecutionStore();
  const id=options.probe_run_id??'PR-'+randomUUID();assertId(id);
  const definition=probeDefinition(probe);const definitionHash=hash('contradictor.probe.v1',definition);
  const descriptor=adapter.descriptor ? immutable(adapter.descriptor) : undefined;
  if(!descriptor) throw new Error('ADAPTER_DESCRIPTOR_REQUIRED');
  assertId(descriptor.tool_id);assertId(descriptor.adapter_id);assertId(probe.id.split(' ')[0]);
  const old=store.get(id);
  if(old) {
    if(old.probe_definition_hash!==definitionHash||old.tool_id!==descriptor.tool_id||old.tool_build!==descriptor.tool_build||old.adapter_id!==descriptor.adapter_id||old.adapter_version!==descriptor.adapter_version)throw new Error('IDEMPOTENCY_CONFLICT');
    return relationResultToRow(probe,old);
  }
  if(!probe.probe_version)throw new Error('PROBE_VERSION_REQUIRED');
  if(!libraryProbes.has(probe) && !/^sha256:[0-9a-f]{64}$/.test((probe.definitionContext as any)?.executable_hash??''))throw new Error('PROBE_EXECUTABLE_IDENTITY_REQUIRED');
  const started=timestamp();const steps:any[]=[];
  const inputs:string[]=[];const observations:ToolObservation[]=[];
  let state:Exclude<ExecutionState,'not_run'>='inconclusive';let result=uncertain('Not executed.');
  const missing=(probe.requiredCapabilities??[]).filter(c=>!descriptor.capabilities.includes(c));
  if((probe.requiredCapabilities??[]).includes('review')&&typeof adapter.approve!=='function')missing.push('review');
  if((probe.requiredCapabilities??[]).includes('export')&&typeof adapter.readExportedArtifact!=='function')missing.push('export');
  // Proxy records all sequence calls before/after. No tool operation is automatically replayed.
  const wrapped=new Proxy(adapter,{get(target,key) {
    if(!['newSession','submit','readLiveState','approve','readExportedArtifact'].includes(String(key)))return Reflect.get(target,key);
    return async (...args:any[])=>{
      const step:any={sequence:steps.length+1,operation:String(key),arguments:immutable(args),started_at:timestamp()};steps.push(step);
      if(key==='submit')inputs.push(args[0]);
      try {
        const fn=Reflect.get(target,key);if(typeof fn!=='function')throw new Error('UNSUPPORTED_OPERATION');
        const value=await fn.apply(target,args);
        step.completed_at=timestamp();step.output=value===undefined?null:immutable(value);
        if(key!=='newSession') {
          if(!value||typeof value.status!=='string'||!value.status||typeof value.observedAt!=='string'||!TIME.test(value.observedAt))throw new Error('INVALID_OBSERVATION');
          if (descriptor.capabilities.includes('ranked') && (!Array.isArray(value.rankedItems)||value.rankedItems.some((r:any)=>!r||typeof r.label!=='string'||!Number.isSafeInteger(r.rank)||r.rank<1)))throw new Error('INVALID_RANKED_OBSERVATION');
          observations.push(immutable(value));
          if(value.status==='error'||value.status==='unknown')throw new Error('UNUSABLE_OBSERVATION:'+value.status);
        }
        return step.output;
      }catch(e) {step.completed_at=timestamp();step.error=e instanceof Error?e.message:String(e);throw e;}
    };
  }});
  try {
    if(missing.length) {state='unsupported';result=uncertain('Missing capabilities: '+Array.from(new Set(missing)).join(', '));}
    else {
      switch(probe.kind) {
        case 'input-relation': {
          const baseline=probe.baselineInput();const transformed=probe.transform(baseline);
          await wrapped.newSession(id+'-baseline');const a=await wrapped.submit(baseline);
          await wrapped.newSession(id+'-transformed');const b=await wrapped.submit(transformed);
          result=probe.relation(a,b);break;
        }
        case 'categorical': await wrapped.newSession(id);result=probe.assertion(await wrapped.submit(probe.input()));break;
        case 'action-sequence':result=await probe.run(wrapped);break;
        case 'cross-surface':await wrapped.newSession(id);await wrapped.submit(probe.input());result=probe.relation(await wrapped.readLiveState(),await wrapped.readExportedArtifact!());break;
      }
      if(typeof result.pass!=='boolean'||typeof result.evidence!=='string')throw new Error('INVALID_RELATION_RESULT');
      state=result.needsManualConfirmation?'inconclusive':result.pass?'passed':'failed';
    }
  }catch(e) {state='error';result=uncertain('Execution error (not a confirmed product defect): '+(e instanceof Error?e.message:String(e)));}
  const evidence=store.putEvidence({probe_run_id:id,descriptor,definition,result,execution_state:state,steps});
  const record=sealRecord({schema_version:'contradictor.execution.v1',probe_run_id:id,probe_id:probe.id.split(' ')[0],
    probe_version:probe.probe_version??'custom-unversioned',probe_definition_hash:definitionHash,probe_definition:definition,
    tool_id:descriptor.tool_id,tool_build:descriptor.tool_build,adapter_id:descriptor.adapter_id,adapter_version:descriptor.adapter_version,
    started_at:started,completed_at:timestamp(),baseline_input_hash:inputs[0]===undefined?null:hash('contradictor.input.v1',inputs[0]),
    transformed_input_hash:inputs[1]===undefined?null:hash('contradictor.input.v1',inputs[1]),
    baseline_observation_hash:observations[0]===undefined?null:hash('contradictor.observation.v1',observations[0]),
    transformed_observation_hash:observations[1]===undefined?null:hash('contradictor.observation.v1',observations[1]),
    execution_state:state,relation_result:state==='passed'?'pass':state==='failed'?'fail':'inconclusive',result_version:'1.0.0',result,
    evidence_refs:[evidence],environment:{node:process.versions.node,unicode:process.versions.unicode??'unknown',platform:process.platform,clock_precision:'milliseconds_padded_to_six_digits'}});
  return relationResultToRow(probe,store.append(record));
}
export async function runAllProbes(adapter:ToolAdapter,manifest:ToolManifest,probes:Probe[]=buildUniversalProbes(manifest),options:RunOptions={}):Promise<ContradictorRow[]> {
  if(adapter.descriptor.tool_build!==manifest.buildVersion)throw new Error('BUILD_MISMATCH');
  const rows:ContradictorRow[]=[];
  for(const probe of probes) rows.push(await runProbe(probe,adapter,{store:options.store}));
  return rows;
}
/** Required coverage is explicit when supplied; empty, planned and inconclusive sets never clear.
 * Targeted human/spec review remains allowed while broad peer validation is blocked. */
export function readyForHumanValidation(rows:ContradictorRow[],requiredIds:string[]=rows.map(r=>r.testId)):boolean {
  return requiredIds.length>0&&rows.length>0&&filterBlocking(rows).length===0&&requiredIds.every(id=>rows.some(r=>r.testId===id&&!blocksPeerTest(r)));
}

// ---------------------------------------------------------------------------
// Markdown export
// ---------------------------------------------------------------------------

function mdCell(v: string): string {
  return (v || '—').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

export function buildMarkdownReport(
  rows: ContradictorRow[],
  title: string,
  intro: string,
  meta: { tester?: string; toolBuild?: string; overallNotes?: string } = {}
): string {
  let md = `# ${title}\n\n`;
  md += `- **Tester:** ${meta.tester ?? '—'}\n`;
  md += `- **Tool / Build:** ${meta.toolBuild ?? '—'}\n\n`;
  md += `${intro}\n\n`;
  md +=
    '| # | Test ID | Class | Target Area | Repro / Input | Expected | Actual | Exposure Type | Severity | Blocks Peer Test | Codex-Ready | Notes |\n' +
    '|---:|---|---|---|---|---|---|---|---|---|---|---|\n';
  rows.forEach((r, i) => {
    md += `| ${i + 1} | ${mdCell(r.testId)} | ${mdCell(r.rowClass)} | ${mdCell(r.target)} | ${mdCell(
      r.repro
    )} | ${mdCell(r.expected)} | ${mdCell(r.actual)} | ${mdCell(r.exposure)} | ${mdCell(
      r.severity
    )} | ${mdCell(r.blocksPeerTest)} | ${mdCell(r.codexReady)} | ${mdCell(r.notes)} |\n`;
  });
  md += '\n## Execution provenance\n\n';
  for(const r of rows) md += `- ${r.testId}: ${r.row_origin}/${r.execution_state}; execution=${r.execution_record?.probe_run_id??'none'}; record=${r.execution_record?.record_hash??'none'}\n`;
  if (meta.overallNotes) {
    md += `\n## Overall Notes\n\n${meta.overallNotes}\n`;
  }
  return md;
}

export function buildFullFindingsMarkdown(
  rows: ContradictorRow[],
  meta?: { tester?: string; toolBuild?: string; overallNotes?: string }
): string {
  return buildMarkdownReport(
    rows,
    'Break-It Pre-Test Exposure Log',
    'Full findings — everything checked, including passes, before this tool went to human or peer testing.',
    meta
  );
}

export function buildCodexFixListMarkdown(
  rows: ContradictorRow[],
  meta?: { tester?: string; toolBuild?: string; overallNotes?: string }
): string {
  return buildMarkdownReport(
    filterBlocking(rows),
    'Codex Fix List',
    'Blocking items only — these must be resolved before this build goes to a peer tester. Anything marked "No — needs spec" needs a decision made here first, not a guess from Codex.',
    meta
  );
}

// ---------------------------------------------------------------------------
// Layer 9 envelope — the handshake point for a future real Leviathan
// integration. Draft shape, not confirmed. See file header.
// ---------------------------------------------------------------------------

export function toManifestEnvelope(
  toolName: string,
  buildVersion: string,
  rows: ContradictorRow[]
): ContradictorManifestEnvelope {
  const blocking = filterBlocking(rows);
  const needsSpec = filterNeedsSpec(rows);
  const routingHints: string[] = [];
  if (blocking.length > 0) routingHints.push('blocks_peer_test');
  if (needsSpec.length > 0) routingHints.push('needs_spec_decision');
  if (readyForHumanValidation(rows)) routingHints.push('clear_for_peer_test');

  return {
    schema_version: 'contradictor-v2',
    integration_status: 'unverified',
    layer_name: 'The Contradictor',
    tool_name: toolName,
    build_version: buildVersion,
    classification_state: rows.length === 0 ? 'not_run' : readyForHumanValidation(rows) ? 'clear_for_peer_test' : 'blocked',
    promotion_default: 'candidate_only',
    sensitivity: 'normal',
    routing_hints: routingHints,
    finding_count: rows.length,
    blocking_count: blocking.length,
    needs_spec_count: needsSpec.length,
  };
}

// ---------------------------------------------------------------------------
// Public surface — the class a caller (Leviathan, a CLI, a UI, Codex) uses.
// ---------------------------------------------------------------------------

export class Contradictor {
  private _rows: ContradictorRow[] = [];
  private store:ExecutionStore;
  constructor(store:ExecutionStore=new MemoryExecutionStore()) {this.store=store;}
  get rows():ContradictorRow[] {return [...this._rows];}
  private seed(rows:ContradictorRow[]):void {for(const row of rows)if(!this._rows.some(r=>r.testId===row.testId))this._rows.push(immutable(row));}
  tester = '';
  toolBuild = '';
  overallNotes = '';

  seedUniversal(): this {
    this.seed(generateUniversalRows());
    return this;
  }

  seedFromManifest(manifest: ToolManifest): this {
    this.seed(generateFromManifest(manifest, true));
    this.toolBuild = this.toolBuild || `${manifest.toolName} — ${manifest.buildVersion}`;
    return this;
  }

  addFinding(row: Partial<ContradictorRow>): this {
    const {execution_record,...manual}=row;
    this._rows.push(immutable(blankRow({...manual,row_origin:'manual_observation',execution_state:'inconclusive'})));
    return this;
  }

  removeRow(index: number): this {
    throw new Error('APPEND_ONLY: start a new evaluation for a revised build; findings cannot be deleted.');
  }

  get blocking(): ContradictorRow[] {
    return filterBlocking(this.rows);
  }

  get needsSpecDecisions(): ContradictorRow[] {
    return filterNeedsSpec(this.rows);
  }

  get clearForPeerTest(): boolean {
    return readyForHumanValidation(this.rows);
  }

  /** Actually run the Universal Pattern set against a live tool via its
   * adapter — real observed rows, not hypotheses to fill in by hand. */
  async runUniversalProbes(adapter: ToolAdapter, manifest: ToolManifest): Promise<this> {
    const rows = await runAllProbes(adapter, manifest,buildUniversalProbes(manifest),{store:this.store});
    const ids=new Set(rows.map(r=>r.testId));
    // Planned placeholders become executed projections; existing execution history is preserved.
    this._rows=this._rows.filter(r=>!(r.row_origin==='planned'&&ids.has(r.testId)));
    this._rows.push(...rows);
    this.toolBuild = this.toolBuild || `${manifest.toolName} — ${manifest.buildVersion}`;
    return this;
  }

  /** The gate, as a property on the running instance: false until every
   * executed probe clears (or every manual-confirmation item is resolved
   * and re-marked). */
  get clearedForHumanValidation(): boolean {
    return readyForHumanValidation(this.rows);
  }

  toFullFindingsMarkdown(): string {
    return buildFullFindingsMarkdown(this.rows, {
      tester: this.tester,
      toolBuild: this.toolBuild,
      overallNotes: this.overallNotes,
    });
  }

  toCodexFixListMarkdown(): string {
    return buildCodexFixListMarkdown(this.rows, {
      tester: this.tester,
      toolBuild: this.toolBuild,
      overallNotes: this.overallNotes,
    });
  }

  toManifestEnvelope(toolName: string, buildVersion: string): ContradictorManifestEnvelope {
    return toManifestEnvelope(toolName, buildVersion, this.rows);
  }
}

// ---------------------------------------------------------------------------
// Example seed data — FFC FrictionMap's first real break-it pass. Reference
// usage, not core logic. Safe to delete once the real fix list has been
// consumed by Codex.
// ---------------------------------------------------------------------------

export const FRICTIONMAP_EXAMPLE_MANIFEST: ToolManifest = {
  toolName: 'FFC FrictionMap',
  buildVersion: 'v0.4.0 / rubric v0.1',
  // Patched per ffc-frictionmap-observed-output-contract.md (frozen):
  // 'Automation opportunity' confirmed live, first seen case 1e. Treat this
  // list as provisional, not exhaustive — an engine that surfaced one
  // undocumented category can surface more; do not assume 8 is the ceiling.
  categories: [
    'Decision latency',
    'Ownership confusion',
    'Process ambiguity',
    'Tool/system fragmentation',
    'Reporting blindness',
    'Delegation gaps',
    'Communication drag',
    'Automation opportunity',
  ],
  knownRiskAreas: [
    {
      area: 'Evidence anchor boundary detection',
      why: 'Anchors appear to key off whitespace gaps between statements rather than actual sentence/claim boundaries.',
    },
    {
      area: 'Score recalculation on evidence edit',
      why: 'Editing evidence updated the evidence list but the numeric score did not change.',
    },
    {
      area: 'Evidence count consistency across UI regions',
      why: 'One area shows Evidence: 1, ranking shows 3 frictions extracted, audit footer shows Evidence strength: 3 strong — three different numbers with no clear distinction.',
    },
    {
      area: 'Anchor fan-out without per-category evidence sufficiency',
      why: 'Confirmed live (frozen contract §4): a single broad/compound sentence can be cited as sole supporting evidence for multiple independent findings simultaneously (observed fan-out of 4 categories from one anchor). No independent per-category evidence check exists beyond anchor-matching.',
    },
    {
      area: 'Static boilerplate reasoning text, not evidence-derived',
      why: 'Confirmed live (frozen contract §5): symptom/structural-cause/recommended-intervention text is identical, word-for-word, across multiple unrelated evidence inputs for the same category. The displayed reasoning cannot be used to catch a bad category match — it carries no information about fit.',
    },
    {
      area: 'Fully-rendered signal card inside an insufficient-evidence state',
      why: 'Confirmed live (frozen contract §5, Observation A): a complete, structured signal card can render in full while the top-level status simultaneously declares INSUFFICIENT EVIDENCE. Only observed once — not yet confirmed as general.',
    },
  ],
  inputSurfaces: [
    'Operational context textarea',
    'Client/prospect field (intake)',
    'Review name field',
    'Load sample button',
  ],
};
