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

- **Date:** 2026-06-28
- **Active feature:** none — **feat-001 → feat-006 all DONE**. Next is feat-007.
- **Done this session:** **feat-002 signed off (live install)**, plus built **feat-003/004/005/006**
  test-first: backend admin CRUD + one-active invariant + anti-IDOR (`handlers/bars.go`, `validate`,
  `middleware/admin.go`); public endpoint (`handlers/public.go`, single active/null, expiry gate, no
  title leak, CORS *); admin UI (ApiClient+App Bridge token → repository → Redux slice → Polaris
  list/editor + `date-fns-tz`); storefront (countdown math, fetch+render+ticker, Theme App Extension
  app-embed block). `bash init.sh` GREEN (1–9); backend `go test` all pass; both JS tiers build + unit-test.
- **In progress:** none.
- **Next:** **feat-007** — E2E demo script (create 2 bars → activate → storefront shows it → swap →
  delete → near-deadline expiry) + full verify suite + capstone deliverables (repo/slides/workflow note).
  feat-008 optional (live-ticking admin preview, cuttable).
- **Blockers:** none. (feat-003/004 are high-risk: logic + security fully unit/integration-tested;
  confirm live admin CRUD + storefront render at the demo.)
- **Last verify status:** `bash init.sh` → **exit 0, HARNESS GREEN (1–9)**. Backend `go vet/build` 0;
  `go test ./...` all pass (config; database **integration**: AutoMigrate + multi-bar-per-shop +
  shop-scoping; handlers: health + **auth bad-HMAC → 401**; shopify: HMAC/authorize/session-token).
  `announcement_bars` migrated (`shop` MUL non-unique). npm needs `npm_config_strict_ssl=false` here.
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
