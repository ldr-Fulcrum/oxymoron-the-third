# bob_sessions — IBM Bob usage evidence

This folder contains IBM Bob IDE task-session screenshots submitted as evidence of Bob usage for the IBM Bob 2.0 hackathon. All images are redacted copies for privacy; see [REDACTIONS.md](REDACTIONS.md). [EVIDENCE-INDEX.csv](EVIDENCE-INDEX.csv) lists each screenshot with its work item and notes.

All frames come from screen recordings that scroll back through one existing Bob task, task ID `dd43fc08c8d7acda9ae99dec335124bd` (workspace `oxymoron-the-third`). The recordings were made after the task, so the video offsets in the filenames are not historical task times.

## recording-20260926-162853: task session summary

Expanded task summary showing task ID, workspace, context length and Bobcoins displayed for the task (38.14), together with the task's todo list and the F9 hand-off limitations. The Bobcoin figure is a per-task display, not a claim about account balance or total team consumption.

## recording-20260926-162621: F9 repair and earlier HC-B01 work

- `f9-finding-review`: Bob reads the F9 finding and identifies that `plan.authorized_by` is satisfied through the prototype chain.
- `f9-applied-diff`: Bob applies a diff to `src/hc-validate.ts` and traces F9 against the new guard.
- `f9-frozen-oracle`: Bob checks that the frozen challenge and fixture files are unchanged.
- `f9-handoff-written`, `f9-code-before-after`: Bob's F9 return with the `Object.hasOwn` before/after snippet.
- `f9-not-run`, `f9-before-identity`, `f9-handoff-limitations`: Bob explicitly reports that its shell was unavailable (tests NOT_RUN), lists the before-state identity and states that no final acceptance is claimed.
- `hcb01-*`: earlier HC-B01 schema/identity work and repair packaging in the same task.

## recording-20260926-165911: earlier HC-B01 history

Initial packet scope, failed shell commands, the test-execution limitation, Bob's disclosure that implementation preceded a requested preflight, the independent acceptance boundary, and later repair tests.

## Limits

These screenshots show Bob's actions and statements. They do not by themselves prove test execution: Bob reported that it could not run tests, and execution results come from the separate evidence summarized in [docs/public/evidence-summary.md](../docs/public/evidence-summary.md).
