# ARCHITECTURE.md — Design Spec

Detailed technical design for the Announcement Bar app. Derived from the six approved brainstorm
sections. Product context: `PRODUCT.md`. Implementation HOW: `plan.md`.

The app is a three-tier monorepo (admin, backend, storefront) chosen so each tier has one clear
responsibility and a well-defined interface to the next.

---

## 1. Architecture overview

Many shop-scoped bars are managed in the admin; the storefront renders only the single active one:

```
ADMIN (frontend/)                BACKEND (backend/)                  STOREFRONT (storefront/)
React 18 + Vite + TS             Go + Fiber + GORM + MySQL           Webpack + TS bundle
Polaris + App Bridge             /api/v1/announcement-bars/:shop     Theme App Extension
Redux Toolkit + axios   ──────►   GET (list) · POST (create)         app-embed block
ApiClient→BaseRepo→     signed    PUT /:id · DELETE /:id  (CRUD)     ◄── ApiClient→BaseRepo→
 AnnouncementBarRepo    HMAC +    GET /web/public/bar?shop=  ───────►    AnnouncementBarRepo
                        Bearer     (public, CORS *, ONE active bar)      window.Shopify.shop
                                 WHERE shop = ? + one-active invariant   countdown JS, inject DOM
```

- **Backend:** Go + Fiber + GORM + MySQL. Every query scoped `WHERE shop = ?`.
- **Admin:** React 18 + Vite + TS, Polaris + App Bridge, Redux Toolkit. Data layer
  is a small repository stack: `ApiClient` (axios) → `BaseRepository` → `AnnouncementBarRepository`,
  so HTTP/auth concerns stay in one place and each resource gets a thin typed wrapper.
- **Storefront:** Webpack-bundled TypeScript with the same repository layering. A Theme App
  Extension app-embed block injects the bundle and sets `window.*` globals; the shop is read from
  `window.Shopify.shop`.

---

## 2. Data model — `announcement_bars`

**Many rows per shop** (one per saved bar). GORM model.

| Field                  | Type           | Constraints / notes                                                                                  |
|------------------------|----------------|------------------------------------------------------------------------------------------------------|
| `id`                   | bigint, PK     | auto-increment. Per-bar identifier used by the admin CRUD routes.                                     |
| `shop`                 | varchar(255)   | NOT NULL, **INDEX (not unique)**. The `*.myshopify.com` domain. Tenant key — many bars share a shop.  |
| `title`                | varchar(120)   | NOT NULL. Admin-facing label so the merchant can tell saved bars/drafts apart. Not shown on storefront.|
| `enabled`              | boolean        | NOT NULL, default `false`. **At most one `enabled = true` per shop** (app-enforced invariant).        |
| `message`              | varchar(255)   | Required (1–200 chars). Bar text.                                                                     |
| `background_color`     | varchar(9)     | NOT NULL. Hex `#RRGGBB` or `#RRGGBBAA`. Default `#1A1A1A`.                                             |
| `text_color`           | varchar(9)     | NOT NULL. Hex. Default `#FFFFFF`.                                                                      |
| `countdown_enabled`    | boolean        | NOT NULL, default `false`.                                                                            |
| `countdown_end_at`     | datetime (UTC) | Nullable. Required when `countdown_enabled = true`. Absolute UTC instant. Future at save time.        |
| `countdown_bg_color`   | varchar(9)     | NOT NULL. Hex. Default `#000000`.                                                                      |
| `countdown_text_color` | varchar(9)     | NOT NULL. Hex. Default `#FFFFFF`.                                                                      |
| `countdown_format`     | varchar(20)    | NOT NULL. Enum: `dd:hh:mm:ss` \| `hh:mm:ss` \| `with_labels`. Default `dd:hh:mm:ss`.                  |
| `created_at`           | datetime       | GORM-managed.                                                                                         |
| `updated_at`           | datetime       | GORM-managed.                                                                                         |

**Color validation:** every color field must match `^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`,
validated on the admin (regex, shown as an inline `TextField` error) and re-validated on the
backend before save.

**Timezone rule:** the merchant picks the deadline in store timezone; the admin converts it to
UTC before sending. `countdown_end_at` is always stored/served as an absolute UTC instant
(ISO 8601, `Z`), so every visitor sees identical time remaining.

**One-active-per-shop invariant:** at most one row per shop may have `enabled = true`. MySQL has no
filtered/partial unique index, so this is **not** a DB constraint — it is enforced in the API layer:
whenever a write sets a bar `enabled = true`, the same transaction sets `enabled = false` on all
other bars of that shop. There is intentionally **no `sort_order`** column — bars never stack, so
there is no ordering to store.

**Stateless auth, single table:** the ONLY table is `announcement_bars`. Admin requests are
authenticated **statelessly** via the App Bridge session-token `dest` claim (decoded per request);
the app **never calls the Shopify Admin API**, and the OAuth callback only completes the install
handshake and then **discards** the access token. There is **no** shop / session / token table.

---

## 3. API contract

Response envelope: `{ "error": bool, "msg": string, "data": any }`.

**Anti-IDOR (applies to ALL admin routes):** every admin route runs behind `VerifyShopifyApi()`
(Shopify query-param HMAC; no-ops when `STAGE_STATUS=dev`). The `:shop` path param MUST equal the
*authenticated* shop derived from the App Bridge **session-token `dest`** claim in ALL modes (dev
included) — never trust the path/query param. Mismatch → `403 { error:true, msg:"shop mismatch" }`.
Additionally, any `:id` MUST belong to that shop; a bar id that isn't this shop's →
`404 { error:true, msg:"not found" }` (a merchant must never read/edit/delete another shop's bar).

### 3.1 Admin — list bars (server-side search / filter / sort / pagination)
```
GET /api/v1/announcement-bars/:shop?q=&status=&sort=&page=&page_size=
```
- Returns **one page** of the shop's bars after applying, all **on the server**:
  - `q` — case-insensitive search across `title` OR `message` (omitted ⇒ no search).
  - `status` — `active` | `draft` (omitted ⇒ all). Filters on `enabled`.
  - `sort` — `"<field> <dir>"`, `field ∈ title | status | countdown`, `dir ∈ asc | desc`
    (default `title asc`). The field is **whitelisted** before it reaches SQL — the raw param is
    never interpolated into `ORDER BY` (injection-safe). Bars without a countdown sort last.
  - `page` / `page_size` — 1-based page and page size (default `page_size = 10`, clamped to ≤ 100).
- `200 { error:false, msg:"success", data: [<bar>...], meta: {…} }`. The `meta` block carries the
  pagination state the admin list UI needs:
  ```json
  "meta": { "total": 23, "page": 1, "page_size": 10, "total_pages": 3 }
  ```
  A shop with no bars yet returns an empty array `[]` with `total: 0`.

### 3.2 Admin — create bar
```
POST /api/v1/announcement-bars/:shop
Body: flat settings DTO (all editable fields, incl. title)
```
- Server-side validation before save: `title` required; colors match the hex regex; `message`
  1–200 chars when `enabled`; if `countdown_enabled` then `countdown_end_at` is present and parses
  as a valid future UTC instant. On failure → `400 { error:true, msg:<reason> }`.
- New bars default `enabled = false`. If the request creates a bar with `enabled = true`, apply the
  one-active invariant (see 3.2b). On success → `201 { error:false, msg:"success", data:<bar> }`.

### 3.2a Admin — update bar
```
PUT /api/v1/announcement-bars/:shop/:id
Body: flat settings DTO (all editable fields, incl. title)
```
- 404 if the bar is not this shop's. Same validation as create.
- **One-active invariant:** when this request sets `enabled = true`, the SAME transaction sets
  `enabled = false` on all OTHER bars of the same shop, so exactly one stays active.
- On success → `200 { error:false, msg:"success", data:<bar> }`.

### 3.2b Admin — delete bar
```
DELETE /api/v1/announcement-bars/:shop/:id
```
- 404 if the bar is not this shop's. Deletes the row.
- On success → `200 { error:false, msg:"success", data:null }`. Deleting the active bar simply
  leaves the shop with no active bar (storefront then shows nothing).

### 3.3 Public — storefront read (server-side expiry gate)
```
GET /web/public/bar?shop=<domain>
```
- **No auth. CORS `*`.** Shop-scoped by the `?shop=` query param only — appropriate for
  display-only, non-sensitive data that a public storefront script must read without secrets.
  Missing `shop` → `400`.
- **Returns the SINGLE active bar.** The endpoint selects the shop's one bar with `enabled = true`
  (the one-active invariant guarantees at most one) and applies the **server-side expiry gate:** it
  returns that bar ONLY when (`countdown_enabled = false` OR `countdown_end_at` is still in the
  future at request time). If there is no enabled bar, or the active bar is already expired, it
  returns `200 { error:false, msg:"success", data: null }`. The server NEVER ships a disabled or
  already-expired bar, and never ships more than one. Shop A must never receive shop B's bar.
- On success: `200 { error:false, msg:"success", data: <public bar fields> }` — message, colors,
  `countdown_enabled`, `countdown_end_at` (UTC ISO 8601), countdown colors, format. (`title` is
  admin-only and is NOT included.)

### Expiry responsibility split (server vs client)
- **Server** decides whether a bar is renderable *at request time* (enabled + not-yet-expired).
  Already-expired or disabled → `data: null`, nothing ships.
- **Client** handles only expiry that occurs *live while the visitor is viewing the page*: it
  ticks the countdown and, when the timer reaches zero, stops the interval and removes the bar
  from the DOM. The client does not re-fetch.

---

## 4. Storefront rendering & countdown logic

Flow:
1. **App-embed block** (`target: body`) sets `window.announcementBarEnabled = true` + page
   context, and injects the webpack bundle via a `storefront.liquid` snippet
   (`{{ 'announcement-bar.js' | asset_url }}` with `defer`).
2. **Bundle** (`index.ts`) on `DOMContentLoaded` reads `window.Shopify.shop`, calls
   `AnnouncementBarRepository.getBar(shop)` → `GET /web/public/bar?shop=`.
3. On `data !== null`, JS builds the bar DOM, **prepends it to `<body>`** (static bar at top),
   applies colors, and — if `countdown_enabled` — starts a 1s `setInterval` ticker rendering the
   remaining time to `countdown_end_at` in the configured format.

### Countdown format rendering (`countdown_format`)
- `dd:hh:mm:ss` → zero-padded days:hours:minutes:seconds, e.g. `02:14:03:09`.
- `hh:mm:ss` → days folded into hours, e.g. `62:03:09`.
- `with_labels` → `2d 14h 03m 09s`.

### Edge-case table

| #  | Case                                              | Behavior                                                                 |
|----|---------------------------------------------------|--------------------------------------------------------------------------|
| 1  | No bar is enabled (all saved bars disabled)       | Server returns `data: null`; storefront renders nothing.                 |
| 2  | Shop has no bars at all                           | Server returns `data: null`; storefront renders nothing.                 |
| 3  | `countdown_enabled = false`                       | Render a plain bar (message + colors), no timer.                         |
| 4  | `countdown_end_at` already passed at request time | Server returns `data: null` (server gate); bar never ships.              |
| 5  | Countdown reaches zero while viewing              | Client stops interval and removes the bar from the DOM (no re-fetch).    |
| 6  | Visitor local-clock skew                          | Accepted limitation; client clock drives the tick. No server-time sync.  |
| 7  | App embed not enabled in the theme                | Bundle never loads → no bar. Demo checklist must note enabling app embed. |
| 8  | Brief flicker before fetch resolves               | Accepted; the bar is JS-injected and appears once the fetch resolves.    |
| 9  | Invalid/garbage stored color                      | Backend rejects on save (hex regex), so storefront always gets valid hex. |
| 10 | Merchant activates a different bar                | One-active invariant swaps which bar is enabled; storefront shows the new active bar on next load. |
| 11 | The active bar is deleted                         | No enabled bar remains → server returns `data: null`; storefront shows nothing. |

---

## 5. Admin UI

Two Polaris views under the app:
- **Index list** (route `/announcement-bars`): an `IndexTable` of the shop's saved bars showing
  `title`, an **"Active" badge** on the one enabled bar, the countdown end, and a message preview.
  Primary action **Add bar**; each row has per-row **Edit** and **Delete**. A Polaris `IndexFilters`
  bar drives **server-side** search/filter/sort/pagination: a search box (debounced ~300ms, maps to
  `q`), a **Status** filter (`active`/`draft` → `status`), sort options for title/status/countdown
  end (→ `sort`), and `Pagination` (10 per page → `page`/`page_size`). Every change re-queries
  `GET …/:shop?q&status&sort&page` — the client holds only the current page, never the full set.
- **Per-bar editor** (routes `/announcement-bars/new` and `/announcement-bars/:id`): the per-bar
  fields **plus Title** — Enabled toggle (enabling implies the other bars deactivate; reflect the
  server invariant by refetching the list), Message (`TextField`), background & text colors (each a
  Polaris `ColorPicker` in a `Popover` + a hex `TextField`, alpha-aware),
  Enable-countdown checkbox revealing deadline (`TextField type="datetime-local"`, interpreted in
  store timezone), countdown colors, and a format `Select`.
- **Live preview (`Layout.Section`):** re-renders the bar being edited as fields change, and the
  countdown ticks live every second (resolved — this is feat-008).
- **Save bar:** App Bridge contextual save bar (`<SaveBar>`); dirty-state via `JSON.stringify`
  compare; navigating away while dirty triggers `saveBar.leaveConfirmation()`.
- **Data layer:** `AnnouncementBarRepository` (`url() => "/announcement-bars"`,
  `list(params)` → builds the `q/status/sort/page/page_size` query string and returns a typed
  `{ items, total, page, pageSize, totalPages, activeCount }`, `create`, `update`, `remove`) + an
  `announcementBarSlice` (`createAsyncThunk` fetch/create/update/delete, holding the current page +
  pagination meta) registered in `store.ts`.
  Nav `<Link>` in the app nav, routes in the app router.
- **Validation (native React state, inline `TextField` errors):** title required; message required
  & ≤200 chars (always required); if countdown enabled, deadline required and must be in the future at
  save; colors valid hex. Invalid fields render a red border + message via Polaris's `error` prop.

---

## 6. Component inventory (what gets built)

| Tier       | Artifact                          | Responsibility                                             |
|------------|-----------------------------------|-----------------------------------------------------------|
| Backend    | `AnnouncementBar` GORM model      | Many rows per shop; tenant key `shop`; admin-facing `title`. |
| Backend    | `VerifyShopifyApi` middleware     | HMAC verification + anti-IDOR shop-match + per-bar `:id` ownership helper. |
| Backend    | Admin controller (CRUD)           | Authenticated list (server-side search/filter/sort/pagination + meta) / create / update / delete + one-active invariant (transaction). |
| Backend    | Public controller (GET)           | Server-gated, shop-scoped read of the single active bar.  |
| Admin      | `ApiClient` / `BaseRepository`    | Axios client + uniform result wrapping + auth headers.    |
| Admin      | Index list + per-bar editor       | The bar list (Active badge), editor form, preview, activate, and dirty-state save flow. |
| Storefront | `ApiClient` / `BaseRepository`    | Public fetch layer for the bundle.                        |
| Storefront | Bundle entry + countdown module   | Inject bar, run ticker, handle live expiry.               |
| Storefront | Theme app-embed block + snippet   | Load the bundle and pass shop/page context.               |
