---
name: Server media orphan cleanup
description: Why orphaned media deletion uses two-phase marking with grace periods instead of immediate delete-on-upsert
---

# Server media orphan cleanup design

**Rule:** Never delete server media immediately when a project upsert or deletion stops referencing it. Use two-phase cleanup: mark `unreferenced_at`, un-mark if any project references the id again, and only delete (row + file, atomically with a live in-SQL reference recheck) after a grace period.

**Why:** The per-note merge means a note (and its media references) can *transiently* vanish from the server JSON — e.g. device A pushes a newer copy that never saw device B's note; the note only returns when B next syncs. Immediate delete-on-diff would destroy media for a note that gets resurrected. Also, media uploads happen *before* the linking project PUT, so a brand-new upload is briefly unreferenced by design. Replayable test projects intentionally share durable media IDs with their source project, so deleting the source must not remove media still referenced by the test copy. If a migration creates separate media rows that point to the same physical file, row-level reference checks are insufficient: unlink only when no other row shares that file path.

**How to apply:**
- Referenced ids live in project JSON at `note.audioRemoteId`, `note.photos[].remoteId`, `projectDescriptionAudioRemoteId`.
- Upload grace (~1h) protects not-yet-linked fresh uploads; deletion grace (default 72h, `MEDIA_CLEANUP_GRACE_HOURS`) covers the offline-device resurrection window.
- Deletion must be a single conditional `DELETE ... RETURNING` that revalidates `unreferenced_at` and rechecks `NOT EXISTS (project data containing the id)` at execution time — a snapshot-then-delete pattern loses to concurrent re-referencing PUTs. Substring match on `data::text` is safe because ids are UUIDs and false positives only postpone deletion.
- Whole-project DELETE resets `unreferenced_at` to the current time and never unlinks immediately. Resetting is required because a stale old marker could otherwise bypass the grace window before a local-first replay copy's PUT arrives.
- Any operation that duplicates a media row for another tester must either duplicate the file too or make physical-file cleanup path-aware; deleting a duplicate row must never unlink a file still used by the source row.
- Backend changes only take effect after the user redeploys on Render.
