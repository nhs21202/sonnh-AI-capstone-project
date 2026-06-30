# progress.md — Session Log

Human-readable, **chronological** record of progress. The machine-readable source of truth for
feature state + evidence is `.claude/feature_list.json`; this file is the narrative bridge between
sessions (alongside `session-handoff.md`). Keep entries short and factual.

## Current status (2026-06-29)

**All 8 features DONE.** `bash init.sh` → **HARNESS GREEN (9/9)**: backend `go test`, frontend 51
vitest, storefront 5 vitest, all builds 0. Feature state (mirrors `.claude/feature_list.json`):

| Feature | What | Status |
|---|---|---|
| feat-001 | Repo scaffold + demo environment | **done** |
| feat-002 | Data model + OAuth install (stateless) | **done** (live install signed off) |
| feat-003 | Admin CRUD API + one-active + anti-IDOR | **done** (live admin CRUD signed off) |
| feat-004 | Public storefront endpoint (expiry gate) | **done** (public endpoint verified live via curl) |
| feat-005 | Admin UI config form | **done** |
| feat-006 | Storefront bundle + theme extension | **done** |
| feat-007 | E2E demo + verify suite + deliverables | **done** (repo URL placeholder still to fill) |
| feat-008 | Live-ticking admin preview | **done** |

feat-004–008 were promoted from `manual-verification` to `done` on the **user's hands-on sign-off
(2026-06-29)** for capstone submission. **Remaining non-code item:** fill the repo URL placeholder
(presentation slide 16 + `docs/demo-script.md` §3).

## Blockers

- None. Awaiting the user's hands-on verification of feat-004–008.

## Resolved decisions

- **Schema / DAG:** course schema; feature DAG lives in `.claude/feature_list.json`.
- **Stateless auth:** the only table is `announcement_bars`; admin auth via the App Bridge
  session-token `dest` claim; the OAuth callback discards the access token; the app never calls the
  Shopify Admin API; no shop/session/token table.
- **One active per shop:** many saved bars, at most one enabled — enforced in a DB transaction.
- **Anti-IDOR:** session-token `dest` compared to `:shop` in ALL modes (403 on mismatch).
- **Schema management:** GORM `AutoMigrate` on boot (golang-migrate dropped — single-table app).
- **Per-tier `.env`:** `backend/.env` (secrets + DB), `frontend/.env` + `storefront/.env` (public,
  compiled into the bundles). No root `.env`.
- **Validation (both tiers, mirrored in `validate.Bar` + `frontend/src/lib/barValidation.ts`):**
  title required ≤120; **message required (always) ≤200**; hex colors; future countdown deadline when
  countdown is on.
- **Admin UI:** Polaris + App Bridge; ColorPicker popover + hex field; on/off **toggles** (not
  checkboxes); inline `TextField` errors with `*` required markers; **Edit** uses the contextual save
  bar, **Add** uses a "Create bar" page primary action.

## Session log (chronological)

### Session 1 — Planning (2026-06-28)
Brainstormed scope (many saved bars per shop, one active at a time). Wrote `docs/PRODUCT.md`,
`ARCHITECTURE.md`, `plan.md`, `user-stories.md`, `complex-cases.md`, `questions.md`; authored the
feature DAG (`.claude/feature_list.json`); stood up the harness scaffold (`AGENTS.md`, `CLAUDE.md`,
`progress.md`, `session-handoff.md`, env descriptors).

### Session 2 — Guardrail / feedback subsystem (2026-06-28)
Stood up the guardrails (a harness component, not a DAG feature): `.claude/settings.json`
(permission allow/ask/deny + hook registration), `block-dangerous.sh` (PreToolUse, exit 2 = block),
`scan-secrets.sh` (PostToolUse, warn-only). Windows-adapted: hooks run as `bash .claude/hooks/*.sh`;
a **probe-validated** JSON parser keeps the fail-closed contract (no `jq`; the on-PATH `python3` is a
fake App-Execution-Alias stub).
**Evidence:** `rm -rf /`, `git push --force`, `git reset --hard`, `DROP TABLE`, `curl … | sh` → exit 2
(blocked); safe commands → 0; secret patterns (`shpat_…`, `mysql://user:pass@…`) → warning.

### Session 3 — Environment subsystem (2026-06-28)
Built `.gitignore`, `docker-compose.yml` (MySQL 8 only; app user; healthcheck; `127.0.0.1:3307`;
named volume), `.nvmrc` (`22`), root `Makefile`, and `init.sh` (Node 22 → Go → `.env` → MySQL up →
wait healthy → backend test+build → frontend ci → storefront ci → GREEN banner).
**Evidence:** early steps GREEN on a Node-22 + Docker checkout; the backend step is an intended
controlled-RED until feat-001 creates `backend/`. DB vars identical across compose / `.env.example` /
`Makefile` / `init.sh`.

### Session 4 — Prototype UI spec (2026-06-28)
Created `docs/prototype/` (`index.html`, `styles.css`, `admin-list.html`, `admin-editor.html`,
`storefront-bar.html`) as the static UI source-of-truth: shared design tokens; admin list with one
Active badge + Edit/Delete; per-bar editor with toggle + colors + countdown + live preview; storefront
mock with the single active bar + ticking countdown. Static HTML/CSS only; English; brand
"Announcement Bar App".

### Session 5 — feat-001 scaffold + harness decisions (2026-06-28)
- **feat-001 DONE.** Three tier skeletons build/boot: `backend/` (Go module `announcementbar`,
  `internal/{config,database,handlers}`, `main.go`, TDD + DB integration test), `frontend/`
  (Vite + React 18 + Polaris shell), `storefront/` (Webpack + TS). `bash init.sh` → exit 0,
  HARNESS GREEN (9 steps); GET `/health` via tunnel returns the `{error,msg,data}` envelope.
- **Decisions baked into the harness:** stateless / single-table; per-tier `.env` + godotenv;
  **golang-migrate dropped** (GORM `AutoMigrate` on boot — init.sh migrate step removed);
  backend layout pinned in AGENTS §2.
- **Env split:** single root `.env` → per-tier `backend/.env` / `frontend/.env` / `storefront/.env`
  (frontend env is compiled into the public bundle, so secrets stay backend-only).
- **Dev tooling:** optional phpMyAdmin service (`make db.admin`, auto-login, `127.0.0.1:8081`); the
  harness flow (`init.sh` / `make db.up`) still starts only `db`.
- **Windows residual risks:** `go test` can hit a Defender `test.exe` lock (init.sh tolerates only
  that named artifact); npm `UNABLE_TO_VERIFY_LEAF_SIGNATURE` worked around per-run with
  `npm_config_strict_ssl=false` (NOT baked into the repo).

### Session 6 — feat-002 data model + OAuth install (2026-06-28)
- **feat-002 DONE — live install signed off on `sonnh-dev-store-3`.** GORM model + `AutoMigrate`;
  `shopify/` (`AuthorizeURL`, `VerifyHMAC`, `ShopFromSessionToken` `dest` decode,
  `ExchangeCodeForToken` → token **discarded**); `/auth` + `/auth/callback`
  (verify → exchange → discard → redirect). Stateless: only `announcement_bars`.
- **Security (TDD):** `ShopIsValid` regex (open-redirect/SSRF guard) on both auth routes; CSRF state
  nonce (`crypto/rand`, HttpOnly cookie, constant-time compare).
- **Live-wiring fix:** OAuth `redirect_uri` double-slash from a trailing `/` in `APP_URL`.
- **Evidence:** `init.sh` GREEN; `go test ./...` all pass (config, DB integration, auth bad-HMAC → 401,
  shopify HMAC/`dest`); `DESCRIBE announcement_bars` matches the spec.

### Session 7 — feat-003..006 + integration fixes (2026-06-28)
- Built test-first: **feat-003** (admin CRUD + one-active invariant + anti-IDOR), **feat-004** (public
  endpoint: single active bar / null, server expiry gate, no `title` leak, CORS), **feat-005** (admin
  UI: ApiClient → repository → Redux, Polaris list + editor, `date-fns-tz`), **feat-006** (storefront
  countdown math + fetch/render/ticker + Theme App Extension app-embed block).
- **Integration fixes (caught live, not by unit tests):**
  - Backend serves the built admin SPA — `app.Static("/")` + `GET /*` fallback (was "Cannot GET /").
  - App Bridge loaded in `index.html` (`<meta shopify-api-key>` + `app-bridge.js`) — was admin API 401.
  - CORS as path middleware on `/web/public` so the `OPTIONS` preflight is answered — was 405.
- **Evidence:** `bash init.sh` → HARNESS GREEN (9 steps); backend all packages `ok`; both JS tiers
  build + unit tests pass. feat-003/004 are high-risk → confirm live at the demo.

### Session 8 — Polish + capstone deliverables (2026-06-29)
- **Storefront bar made sticky** at the top of the page (`position: sticky; top:0`).
- **Validation hardened (TDD):** title ≤120 / message ≤200 length rules on both tiers; **message is
  now always required** (was only when enabled); extracted a testable `frontend/src/lib/barValidation.ts`;
  added `*` required markers + character counters; removed the unused `formik`/`yup` deps.
- **Toggles:** new on/off switch replaces the "Enabled" and "Enable countdown" checkboxes in the
  editor; the list gained a per-row activate/deactivate toggle (server enforces one-active on refetch);
  the prototype was updated to match.
- **Add vs Edit save UX:** Edit keeps the contextual save bar; Add uses a "Create bar" page primary
  action (no save bar). New bars default `message = "Your message here!"`.
- **feat-007 artifacts:** `docs/demo-script.md` (10-step E2E walkthrough + verify evidence); a
  terminal-themed Vietnamese slide deck at `presentation/index.html` (built via subagent).
- **Evidence:** `bash init.sh` → HARNESS GREEN (9/9); backend `validate` + handlers `ok`; frontend
  10 vitest pass, tsc 0, vite build 0; storefront 5 vitest pass, webpack 0.
- feat-004–008 left at `manual-verification` pending the user's hands-on demo sign-off.

### Session 9 — feat-005 frontend test suite (2026-06-29)
Built out feat-005's frontend test suite to the Medium-risk bar (AGENTS §11 = unit + integration):
jsdom + React Testing Library infra plus negative/boundary/integration coverage, and wired the
frontend/storefront test runs into `init.sh` alongside the backend `go test`. **No feature marked
done; frontend-only; no git.**

**Completion Summary**
- **Changed:**
  - **Infra:** devDeps `@testing-library/react` / `jest-dom` / `user-event` / `jsdom`; `vite.config.ts`
    `test` block (jsdom env + setup); `src/test/setup.ts` (jest-dom matchers + RTL `afterEach(cleanup)`
    + `matchMedia`/`ResizeObserver` polyfills); `src/test/testUtils.tsx` (`renderWithProviders` + `makeStore`);
    `src/test/factories.ts` (`makeBar`).
  - **List querying:** the bars list drives **search / filter / sort / pagination server-side** —
    `AnnouncementBarRepository.list(params)` maps `q/status/sort/page/page_size` into the request and
    the backend `ListBars` query returns one page + a `meta` block; the admin holds only the current page.
  - **Verify harness:** `init.sh` steps 8/9 now run the frontend/storefront `npm test` + build (parity
    with the backend `go test` step); `AGENTS.md` §6 verify commands corrected to the standalone
    `npm test` (the tiers are not npm workspaces). Also fixed a latent `set -e` bug in step 7 — a bare
    `out=$(go test)` assignment aborted before the Windows `.test.exe` flake tolerance could run; now
    `if out="$(go test ...)"; then rc=0; else rc=$?; fi`.
  - **New/strengthened tests (51 total):** `api/AnnouncementBarRepository.test.ts` (3: q/status/sort/page
    → request params; status omitted when both/none; meta → typed result), `lib/color.test.ts` (6),
    `lib/countdown.test.ts` (7), `store/announcementBarSlice.test.ts` (6: applyToggle one-active;
    fetchBars fulfilled/rejected/pending + pagination meta), `components/Toggle.test.tsx` (4: aria/keyboard/disabled),
    `pages/BarEditor.test.tsx` (7: invalid-submit BLOCKED ×4, valid create payload + store-local→UTC,
    edit update-with-id, countdown reveal), `pages/BarsList.test.tsx` (5: server-driven render, Next
    re-queries the page, optimistic toggle, delete + refetch, empty state), strengthened `lib/time.test.ts`
    (4: NY EDT, DST EST-vs-EDT, Asia/Ho_Chi_Minh, invalid-input throws), `lib/barValidation.test.ts` (9).
- **Verification (raw):**
  ```
  npx vitest run
   ✓ src/lib/countdown.test.ts (7)   ✓ src/lib/color.test.ts (6)   ✓ src/api/AnnouncementBarRepository.test.ts (3)
   ✓ src/store/announcementBarSlice.test.ts (6)   ✓ src/lib/time.test.ts (4)   ✓ src/lib/barValidation.test.ts (9)
   ✓ src/components/Toggle.test.tsx (4)   ✓ src/pages/BarsList.test.tsx (5)   ✓ src/pages/BarEditor.test.tsx (7)
   Test Files  9 passed (9)
        Tests  51 passed (51)
  tsc --noEmit -> 0 ; vite build -> 0 ; storefront webpack -> 0
  bash init.sh -> HARNESS GREEN (9/9): backend go test ok; frontend 51 vitest; storefront 5 vitest; all builds 0.
  ```
- **Two jsdom gaps fixed at the root (NOT by deleting assertions):** RTL auto-cleanup unregistered
  (Vitest globals off) → "multiple elements" → added `afterEach(cleanup)`; Polaris needs
  `ResizeObserver`/`matchMedia` → polyfilled in `setup.ts`. One selector scoped: a
  `getByLabelText(/background color/i)` also matched the swatch button's aria-label → switched to
  `getByRole("textbox", …)`. No production code weakened; no real bug surfaced by the tests.
- **Residual risks:** component tests mock `barsRepo` + App Bridge (no real network/App Bridge);
  search/sort/filter is covered at the **repository + slice** level (request params + `meta` mapping)
  and via the `BarsList` re-query, not driven through the `IndexFilters` portal/popover DOM (brittle
  under jsdom); `ApiClient`'s axios interceptor is left untested.
- **Not verified / NOT done:** feat-005 stays **manual-verification** — the human signs off the live
  admin. No real-browser/E2E run.

## How to use this file

Each session appends a dated entry (Done / Next / Evidence) in **chronological** order. The
feature-state source of truth is `.claude/feature_list.json`; keep this file short and factual — it
is the bridge between sessions alongside `session-handoff.md`.
