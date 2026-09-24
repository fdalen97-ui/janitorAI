---
name: Google Doc idempotency
description: Durable rule for safely retrying report generation across API, worker, and AI-engine restarts.
---

Create or claim the Google Drive document with a stable report-attempt identifier before any expensive AI analysis begins. A retry must reconcile that Drive marker and either reuse the completed document or wait for/replace a stale processing document. The API ledger and in-memory locks are supporting controls, not the source of external-side-effect idempotency.

**Why:** A process can time out or restart after Google has accepted work but before PostgreSQL records success. Retrying from the ledger alone can create a second document and a second AI charge.

**How to apply:** Any report-generation entry point, including background batches, must carry the same stable attempt identifier end to end. Concurrent Drive claims must select one deterministic canonical document before either request proceeds to AI work.