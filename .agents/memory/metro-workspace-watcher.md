---
name: Metro workspace watcher
description: Why the Expo monorepo Metro configuration excludes transient workspace profile directories.
---

Metro watches the repository root because the mobile app resolves shared workspace code from there. Transient workspace directories such as `.config/chromium` are not source and can disappear while Metro walks them, causing an `ENOENT` watcher crash before port 5000 opens.

**Why:** Keeping the broad monorepo watch folder is useful, but including browser profiles makes preview startup dependent on unrelated process state.

**How to apply:** Keep transient workspace directories out of Metro's resolver block list whenever the workspace root is included in `watchFolders`.