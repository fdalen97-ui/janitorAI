---
name: Workspace audit lockfiles
description: Non-obvious npm workspace behavior relevant to dependency security fixes.
---

After changing a dependency in one npm workspace, verify both the installed tree and every relevant lockfile package entry. A successful install command or updated manifest does not by itself prove that a vulnerable transitive resolution was replaced; run the workspace audit and inspect the resolved versions.

**Why:** In this monorepo, a workspace install left old `multer` and root `qs` lock entries while updating the API manifest. CI audits the API workspace and fails on the lockfile-resolved packages, not the declared ranges.

**How to apply:** For security updates, perform a clean `npm ci`, run the exact workspace-scoped audit command, and use `npm ls` to confirm the resolved versions before pushing.