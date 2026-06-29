# session-handoff.md — Session Handoff

> Filled at the end of every session so the next session (human or agent) can reboot immediately
> with `bash init.sh`. Leave a clean state. This is a deliberate handoff, not a copy of the docs.

Full context lives in the docs (don't restate here):
- Product (what & why): `docs/PRODUCT.md`
- Architecture (decided): `docs/ARCHITECTURE.md`
- Locked decisions (the six DISCUSS answers): `docs/questions.md`

Model: **many saved bars per shop, at most one active at a time** (full CRUD admin; the storefront
renders the single active bar).

## Quick reboot

```bash
nvm use            # Node 22
bash init.sh       # prepares per-tier .env, brings up MySQL, installs deps, runs verify
```
Read order: `AGENTS.md` (source of truth) → `.claude/feature_list.json` → `progress.md` → this file.

> Note: each tier owns its `.env` — `backend/.env` (secrets + DB, auto-loaded via godotenv),
> `frontend/.env` (Vite `VITE_REACT_APP_*`, public only), `storefront/.env` (webpack `REACT_APP_*`,
> build-time). `init.sh` step 3 creates them from each `*/.env.example`. `bash init.sh`
> (Node 22 + Docker) now finishes **GREEN (steps 1–9)**. On this TLS-intercepting network prefix it
> with `npm_config_strict_ssl=false` (not baked into the repo).

## Most recent handoff

- **Date:** 2026-06-29
- **Active feature:** none in-progress. **ALL 8 features DONE (feat-001 → feat-008).** feat-004–008
  were promoted from `manual-verification` to `done` on the user's hands-on sign-off (2026-06-29).
- **Done this session (polish + deliverables):** storefront bar made **sticky** at the top; **message
  now always required** + title ≤120 / message ≤200 length rules (TDD, both tiers, via new
  `frontend/src/lib/barValidation.ts`); `*` required markers + character counters; checkboxes →
  **toggles** (editor "Enabled" + "Enable countdown", and a per-row activate/deactivate toggle in the
  list that keeps one-active); **Add** screen uses a "Create bar" page action (no save bar) while
  **Edit** keeps the contextual save bar; new bars default `message = "Your message here!"`; removed
  unused `formik`/`yup`; wrote `docs/demo-script.md`; built the Vietnamese slide deck
  `presentation/index.html`.
- **In progress:** none.
- **Next:** all features done. Repo URL filled (slide 16 + `docs/demo-script.md` §3 ->
  github.com/nhs21202/sonnh-AI-capstone-project). Remaining non-code deliverable: record the demo
  video (`docs/demo-script.md` walkthrough) and submit. Capstone deadline: **14:00 Tue 2026-06-30**.
- **Blockers:** none.
- **Last verify status:** `bash init.sh` → **exit 0, HARNESS GREEN (1–9)**. Backend `go test ./...`
  all pass (config; DB integration; handlers incl. auth bad-HMAC → 401; shopify; `validate` incl. the
  new length + always-required-message rules).
  Frontend: tsc 0, **67 vitest pass** (logic + slice + component tests), vite build 0.
  Storefront: 5 vitest pass, webpack 0. npm needs `npm_config_strict_ssl=false` on this network.
- **Running process:** a dev backend is up on `127.0.0.1:5005` (serves the built admin from
  `frontend/dist`). Before recording the demo, restart it (`cd backend && go run .`) so it serves the
  latest code, and replace the placeholder test-bar message with real demo copy.
- **Clean state?:** yes — `node_modules`/`dist`/`.env` git-ignored; MySQL container left running
  (`make db.down` stops it).

Guardrail (Day-4): `.claude/settings.json` + `.claude/hooks/block-dangerous.sh` (PreToolUse,
exit 2 = block) + `.claude/hooks/scan-secrets.sh` (PostToolUse, warn-only). Tested green via raw
exit codes — full detail in `progress.md` (Session 2), not here.

## Before-you-leave checklist

- [ ] `feature_list.json` reflects true status (1 feature in-progress, or 0).
- [ ] `evidence` of any feature just marked done has real verify-command output.
- [ ] `progress.md` has a new dated entry.
- [ ] No stray changes; `bash init.sh` is re-runnable.
- [ ] `.env` is NOT committed.
