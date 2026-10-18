# Volt Assistant: engineering case study

## Problem and scope

A purchaser starts with a specification, checks available electrical products and possible substitutions, and exports a reviewed purchase list. The project explores the points where convenience can conflict with correctness: partial extraction, incompatible substitutes, stale prices and repeated confirmation.

The original hackathon has ended. This is an independent local portfolio application, not an official supplier service. Public examples are invented. There are no real orders, reservations, payments or claims of business savings.

## A workflow with explicit authority

1. Upload a document; a durable job records processing progress.
2. Review extracted text and quantities. Save a draft and resume later.
3. Select catalogue products or rule-based substitution candidates.
4. Prepare a time-limited proposal. The cart is still unchanged.
5. Explicitly confirm; a transaction revalidates revision, price, quantity and stock.
6. Export CSV/XLSX.

Qwen is useful for interpreting free text and images, but its output is not trusted as commercial truth. Search without a model is a supported baseline, not an error screen.

## Decisions worth discussing in an interview

- Why one PostgreSQL database supports both business transactions and a bounded work queue: [ADR 001](decisions/001-go-and-postgres.md).
- Why the assistant cannot execute arbitrary model-generated actions: [ADR 002](decisions/002-model-boundary.md).
- How a draft revision prevents a second tab overwriting newer work, and how upgrades preserve version-one data: [ADR 003](decisions/003-review-and-migrations.md).
- Why CPU-only inference was chosen on this particular laptop and what the 10,000-product measurements do and do not establish: [ADR 004](decisions/004-local-runtime-and-scale.md).

## Failures that changed the implementation

**A late worker could replace newer output.** A lease expiring does not stop the original process. Completion now checks the claimed attempt number. Tests cover cancellation, lease recovery, concurrent claims and the old worker finishing after its replacement.

**16A also matched 116A.** A larger synthetic catalogue exposed substring ambiguity. Numeric terms now match complete normalized tokens. Exact articles return their one product. The browser and chat share server search rules.

**Vite uploads were rejected.** The development proxy rewrote Host while the browser retained its Origin. Preserving Host fixed development without disabling server CSRF protection. CI now checks both the built application and the development proxy.

**One tab could erase another tab's draft.** Compare-and-swap revisions reject stale edits, leave local values visible and ask for an explicit reload.

**A valid JSON response still had the wrong intent.** The earlier Kazakh delivery regression showed that schema-constrained generation alone is insufficient. Recognized purchase terms remain authoritative on the server.

## Evidence, not a feature count

- [Verification record](verification.md): test and CI evidence.
- [Evaluation report](evaluation.md): query labels, actual model outputs, document fixtures and measurement limits.
- [Recorded walkthrough](demo/walkthrough.webm) and [transcript](demo/transcript.md).
- [API contract](openapi.json) and [architecture](architecture.md).

The remaining boundary is deliberate: local use, a bounded catalogue and mandatory review. Broader supplier integration, production concurrency, arbitrary photographed paperwork and general multilingual dialogue require separate validation.

