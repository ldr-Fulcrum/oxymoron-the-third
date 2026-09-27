# DEMO-CONTRACT-01 v1 — Frozen behavior
Authority: LDR explicit instruction, 2026-09-25. Owner: LDR. Status: FROZEN REQUIREMENT; execution/admission pending. Classification: documentation, IN-300 / IN-600 competition scope.

## Exact requirement DEMO-HC01
For a nonempty two-item EvaluationPlan and matching passed attempts, evaluatePlanReadiness must return blocked when authorized_by is absent, null, non-string, empty or whitespace. An authorized otherwise identical plan returns clear. An empty required set cannot clear. Wrong plan binding, probe-definition hash or target build cannot satisfy an item. These are structural authorization/context checks, not authentication or cryptographic approval proof.

Primary failure story: a genuine preserved pre-repair Bob candidate incorrectly clears an unauthorized nonempty plan (or throws an uncontrolled TypeError for missing authorization); the identical independently authored challenge reports failure. Bob repairs only that defect. The same challenge reports satisfied against the repaired candidate. A passing safety challenge means the invalid plan is BLOCKED, not that the invalid plan becomes clear.

Abhitek independently authors the oracle from these expectations; Codex/Bob do not supply his test implementation. Challenge includes direct readiness invocation, otherwise matching attempts, and an authorized positive control. Three identity negative controls preserve plan/probe/build boundaries. Synthetic data only.

## Frozen sequence and evidence
1. Publish and identify candidate files by commit plus SHA-256 manifest. Preserve genuine failing source before execution; never silently restore or mutate the current candidate to manufacture a defect.
2. Abhitek publishes challenge, fixtures, expected outcomes, command and challenge/fixture hashes BEFORE the measured before/after run.
3. Ahmad's loopback POST /execute runs the fixed challenge command against the admitted candidate. The invocation binds candidate revision/hash, challenge hash and fixture hash. No public server or untrusted commands.
4. Integration preserves raw request/response and structured challenge outcomes through Contradictor evidence storage. A process exit alone is not technical acceptance. Timeout, process error, missing/malformed result or mismatched identity cannot count as satisfied.
5. A confirmed failure routes to Bob with the unchanged requirement and bounded repair scope. Capture attributable Bob session summary and diff. No requirement/oracle changes.
6. Rerun identical challenge and fixtures against the repaired revision; only build identity and run-specific metadata change. Both runs remain preserved with distinct run IDs.
7. BUILD independently evaluates the chain; LDR records submission GREENLIGHT/HALT separately.

Required evidence: requirement ID/version; candidate commit and file hashes; challenge/fixture hashes; tool/runtime versions; request ID; command/executable/args/timeout; raw status/exit/stdout/stderr/timed_out/process_error/duration; timestamps; per-case expected/actual/disposition; Contradictor record/evidence references and hashes; repair packet/diff; Bob evidence; known limitations. Fresh operator must reproduce and reopen evidence without hidden local files.

## Brakes and truthfulness
No pre-repair source has been admitted by this freeze. Existing review logs are historical evidence, not executable failing artifacts. Current HC-B01 candidate already passes the reviewed cases. If no genuine failing candidate is recoverable and independent challenge finds no defect, report that result: the failure/repair demo remains BLOCKED. A disclosed seeded fixture would require a versioned LDR scenario amendment; never present it as a discovered live defect or pretend an old repair occurred after this freeze.

Behavior is frozen now; candidate/challenge hashes are separate pending admission records and cannot silently change this behavior. New criteria require v2, reason and LDR authorization. No claim of complete HC enforcement, malicious-host security, full schema equivalence, end-to-end integration, BUILD acceptance or submission qualification is established here.
