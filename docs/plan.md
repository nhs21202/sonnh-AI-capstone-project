# plan.md — Implementation Plan (HOW)

How to build the Announcement Bar app. WHAT/WHY: `PRODUCT.md`. Design:
`ARCHITECTURE.md`. The app is a three-tier monorepo whose tiers are built in dependency
order: **session/data model → backend admin API → public endpoint → admin UI → storefront bundle
→ e2e/demo.**

---

## 0. Repo scaffold & environment

- Monorepo with `backend/`, `frontend/`, `storefront/`, plus `docs/`, `plan.md`, harness files.
- Backend env: Go + Fiber + GORM + MySQL. Create a local MySQL DB; define `.env` keys (`DB_*`,
  `STAGE_STATUS`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`).
- Frontend env: Vite + React + TS; `.env` keys `VITE_REACT_APP_API_URL`,
  `VITE_REACT_APP_API_BASE_URL`, `VITE_REACT_APP_API_KEY`.
- Storefront env: Webpack TS; `REACT_APP_API_BASE_URL` baked at build time.
- A Shopify Partner dev store + app (App Bridge `apiKey`, app-embed extension) for the demo.
  **Infra setup details are an open question — see `questions.md`.**

## 1. Session / data model (backend)

- Define GORM model `AnnouncementBar` with the fields in spec §2: `id` PK, `shop` **index
  (non-unique)** so many bars share a shop, and an admin-facing `title`. No `sort_order`.
- Auto-migrate on boot.
- Implement the Shopify OAuth/session install flow (`GET /auth`, `/auth/callback`) so the app
  installs on the dev store and the admin can authenticate.
- Acceptance: table exists; app installs on the dev store; **multiple rows for the same shop
  coexist**; `WHERE shop = ?` returns the shop's set of bars.

## 2. Backend admin API (CRUD)

- Routes under the `/api/v1` group, all behind `VerifyShopifyApi()`:
  - `GET    /announcement-bars/:shop`     → `ListAnnouncementBars` (newest first)
  - `POST   /announcement-bars/:shop`     → `CreateAnnouncementBar` (→ 201)
  - `PUT    /announcement-bars/:shop/:id` → `UpdateAnnouncementBar` (→ 200)
  - `DELETE /announcement-bars/:shop/:id` → `DeleteAnnouncementBar` (→ 200)
- Implement the **anti-IDOR check** in a shared helper: derive the authenticated shop from the App
  Bridge session-token `dest` claim in ALL modes (dev included) and compare to `:shop`; `403` on
  mismatch. (Dev-mode derivation per `questions.md` Q2.) Any `:id` must belong to that shop, else
  `404`.
- Per-bar validation before save: `title` required; `message` required (always); hex colors;
  future `countdown_end_at` when countdown enabled. New bars default `enabled = false`.
- **One-active invariant:** when a create/update sets `enabled = true`, the SAME transaction sets
  `enabled = false` on all OTHER bars of that shop, so exactly one stays active.
- Return the standard `{ error, msg, data }` envelope.
- Acceptance: create → list → update → delete round-trips; enabling one disables the others (assert
  exactly one `enabled` per shop); mismatched `:shop` vs `dest` → 403; foreign `:id` → 404; invalid
  body → 400. Covered by Go handler unit tests.

## 3. Public storefront endpoint

- Route `GET /web/public/bar` → `GetPublicBar`, CORS `*`, no auth. Returns the **single active
  bar** (or null), never a list.
- Read `shop := c.Query("shop")`; `400` if empty. Query the shop's `enabled = true` bar
  (`WHERE shop = ? AND enabled = true` — the one-active invariant guarantees at most one).
- **Server-side expiry gate:** return that bar only when (`!countdown_enabled` OR
  `countdown_end_at` in the future); if there is no enabled bar or it is already expired →
  `data: null`.
- Return only public display fields (no internal timestamps, no `title`).
- Acceptance (Go unit tests): missing `shop` → 400; no enabled bar → null; expired → null; one
  active → full bar payload; shop A cannot see shop B's data.

## 4. Admin UI

- Build the data layer: an `ApiClient` (axios wrapper with auth-header interceptor) and a
  `BaseRepository` (uniform result wrapping), then an `AnnouncementBarRepository`
  (`url()=>"/announcement-bars"`, `list`, `create`, `update`, `remove`).
- Add `announcementBarSlice` (`createAsyncThunk` list/create/update/delete, holding the collection)
  → register in `store.ts`.
- Build the **index list** (Polaris `IndexTable`/`ResourceList`): `title`, an **Active** badge on
  the enabled bar, countdown end, message preview; primary **Add bar**; per-row Edit + Delete.
- Build the **per-bar editor** (Polaris `Page`/`Layout`/`Card`/`FormLayout`): **Title** field,
  Enabled toggle (enabling implies others deactivate — refetch the list to reflect it), `TextField`
  (message), color inputs (hex `TextField`; ColorPicker is an open question — `questions.md` Q5),
  countdown `Checkbox` + `datetime-local` + countdown colors + format `Select`.
- Store-timezone → UTC conversion on load/save (use `date-fns` / `date-fns-tz`).
- Live preview pane re-rendering the bar being edited from current form values (fidelity per
  `questions.md`).
- Inline validation (native React state, red `TextField` errors) per spec §5. App Bridge contextual
  save bar (`<SaveBar>`) with leave-confirmation. Colors via Polaris `ColorPicker` popover + hex field.
- Routes in the app router, nav `<Link>` in the app nav.
- Acceptance: list shows saved bars with the Active badge; create/edit/delete persist and survive
  reload; activating one bar deactivates the others; validation blocks bad input.

## 5. Storefront bundle + theme extension

- Build the storefront data layer: an `ApiClient` and `BaseRepository`, then an
  `AnnouncementBarRepository.getBar(shop)`.
- Webpack entry `src/index.ts`: on `DOMContentLoaded`, read `window.Shopify.shop`, fetch the active
  bar, and if `data !== null` build + prepend the one active bar to `<body>`, apply colors, run the
  countdown ticker. Keep remaining-time math + each `countdown_format` as pure, unit-testable
  functions. (The storefront stays simple: it renders exactly one active bar.)
- Client expiry: when the ticker reaches zero, clear the interval and remove the bar (no refetch).
- Theme App Extension: app-embed block (`target: body`) sets `window.announcementBarEnabled` +
  page context and renders the `storefront.liquid` snippet that injects the built bundle.
- Build with `webpack --env ENVIRONMENT=production` into `extensions/.../assets/announcement-bar.js`.
- Acceptance: on a dev-store storefront with the app embed enabled, the configured bar renders;
  countdown ticks; bar disappears at expiry; toggling off in admin hides it on next load.

## 6. End-to-end / demo

- Manual demo script: create two bars in admin → activate one → open storefront → see that bar +
  ticking countdown → activate the other → reload (storefront swaps to it) → delete one → set a
  near deadline → watch it expire and vanish.
- Verify suite (the Feedback subsystem / highest ROI): backend `go test` for handlers; storefront
  unit tests for countdown/format pure functions; documented manual storefront walkthrough.
- Capstone deliverables: repo link, short slide deck (goal / concepts applied / how AI helped /
  results / difficulties / lessons), and the AI/Harness workflow note.

---

## Testing strategy (scaled to a short demo)

- **Backend (Go unit tests):** public-handler shop-scoping, no-enabled-bar→null, expired→null,
  missing `shop`→400; admin anti-IDOR mismatch→403; foreign `:id`→404; validation→400; the
  **one-active invariant** (enabling one disables the others — assert exactly one `enabled` per shop).
- **Storefront (unit tests):** remaining-time math, expiry boundary, all three formats.
- **Manual:** the demo script above, with evidence captured.

## Cross-cutting

- Every backend query scoped `WHERE shop = ?`; every `:id` checked to belong to that shop.
- At most one bar `enabled` per shop, enforced in the API layer inside a transaction.
- Colors validated on both admin (hex regex) and backend before save.
- All generated files, comments, and docs in English (course rule).
