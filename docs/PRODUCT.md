# PRODUCT.md — Announcement Bar App

> North-star product brief. Re-read at the start of every session before touching code.
> Detailed design lives in `ARCHITECTURE.md`; the HOW lives in `plan.md`.

## Goal

Give Shopify merchants a fast, no-code way to show a styled announcement bar with an
optional countdown at the top of their storefront — typed in the admin, live on the store,
and self-removing when the promotion ends.

## Target merchant

Small-to-mid Shopify merchants running time-bound promotions (flash sales, free-shipping
deadlines, holiday offers) who want to configure a bar themselves without editing theme code
or hiring a developer.

## Product model: many saved bars, one live at a time

A shop can save **many** announcement bars (full CRUD), but **at most one is enabled (live) at a
time**; the storefront always renders that single active bar. Each saved bar carries an
admin-facing `title` so the merchant can tell drafts apart. Enabling a bar automatically
deactivates any other active bar — a one-active-per-shop invariant enforced in the API layer
(inside a transaction). No stacking, no multiple bars shown at once, and no per-page targeting in
this version — this keeps the storefront and data flow small and demoable while letting merchants
prepare promotions ahead of time and switch between them.

## Main use cases

1. Merchant opens the embedded admin and sees a list of their saved bars; clicks **Add bar**,
   gives it a title, types a message, picks background/text colors, and saves it as a draft
   (new bars start disabled).
2. Merchant **activates** one bar → it appears site-wide on the storefront; any previously active
   bar is automatically deactivated (exactly one live bar).
3. Merchant enables a countdown on a bar, sets a deadline (in store timezone) and countdown
   colors/format → every visitor sees the same time remaining ticking down.
4. When the deadline passes, the active bar disappears automatically for all visitors.
5. Merchant edits or deletes saved bars; deleting the active bar leaves the storefront with no bar.
6. Merchant sees a live preview of the bar in the admin as they edit (optional).

## Data entity (high level)

Many `announcement_bars` records per shop, each holding: an admin-facing `title`, the `enabled`
flag (at most one `true` per shop), the `message`, background/text colors, and a countdown group
(`countdown_enabled`, an absolute-UTC `countdown_end_at`, countdown colors, and a display
`countdown_format`). Tenant isolation is by `shop` domain on every query; the one-active-per-shop
invariant is enforced in the API layer (MySQL has no filtered-unique index). Full
field/type/constraint detail is in `ARCHITECTURE.md`.

## Business rules

- A shop can store many bars, but **at most one is enabled (live)** at a time; enabling a bar
  deactivates the others. The storefront shows only that single active bar, site-wide (every page).
- The countdown deadline is stored as an absolute UTC instant; all visitors see identical
  time remaining regardless of their local timezone.
- The active bar is shown only when `enabled = true` **and** (if a countdown is set) the deadline
  has not passed.
- Display-only: the bar has no buttons, links, or dismiss control.

## Definition of done (product)

The end-to-end demo works: a merchant configures the bar in the embedded admin, saves, and the
bar renders correctly on a real storefront — including the countdown ticking, the bar
auto-hiding at expiry, and the on/off toggle taking effect — backed by evidence (verify-command
output), not assertions.

## Out of scope (explicit — do NOT build)

- Showing more than one bar at once (stacking, rotation, or a carousel). Many bars can be *stored*,
  but exactly one *active* bar renders at a time.
- Page / URL targeting (the active bar is always site-wide).
- Scheduled future start time (only the countdown *end* is handled, not a delayed start).
- Evergreen / per-visitor countdowns (no cookies/localStorage timers).
- CTA buttons, links, or click actions.
- Dismiss ("X") button with per-visitor persistence.
- Multi-language / message translation.
- Analytics, impression tracking, or A/B testing.
