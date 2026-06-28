# AGENTS.md — System of Record

The single source of truth for any agent (Claude Code, Codex, Cursor, …) working on this repo.
The repo IS the spec: anything not written here or in the linked docs is treated as nonexistent.
This is a MAP, not a manual — it constrains, it does not micromanage.

## 1. What this project is

A Shopify app: a merchant manages many saved announcement bars (message, styling, fixed-date
countdown) in the embedded admin, with **at most one active at a time**; the single active bar
renders site-wide on the storefront and self-hides at expiry. Capstone goal: a clear, demoable app
that shows the AI/harness workflow.
Product detail: `docs/PRODUCT.md`. Architecture: `docs/ARCHITECTURE.md`.

## 2. Tech stack (FIXED — do not change)

- **backend/** — Go + Fiber + GORM + MySQL. Layout: `internal/{config,database,handlers,models,shopify,middleware}`.
- **frontend/** — React 18 + Vite + TypeScript, Polaris + App Bridge, Redux Toolkit. Form validation
  is native React state with inline Polaris `TextField` errors (not Formik/Yup); colors use Polaris `ColorPicker`.
- **storefront/** — Webpack-bundled TypeScript, Shopify Theme App Extension (app-embed block).
- MySQL 8 via `docker-compose.yml`. Node 22. Go 1.21+.

## 3. Startup (one command from a clean checkout)

```
bash init.sh
```
Brings up MySQL, prepares per-tier env, installs deps, and runs the verify suite (schema is created
by GORM AutoMigrate when the backend boots). It must
finish green once the tiers exist. (Until feat-001 is done, init.sh is the target, not yet green —
see `progress.md`.)

## 4. Per-session work loop (act → observe → feedback)

1. Read `.claude/feature_list.json`; pick exactly ONE `not-started` feature whose `dependencies`
   are all `done`. Only one feature is `in-progress` at a time.
2. Read `progress.md` (what the last session left) and `session-handoff.md`.
3. Set the feature `in-progress`.
4. Implement; after each meaningful change run the relevant verify command (§6). Build each
   feature via the AI Quality Loop in §11.
5. When the feature's acceptance holds, run the full verify suite and paste real output into the
   feature's `evidence`.
6. Update `feature_list.json` (`done`), `progress.md`, and `session-handoff.md`. Leave a clean
   state so the next session only needs `bash init.sh`.

## 5. Scope & feature order

Source of truth: `.claude/feature_list.json` (a DAG). Order:
session/data model → backend admin API → public endpoint → admin UI → storefront bundle →
e2e/demo → (live-ticking preview, OPTIONAL/cuttable). Respect the DAG; never skip a dependency.
Do not invent scope not in the feature list. Out-of-scope items are listed in `docs/PRODUCT.md`.

## 6. Verify commands (run from repo root)

| Tier       | Command                                  | Checks                                    |
|------------|------------------------------------------|-------------------------------------------|
| Backend    | `go test ./...` (in `backend/`)          | handlers, shop-scoping, anti-IDOR, gates  |
| Frontend   | `npm run test --workspace=frontend`      | admin form logic/validation               |
| Storefront | `npm run test --workspace=storefront`    | countdown math, formats, expiry boundary  |
| All (JS)   | `npm run check && npm run build`         | typecheck + builds                        |

## 7. Definition of DONE (requires EVIDENCE)

A feature is DONE only when its acceptance check passes AND real verify-command output is pasted
into its `evidence` field. "Done" is proof, not a promise. Do not self-declare done from
reasoning. The doer and the checker are separate concerns.

## 8. Hard constraints

- Do NOT change the tech stack, the data schema (spec §2), or the API contract (spec §3) without
  updating `docs/ARCHITECTURE.md` first.
- Every backend query is scoped `WHERE shop = ?`; every route with an `:id` verifies the bar
  belongs to that shop (`WHERE id = ? AND shop = ?`), else `404`.
- At most ONE bar `enabled` per shop — enforced in the API layer inside a transaction (enabling one
  deactivates all others). MySQL has no filtered-unique index for this; a test asserts it.
- Anti-IDOR: derive the authenticated shop by decoding the App Bridge session-token JWT `dest`
  claim in ALL modes (dev included); compare to `:shop`; never trust the path/query param.
- Validate colors (hex regex) on both admin and backend before save.
- Each tier owns its env: `backend/.env` (secrets + DB), `frontend/.env` + `storefront/.env`
  (public, build-embedded). Commit each `*/.env.example`, never a real `.env`.
- All files, comments, and docs in English.

## 9. Escalation

- MySQL not healthy → check `docker compose ps` / `docker compose logs db`; reconcile `.env` with
  `docker-compose.yml`; on port 3306 conflict set `DB_PORT` in `.env`.
- Verify red → record the blocker in `progress.md` + `session-handoff.md`; do NOT mark done.
- Open product/scope question → see `docs/questions.md`; do not guess, ask the human.

## 10. Links

- Product brief: `docs/PRODUCT.md`
- Architecture / design spec: `docs/ARCHITECTURE.md`
- Implementation plan: `docs/plan.md`
- Stories: `docs/user-stories.md` · Edge cases: `docs/complex-cases.md` · Open Qs: `docs/questions.md`
- Feature DAG (scope state): `.claude/feature_list.json`
- Session log: `progress.md` · Handoff: `session-handoff.md`
- UI spec: `docs/prototype/`

## 11. AI Quality Loop (how to build each feature)

- **Risk Matrix** (set per feature before coding; DEFAULT Medium if unsure):
  - **Low** = text/format/comment → smoke check (build + lint).
  - **Medium** = business logic / validator / single API → unit + integration tests.
  - **High** = anything touching auth, security, migration, data integrity, money/billing, roles →
    full verification + human sign-off before done.
  - **Auto-High keywords**: auth, oauth, hmac, session token, migration, schema, anti-IDOR,
    shop isolation, data deletion.
- **The loop per feature**: Context & Risk → TDD (RED → GREEN → REFACTOR; GREEN = the
  implementation, not a separate phase) → Extended Verification (run real commands; paste RAW
  output, never paraphrase) → Systematic Debugging (ONLY if verification fails) → Completion Summary.
- **Systematic Debugging rules**: reproduce → read raw output → form a hypothesis → test it → fix
  root cause. STOP and escalate to the human after 2 failures on the SAME hypothesis OR 3 different
  hypotheses without a root cause. No fix-by-deletion: never weaken/delete a test or add a fallback
  to hide a failure unless the human confirms the test itself is wrong.
- **Completion Summary template** (put it in the feature's evidence or progress.md):
  Changed / Out-of-scope changes / Verification result (with raw output) / Residual risks / Not verified.
