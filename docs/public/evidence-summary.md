# Evidence summary

This is a short factual index of the evidence included in this public release. It adds no results beyond those recorded in the files referenced below and in the repository [README](../../README.md).

## Frozen requirement

- [DEMO-CONTRACT-01.md](DEMO-CONTRACT-01.md): original frozen behavior for the demonstration case (v1).
- [DEMO-CONTRACT-01-v2.md](DEMO-CONTRACT-01-v2.md): v2 amendment that admits the F9 own-property authorization requirement. Both are copied byte-for-byte from the project's frozen documents, so any file paths mentioned inside them refer to the original private-repository layout; in this repository v1 is `docs/public/DEMO-CONTRACT-01.md`.

## Independent challenge

- `tests/adversarial/abhitek-02.test.mjs` and `tests/adversarial/fixtures/abhitek-02/fixtures.mjs`: the frozen 30-case adversarial challenge, including F9.
- Challenge hash recorded by the execution bridge for both historical runs: `sha256:299a2a3d291b9550768ab2f08edda5c6f6b9d9531f2a304348a5b8ceb3a2bd7d`.

## Historical before state (F9 fails)

[evidence/f9-before-20260926/](evidence/f9-before-20260926/)

- Run `Run-F9-Before-001`, candidate `eb1d6a5b850076f6a2b9d14992c12694e55b8689`.
- 30 tests: 29 passed, 1 failed (F9); execution state `failed`.
- Record hash `sha256:01225f6675bd6f0c9286df900a438a661a037c7dc7e0296621a26a3add3dce47`.

## Historical repair (F9 passes)

[evidence/f9-after-20260926/](evidence/f9-after-20260926/)

- Run `Run-F9-After-001`, candidate `df31ea621e9b2de4444ed5fc0806190494b4897e` (the IBM Bob `Object.hasOwn` repair).
- 30 tests: 30 passed, 0 failed; execution state `passed`.
- Record hash `sha256:1f4b9a52086228d2304912279ff1845674e4b84c9ac09d365bcaf80ccbeb1616`.
- `08-before-after-comparison.txt`: comparison of the two runs returned `failure_to_pass_evidence` with the same challenge hash.

Each run's `RESULT.json` records `final_acceptance: NOT_ISSUED`; these files are execution evidence, not an acceptance decision. One of the 30 challenge cases is the deferred E1 zero-width-space observation, not proof of E1 enforcement.

The full sealed evidence stores (records, content-addressed evidence files and raw command transcripts) are not published because they embed local machine paths and cannot be edited without invalidating their hashes.

## Integrated candidate

Integrated candidate independently reproduced during BUILD review: `3c8e1a729f209b553b2dcd064c88dcdc51f4a540`. The source, tests, schemas, scripts and backend in this repository are taken from that commit. The reproduction recorded (see README): TypeScript typecheck PASS; Node regression suite 146 / 146; frozen adversarial challenge 30 / 30; backend pytest 8 / 8.

## IBM Bob usage

[bob_sessions/](../../bob_sessions/) contains frames from screen recordings of the IBM Bob task `dd43fc08c8d7acda9ae99dec335124bd`, including the task session summary, the F9 finding review, the applied diff to `src/hc-validate.ts`, and Bob's explicit disclosure that it could not run tests in its environment. Screenshots are published as redacted copies; see [bob_sessions/REDACTIONS.md](../../bob_sessions/REDACTIONS.md).
