# questions.md — Open Questions for the Human (DISCUSS)

DISCUSS items from the NOW/COMPLEX/DISCUSS classification. These need YOUR decision before they
can be built (and before `feature_list.json` is written). Each gives context, options, and my
recommendation.

---

## Q1 — `feature_list.json` field convention
**Context:** the course (Day 7) prescribes per-feature fields `id · name · description ·
dependencies · status · evidence`, status enum `not-started | in-progress | done | blocked`. Your
earlier instruction said `id · title · depends_on · acceptance check`.
**Options:**
- (A) Follow the course schema exactly (`dependencies`, `evidence`, status enum). **← recommended**
  — most faithful to the capstone rubric.
- (B) Use your earlier names (`depends_on`, `acceptance check`).
- (C) A hybrid you specify.
**Why it matters:** this is the scope source-of-truth the build agent reads; the field names are
load-bearing for the harness.

## Q2 — Anti-IDOR: how to derive the authenticated shop in DEV
**Context:** `VerifyShopifyApi()` no-ops when `STAGE_STATUS=dev`, so locally there's no verified
shop to compare against the `:shop` path param for the anti-IDOR check.
**Options:**
- (A) Decode the App Bridge **session-token JWT** (`dest` claim) on the backend to get the shop in
  ALL modes, and compare to `:shop`. **← recommended** — real isolation even in dev, closest to
  production.
- (B) In dev, trust the `:shop` param (no check); enforce strictly only in prod. Simpler, but the
  anti-IDOR rule is untested until prod.
- (C) Require a verified `shop` query param even in dev (partial HMAC check locally).
**Why it matters:** decides whether S7's security is actually exercised during the demo.

## Q3 — Per-bar storage: flat columns vs JSON `settings` blob
**Context:** each bar's editable settings can be stored as flat, typed columns or as a single JSON
`settings` blob. The model holds many bars per shop, so this choice is per row.
**Options:**
- (A) Flat, typed columns per bar. **← recommended** — simplest, queryable, easy to validate.
- (B) A single JSON `settings` column per bar, so adding fields later needs no migration. More
  flexible, slightly less queryable/typed.
**Why it matters:** it sets how every bar is read and validated.

**Resolution:** option (A) — **flat columns per bar**. Many rows per shop (`shop` indexed
**non-unique**, plus a `title`), with at most one `enabled` per shop guaranteed by a transactional
**one-active invariant**; the storefront fetches and renders exactly one active bar (or none). See
`PRODUCT.md`, `ARCHITECTURE.md` §2–3, and `complex-cases.md#one-enabled-invariant`.

## Q4 — Live preview fidelity in the admin
**Context:** the admin preview re-renders on field change. Should the preview's countdown **tick
live** (a running clock in the admin) or show a **static snapshot** (e.g. computed remaining at
the chosen deadline)?
**Options:**
- (A) Live-ticking preview. **← recommended** — higher demo wow-factor; shares the storefront
  ticker logic, so low marginal cost.
- (B) Static snapshot. Simpler; less impressive.
**Why it matters:** affects effort in S10 and the demo polish.

## Q5 — Color input UI: hex field vs Polaris ColorPicker
**Context:** a hex text input vs a graphical picker. Polaris 13 ships `ColorPicker`
(HSB, no alpha by default).
**Options:**
- (A) Hex `TextField` with a small swatch. — supports `#RRGGBBAA`, least effort, simplest validation.
- (B) Polaris `ColorPicker`. Nicer UX, but extra wiring and no alpha by default.
**Why it matters:** minor, but sets the admin form's component set.
**Resolved:** **both** — each color uses a Polaris `ColorPicker` inside a `Popover` *and* a hex
`TextField` (alpha-aware via HSBA↔hex helpers in `lib/color.ts`). Implemented in the per-bar editor.

## Q6 — Demo environment setup
**Context:** the demo needs a Shopify Partner dev store, an installed app (App Bridge key +
app-embed extension), a running Go backend, and MySQL — plus a public tunnel (e.g. ngrok) so the
storefront can reach the backend.
**Options:**
- (A) Stand up a fresh dev store + app + local MySQL + tunnel dedicated to this project. **←
  recommended** — clean and self-contained.
- (B) Use a hosted backend/DB instead of local + tunnel. Fewer moving parts at demo time, more
  setup up front.
**Why it matters:** drives the step-0 setup and how realistic the demo is within the deadline.

## Q7 — Auth statefulness: store the access token, or stay stateless?
**Context:** a Shopify app can persist the OAuth access token (to call the Admin API / register
webhooks) or stay stateless and authenticate each admin request with the App Bridge session token.
**Resolution: STATELESS.** The ONLY table is `announcement_bars`. Admin auth is via the App Bridge
session-token `dest` claim (decoded per request); the app **never calls the Shopify Admin API**, and
the OAuth callback completes the install handshake then **DISCARDS** the access token. There is **no**
shop / session / token table. This keeps feat-002 small and avoids token storage/encryption. See
`ARCHITECTURE.md` §2.
