# Reproducing the Contradictor checks

Scope: local, trusted execution of the Node regression suite, the frozen adversarial challenge, and the Python execution backend tests contained in this repository. A passing run means the executed tests passed; it is not a security certification or a release decision. See [SECURITY.md](../../SECURITY.md) before running the backend.

## Runtime

The integrated candidate was reproduced with Node 26.5.0 and Python 3.12. Node must support native TypeScript type stripping (`.ts` imports without a build step) and the `node:test` reporter API. Other runtime versions are unverified. No private environment file is required. Direct Python dependencies are pinned in `requirements-dev.txt`; transitive Python dependencies are not locked. npm uses `package-lock.json`.

## Install and check

POSIX:

```sh
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
export PYTHON="$PWD/.venv/bin/python"
npm run typecheck
npm run test:all
node --test tests/adversarial/abhitek-02.test.mjs
.venv/bin/python -m pytest tests/test_execution.py -q
```

Windows (PowerShell):

```powershell
npm ci
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
$env:PYTHON = (Resolve-Path .venv/Scripts/python.exe).Path
npm run typecheck
npm run test:all
node --test tests/adversarial/abhitek-02.test.mjs
.\.venv\Scripts\python.exe -m pytest tests/test_execution.py -q
```

What each command covers:

- `npm run typecheck`: strict TypeScript check of `src/contradictor.ts`, `src/provenance.ts`, `src/hc-schemas.ts` and `src/hc-validate.ts`.
- `npm run test:all`: `tests/kernel.test.mjs`, `tests/adversarial/abhitek-01.test.mjs`, `tests/hc-b01/hc-b01.test.mjs`, `tests/hc-b01/schema-agreement.test.mjs`, `tests/integration/execution-bridge.test.mjs` and `tests/integration/compare-evidence.test.mjs`, run serially.
- `tests/adversarial/abhitek-02.test.mjs` with `tests/adversarial/fixtures/abhitek-02/fixtures.mjs`: the frozen 30-case adversarial challenge, including F9. It is run separately from `test:all`.
- `tests/test_execution.py`: backend tests for `backend/main.py`.

The bridge integration suite starts and stops its own loopback backend (`tests/integration/start_backend.py`) on an OS-assigned port. Its synthetic success/failure/timeout/tamper fixtures (`tests/fixtures/`) test plumbing only; they are not the F9 case. Retained `.bridge-test-*` folders are synthetic artifacts and are ignored by Git.

## Run a challenge through the execution bridge

Start the backend from the repository root in a separate terminal, bound to loopback only:

```sh
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Create an input JSON file with real absolute paths on your machine. This example uses the repository's own regression suite as a plumbing check:

```json
{
  "run_id": "Run-Example-001",
  "challenge_id": "HC01-Regression",
  "candidate_root": "/absolute/path/to/this/repository",
  "test_file": "tests/hc-b01/hc-b01.test.mjs",
  "fixture_files": ["tests/hc-b01/fixtures.mjs"],
  "source_files": ["src/hc-validate.ts", "src/hc-schemas.ts"],
  "endpoint": "http://127.0.0.1:8000/execute",
  "timeout_ms": 30000,
  "evidence_root": "/absolute/path/to/a/fresh/evidence/folder"
}
```

To run the frozen challenge instead, use `tests/adversarial/abhitek-02.test.mjs` as `test_file` and list `tests/adversarial/fixtures/abhitek-02/fixtures.mjs` in `fixture_files`.

```sh
node scripts/prepare-challenge.mjs input.json frozen-run.json
# Review the manifest before executing.
node scripts/run-challenge.mjs frozen-run.json
```

CLI exit 0 = challenge passed; 1 = challenge failed and needs review; 2 = error, inconclusive, or admission failure. Missing or malformed reports, inconsistent status, skipped/todo/cancelled cases, or zero tests never count as a pass.

The manifest records the Git HEAD and SHA-256 of the explicitly listed files. It does not prove the whole working tree is clean, and it cannot detect a malicious change-and-restore, unlisted dependency drift, or a dishonest local backend. Backend and bridge must run on the same trusted machine.

Evidence is written to `<evidence_root>/<run_id>/records` and `evidence`. Use a new run ID for every execution; duplicate run IDs are refused.

## Inspect, export and compare executions

```sh
node scripts/inspect-evidence.mjs /path/to/evidence/Run-Example-001 Run-Example-001
node scripts/inspect-evidence.mjs /path/to/evidence/Run-Example-001 Run-Example-001 /path/to/new-review-package
node scripts/compare-evidence.mjs /path/to/evidence/Run-Before Run-Before /path/to/evidence/Run-After Run-After
```

`inspect-evidence` reopens and validates a run and can export a new, no-overwrite review package. `compare-evidence` reopens two runs, verifies their hashes, and checks identical challenge identity, distinct candidate commits, run order, initial failure and passed rerun. Exit 0 reports `failure_to_pass_evidence`; exit 1 reports why a transition is not demonstrated; exit 2 means missing, invalid or tampered evidence. For programmatic reopening, `src/provenance.ts` exports `FileExecutionStore`.

## Historical F9 before/after evidence

The historical before (`eb1d6a5`) and repair (`df31ea6`) candidates are not part of this repository's fresh history, so the before/after pair cannot be re-executed from this repository alone. Summaries of those runs are preserved in:

- `docs/public/evidence/f9-before-20260926/RESULT.json` and `review-package/summary.json` (29/30, F9 failed)
- `docs/public/evidence/f9-after-20260926/RESULT.json` and `review-package/summary.json` (30/30)
- `docs/public/evidence/f9-after-20260926/08-before-after-comparison.txt` (comparison result `failure_to_pass_evidence`)

The full sealed evidence stores for those runs are not published because they embed local machine paths. See [evidence-summary.md](evidence-summary.md).
