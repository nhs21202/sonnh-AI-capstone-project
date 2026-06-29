# present.md — How I Built This with AI (Workflow Record)

> Source material for the capstone report and slide deck. It records **how I worked with an AI
> coding assistant** (Claude Code) to design and harness this project — the brainstorming, the
> planning, the harness/guardrail setup — not just the final code. Read this top-to-bottom and
> lift whatever you need into the report.

---

## 0. The capstone in one paragraph

Build **one simple, demoable Shopify app** and — just as importantly — show the **AI / harness
workflow** behind it. My app is an **Announcement Bar**: a merchant manages several saved bars
(message, colors, an optional fixed-date countdown) in the embedded admin and keeps **one active at
a time**; the active bar renders site-wide on the storefront and auto-hides when the countdown
expires. Grading rewards clear logic, a working
demo, and a credible story of *how AI was used as a disciplined engineering partner*. Deliverables:
repo/demo link, slide deck, and this AI/harness workflow note.

The thesis of my workflow: **treat the AI like a strong but literal junior engineer, and put a
harness around it** — explicit rules, a planned scope, automated guardrails, and an
evidence-before-"done" habit — so the speed of AI doesn't turn into sloppiness.

---

## 1. The methodology: a "harness" around the AI

I didn't just prompt-and-pray. I built a small **harness** (from the course's Day-2 / Day-4 / Day-7
material) so the AI works inside guardrails. A harness has five subsystems; here is how each maps to
a real file in this repo:

| Subsystem      | Question it answers                  | Where it lives in this repo |
|----------------|--------------------------------------|------------------------------|
| **Guidance**   | What are the rules / source of truth?| `AGENTS.md`, `CLAUDE.md` |
| **Tools**      | What can the AI run?                  | permission rules in `.claude/settings.json` |
| **Environment**| How is it reproducible?              | `docker-compose.yml`, `.env.example`, `.nvmrc`, `Makefile`, `package.json`, `init.sh` |
| **State**      | What's the scope, log, and handoff?  | `.claude/feature_list.json`, `progress.md`, `session-handoff.md` |
| **Feedback**   | How do we know it actually works?    | `init.sh` verify suite + the Day-4 guardrail hooks |

The point: the AI is fast but *literal*. The harness supplies the judgment a human would otherwise
have to repeat in every prompt — scope, rules, verification, and continuity between sessions.

---

## 2. The workflow, in the order it actually happened

### Phase 1 — Brainstorming the scope (no code)
I asked the AI to brainstorm **one question at a time** and to *push back* on scope rather than
agree with everything. We pinned down a deliberately lean MVP:
- Many saved bars per shop with **exactly one active at a time** (full CRUD admin; the storefront
  renders only the single active bar). No stacking, no per-page targeting.
- A **fixed-date countdown** as the hero feature, with per-bar enable/activate.
- On expiry: **hide the whole bar**.
- A live admin preview, marked as the *last and cuttable* feature.

**Technique:** I forced the AI to interrogate the idea instead of expanding it. The valuable output
of brainstorming was the **"out of scope" list** — the features we consciously said *no* to.

### Phase 2 — Planning artifacts (English, plan-mode discipline)
Before any code, I had the AI produce a fixed set of planning docs, in a deliberate order:
1. `docs/PRODUCT.md` — the 1-page north-star (what & why).
2. `docs/ARCHITECTURE.md` — the design spec (data model, API contract, edge-case table).
3. `docs/plan.md` — the implementation plan (the *how* / build order).
4. `docs/user-stories.md` — stories derived **from** the plan, in Given/When/Then form.

**Technique:** *separate the WHAT from the HOW*. PRODUCT/ARCHITECTURE are durable; the plan is the
sequence. Deriving user stories from the plan (not the other way round) kept them grounded.

### Phase 3 — Classify, then resolve the unknowns
Every user story was tagged **NOW / COMPLEX / DISCUSS**:
- **NOW** — build immediately.
- **COMPLEX** — needs an explicit edge-case decision → `docs/complex-cases.md`.
- **DISCUSS** — a genuine product/tech fork I had to decide → `docs/questions.md`.

I then resolved **six DISCUSS questions** myself (the AI proposed options + a recommendation; I
chose). Examples of the real decisions:
- **Anti-IDOR:** derive the authenticated shop from the signed session-token JWT `dest` claim in
  *all* modes — never trust a path/query parameter.
- **Expiry split:** the *server* refuses to ship a disabled/expired bar; the *client* removes it
  live when the ticker hits zero.
- **Timezone:** the merchant picks a deadline in store time; it's converted to absolute UTC so every
  visitor sees the same time remaining.
- **One active per shop:** enforced in the API layer inside a transaction (enabling one bar
  deactivates the others), since MySQL has no filtered-unique index for it.
- Flat DB columns per bar over a JSON blob (YAGNI); hex color input with a swatch; a fresh
  self-contained demo environment.

**Technique:** the AI is great at *enumerating options and trade-offs*; the human stays the
*decision-maker*. I never let it silently guess on a fork — unknowns became explicit questions.

### Phase 4 — The feature DAG (scope as a dependency graph)
I had the AI turn the plan into `.claude/feature_list.json`: 8 features, each with
`id / description / dependencies / acceptance / status / evidence`. Rules baked in: **only one
feature `in-progress` at a time**, never start a feature whose dependencies aren't `done`, and
`evidence` may only contain **real verify output** — never a promise. The optional live-preview
feature is a leaf node, explicitly cuttable if time runs out.

**Technique:** scope becomes a machine-checkable graph, not a vibe. The AI can't wander off-plan.

### Phase 5 — Harness scaffold (Guidance + State)
I set up the rule/continuity files: `AGENTS.md` (the system of record), a `CLAUDE.md` stub,
`progress.md` (a running session log), and `session-handoff.md` (a deliberate cross-session
handoff). Hard constraints live in `AGENTS.md`: shop-scope every query (`WHERE shop = ?`), validate
hex colors on both ends, commit `.env.example` but never `.env`, English-only.

**Technique:** write the rules **once, in the repo**, so I don't re-type them every session — and so
a *future* session (or a different AI) starts from the same contract.

### Phase 6 — Guardrails (Day-4 security subsystem)
I added an automated safety net so the AI literally *cannot* run the worst commands:
- `.claude/settings.json` — permission **allow / ask / deny** lists (e.g. allow `npm`/`go test`;
  *ask* before `git push`; **deny** reading `.env`/keys, `rm -rf`, force-push, hard-reset — and deny
  editing the hooks themselves so the AI can't disable its own guardrail).
- `.claude/hooks/block-dangerous.sh` — a PreToolUse hook that **blocks** dangerous shell commands
  (`rm -rf`, `DROP TABLE`, `git push --force`, `curl … | sh`, …). Exit code **2 = block**.
- `.claude/hooks/scan-secrets.sh` — a PostToolUse hook that **warns** if an edited file looks like it
  contains a secret (Shopify tokens, `mysql://user:pass@…`, private keys).

I then **tested** them and recorded raw exit codes as evidence:
`rm -rf /` → 2 (blocked), `git push --force` → 2, `npm run remove-cache` → 0 (correctly allowed),
`go test ./...` → 0. Secret scanner warned on a fake `shpat_…` token but never blocked a write.

**Technique:** *don't trust the AI to be careful — make carelessness impossible.* Guardrails are
code, tested like any other code.

### Phase 7 — Handoff hygiene
I rewrote `session-handoff.md` to match the course reference shape — a short, deliberate handoff
(Quick reboot recipe → an 8-field status snapshot → a before-you-leave checklist) instead of a
duplicate of the other docs. I verified on disk that every file the handoff *claims* exists actually
exists, and fixed a stale claim (a `docker-compose.yml` listed as done that wasn't there).

**Technique:** the handoff is for the *next* session; it must be honest and runnable, not a brochure.

---

## 3. The AI-collaboration techniques I leaned on (the transferable lessons)

| Technique | What it means in practice |
|-----------|----------------------------|
| **Brainstorm before building** | One question at a time; make the AI argue *against* scope creep; the prize is the "out of scope" list. |
| **Separate WHAT from HOW** | Durable product/architecture docs vs. a sequenced plan. |
| **Classify unknowns** | NOW / COMPLEX / DISCUSS — surface every fork as an explicit decision instead of a silent guess. |
| **Human owns decisions** | AI enumerates options + trade-offs; I pick. |
| **Scope as a DAG** | `feature_list.json` with dependencies + one-in-progress rule. |
| **Rules live in the repo** | `AGENTS.md`/`CLAUDE.md` so the contract isn't re-typed each prompt. |
| **Evidence, not promises** | A feature is "done" only with real verify output pasted in. |
| **Guardrails as code** | Permission deny-lists + tested hooks; the AI can't run the worst commands. |
| **Delegate research to subagents** | Spin up read-only agents to map reference material and report back, keeping the main thread focused. |
| **Honest handoff** | Every session ends init.sh-green (or the gap is stated), with a runnable reboot recipe. |

---

## 4. Three concrete moments where the harness earned its keep

1. **The guardrail that silently failed open.** My first version of the blocking hook followed the
   reference literally and returned "allow" (exit 0) for `rm -rf /`. Because I *tested it with raw
   exit codes* instead of trusting it, I caught that on Windows the on-PATH `python3` is a fake
   stub that emits nothing — so the JSON parser returned an empty command and the guard waved
   everything through. I rewrote parser selection to **probe-validate** (round-trip a sentinel
   before trusting a parser) and re-tested until every case was correct. *The feedback loop, not my
   intuition, caught the bug.*

2. **Refusing to claim "done" from reasoning.** The harness rule that `evidence` = real command
   output stopped me from marking the guardrail subsystem complete until I had pasted actual exit
   codes. The first run *looked* plausible and was wrong.

3. **Catching a lie in the handoff.** When rewriting `session-handoff.md`, I `ls`-verified each
   claimed file and found one (`docker-compose.yml`) listed as "done" but absent on disk. The
   "handoff must match reality" rule turned a documentation drift into a caught error.

---

## 5. Artifact map (point to this in the report)

| File | Role |
|------|------|
| `AGENTS.md` | System of record — rules, tech stack, verify commands, hard constraints. |
| `CLAUDE.md` | Claude-Code-specific stub pointing to `AGENTS.md`. |
| `docs/PRODUCT.md` | 1-page product brief (what & why). |
| `docs/ARCHITECTURE.md` | Design spec — data model, API contract, edge cases. |
| `docs/plan.md` | Implementation plan (build order / how). |
| `docs/user-stories.md` | Given/When/Then stories + NOW/COMPLEX/DISCUSS table. |
| `docs/complex-cases.md` | Edge-case decisions. |
| `docs/questions.md` | The six DISCUSS questions and their resolutions. |
| `.claude/feature_list.json` | The 8-feature scope DAG with acceptance + evidence. |
| `.claude/settings.json` | Permission allow/ask/deny + hook registration. |
| `.claude/hooks/block-dangerous.sh` | PreToolUse blocker (exit 2 = block). |
| `.claude/hooks/scan-secrets.sh` | PostToolUse secret warner (warn-only). |
| `progress.md` | Running session log (Done/In-progress/Next/Blockers/Evidence). |
| `session-handoff.md` | Deliberate cross-session handoff (reboot recipe + status + checklist). |
| `present.md` | This file — the AI/harness workflow story. |

---

## 6. Suggested slide outline (≈8 slides)

1. **Title** — Announcement Bar app + "Built with an AI harness".
2. **The app** — many saved bars, one active at a time, fixed-date countdown, auto-hide on expiry.
   (Live demo here.)
3. **My thesis** — AI is a fast, literal junior engineer; put a harness around it.
4. **The 5-subsystem harness** — Guidance / Tools / Environment / State / Feedback (the table in §1).
5. **From idea to plan** — brainstorm → PRODUCT/ARCHITECTURE/plan → user stories → DAG.
6. **Decisions I owned** — anti-IDOR via JWT `dest`, server-vs-client expiry, timezone→UTC.
7. **Guardrails as code** — deny-lists + tested hooks; show the exit-code evidence and the
   "silently-failed-open" bug I caught by testing.
8. **What I learned** — evidence over promises; honest handoffs; the human stays the decision-maker.

---

## 7. Where it stands now + honest limitations

**Status: all 8 features done.** `bash init.sh` finishes **GREEN (9/9)**; the app **installs live via
OAuth** on `sonnh-dev-store-3`; admin CRUD, the public endpoint, and the storefront bar all work on
the dev store; backend `go test ./...` passes (incl. shop-isolation, anti-IDOR, one-active), and the
frontend/storefront vitest suites are green. The live-preview (feat-008) was built and verified, not
cut.

Honest limitations (stated, not hidden):
- **One-active is an app-layer invariant, not a DB constraint.** MySQL has no filtered-unique index
  for "one enabled per shop", so it's enforced inside a transaction; a rare concurrent double-enable
  race is theoretically possible. A test asserts the invariant.
- **No pagination/search on the bars list** — deliberate YAGNI for a small, merchant-managed set;
  deferred behind a documented decision rather than built speculatively.
- **Stateless by design** — the app never calls the Admin API and discards the OAuth token, so it
  can't read theme state (e.g. whether the app-embed is actually toggled on); the merchant is
  guided to the theme editor instead.
- **Demo runs on a dev store via an ngrok tunnel**, not a production deployment; frontend component
  tests mock App Bridge + the network, with the live walkthrough covering the real browser path.

**What I'd do next:** pagination + search on the list, an automated end-to-end (real-browser) test,
an "enable the app embed" guidance banner, and a production deployment.

- **The story is the deliverable too.** Beyond the code, the *workflow* — disciplined brainstorming,
  explicit decisions, scope-as-a-DAG, tested guardrails, evidence-before-done, honest handoffs — is
  what the capstone is grading. This document is the evidence of that workflow.
