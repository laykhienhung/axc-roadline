---
name: "DevSpec: Archive"
description: Move a done change's artifacts to devspec/archive/, keeping its board entry as done (worker auto-fires this per change)
category: Workflow
tags: [workflow, archive, cleanup]
---

Invoke the `devspec-archive` skill. Input: `$ARGUMENTS` (optional change id; sweeps done-but-unarchived changes if omitted).
