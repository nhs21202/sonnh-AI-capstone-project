# user-stories.md — Stories to Review the Plan

Derived from `plan.md` to review it *as the user*. One story per capability, each in
Given/When/Then with explicit acceptance criteria (AC). Each story is classified
**NOW / COMPLEX / DISCUSS** (course Day 2). Gaps the plan missed are flagged at the bottom.

---

## Classification summary

| #  | Story                          | Class    | Why                                                              |
|----|--------------------------------|----------|-----------------------------------------------------------------|
| S1 | Install & data model           | NOW      | Standard GORM model (many rows/shop) + Shopify OAuth/session install. |
| S2 | Configure message              | NOW      | Plain text field round-trip.                                    |
| S3 | Style colors                   | COMPLEX  | Hex validation both sides; hex `TextField` + swatch (Q5 resolved). |
| S4 | Activate one bar (one-active)  | COMPLEX  | Enabling one deactivates the others; transactional invariant.  |
| S5 | Countdown setup                | COMPLEX  | Store-tz → UTC conversion; format rendering.                   |
| S6 | Expiry / auto-hide             | COMPLEX  | Server-vs-client split must be exact.                          |
| S7 | Admin CRUD + anti-IDOR         | COMPLEX  | Shop-match + per-bar `:id` ownership; JWT `dest` in all modes (Q2 resolved). |
| S8 | Public endpoint (server gate)  | COMPLEX  | Single active + not-expired gate; shop isolation.              |
| S9 | Storefront render + countdown  | COMPLEX  | Bundle/theme wiring; flicker; client ticker (one active bar).  |
| S10| Live preview in admin          | DISCUSS  | Resolved → live-ticking, last & cuttable (Q4, feat-008).      |
| S11| List saved bars                | NOW      | Index list of the shop's bars with an Active badge.            |
| S12| Create a bar                   | NOW      | "Add bar" → new draft, defaults `enabled:false`.               |
| S13| Edit a bar                     | NOW      | Open a saved bar in the editor and update it.                  |
| S14| Delete a bar                   | NOW      | Remove a saved bar; deleting the active one clears the storefront. |

NOW → execute directly. COMPLEX → see `complex-cases.md`. DISCUSS → see `questions.md`.

---

## S1 — Install & data model (NOW)
- **GIVEN** a Shopify Partner dev store with the app installed
- **WHEN** the backend boots and the merchant opens the app
- **THEN** an `announcement_bars` row exists (or defaults are returned) for that shop, keyed by
  shop domain
- **AC:** auto-migration creates the table; OAuth install succeeds; **multiple rows for the same
  shop coexist**; `WHERE shop = ?` returns the shop's set of bars; a fresh shop returns an empty
  list (no bars yet).

## S2 — Configure message (NOW)
- **GIVEN** the merchant is on the admin settings page
- **WHEN** they type a message (1–200 chars) and save with the bar enabled
- **THEN** the message persists and is returned on reload
- **AC:** message ≤200 chars persists; an empty message is always rejected with a visible
  error; reload shows the saved message.

## S3 — Style colors (COMPLEX)
- **GIVEN** the merchant is editing the bar
- **WHEN** they set background and text colors and save
- **THEN** valid hex colors persist and drive the storefront render
- **AC:** valid `#RRGGBB`/`#RRGGBBAA` persists; invalid hex blocked on admin (inline error) AND backend;
  storefront applies the saved colors. Color UI = hex `TextField` + swatch (supports alpha), per
  the Q5 decision. See `complex-cases.md#hex-color-validation`.

## S4 — Activate one bar / one-active invariant (COMPLEX)
- **GIVEN** a shop with several saved bars, bar A currently active
- **WHEN** the merchant enables bar B (and saves)
- **THEN** bar B becomes the only active bar and bar A is automatically deactivated; the storefront
  shows bar B on next load
- **AC:** enabling B sets `enabled=true` on B and `enabled=false` on all other bars in the SAME
  transaction; at most one bar per shop is ever `enabled`; disabling the active bar leaves none
  active → public `data: null`. See `complex-cases.md#one-enabled-invariant`.

## S5 — Countdown setup (COMPLEX)
- **GIVEN** the merchant enables the countdown
- **WHEN** they pick a deadline in store timezone, countdown colors, and a format, then save
- **THEN** the deadline is stored as absolute UTC and the storefront ticks down in the chosen
  format
- **AC:** store-tz input converts correctly to UTC; `countdown_end_at` required & must be future
  on save; each format (`dd:hh:mm:ss`, `hh:mm:ss`, `with_labels`) renders correctly. See
  `complex-cases.md#timezone-to-utc`.

## S6 — Expiry / auto-hide (COMPLEX)
- **GIVEN** a bar with a countdown
- **WHEN** the deadline passes
- **THEN** the bar does not render (if already expired at load) or is removed live (if it expires
  while viewing)
- **AC:** already-expired at request → server returns `data: null` (no bar); expires while
  viewing → client clears interval and removes the bar, no re-fetch. See
  `complex-cases.md#expiry-server-vs-client`.

## S7 — Admin CRUD + anti-IDOR (COMPLEX)
- **GIVEN** an authenticated merchant for shop A
- **WHEN** they call the CRUD routes `/api/v1/announcement-bars/:shop[/:id]`
- **THEN** they can only list/create/update/delete shop A's bars
- **AC:** authenticated create→list→update→delete round-trips; `:shop` ≠ authenticated shop
  (session-token `dest`) → `403`; an `:id` that isn't shop A's → `404`; invalid body → `400`. See
  `complex-cases.md#anti-idor-shop-check` and `questions.md` Q2.

## S8 — Public endpoint with server gate (COMPLEX)
- **GIVEN** a storefront request with `?shop=<domain>`
- **WHEN** it calls `GET /web/public/bar`
- **THEN** it receives only the single active, renderable bar, or `data: null`
- **AC:** missing `shop` → 400; no enabled bar → null; expired → null; one active → full payload
  (never more than one); shop A cannot read shop B. Covered by Go unit tests.

## S9 — Storefront render + countdown (COMPLEX)
- **GIVEN** the app embed is enabled on a dev-store theme
- **WHEN** a visitor loads any storefront page
- **THEN** the shop's single active bar appears at the top and the countdown ticks
- **AC:** the one active bar prepends to `<body>` with correct colors/message; countdown ticks each
  second in the saved format; reaching zero removes the bar; no active bar → no bar; app-embed-off →
  no bar. See `complex-cases.md#app-embed-not-enabled` and `#fetch-flicker`.

## S10 — Live preview in admin (DISCUSS — resolved: live-ticking)
- **GIVEN** the merchant is editing a bar
- **WHEN** they change message/colors/countdown
- **THEN** the preview reflects the bar and the countdown **ticks live** (a running clock in the
  editor), updating immediately on field changes
- **AC:** preview updates on every field change; the countdown ticks live by sharing the storefront
  ticker logic. Per the Q4 decision this is the **last** feature (`feat-008`) and is **cuttable** —
  if time runs short, cutting it leaves the static preview from S5/feat-005 intact.

## S11 — List saved bars (NOW)
- **GIVEN** a shop with zero or more saved bars
- **WHEN** the merchant opens the app index
- **THEN** they see a list of their bars (newest first) with title, an **Active** badge on the
  enabled one, countdown end, and a message preview
- **AC:** the list shows all the shop's bars and only that shop's; the active bar is clearly
  badged; an empty shop shows an empty state with an **Add bar** call to action.

## S12 — Create a bar (NOW)
- **GIVEN** the merchant is on the index list
- **WHEN** they click **Add bar**, fill the editor (title required), and save
- **THEN** a new bar is created as a draft (`enabled:false`) and appears in the list
- **AC:** `POST` returns `201`; title required (else `400`); the new bar is disabled by default and
  does not affect the currently active bar.

## S13 — Edit a bar (NOW)
- **GIVEN** a saved bar
- **WHEN** the merchant opens it in the editor, changes fields, and saves
- **THEN** the changes persist and survive reload
- **AC:** `PUT` updates only that bar; editing a bar that isn't this shop's → `404`; enabling it
  here triggers the one-active invariant (see S4).

## S14 — Delete a bar (NOW)
- **GIVEN** a saved bar
- **WHEN** the merchant deletes it
- **THEN** it is removed from the list; if it was the active bar, the storefront then shows nothing
- **AC:** `DELETE` removes only that bar; deleting a bar that isn't this shop's → `404`; deleting
  the active bar leaves no active bar → public `data: null`.

---

## Decisions & residual risks (from the plan review)

The DISCUSS questions raised during the plan review are now resolved (see `questions.md`):

1. **Dev-mode authenticated-shop source (anti-IDOR) — resolved (Q2).** Derive the authenticated
   shop by decoding the App Bridge session-token JWT `dest` claim in ALL modes (dev included);
   compare to `:shop`; never trust the path/query param. Exercised by S7.
2. **Per-bar storage shape — resolved (Q3).** Flat, typed columns per bar (no JSON blob); `shop`
   indexed non-unique with many bars per shop, plus a `title`.
3. **`feature_list.json` field convention — resolved (Q1).** Course schema:
   `id`/`name`/`description`/`dependencies`/`acceptance`/`status` (enum
   `not-started|in-progress|done|blocked`)/`evidence`.
4. **Demo infra setup — resolved (Q6).** Fresh, self-contained env: own Shopify Partner dev store +
   installed app, local MySQL (docker-compose), and a public tunnel so the storefront reaches the
   backend.
5. **Color input UI — resolved (Q5).** Hex `TextField` + swatch (supports `#RRGGBBAA`); no Polaris
   ColorPicker.
6. **Public endpoint caching/load** (many storefront hits) — intentionally out of scope for the
   demo; noted so it isn't mistaken for an omission. *(Residual — not a DISCUSS question.)*
