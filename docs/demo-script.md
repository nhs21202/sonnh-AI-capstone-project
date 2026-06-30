# Demo script — Announcement Bar App (feat-007)

A scripted end-to-end walkthrough for the capstone demo, plus the automated verify-suite evidence.
Brand: **Announcement Bar App**. Store used for the live demo: `sonnh-dev-store-3.myshopify.com`.

---

## 0. Prerequisites (have these running before you present)

1. **MySQL** up: `docker compose up -d` (or just run `bash init.sh` once — it starts it).
2. **Backend** running and reachable on its port: from `backend/` run `go run .`
   (loads `backend/.env`, AutoMigrates `announcement_bars`, serves the API + the built admin SPA).
3. **Public tunnel** (ngrok) pointing at the backend, and `APP_URL` in `backend/.env` set to that
   HTTPS URL **with no trailing slash**. The Partner app's redirect URL is `<APP_URL>/auth/callback`.
4. **Admin built**: `cd frontend && npm run build` (the backend serves `frontend/dist`).
5. **Storefront extension deployed**: `cd storefront && npm run build` then `shopify app deploy`
   (or `shopify app dev`), and the app-embed **Announcement Bar** is toggled **on** in the theme.

Sanity check: open `<APP_URL>/health` → `{"status":"ok"}`; open `<APP_URL>/` inside the store admin
→ the embedded app loads (App Bridge boots from the `?shop&host` params).

---

## 1. End-to-end walkthrough (the live story)

| # | Action | Where | Expected result |
|---|--------|-------|-----------------|
| 1 | Open the app from the store's Apps menu | Admin | Bars list renders (empty on a fresh store); once bars exist, the **search box / Status filter / sort / pager** each re-query the server (visible in Network as `GET …/:shop?q&status&sort&page`) |
| 2 | **Add bar** → fill Title `Summer Sale`, Message `Summer sale — 20% off`, pick colors | Admin editor | Live preview updates **as you type**; required fields show `*` |
| 3 | Leave it disabled, **Save** | Admin | Contextual save bar appears when dirty; saving returns to the list, bar shows **no** Active badge |
| 4 | **Add bar** #2 → Title `Free Shipping`, Message `Free shipping over $50`, enable **Countdown**, set a deadline ~3 hours out, **Enable** the bar, **Save** | Admin editor | Validation passes; list now shows bar #2 with the **Active** badge |
| 5 | Open the **storefront** home page | Storefront | The **Free Shipping** bar renders **sticky at the very top**, correct colors, countdown **ticking** every second |
| 6 | Back in admin, open **Summer Sale**, toggle **Enabled**, **Save** | Admin | List flips: **Summer Sale** is now Active, **Free Shipping** is not (one-active invariant) |
| 7 | **Reload** the storefront | Storefront | The bar **swaps** to **Summer Sale** (server returns the single active bar) |
| 8 | Delete **Free Shipping** from the list | Admin | Row disappears; storefront unaffected (it wasn't active) |
| 9 | Edit the active bar → set the countdown deadline to ~40 seconds out, **Save**; watch the storefront | Storefront | Countdown counts down; at **zero** the bar **removes itself** from the page (client expiry) |
| 10 | (Optional) Disable the only active bar, reload storefront | Storefront | **No bar** renders (no active bar → endpoint returns `data: null`) |

**Invariants to call out while presenting**
- **One active per shop** — enabling a bar deactivates the others (enforced in a DB transaction).
- **Anti-IDOR** — the admin API authorizes via the App Bridge session-token `dest` claim; a token for
  shop A can never read/modify shop B's bars (mismatch → 403).
- **Stateless** — the only table is `announcement_bars`; the OAuth access token is verified then
  **discarded**; the app never calls the Admin API.
- **Storefront safety** — the public endpoint returns only display fields (never the internal Title),
  applies the **server-side expiry gate**, and is the single source of "which bar is active".

---

## 2. Verify suite (automated) — evidence

Run from the repo root:

```
$ bash init.sh
==> 1/9 Check Node 22
==> 2/9 Check Go
==> 3/9 Prepare per-tier .env files
==> 4/9 Start MySQL (docker compose)
==> 5/9 Wait for MySQL healthy
==> 6/9 Schema (no separate migrate step)
==> 7/9 Backend test + build
ok  announcementbar/internal/config
ok  announcementbar/internal/database
ok  announcementbar/internal/handlers
ok  announcementbar/internal/middleware
ok  announcementbar/internal/shopify
ok  announcementbar/internal/validate
==> 8/9 Frontend install
==> 9/9 Storefront install
================ HARNESS GREEN ================
```

What the suites cover:
- **Backend (`go test ./...`)** — OAuth HMAC + session-token + shop validation; admin CRUD round-trip;
  the **list query** (server-side `q` search, `status` filter, whitelisted `sort`, pagination `meta`);
  one-active invariant (`enabling one disables the others`); anti-IDOR (403 on `dest` mismatch);
  public endpoint (missing shop → 400, no/expired bar → `null`, Title never leaked, shop A ≠ shop B);
  **input validation** incl. title ≤120 / message ≤200 length rules.
- **Frontend (`vitest`)** — store-timezone ⇄ UTC round-trip; `computeErrors` validation rules
  (required, length, hex, future-deadline) mirroring the backend; the bars-list **repository query
  mapping** (`q/status/sort/page` → request, `meta` → typed result) and the server-driven list
  (re-query on search/filter/sort/page).
- **Storefront (`vitest`)** — countdown remaining-time math, the expiry boundary, all three formats.

---

## 3. Capstone deliverables checklist

- [x] **Repo / source link** — https://github.com/nhs21202/sonnh-AI-capstone-project
- [ ] **Live demo** — embedded admin on `sonnh-dev-store-3` + storefront bar (via ngrok tunnel).
- [x] **Presentation slide deck** — `presentation/index.html` (terminal-themed, open in a browser).
- [x] **AI / Harness workflow note** — `present.md`.
- [x] **Verify evidence** — `bash init.sh` → `HARNESS GREEN` (above); see also `.claude/feature_list.json` evidence per feature.
