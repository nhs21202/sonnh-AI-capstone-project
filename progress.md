# progress.md — Session Log

Human-readable record of progress. Updated at the end of every session.

## Current status

**Done:** feat-001, feat-002, feat-003 (feat-002/003 had live demo sign-off on `sonnh-dev-store-3`).
**`manual-verification` — feat-004, feat-005, feat-006:** code + automated tests are complete and
green, but they await the user's hands-on end-to-end verification before being marked done. **feat-007
+ feat-008 not-started.** feat-008's live-ticking editor preview exists in code but stays not-started
pending the user's own verification. Do NOT mark anything done from code reading — only the user's
hands-on sign-off promotes a `manual-verification` feature to done. All three tiers build/boot;
`bash init.sh` is GREEN (steps 1–9).

## Blockers

- None blocking. Awaiting the user's hands-on verification of feat-004–007 before final sign-off.

## Open decisions

All six DISCUSS questions are resolved (see the top of `docs/questions.md`): course schema for the
feature DAG; anti-IDOR via JWT `dest` in all modes; flat columns per bar (many saved bars per shop,
at most one active at a time, enforced by a transactional one-active invariant); live-ticking
preview last and cuttable (implemented, awaiting user sign-off); color inputs use a Polaris
`ColorPicker` popover **and** a hex `TextField`; fresh self-contained demo env.

## Session log

### Session 1 — Planning (2026-06-28)
- **Done:** brainstormed scope (many saved bars per shop, one active at a time); wrote
  `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/plan.md`, `docs/user-stories.md`,
  `docs/complex-cases.md`, `docs/questions.md`; authored the feature DAG at
  `.claude/feature_list.json`; established the harness scaffold (`AGENTS.md`, `CLAUDE.md`,
  `progress.md`, `session-handoff.md`, env descriptors).
- **In-progress:** none.
- **Next:** feat-001 (repo scaffold & demo environment).
- **Blockers:** none.
- **Evidence:** planning artifacts present under `docs/` and `.claude/` (see file tree).

### Session 2 — Guardrail / feedback subsystem (Day-4) (2026-06-28)
- **Done:** stood up the guardrail subsystem (a harness component, not a product feature in the
  DAG). Created `.claude/settings.json` (permission allow/ask/deny + hook registration),
  `.claude/hooks/block-dangerous.sh` (PreToolUse, exit 2 = block), `.claude/hooks/scan-secrets.sh`
  (PostToolUse, warn-only). Handled the three known kit bugs (exit 2 not 1; parse
  `.tool_input.command`; specific `rm -rf` regex) and denied editing the hooks themselves.
- **Windows adaptation:** hooks are registered as `bash .claude/hooks/*.sh` (not bare `.sh`).
  Parser selection is **probe-validated** because `jq` is absent and the on-PATH `python3` is a
  fake Windows App-Execution-Alias stub; the probe falls through to the real `python` and keeps
  the fail-closed contract intact. All comments/messages translated to English (project rule).
- **In-progress:** none.
- **Next:** feat-001 (repo scaffold & demo environment).
- **Blockers:** none.
- **Evidence (raw exit codes):**
  - `rm -rf /` -> 2; `git push --force` -> 2; `git reset --hard` -> 2; `DROP TABLE` -> 2;
    `curl … | sh` -> 2 (BLOCKED).
  - `npm run remove-cache` -> 0; `go test ./...` -> 0; `npm install` -> 0; empty/non-bash -> 0 (allowed).
  - scan-secrets: clean file -> exit 0, no warning; `shpat_…` and `mysql://user:pass@…`
    -> exit 0 with WARNING. (No-parser path is fail-closed=block for the Pre hook, warn-skip for the Post hook.)

### Session 3 — Environment subsystem (2026-06-28)
- **Done:** built the Environment subsystem (shape based on a standard Go+React+Webpack monorepo
  layout): `.gitignore`, `docker-compose.yml` (MySQL 8 only; `db` service, app user, healthcheck via
  `mysqladmin ping` as `app`, `127.0.0.1:${DB_PORT:-3307}:3306`, named volume), `.env.example`
  (lean: stage/server/Shopify/DB/Vite), `.nvmrc` (`22`), root `Makefile` (`db.up`/`db.down` +
  tier-guarded `check`/`test`/`build`), root `package.json`, and `init.sh` (Node 22 → Go → `.env` →
  MySQL up → wait healthy → backend test+build → frontend ci → storefront ci → GREEN banner).
  (A golang-migrate `migrate.up` step existed here originally; later removed — see the migration
  cleanup note below.)
- **init.sh design:** steps 1–6 pass on a Node-22 + Docker-up checkout; **step 7 (backend) is the
  intended controlled-RED** until feat-001 creates `backend/`.
- **In-progress:** none.
- **Next:** `docs/prototype/` (optional), then feat-001 (tier skeletons).
- **Blockers:** none.
- **Evidence (raw):**
  - DB vars identical across `docker-compose.yml` / `.env.example` / `Makefile` / `init.sh`:
    `announcement_bar` / `app` / `app_pass` / `3307` / `127.0.0.1`.
  - `git check-ignore .env .env.example` → only `.env` ignored; `git status` shows `.env.example`
    tracked-able and no `.env` (gitignore works).
  - `bash init.sh` (Node 22 + Docker up): early steps GREEN — Node v22.14.0, Go 1.25.4, `.env` ready,
    MySQL `mysql:8.0` pulled + container started, MySQL healthy via the app-user healthcheck — then
    the intended controlled-RED at the backend step:
    `Error: backend/ does not exist yet - build the Go tier in feat-001.` (exit 1).
  - Fixed a `set -e` gotcha found during the run: a `cd backend && ...` chain is exempt from
    `set -e` (non-final command in an `&&` list), so step 7 was bleeding into step 8; steps 7-9 now
    guard the tier dir and `exit 1` with a clear message, halting cleanly at the failing step.
  - MySQL container `sonnh-ai-capstone-project-db-1` is left running by init.sh (stop with
    `make db.down`).

### Session 4 — Prototype UI spec (2026-06-28)
- **Done:** created `docs/prototype/` (`index.html`, `styles.css`, `admin-list.html`,
  `admin-editor.html`, `storefront-bar.html`) as the static UI source-of-truth — shared
  Polaris-ish design tokens in `styles.css`; admin bars list with exactly one Active badge +
  Edit/Delete; per-bar editor with title/enabled-toggle/message/colors (hex + swatch)/countdown
  (deadline, colors, three formats) + pinned contextual save bar (dirty state) + live preview with a
  vanilla-JS ticking countdown; storefront mock with the single active bar prepended + ticking
  countdown and a "no active bar -> nothing renders" comment. Static HTML/CSS only (no framework, no
  build step); brand "Announcement Bar App"; English only.
- **In-progress:** none.
- **Next:** feat-001 (build the three tier skeletons).
- **Blockers:** none.
- **Evidence:** files created under `docs/prototype/`: `index.html`, `styles.css`,
  `admin-list.html`, `admin-editor.html`, `storefront-bar.html` (`ls -1 docs/prototype/` lists 5).

### Session 5 — feat-001 Repo scaffold (in-progress) (2026-06-28)
Built via the AI Quality Loop (§11), TDD for backend logic. **feat-001 set `in-progress`.**

**Completion Summary**
- **Changed:**
  - `backend/` — Go module `announcementbar`; `internal/config` (env→DSN + defaults, TDD),
    `internal/handlers/health` (`{error,msg,data}` envelope, TDD), `internal/database` (GORM MySQL
    connect, TDD integration test against the live container), `main.go` (boot: config→DB→Fiber→/health).
  - `storefront/` — standalone Webpack + TS (package.json, tsconfig, webpack.config.js, src/index.ts);
    builds to `dist/announcement-bar.js`.
  - `frontend/` — standalone Vite + React 18 + TS + Polaris 13 admin shell (App Bridge dep present,
    Provider deferred to feat-002); builds via `tsc --noEmit && vite build`.
  - `init.sh` step 7 hardened (see Residual risks). Root `package.json` dropped `workspaces`
    (tiers are standalone so per-tier `npm ci` works).
- **Out-of-scope changes:** none beyond the workspaces removal + the init.sh step-7 fix (both needed
  to make `init.sh` reliably green on this machine).
- **Verification result (raw):** `bash init.sh` → **exit 0, "================ HARNESS GREEN ================"**
  (steps 1–9). Backend `go vet/build/test ./...` = 0 (config/handlers/database all `ok`; DB integration
  test pinged MySQL). Frontend `vite build` = 0 (1096 modules; 445 kB Polaris CSS + 350 kB JS).
  Storefront `webpack` = 0 (`dist/announcement-bar.js`). `node_modules`/`dist`/`.env` confirmed git-ignored.
- **Residual risks:**
  1. **Windows `go test` flake:** fresh test-binary builds can hit a Defender temp-file lock
     (`unlinkat …test.exe`) and exit non-zero despite passing. `init.sh` step 7 now aborts on any real
     `FAIL` but tolerates only that named cleanup artifact.
  2. **TLS interception on this network:** npm install/ci fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`
     (an SSL-inspecting proxy/AV CA not in npm's trust store). Worked around **per-run** with
     `npm_config_strict_ssl=false` (NOT baked into the repo). Proper fix: trust the CA via
     `NODE_EXTRA_CA_CERTS`, or `npm config set strict-ssl false` once on this machine.
  3. **npm audit:** frontend reports 2 advisories (1 high, 1 moderate) in transitive build deps —
     noted, not addressed in the skeleton.
- **Not verified / NOT done (human-only — feature stays in-progress):** Shopify Partner dev store;
  installed app + real `SHOPIFY_API_KEY`/`SHOPIFY_API_SECRET` via OAuth; a public tunnel reaching the
  backend. These need your Shopify account and can't be done by the agent.

**Human checklist to finish feat-001 (then flip it to `done`):**
1. Create a Shopify Partner dev store. 2. Create an app; copy its API key/secret into `.env`
(`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`). 3. Start a tunnel (e.g. `cloudflared`/`ngrok`) to
`http://127.0.0.1:5005`; set `APP_URL` to the tunnel URL. 4. Install the app on the dev store. 5. Re-run
`bash init.sh`, confirm green, then set feat-001 `done`.

### Dev tooling — phpMyAdmin (2026-06-28)
- Added a `phpmyadmin:5.2` service to `docker-compose.yml` (on-demand; `127.0.0.1:8081`), plus
  `make db.admin` (start + print URL) and `make db.shell` (MySQL CLI). `init.sh` / `make db.up`
  still start only `db`, so the harness flow is unaffected. Configured for **auto-login** (config
  auth as root; no login screen) since the port is bound to 127.0.0.1 only. Verified: HTTP 200, no
  login form, sees the `announcement_bar` database at http://localhost:8081.

### Env refactor — per-tier .env files (2026-06-28)
- Split the single root `.env` into per-tier files (standard 3-tier layout): `backend/.env`
  (secrets + DB; auto-loaded via `github.com/joho/godotenv/autoload`), `frontend/.env`
  (Vite `VITE_REACT_APP_*`, public only), `storefront/.env` (webpack `REACT_APP_*`, injected at build
  via `dotenv` + `DefinePlugin`). Removed root `.env`/`.env.example`. `init.sh` step 3 creates all
  three from each `*/.env.example`; root `Makefile` reads `backend/.env` for the DSN. **Why:** each
  bundler loads env from its own dir, and frontend env is compiled into the public bundle, so secrets
  must stay backend-only.
- **Verified:** `bash init.sh` GREEN (steps 1–9); backend `go build/test` ok; frontend `vite build`
  ok; storefront bundle has `REACT_APP_API_BASE_URL` baked in (grep found `127.0.0.1:5005`).
  `*/.env.example` committable, `*/.env` git-ignored.

### Fix — storefront CORS preflight 405 (feat-004/006 live wiring) (2026-06-28)
- **Gap:** the storefront fetch to `/web/public/bar` failed — the browser sent an `OPTIONS` preflight
  (triggered by the custom `ngrok-skip-browser-warning` header) and the backend returned **405**
  because CORS was attached only to the GET route, leaving `OPTIONS` unhandled. The unit tests
  didn't catch it (they don't do cross-origin preflight).
- **Fix:** `main.go` now applies CORS as path middleware `app.Use("/web/public", cors.New({AllowOrigins:"*",
  AllowMethods:"GET,OPTIONS", AllowHeaders:"ngrok-skip-browser-warning, Content-Type"}))`, which answers
  the preflight. Verified: `OPTIONS` -> 204 with `Allow-Origin: *` + `Allow-Headers`; `GET` -> 200 `*`.

### Fix — App Bridge not loaded -> admin API 401 (completes feat-005 auth wiring) (2026-06-28)
- **Gap:** the admin SPA rendered but `GET /api/v1/announcement-bars/:shop` returned **401** with **no
  `Authorization` header**. Root cause: the ApiClient reads the session token from
  `window.shopify.idToken()`, but `index.html` never loaded **App Bridge**, so `window.shopify` was
  undefined -> no token attached.
- **Fix:** `frontend/index.html` `<head>` now has `<meta name="shopify-api-key"
  content="%VITE_SHOPIFY_API_KEY%">` + `<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js">`
  (loads before the bundle). Verified: a build injects the key into the meta and includes the script.
- **Requires (human config):** `frontend/.env` `VITE_SHOPIFY_API_KEY=<api key>`; `backend/.env`
  `SHOPIFY_API_SECRET=<secret>` EXACT (no spaces around `=`, or the JWT verify fails). Rebuild
  frontend + restart backend.

### Fix — backend serves the admin SPA (completes feat-005 wiring) (2026-06-28)
- **Gap found:** feat-005's admin built fine, but it was **NOT actually reachable** from the App URL —
  the backend had no route for `/`, so the embedded app showed Fiber's "Cannot GET /". feat-005 was
  marked done on build/unit evidence; the embedded-serving wiring was missing.
- **Fix:** `backend/main.go` now serves the built SPA AFTER the API/auth/health routes:
  `app.Static("/", FRONTEND_DIST)` (default `../frontend/dist`, env-overridable) + a final `GET /*`
  SPA fallback returning `index.html` that skips `/api`, `/auth`, `/web`, `/health`.
- **Manual check (new binary on :5099):** `GET /` -> `index.html` (`<div id="root">`, title
  "Announcement Bar App"); `GET /health` -> `{...,"msg":"ok"}` (not shadowed);
  `GET /api/v1/announcement-bars/...` (no token) -> 401 (not shadowed). `go build` 0.
- **Note:** restart the backend on :5005 (kill the old `go run .`) to pick this up; then the App URL
  renders the admin.

### Session 8 — feat-003..006 (backend API + public endpoint + admin UI + storefront) (2026-06-28)
- **feat-002 DONE** (live OAuth install signed off). Built **feat-003 / feat-004 / feat-005 / feat-006**
  test-first (AI Quality Loop §11):
  - **feat-003** (backend admin CRUD + one-active invariant + anti-IDOR): `internal/handlers/bars.go`,
    `internal/validate/bar.go`, `internal/middleware/admin.go` (session-token `dest` vs `:shop` -> 403).
    Tests: CRUD round-trip, exactly-one-enabled invariant, 403/401, 404, 400.
  - **feat-004** (public endpoint): `internal/handlers/public.go` — single active bar / null, server
    expiry gate, no `title` leak, CORS `*`. Tests: 400 / null / expired-null / payload / shop isolation.
  - **feat-005** (admin UI): ApiClient(+App Bridge token)->BaseRepository->AnnouncementBarRepository;
    Redux `announcementBarSlice`; Polaris list (Active badge, Add/Edit/Delete) + editor (validation
    mirrors backend) + `date-fns-tz`. tsc 0, vitest (tz round-trip), vite build 0 (1484 modules).
  - **feat-006** (storefront): countdown math (vitest 5: math/expiry/3 formats), fetch+render+ticker,
    Theme App Extension app-embed block; webpack build 0 -> `extensions/announcement-bar/assets/`.
- **Verified:** `bash init.sh` exit 0, HARNESS GREEN (9 steps); backend all packages `ok`; both JS
  tiers build + unit tests pass.
- **HIGH-RISK note (feat-003/004):** logic + security fully unit/integration-tested; confirm the live
  admin CRUD + storefront render on the dev store at the demo.
- **Next:** **feat-007** (E2E demo script + full verify suite + capstone deliverables); feat-008
  optional (live-ticking admin preview, cuttable).

### Session 7 — feat-002 data model + OAuth install (in-progress, awaiting sign-off) (2026-06-28)
Built test-first (TDD), AI Quality Loop §11. **feat-002 set `in-progress`.** HIGH risk → not marked
done; awaiting human sign-off on the live install.

**Completion Summary**
- **Changed (backend/internal):** `models/announcement_bar.go` (GORM model; `shop` non-unique index;
  all spec fields/defaults); `database.Migrate` (GORM AutoMigrate, called on boot in `main.go`);
  `shopify/` (`AuthorizeURL`, `VerifyHMAC`, `ShopFromSessionToken` JWT `dest` decode,
  `ExchangeCodeForToken` → token **discarded**); `handlers/auth.go` (`/auth` install start,
  `/auth/callback` verify→exchange→discard→redirect). Wired routes + AutoMigrate in `main.go`.
  Stateless: only the `announcement_bars` table; no shop/session/token table.
- **Out-of-scope changes:** none.
- **Verification result (raw):** `bash init.sh` → exit 0, HARNESS GREEN (9 steps). `go vet/build` = 0.
  `go test ./...` all pass: config, **database integration** (AutoMigrate + 2-bars-per-shop coexist +
  WHERE shop=? returns the set + fresh shop empty), handlers (health + **auth bad-HMAC → 401**),
  shopify (HMAC valid/tampered, authorize URL, session-token `dest` decode + wrong-secret reject).
  `DESCRIBE announcement_bars`: `id` PK auto_increment; `shop` varchar(255) **MUL** (non-unique);
  `title` 120 NOT NULL; colors varchar(9) with defaults `#1A1A1A`/`#FFFFFF`/`#000000`;
  `countdown_format` default `dd:hh:mm:ss`; timestamps.
- **Security hardening (TDD, this pass):** `shopify.ShopIsValid` (regex
  `^[a-z0-9][a-z0-9-]*\.myshopify\.com$`, case-insensitive) — open-redirect/SSRF guard applied in
  BOTH `/auth` and `/auth/callback` (400 before using shop). CSRF: `/auth` sets a random
  (`crypto/rand`) nonce in a short-lived HttpOnly cookie and passes it as `state`; `/auth/callback`
  constant-time compares the cookie to the `state` query param (400 on mismatch) then clears it.
  Tests: `evil.com` / `acme.myshopify.com.evil.com` rejected, `acme.myshopify.com` accepted; state
  mismatch → 400. `go test ./...` all pass.
- **Residual risks:** the live OAuth round-trip (approve → callback → token exchange) is only verified
  by the unit-level HMAC + state gates; confirm end-to-end on a real install. HMAC is computed over
  decoded, sorted params (matches the common Shopify impl) — confirm on the live callback.
- **Not verified / NEEDS HUMAN SIGN-OFF:** acceptance item *"app installs on the dev store"* — the
  live OAuth install on `sonnh-dev-store-3`. Requires running backend + tunnel + Partner-Dashboard
  App URL `=/auth` and redirect URL `=/auth/callback`, then a real install. High risk → sign-off
  before `done`.

### Session 6 — feat-001 closed + feat-002 decisions baked (2026-06-28)
- **feat-001 DONE** (status + evidence in `feature_list.json`): init.sh exit 0 HARNESS GREEN (9
  steps); GET /health via ngrok returns the `{error,msg,data}` envelope.
- **Baked feat-002 decisions into the harness:**
  1. **Stateless / single table** — the only table is `announcement_bars`; admin auth via the App
     Bridge session-token `dest` claim; the app never calls the Shopify Admin API; the OAuth callback
     discards the access token; no shop/session/token table. (`ARCHITECTURE.md` §2, `questions.md` Q7,
     feat-002 description.)
  2. **Per-tier .env + godotenv** — `backend/.env.example` + `frontend/.env.example`
     (`VITE_API_BASE_URL`, `VITE_SHOPIFY_API_KEY`); `main.go` loads `backend/.env` via
     `godotenv.Load()` (error ignored so real env wins); `Config` gained `SHOPIFY_*`/`APP_*` fields
     (added test-first); init.sh `cp -n` per tier; `.gitignore` + AGENTS §3 already per-tier.
  3. **golang-migrate dropped** (last turn) — init.sh step 6 is now a one-line GORM note.
  4. **Backend layout pinned** in AGENTS §2: `internal/{config,database,handlers,models,shopify,middleware}`.
- **Verified:** `bash init.sh` exit 0 HARNESS GREEN (9 steps); backend `go test/build ./...` ok
  (config test now covers the new Shopify fields).

### Migration approach — golang-migrate removed (2026-06-28)
- Decision: the app manages its schema with **GORM `AutoMigrate` on boot** (the `announcement_bars`
  table is created/updated when the backend starts, in feat-002). The golang-migrate path is not
  needed for a single-table app, so it was **removed**: dropped `init.sh`'s migrate step (now an
  8-step script), and removed `migrate.up` / `MIGRATIONS_FOLDER` / `DATABASE_URL` from the root
  `Makefile`. `AGENTS.md` §3 no longer says "runs migrations". `docs/plan.md`'s "Auto-migrate on boot"
  already described the GORM approach.
- Verified: `bash init.sh` still GREEN (steps 1–8); `make` targets (`db.up`/`db.down`/`db.admin`/
  `db.shell`/`check`/`test`/`build`) parse and run.

## How to use this file

Each session appends a dated entry: Done / In-progress / Next / Blockers / Evidence. Keep it
short and factual — it is the bridge between sessions alongside `session-handoff.md`.
