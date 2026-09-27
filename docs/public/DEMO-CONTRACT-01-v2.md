# DEMO-CONTRACT-01 v2 — F9 own-property amendment
Authority: LDR explicit approval on 2026-09-26: approve F9 and defer E1; execute needed actions.
Status: FROZEN REQUIREMENT. Candidate/challenge admission and executed evidence pending.

## Scope and precedence
This version consists of DEMO-CONTRACT-01 v1 at docs/demo-freeze-20260925-v1/DEMO-CONTRACT-01.md plus this bounded amendment. The original v1 remains preserved unchanged. This amendment supersedes v1 only on the own-property authorization requirement and the corresponding prospective demo scenario. All other requirements, identity controls, execution/evidence requirements and authority boundaries remain in force.

## DEMO-HC01-F9 — Required behavior
For an otherwise valid nonempty two-item EvaluationPlan with matching passed attempts, evaluatePlanReadiness must return blocked without an uncontrolled exception when authorized_by is absent from the plan's own properties, even if its prototype supplies a nonempty authorization string.

An otherwise identical plan with its own nonempty valid authorized_by and matching passed attempts must return clear. The existing absent/null/non-string/empty/whitespace authorization blocking, empty-required-set blocking and plan/probe/build identity controls remain unchanged. Own-property presence is necessary, not sufficient; all existing checks still apply.

This is a structural metadata requirement for the direct readiness API. It neither authenticates an author nor asserts a demonstrated external prototype-pollution exploit. An inherited value cannot act as the plan's authorization.

## E1 disposition — DEFERRED
U+200B and broader invisible-character restrictions are not added by this version. Preserve the E1 observation and disclose the limitation. Do not change normalization or invent an invisible-character filter during F9 repair. A later restriction needs an explicit character policy, versioned requirement and authorization.

## Prospective challenge / repair sequence
Abhitek independently authors the asserting F9 oracle and preserves an own-property positive control, corrects B2 and documents exact-byte checkout. Publish a NEW challenge/fixture freeze and hashes before the measured failing execution. Preserve prior observational challenge 4ab78d286e37a27451fb1b394e4b51d09c1c0eda and its historical results.

Codex executes the unchanged frozen challenge through the existing local backend/evidence bridge against an admitted unmodified candidate and preserves request, response, code/challenge hashes and record references. The known observation is a candidate for this prospective failure; it is not itself the new asserted failing run.

Only after a genuine failure under v2 is preserved may a bounded F9 repair packet route to Bob. Product repair scope is own-property authorization enforcement in HC-B01, preserving all other semantics. Do not modify the independent challenge to pass, add E1 restrictions, expand HC-B02+, or spend Bob activity on speculative repair before evidence exists. Same challenge/fixtures rerun against repaired build with new run identity. Capture actual Bob session/diff and disclose the executor if Codex runs commands.

Describe this accurately as a repair against a newly clarified v2 requirement, not a retroactive violation of v1. No seeded production defect or fabricated historical Bob action. BUILD owns independent technical determination; LDR retains final submission greenlight.
