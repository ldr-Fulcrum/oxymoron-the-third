# Contradictor — Evidence Before Acceptance

Contradictor is an adversarial validation prototype for AI-assisted software development.

Its central premise is simple:

> A completion claim is not proof.

The demonstrated workflow separates implementation from challenge, execution, evidence, and technical review.

## Hackathon Demonstration

This repository contains the public competition release prepared for the IBM Bob 2.0 hackathon.

The demonstrated sequence is:

1. A requirement is frozen before repair.
2. An independent adversarial challenge exposes a reproducible failure.
3. IBM Bob receives a bounded repair task.
4. The repair is applied without weakening the challenge.
5. The same frozen challenge is executed again.
6. Before/after evidence is preserved.
7. The integrated candidate is independently reproduced and reviewed.

## Demonstrated F9 Case

The frozen F9 case tests authorization-property ownership.

A property inherited through an object's prototype chain must not satisfy the authorization requirement.

The bounded repair uses:

```js
Object.hasOwn(...)
```

This distinguishes an object's own authorization field from one inherited through its prototype.

### Historical before state

Historical candidate: `eb1d6a5`

Result: 29 / 30, F9: FAIL

The F9 case observed `clear` where the frozen requirement expected `blocked`.

This repository preserves that result as historical evidence. It is not a simulated failure.

### Historical repair

Repair lineage includes: `df31ea6`

The same frozen F9 challenge subsequently passed: 30 / 30

The challenge and fixture identities remained unchanged across the before/after comparison.

### Final integrated candidate

Integrated candidate independently reproduced during BUILD review:

`3c8e1a729f209b553b2dcd064c88dcdc51f4a540`

Independent reproduction recorded:

- TypeScript typecheck: PASS
- Node regression suite: 146 / 146
- Frozen adversarial challenge: 30 / 30
- Backend pytest suite: 8 / 8

The review also reproduced the historical boundary: the pre-repair candidate fails F9 and the integrated candidate passes it.

## Demo

The browser demonstration is located at: `demo/index.html`

It is a zero-dependency illustrative interface and makes no network calls.

The browser demo is not itself acceptance evidence and does not execute the production runner.

## Security Boundary

The execution backend is a trusted-local prototype.

It can execute the executable and arguments supplied by the caller using the server account's permissions.

It currently has no:

- authentication boundary;
- executable allowlist;
- sandbox;
- production authorization model; or
- public multi-tenant security boundary.

Do not expose the execution backend directly to the public Internet.

The hosted browser demo is separate from that execution backend.

## Known Limits

This project does not claim:

- production security;
- exhaustive adversarial coverage;
- arbitrary untrusted-code isolation;
- measured productivity gains; or
- resolution of every identified edge case.

The E1 zero-width-space behavior remains observational/deferred for this prototype.

## Evidence Principle

The purpose of Contradictor is not to replace human judgment.

Its purpose is to make software claims easier to challenge with reproducible evidence:

```text
claim
→ frozen requirement
→ independent challenge
→ execution
→ structured evidence
→ bounded repair
→ same challenge
→ comparison
→ independent review
```

Final submission and release decisions remain human decisions.

## License

Released under the MIT License. See [LICENSE](LICENSE).

Copyright © 2026 Fulcrum Fortress Consulting.
