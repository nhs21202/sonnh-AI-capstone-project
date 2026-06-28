# complex-cases.md — Edge Cases & Decisions to Resolve Before Coding

COMPLEX items from the NOW/COMPLEX/DISCUSS classification (course Day 2). Each has a proposed
resolution; items that genuinely need YOUR decision are also surfaced in `questions.md`.

---

## timezone-to-utc
**Case:** merchant picks a deadline in their store timezone, but the countdown must mean the same
instant for every visitor worldwide.
**Resolution:** the admin reads the store's IANA timezone, converts the `datetime-local` input
from store-tz to an absolute UTC instant (`date-fns` / `date-fns-tz`) before sending. Backend
stores/serves `countdown_end_at` as UTC ISO 8601 (`Z`). Storefront compares against the visitor's
`Date.now()`. **Watch:** DST transitions and getting the store timezone right (Shopify
`shop.iana_timezone`). Round-trip test: input local time → stored UTC → rendered remaining time.

## expiry-server-vs-client
**Case:** a bar can expire before the page loads, or while the visitor is on the page.
**Resolution (the split):**
- **Server:** `GET /web/public/bar` returns `data: null` when `enabled=false` OR
  (`countdown_enabled` AND `countdown_end_at <= now`). Already-expired/disabled bars never ship.
- **Client:** ticks the countdown; when it hits zero, clears the interval and removes the bar from
  the DOM. No re-fetch.
**Watch:** the server boundary is `<= now` (inclusive); the client must not briefly show a
negative timer — clamp to zero then remove.

## anti-idor-shop-check
**Case:** admin endpoints take `:shop` (and now `:id`) in the path; a merchant must not
read/write/delete another shop's bars by changing either.
**Resolution:** a shared helper derives the *authenticated* shop from the verified request and
compares to `:shop`; mismatch → `403`. In production the authenticated shop comes from the Shopify
HMAC `shop` param (verified by `VerifyShopifyApi`) and/or the App Bridge session-token `dest`
claim. **Additionally**, every route that takes `:id` must confirm the bar belongs to that shop
(`WHERE id = ? AND shop = ?`); a foreign or non-existent id → `404` (don't leak existence). **Open:**
in `dev` mode `VerifyShopifyApi` no-ops, so there's no verified shop to compare against — needs a
decision → `questions.md` Q2.

## one-enabled-invariant
**Case:** a shop holds many bars but at most one may be live; MySQL has no filtered/partial unique
index to enforce "one `enabled` per shop" at the DB level.
**Resolution:** enforce it in the API layer. When a create/update sets `enabled = true`, the SAME
transaction first sets `enabled = false` on all other bars of that shop, then enables the target —
so a concurrent "activate A" / "activate B" can't both win; one transaction commits last and is the
sole active bar. A unit test asserts that after any activate, `COUNT(*) WHERE shop=? AND enabled` is
exactly 1. **Watch:** do the deactivate-others + enable-target in one transaction; never two
separate writes that could interleave.

## delete-active-bar
**Case:** the merchant deletes the bar that is currently active (live on the storefront).
**Resolution:** the delete just removes the row; no bar is promoted in its place. With no
`enabled = true` bar remaining, `GET /web/public/bar` returns `data: null` and the storefront shows
nothing on next load. **Watch:** this is intended — there is no "fallback to the next bar".

## empty-list
**Case:** a shop has no bars yet (fresh install), or has bars but none enabled.
**Resolution:** admin `GET .../announcement-bars/:shop` returns an empty array `[]` (not a defaults
object); the public endpoint returns `data: null`. The admin index renders an empty state with an
**Add bar** action. **Watch:** the admin list must handle `[]` without erroring.

## hex-color-validation
**Case:** invalid colors would break the storefront render or allow CSS injection.
**Resolution:** validate every color field against `^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$` on the
admin (inline `TextField` error, blocks save) AND on the backend before persisting (defense in depth). Storefront
therefore always receives valid hex. **Watch:** reject anything that isn't a strict hex string
(no `rgb()`, no named colors, no raw CSS) to prevent injection into the inline `style`.

## app-embed-not-enabled
**Case:** the Theme App Extension app-embed block is off in the merchant's theme, so the bundle
never loads and no bar shows — looks like a bug in the demo.
**Resolution:** this is expected Shopify behavior (app embeds are merchant-toggled in the Theme
Editor). Document it in the demo checklist: enable the app embed before demoing. Optionally, the
admin can show a one-line "Enable the app embed in your theme" hint. **Watch:** confirm the embed
is on in the dev store before recording the demo.

## fetch-flicker
**Case:** the bar is JS-injected after a fetch, so there's a brief moment before it appears
(potential layout shift at the top of the page).
**Resolution:** accepted trade-off for a JS-injected storefront bar. Keep the fetch
fast and prepend the bar as soon as data resolves. **Watch:** avoid a tall reserved space that
then collapses; only insert the element once data is known. Not worth SSR/metafield complexity for
this demo.

---

## Additional edge cases (defaulted, no decision needed)

- **First run / no bars:** admin list GET returns an empty array `[]`; the editor uses field
  defaults for a new bar; public GET returns `data: null`. (See `one-enabled-invariant`,
  `empty-list`.)
- **Countdown enabled but deadline in the past at save:** rejected on save (`400`), so it can't be
  persisted in an already-expired state.
- **Long message / overflow:** single-line bar; CSS truncates with ellipsis. Message capped at 200
  chars.
- **`hh:mm:ss` format with many days:** days fold into hours (e.g. `62:03:09`) — documented, not a
  bug.
