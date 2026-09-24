---
name: Replay evidence safety
description: The durable-evidence boundary for replaying projects with unavailable attachments
---

Replay may omit an attachment only when the persisted record explicitly marks it as lost and has no durable media ID. Unmarked device-local URIs, missing durable media, and media IDs outside the tester's ownership must still stop the replay.

**Why:** A known-lost local attachment cannot be reconstructed and should not block a report that still has durable evidence, but silently dropping ambiguous evidence would make replay results incomplete without an operator-visible failure.

**How to apply:** Keep the omission narrowly scoped to explicitly lost evidence collections and retain hard failures for every other non-durable or unowned reference.