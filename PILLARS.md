# Layrrrd Pillar Roadmaps & Async Operating Rules

Companion to [OPERATING-PLAN.md](OPERATING-PLAN.md) (§3 defines the four
responsibility areas). This file gives each pillar its own roadmap — so any
owner knows what a good week and a good quarter look like **without needing a
meeting** — and defines how the team runs when someone is unavailable.

Two additions beyond the original four pillars, explained at the bottom:
**Care** (a rotating duty, not a person) and the **absence protocol**.

---

## How to read a pillar

Each pillar has: a mission (one sentence — when in doubt, do the thing that
serves it), the numbers it owns, a weekly checklist (the "am I doing my job"
test, no discussion needed), a phase-by-phase roadmap, and what its owner can
decide alone.

The phases match the operating plan: **P0** = weeks 1–2, **P1** = weeks 3–12,
**P2** = months 3–6, **P3** = months 6–12.

---

## Pillar 1 — Business

**Mission:** the company stays solvent, legal, and able to make its next move.

**Owns the numbers:** revenue / MRR, AI cost per active user, monthly burn,
founding-member count.

**Every week, without being asked:**
- [ ] Check the AI bill against the alert threshold; investigate any jump.
- [ ] Check revenue and any payment failures/refund requests.
- [ ] Clear anything legal/financial sitting in the inbox (bank, Razorpay, CA, Paddle).
- [ ] Unblock others: any decision waiting on Business gets an answer this week.

**Roadmap:**
- **P0:** Backups on · wipe-script guard · test login removed · AI rate limits + billing alert · Paddle application submitted · measurement dashboard (with Growth).
- **P1:** Founding closing date set · Pro pricing finalized (₹999 / €39 / $39) · company registration + business bank account started · engineer-advisor found.
- **P2:** Pro live in all three regions · Paddle live · free-plan trim shipped · GDPR pack done · trademark filed · CA engaged · monthly unit-economics review running.
- **P3:** Scaling spend approved where metrics justify it · Google CSE replacement chosen · mobile decision made with data · (if raising) metrics memo ready.

**Decides alone:** vendor choices, spending inside the agreed budget,
legal/compliance sequencing. **Needs the team:** pricing changes, anything
that changes what users were promised.

---

## Pillar 2 — Growth

**Mission:** a repeatable, provable answer to "where do the next 100 users
come from."

**Owns the numbers:** sign-ups per week *by source*, digest open rate,
share-card shares, founding spots claimed.

**Every week, without being asked:**
- [ ] Ship 2 pieces of content (build-in-public post, Pocket-refugee angle, Rudolf moment).
- [ ] Check which source brought last week's sign-ups; do more of what worked.
- [ ] Run or review one growth experiment (a post format, a channel, a landing tweak).
- [ ] Post the week's growth numbers in the Monday memo.

**Roadmap:**
- **P0:** Email deliverability verified (SPF/DKIM, inbox tests) · dashboard funnel live (with Business).
- **P1:** Two channels chosen and worked deep · founding close-out event executed (counter hidden → deadline announced → launch-week countdown → closed honestly) · Product Hunt launch by week 12 · 2-posts-a-week habit locked in.
- **P2:** EU soft launch (UK/NL/Nordics) · privacy-as-a-feature positioning live on the site · first honest read on organic vs. needs-budget.
- **P3:** Referral loop around friend streaks · Wrapped virality measured and tuned · community stories ("founding member #7 reads 3 hours/week") as a content engine.

**Decides alone:** content, channels, campaign timing. **Needs the team:**
anything that promises users a feature or price.

---

## Pillar 3 — Experience

**Mission:** the core loop — save → summary → it comes back → you finish it —
works every time and feels effortless.

**Owns the numbers:** Weekly Revisit Rate (the north star), D7/D30 retention,
sign-up → first save → first revisit funnel, streak adoption.

**Every week, without being asked:**
- [ ] Run the 10-minute smoke checklist on production.
- [ ] Keep a live top-3 friction list from user interviews; kill one item from it.
- [ ] Review anything shipped this week on a phone, not just a laptop.
- [ ] Click through every preview link before it merges (playbook rule).

**Roadmap:**
- **P0:** Sentry + uptime monitoring live · QA checklist formalized and pinned.
- **P1:** Reading streaks on all surfaces · phone save (PWA share target) · Pocket import · onboarding polish for the launch traffic.
- **P2:** "Download my data" button · 30-day Pro trial experience · upgrade flow that sells without dark patterns.
- **P3:** Community recommendations UI · profiles & collections v1 · friend streaks (with Brand).

**Decides alone:** UX details, flow changes, fix priority. **Needs the team:**
removing or gating an existing feature.

---

## Pillar 4 — Brand & Rudolf

**Mission:** Layrrrd feels alive and unmistakable; Rudolf becomes the asset
competitors can't copy.

**Owns the numbers:** daily catch-up opt-in rate and opens, streak-day share
of actives, share-card shares, Rudolf conversation length.

**Every week, without being asked:**
- [ ] Voice-check all new user-facing copy (does it sound like us? like Rudolf where it should?).
- [ ] Ship one delight detail, however small.
- [ ] Screenshot the week's best brand moment for Growth's content pipeline.

**Roadmap:**
- **P0:** Rudolf's AI-disclosure greeting (charming, compliant) · font license resolved.
- **P1:** Daily catch-up message matrix (has backlog / cleared / streak at risk / milestone) · Weekly Wrapped card design · founding-member badge · Rudolf asset kit (poses, stickers, reaction images) for marketing reuse.
- **P2:** Pricing page story · EU privacy-positioning voice · the free-plan-trim announcement written so kindly people screenshot it.
- **P3:** Friend-streak mechanics and celebration moments (with Experience) · visual identity for profiles & collections.

**Decides alone:** voice, visuals, delight details. **Needs the team:**
rebrand-level changes, anything altering what Rudolf promises users.

---

## The fifth pillar: Care — a rotating duty, not a person

This is what the original four miss. Someone must be "on duty" for the
unplanned: support emails, feedback-widget submissions, founding-member
replies, Sentry alerts, watching the release that just went out. Today that
work has no owner, which means it lands on whoever notices — usually the same
person, usually late.

**Care rotates weekly.** Whoever holds Care this week:
- Answers every support/feedback message within 24h (a holding reply counts).
- Is first responder for Sentry/uptime alerts (playbook incident steps).
- Does the 2-hour watch after any release.
- Replies to founding members and logs what they say for the interview pool.
- Hands over open threads at Friday ship review.

Care is deliberately **on top of** your pillar, one week in four. It keeps
every one of us close to real users and real breakage — and it means "who's
watching today?" always has an answer, even during holidays.

**Pillars we considered and do NOT need yet:** Engineering (it's the AI plus
the playbook plus everyone reviewing), Finance (inside Business), People/HR
(too early at 4), Data (the dashboard is shared; Business + Growth read it).
Add a pillar only when its work is visibly falling on the floor.

---

## The absence protocol: how this runs when someone isn't there

The plan must never have a single point of failure — including its most
enthusiastic member. Five rules:

1. **Written-first Mondays.** The Monday meeting starts with a written memo,
   not talk: each pillar owner posts their numbers, one priority, and
   blockers in the team chat *before* the meeting. If someone is absent — or
   the whole meeting is skipped — the memo still happens, and the absent
   person catches up by reading, not by being briefed.
2. **Every pillar has a named backup.** Each of the four people backs up
   exactly one other pillar (agree the pairing when you assign areas). The
   backup reads the pillar's Monday memo every week — so stepping in is
   never starting cold.
3. **The 48-hour rule.** No decision waits more than 48 hours for an absent
   person. Reversible → the backup decides immediately. Irreversible → after
   48 hours, the tie-breaker and the backup decide together and log it.
   Being away means trusting the protocol; it never means work stops.
4. **The decision log.** One shared doc, one line per decision: date, what
   was decided, who decided, why in ten words. Absences, disagreements, and
   "wait, why did we do this?" moments are all solved by the same habit:
   **if it isn't written down, it didn't happen.**
5. **No knowledge lives in one head.** Plans and playbooks in the repo;
   passwords in the shared manager; dashboards linked from the Monday memo
   template; support threads handed over at Friday review. If someone
   vanished for two weeks tomorrow, the other three should lose speed —
   never access, context, or the ability to decide.
