# CLAUDE.md

**Read `AGENTS.md` first — it is the source of truth (system of record).**

This file holds Claude-Code-specific invariants only; `AGENTS.md` is the shared, multi-model
contract. Do not let the two conflict. (Team tip: this file may be replaced with a symlink
`CLAUDE.md -> AGENTS.md` for multi-model reuse.)

## Invariants

- Before working, read `AGENTS.md` (sections 3, 4, 6, 7), `.claude/feature_list.json`, and
  `progress.md`.
- Keep exactly ONE feature `in-progress`; respect the DAG in `.claude/feature_list.json`.
- Run the real verify commands and paste their output into the feature's `evidence` — never
  claim done from reasoning.
- Use absolute paths; do not commit `.env`.
- End of session: update `progress.md` and `session-handoff.md`, and leave a clean state so the
  next session only needs `bash init.sh`.
- Before writing implementation code, use the `test-driven-development` skill (RED first). On any
  failing verify, use the `systematic-debugging` skill and obey the stop-conditions in
  AGENTS.md §11 (2-same / 3-different).
- Never fix-by-deletion. End each feature with a Completion Summary (per AGENTS.md §11).
