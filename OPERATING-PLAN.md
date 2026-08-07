# Layrrrd Operating Plan

**Period:** August 2026 → August 2027
**Team:** 4 designers (one doubling as marketing), no engineers — code is written by AI tools (Claude Code) operated by the team.
**Status:** Living document. Review the first Monday of every month; strike things out rather than deleting them so decisions stay visible.

> Written in plain language on purpose — everyone on the team should be able
> to read all of it. Technical terms are explained where they appear.

---

## 1. Where we are today

**Product.** A working app: save links from the web or a Chrome extension, AI summarizes them, a weekly digest brings them back via email or Telegram, and Rudolf (our AI reindeer) chats on Telegram/WhatsApp. Sign-up is open. Payments work (Razorpay, India only).

**Money.** Our only paid product is the one-time Founding Membership (100 spots, ₹799/₹1,199) plus Biscuit top-ups (₹50). The first 20 spots (the ₹799 tier) have sold — real validation — but sales stalled there once the warm circle was exhausted, and maximum possible lifetime revenue is about ₹1.1 lakh anyway. **There is no recurring revenue yet.** Meanwhile the AI bill recurs every month. Fixing this is the point of Phase 2; closing founding well is task 1.6.

**The market moment.** Pocket — the biggest "save it for later" app in the world — shut down in July 2025 and orphaned ~30 million users. Its paid competitors charge $40–120/year. None of them *bring content back to you*; they're all libraries you must remember to open. That push-based loop plus Rudolf is our wedge: **"The read-it-later app that reads it to you later."**

**The 3-bet strategy** (each bet funds the next; we don't skip ahead):

1. **Utility** — best AI revisit tool → first real subscription revenue.
2. **Habit** — streaks + daily Rudolf → people use it every day, like Duolingo.
3. **Network** — "see what people like you are saving" → the only path to a truly huge company. Only credible after bets 1–2 show real retention numbers.

---

## 2. The goal ladder (what "winning" looks like at each step)

| Checkpoint | Target | Target date |
| --- | --- | --- |
| Safety net | Backups on, test login gone, error alerts live, AI spend capped | End of week 2 |
| Founding closed | Founding membership closed as a bounded launch event — sold out or deadline reached, whichever first | Month 3 |
| Habit proof | Weekly Revisit Rate ≥ 40%; 25% of weekly actives hold a 7-day streak | Month 6 |
| Recurring revenue | Pro annual plan live in India + Europe + US | Month 6 |
| First real ARR | 1,000 paying subscribers (~₹30–35 lakh/yr blended) | Month 12 |
| Fundable metrics | D30 retention > 20%, DAU/MAU > 25% | Month 12 |

**The north-star metric — Weekly Revisit Rate:** of the people who saved at least one thing this week, what % came back and actually read/finished something? This is the product's whole promise as one number. Everything we ship should move it.

---

## 3. Team: hats, not job titles

Formal titles (CEO, head of marketing, and so on) are **deliberately not decided yet** — deciding them is a team conversation for later. What can't wait is *coverage*: the work below has to happen from week 1 regardless of what anyone is called. So this plan speaks in **responsibility areas**, not titles.

Our suggestion: these four areas each need exactly one owner. Rename them, merge them, or reshuffle when you assign them — but one person can hold two areas, and every area needs exactly one name next to it (shared ownership means no ownership). Whoever owns an area makes sure it happens and reports on it Monday.

| Responsibility area (suggested) | Owner | Covers |
| --- | --- | --- |
| **Business** | *TBD* | Money numbers, payments & legal, pricing, advisor relationships, final calls on irreversible decisions, operating the AI developer for critical changes |
| **Growth** | *TBD* | Distribution: content, Product Hunt, communities, build-in-public, the Pocket-refugee campaign; owns sign-up numbers |
| **Experience** | *TBD* | Dashboard, onboarding, streaks UX, mobile save flow — everything a user touches in-app; runs the weekly QA pass |
| **Brand & Rudolf** | *TBD* | Rudolf's personality, voice and visuals; share cards; delight details; the marketing site; the design system |
| **Everyone, on rota** | All 4 | User interviews (see cadence below) and pre-release QA checklist |

When titles do get decided, they'll likely map onto these areas — the Business owner is who a "CEO" title would naturally go to — but nothing in this plan depends on that decision being made.

Each area has its own roadmap, weekly checklist, and decision authority in
**[PILLARS.md](PILLARS.md)** — plus the fifth rotating duty (Care) and the
absence protocol that keeps the plan running when any one person is away.

### How we ship code without engineers

The AI (Claude Code) is our engineering team; the humans are its editors. Three safety rules, never skipped:

1. **Nothing goes straight to users.** Every change gets a preview link (Vercel makes these automatically). The Experience owner clicks through the preview *before* it merges: log in, save a link, check it summarizes, check the digest.
2. **One change at a time.** Ask the AI for one focused thing per request ("add the streak counter to the dashboard"), not five. Small changes are reviewable; big ones aren't.
3. **The money paths are sacred.** Any change touching payments, login, or account deletion gets a second person on the preview and runs the manual test script in `TESTING.md` before merge.

**The single-operator risk (our current reality).** Today exactly one person
has Claude Code access and does all the building and publishing. That means
one sick week stops every feature, every fix, and every rollback — a worse
single point of failure than anything in the risk register. Task 0.11 breaks
it. The target state: the *ability to ship* is a skill at least two people
have, and the *ability to roll back production* is a skill all four have
(it's clicks in Vercel, not code). Building with the AI is genuinely
learnable by any of us — it's describing one change at a time in plain
language and checking a preview, which is closer to design review than to
programming.

Budget one "technical advisor" favor: find a friendly engineer who'll spend 1 hour/month sanity-checking the repo. Pay them in dinner or equity points.

The full, strict rulebook for building and releasing — environments, testing
layers, release checklist, rollback, incidents — is
**[DEVELOPMENT-PLAYBOOK.md](DEVELOPMENT-PLAYBOOK.md)**. Its setup list (§10)
runs alongside Phase 0 below and is just as mandatory.

---

## 4. Weekly operating rhythm

| When | What | Who |
| --- | --- | --- |
| **Monday, 45 min** | Metrics + plan: Weekly Revisit Rate, sign-ups, revenue, AI bill. Each area owner states their one priority for the week. One priority, not three. | All |
| **Tue–Thu** | Heads-down. Ship small, use previews. | All |
| **Every week** | **3 user conversations minimum** (rota: everyone does at least 3/month). Ask churned users "what made you stop?" Post one insight each in the team chat. | Rota |
| **Friday, 30 min** | Ship review: demo what went live, run the QA checklist on production, screenshot wins for build-in-public content. | All |
| **First Monday monthly** | Review this document. Budget check. Kill or pause one thing that isn't working. | All |

**Decision rules** (to avoid four-designer debate spirals):
- The area owner decides for their area. When you assign areas, also agree on one tie-breaker for cross-area disagreements — the Business owner is the natural choice.
- Anything reversible: just try it. Anything irreversible (pricing, deleting data, legal): sleep on it one night, then the Business owner decides.
- Default answer to new feature ideas during Phases 0–2 is **"after the habit loop ships."** Focus is the whole game.

---

## 5. Phase 0 — Lock the doors (Weeks 1–2)

Safety and legal items. Small, boring, non-negotiable. Nothing else ships until the first four are done.

| # | Task | Owner | How | Done when |
| --- | --- | --- | --- | --- |
| 0.1 | **Turn on database backups** | Business | Enable Firestore daily backups in Google Cloud console (a setting + small fee). AI can provide click-by-click steps. | A backup exists and we've verified we can see it |
| 0.2 | **Make the wipe-script safe** | Business (via AI) | `scripts/reset-data.mjs` deletes ALL data; add a guard so it refuses to run against production. | Running it against prod fails loudly |
| 0.3 | **Remove the test login** | Business (via AI) | A hardcoded email + password "test" bypass lives in the sign-in code. Delete it. | No way to sign in without a real account |
| 0.4 | **Cap the AI bill** | Business (via AI) | Per-user daily rate limits on every AI-calling endpoint (saves, web summaries, Rudolf) + a billing alert on the Anthropic account. | A script hammering the API gets blocked; alert email confirmed |
| 0.5 | **Rudolf discloses he's an AI** | Brand (via AI) | EU law (AI Act, in force since 2 Aug 2026) requires chat AIs to say so up front, in the chat itself. Make it on-brand: "Hi, I'm Rudolf — your AI reindeer 🦌". Label summaries "AI-generated". | First message from Rudolf to any new chat says it |
| 0.6 | **Error alerts** | Experience (via AI) | Add Sentry (free tier) so crashes email us; add an uptime check on the site and the daily digest job. | We get an email when something breaks, before users tell us |
| 0.7 | **Measurement dashboard** | Business + Growth | PostHog dashboards: Weekly Revisit Rate, digest opens, D7/D30 retention, funnel from sign-up → first save → first revisit. Track digest email opens. | Monday meeting runs off this dashboard |
| 0.8 | **Start the Paddle application** | Business | Paddle (merchant of record) will handle all European sales tax for us. Approval takes weeks — apply now so Phase 2 isn't blocked. | Application submitted |
| 0.9 | **Buy the Sardin font license** (or swap the font) | Brand | Our logo font is a personal-use demo license and we charge money. Buy the commercial license or pick a licensed face. | License PDF saved in the drive |
| 0.10 | **Email deliverability check** | Growth (via AI) | Verify SPF/DKIM records on the sending domain (Resend has a checklist). If digests hit spam, our core loop silently dies. | Digest lands in inbox on Gmail/Outlook test accounts |
| 0.11 | **Break the single-operator bottleneck** | Business | One person currently holds the only Claude Code access and does all building/publishing. (a) All four get GitHub accounts on the repo — reviewing a preview link needs no code. (b) A second person gets their own Claude Code access (a cheap subscription; treat it as core infrastructure, like hosting). (c) The current operator writes a one-page "operating the AI developer" runbook: start a session, ask for one change, read the summary, click the preview, merge. (d) An emergency card pinned in team chat: how to roll back production in Vercel — clicks, no code, all four can do it. | A second person has shipped one small change end-to-end without help; all four have done a practice rollback |

---

## 6. Phase 1 — The daily habit (Weeks 3–12)

Goal: someone who saves things gets a reason to come back **every day**. The playbook is Duolingo's, adapted: their streaks took retention from ~12% to ~55%.

| # | Task | Owner | Detail | Done when |
| --- | --- | --- | --- | --- |
| 1.1 | **Reading streak** | Experience | Streak = consecutive days with ≥1 item *finished* (reward closing the loop, never just opening the app). Show it on dashboard, extension popup, and in Rudolf's replies. Design the states: growing, at-risk-tonight, broken, restored. | Streak visible on all three surfaces; PostHog tracks streak length |
| 1.2 | **Rudolf's daily catch-up** | Brand | Opt-in daily message on Telegram/WhatsApp: "You saved 3 things yesterday — this one's a 4-min read." Rudolf's tone does the retention work: warm, funny, never naggy. Write the message matrix (has backlog / cleared / streak at risk / milestone). | Daily message ships; opt-out is one tap; opens tracked |
| 1.3 | **Save from the phone** | Experience | People scroll on phones; our extension is desktop-only. Add PWA share-target support so "Share → Layrrrd" works from any phone app. This is existential, not nice-to-have. | A link shared from a phone appears in the library, summarized |
| 1.4 | **Weekly Wrapped card** | Brand | End-of-week shareable image: "You read 47 minutes this week. Top topic: Design Systems." Beautiful enough that people post it unprompted — our free billboard. | Card auto-generates in digest + dashboard; share tracked |
| 1.5 | **Pocket import tool** | Experience | Upload a Pocket CSV export → items flow through the normal save pipeline. The 30M-refugee door-opener. | A real Pocket export file imports cleanly |
| 1.6 | **Close founding well (deadline-or-sellout)** | Growth | 20/100 sold; the stall is a distribution gap, not a demand ceiling — don't surrender the remaining 80 preemptively. (a) Hide the public counter now — a stalled counter is anti-marketing; keep the page reachable and sell quietly. (b) Announce a closing date: the week after the Phase 1 launch, or sellout, whichever first. (c) Bring the counter back for launch week only, when there's real traffic for scarcity to work on. (d) Close honestly at whatever the number is ("Founding is closed — N founding members"); closing early makes existing members' deal *more* exclusive, and the cap is never raised. (e) Meanwhile, work the 20 we have: personal message to each, a visible founding badge in-app, first pick for interviews and betas. | Counter hidden this week; closing date announced with the launch; founding closed after launch week; all 20 members personally contacted |
| 1.7 | **Distribution engine running** | Growth | Pick two channels and go deep: (a) the Pocket-refugee story on Reddit/HN/design Twitter, (b) build-in-public from one team member's personal account with Rudolf as the recurring character. Prep the Product Hunt launch for when the daily loop is live (launch with streaks + phone save + Pocket import together — that's a story). | 2 posts/week shipping; PH launch executed by week 12 |
| 1.8 | **QA + interview rota live** | All | The weekly rhythm from §4 actually happening. | 4 consecutive weeks of Monday metrics + ≥3 interviews/week |

**What we deliberately do NOT do in Phase 1:** new content types, mobile native apps, more chat platforms, redesigns. Ideas go in a parking-lot doc, reviewed monthly.

---

## 7. Phase 2 — Charge the world (Months 3–6)

Goal: recurring revenue, in three currencies, legally clean in Europe.

| # | Task | Owner | Detail | Done when |
| --- | --- | --- | --- | --- |
| 2.1 | **Layrrrd Pro (annual)** | Business | One plan, regional prices: **₹999/yr India, €39/yr Europe, $39/yr US.** Pro = unlimited Rudolf + everything. 30-day full-Pro free trial (trials convert 30–45%; permanent free tiers convert single digits). | A user in each region can subscribe and gets Pro features |
| 2.2 | **Paddle checkout for non-India** | Business (via AI) | Paddle becomes the seller of record outside India — they handle EU VAT across 27 countries, invoicing, currency. Razorpay stays for India/UPI. Pricing config gains a region dimension. | Test purchases in EUR and USD settle; VAT handled by Paddle |
| 2.3 | **Trim the free plan** | Business | Free Rudolf chat drops 120 → 30 min/day (unlimited saves, summaries, digests stay free — that's the promise on the site). Grandfather existing users for 30 days with a friendly Rudolf message. | New limits live; no support fire |
| 2.4 | **GDPR pack** | Business + Experience | (a) "Download my data" button (we already have real account deletion — the hard part is done); (b) cookie-consent banner; (c) move analytics to PostHog EU hosting; (d) sign the standard data agreements (DPAs) with Google, Anthropic, Resend, Vercel, PostHog; (e) privacy policy rewritten in plain language. | All five checked; policy links live in footer |
| 2.5 | **EU soft launch** | Growth | English-first: UK, Netherlands, Nordics (high English fluency, top-of-world willingness to pay). Privacy is a *selling point* in Europe — "no ads, your data is yours, delete everything in one click" goes on the site. No translations yet. | EU sign-ups and first EUR subscriptions flowing |
| 2.6 | **Company & money hygiene** | Business | Private Limited registered, business bank account, CA engaged for GST + export income, trademark filed for "Layrrrd" (check EU marks before launch), refund policy on the site matches actual practice. Full step-by-step, including the equity/vesting conversation that comes first, in **[COMPANY-SETUP.md](COMPANY-SETUP.md)**. | All filed; monthly books exist |
| 2.7 | **Unit economics check** | Business | Monthly: AI cost per active user vs. revenue per user. If cost/user creeps toward revenue/user, fix before growing. | Number reviewed in first-Monday meeting, every month |

---

## 8. Phase 3 — The social layer (Months 6–12)

Only starts if Phase 1's habit numbers are real (Weekly Revisit ≥ 40%). Retention first, network second.

| # | Task | Owner | Detail |
| --- | --- | --- | --- |
| 3.1 | **Community recommendations, for real** | Experience | "14 designers with your interests saved this" — the data model exists in the code but returns empty today. Ship it or remove the promise from the marketing site. |
| 3.2 | **Friend streaks** | Experience + Brand | Duolingo data: one friend streak → +22% daily completion. Invite a friend, keep a shared streak. Doubles as our viral loop. |
| 3.3 | **Profiles & collections (v1 of the network)** | All | Public reading lists you can follow. The seed of "follow people's taste, not algorithms" — the genuinely huge version of this company. |
| 3.4 | **Scaling fixes** | Business (via AI) | Precompute digests/recommendations (today's jobs scan the whole database daily — first scaling wall); replace Google Custom Search before its 2027 shutdown (Brave/Exa API); durable job queue for AI processing. |
| 3.5 | **Mobile decision** | Business | If phone-save (1.3) usage is strong, evaluate a real mobile app — knowing Apple/Google take 15–30% of store-sold subscriptions. Decide with data, not envy. |

---

## 9. The dashboard (what Monday runs on)

| Metric | What it tells us | Health |
| --- | --- | --- |
| **Weekly Revisit Rate** | Does the product keep its promise? | ≥ 40% |
| D7 / D30 retention | Do people stick? | D30 ≥ 20% by month 12 |
| DAU/MAU | Is it a daily habit? (Duolingo ≈ 37%) | ≥ 25% by month 12 |
| 7-day-streak share | Is the streak working? | ≥ 25% of weekly actives |
| Digest open rate | Is the push loop alive (and out of spam)? | ≥ 40% opens |
| Sign-ups / week + source | Is distribution working, and which channel? | Growing; 2 channels identified |
| Paying subscribers + MRR | The business | 1,000 by month 12 |
| AI cost per active user | The leak detector | Well under revenue/user |

---

## 10. Rough monthly budget (steady state, pre-revenue)

| Item | Est. cost | Notes |
| --- | --- | --- |
| Vercel Pro (hosting) | ~$20 | Needed for commercial use |
| AI (Anthropic) | $30–300, usage-based | The variable to watch; capped by 0.4 |
| Firestore + backups | ~$5–25 | Grows with users |
| Resend (email) | $0–20 | Free to 3k emails/mo |
| Sentry, PostHog, Telegram | $0 | Free tiers |
| Claude Code, 2nd seat | ~$20–50 | Bus-factor insurance on our entire engineering capability (task 0.11) |
| WhatsApp (Meta) | Variable | Least predictable; fine to pause if costly |
| Paddle | % of non-India sales | No fixed fee |
| One-offs | Font license, trademark filing, company registration, CA | Budget ~₹1–1.5 lakh total across the quarter |

---

## 11. Risk register (top 6, reviewed monthly)

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Data loss (no backups today) | High until 0.1 done | Phase 0.1 + 0.2, this week |
| AI bill spike | Medium | Rate limits + billing alerts (0.4), monthly unit-economics check (2.7) |
| Digests silently hit spam | Medium | 0.10 + open-rate on the dashboard |
| EU compliance miss (AI Act is already in force) | Medium | 0.5 now; GDPR pack (2.4) before EU push |
| Team spread across too many surfaces | High | §4 decision rules; monthly "kill or pause one thing" |
| AI-written code breaks something no one notices | Medium | Preview-first rule, QA rota, money-path double-check, monthly engineer-friend review |

---

## 12. Principles (when in doubt)

1. **Reward finishing, not opening.** We cure doomscrolling; we don't cause it.
2. **Rudolf is a product, not a decoration.** Duolingo's owl is a billion-dollar asset; treat ours with the same seriousness.
3. **Distribution is half the job.** If a week had five features and zero marketing, the week failed.
4. **Talk to users every week.** Analytics say what; humans say why.
5. **One change at a time, preview before production, money paths get four eyes.**
6. **Say "after the habit loop ships"** to almost everything new.
7. **Privacy is a feature we sell,** especially in Europe — and we actually mean it (real deletion already ships).
