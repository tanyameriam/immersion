# Layrrrd Team Planner — call-ready version

The working plan, restructured into the team's four pillars. This is the doc
to open during the team call: confirm activities, fill in owners, adjust
times. Detailed background lives in OPERATING-PLAN.md, PILLARS.md,
DEVELOPMENT-PLAYBOOK.md and COMPANY-SETUP.md — this file is the aligned
summary everyone works from.

**How to use in the call (45–60 min):**
1. Confirm the pillars and phases (5 min)
2. Walk each phase table: add/remove activities, fill the Owner column (25 min)
3. Go through "Decide today" and write down each answer (15 min)
4. Agree the timeline + book the equity evening (5 min)

---

## The four pillars

| Pillar | What it covers | Watch-numbers |
| --- | --- | --- |
| **User Acquisition** | Marketing, channels, launches, expansion outside India | Sign-ups/week by source |
| **User Stickiness** | KPI funnel, tracking, interviews, habit features, community, WhatsApp/mobile decisions | Came-back-and-read rate, streaks, D7/D30 |
| **Operational** | Company setup, equity, EU sales & tax, bank, legal, governance (Slack, way of working, rules), ownership, recurring payments, AI costs, advisor | Revenue, burn, AI cost/user |
| **Maintenance** | Logging/alerts, dev guardrails, release strategy, backups, dev→test→live environments | Uptime, incidents, test coverage |

Cross-cutting: **Care** — a weekly rotating duty (support inbox, alerts,
release watch, founding-member replies). Not a pillar; a turn everyone takes.

**Note on effort:** the AI writes the code, so "effort" = human time
directing it and checking the result — not coding time. "Ongoing" = a
standing weekly habit.

---

## The four phases

| Phase | Name | Window | Definition (what must be true at the end) |
| --- | --- | --- | --- |
| **P0** | Foundational lockins | Weeks 1–2 | Nothing can kill us: backups exist, no open doors, AI bill capped, alerts on, tracking live, the company path started |
| **P1** | User stickiness + Daily habit | Weeks 3–12 | A user who saves gets a daily reason to return; we launched publicly; founding closed well |
| **P2** | Worldwide | Months 3–6 | Anyone in India, Europe or the US can pay us yearly, legally |
| **P3** | Go social | Months 6–12 | Layrrrd is social: community picks, friend streaks, profiles — and scaling holds |

---

## P0 — Foundational lockins (Weeks 1–2)

| # | Activity | Pillar | Effort | Owner |
| --- | --- | --- | --- | --- |
| 0.1 | Turn on database backups + verify one | Maintenance | 1–2 h | ___ |
| 0.2 | Make the wipe-script refuse to touch live data | Maintenance | 1 h | ___ |
| 0.3 | Remove the secret test login | Maintenance | 1 h | ___ |
| 0.4 | AI cost caps per user + billing alert email | Maintenance | half day | ___ |
| 0.5 | Logging & alerts: Sentry + uptime check (free; Datadog is overkill for us — skip) | Maintenance | half day | ___ |
| 0.6 | Dev environments: Dev → Test → Live (second Firebase project, test payment keys) | Maintenance | 1 day | ___ |
| 0.7 | Dev guardrails: GitHub branch protection + the release checklist adopted | Maintenance | 1 h | ___ |
| 0.8 | Rollback practice: everyone does the one-click undo once | Maintenance | 30 min, all 4 | all |
| 0.9 | Second builder: 2nd Claude Code seat + how-to page + pairing hour scheduled | Maintenance | 2 h setup, then 1 h/wk | ___ |
| 0.10 | Tracking implemented: PostHog dashboard with the user-journey funnel (sign-up → first save → came back → read) | Stickiness | 1 day | ___ |
| 0.11 | Set targets on the dashboard (the goal ladder numbers) | Stickiness | in the call | all |
| 0.12 | Rudolf discloses he's an AI (EU law, already active) — one charming line | Stickiness | 1 h | ___ |
| 0.13 | Email deliverability: digests reach Gmail/Outlook inboxes, not spam | Acquisition | 2 h | ___ |
| 0.14 | Equity talk: percentages + 4-year vesting, written down | Operational | one evening, all 4 | all |
| 0.15 | Communication setup: Slack or Discord + 5 channels | Operational | 1 h | ___ |
| 0.16 | Way of working adopted: Monday updates, weekly call slot, rules of thumb | Operational | this call | all |
| 0.17 | Roles confirmed: 4 pillar owners + a backup each + tie-breaker | Operational | this call | all |
| 0.18 | Paddle application sent (Europe sales tax handler — approval takes weeks) | Operational | 2 h | ___ |
| 0.19 | Startup credits applied: Anthropic, Google/Firebase, Vercel, PostHog, Sentry | Operational | one afternoon | ___ |
| 0.20 | Font license bought (or font swapped) | Operational | 1 h + cost | ___ |
| 0.21 | Recurring payments inventory: domain, subscriptions — list what we pay, when, from where | Operational | 1 h | ___ |

## P1 — User stickiness + Daily habit (Weeks 3–12)

| # | Activity | Pillar | Effort | Owner |
| --- | --- | --- | --- | --- |
| 1.1 | Reading streaks on all surfaces (reward finishing, not opening) | Stickiness | 1–2 wks | ___ |
| 1.2 | Rudolf's daily catch-up message (opt-in, warm, one-tap off) | Stickiness | 1 wk | ___ |
| 1.3 | Save from your phone (Share → Layrrrd) — critical | Stickiness | 1 wk | ___ |
| 1.4 | Pocket import (CSV upload → library restored) | Stickiness | 2–3 days | ___ |
| 1.5 | Weekly Wrapped share card | Stickiness | 1 wk | ___ |
| 1.6 | User interviews: 3/week as a team, one insight each posted | Stickiness | ongoing | rota |
| 1.7 | User community started: founding-members group + badge; decide build-in-public roadmap (public or not) | Stickiness | 2 h + ongoing | ___ |
| 1.8 | WhatsApp integration: review cost + usage at week 6 → keep or pause | Stickiness | 1 h review | ___ |
| 1.9 | Founding close-out: hide counter now → deadline announced → launch-week countdown → closed honestly; all 20 members messaged personally | Acquisition | spread over P1 | ___ |
| 1.10 | Marketing engine: 2 channels deep, 2 posts/week (Pocket-refugee story + build-in-public) | Acquisition | ongoing | ___ |
| 1.11 | Product Hunt launch (with streaks + phone save + Pocket import live) | Acquisition | 1 wk prep, week 12 | ___ |
| 1.12 | Company registration + bank account (CA drives, background) | Operational | CA does it | ___ |
| 1.13 | Trademark "Layrrrd" filed in India | Operational | 2 h + CA | ___ |
| 1.14 | Advisor: find a friendly engineer, 1 h/month repo sanity check | Operational | 2 h to find | ___ |
| 1.15 | Second operator reaches "ships small changes alone" | Maintenance | via pairing hr | ___ |

## P2 — Worldwide (Months 3–6)

| # | Activity | Pillar | Effort | Owner |
| --- | --- | --- | --- | --- |
| 2.1 | Layrrrd Pro: yearly plan, ₹999 / €39 / $39, 30-day full trial | Operational | 1–2 wks | ___ |
| 2.2 | Paddle checkout live for outside-India | Operational | 1 wk | ___ |
| 2.3 | Free plan trim: Rudolf 2 h → 30 min/day, kind 30-day notice | Operational | 2–3 days | ___ |
| 2.4 | GDPR pack: data-download button, cookie consent, EU analytics, privacy contracts, plain-language policy | Operational | 1–2 wks | ___ |
| 2.5 | EU soft launch: UK, Netherlands, Nordics (English first) | Acquisition | ongoing | ___ |
| 2.6 | Privacy-as-a-feature positioning on the site | Acquisition | 2–3 days | ___ |
| 2.7 | Automated tests: money paths first, then login/deletion, then save pipeline | Maintenance | 1–2 wks | ___ |
| 2.8 | Robot user: one automated sign-up→save→summary browser test on every change | Maintenance | 2–3 days | ___ |
| 2.9 | Monthly money check: AI cost per user vs. income per user | Operational | 1 h/month | ___ |

## P3 — Go social (Months 6–12)

| # | Activity | Pillar | Effort | Owner |
| --- | --- | --- | --- | --- |
| 3.1 | Real community picks ("14 designers like you saved this") | Stickiness | 2–3 wks | ___ |
| 3.2 | Friend streaks (+22% daily return, per Duolingo) | Stickiness | 1–2 wks | ___ |
| 3.3 | Profiles & collections: follow people's reading lists | Stickiness | 3–4 wks | ___ |
| 3.4 | Referral loop built on friend streaks | Acquisition | 1 wk | ___ |
| 3.5 | Mobile app decision — with data, knowing the 15–30% store cut (until then the phone-save from 1.3 covers mobile) | Operational | decision | all |
| 3.6 | Scaling fixes: stop whole-database scans; replace the Google search service (dies 2027) | Maintenance | 1–2 wks | ___ |

---

## Timeline (part-time honest — order is fixed, dates may stretch)

| When | Focus | Milestone at the end |
| --- | --- | --- |
| Weeks 1–2 | P0 lockins | Nothing can kill us; tracking live; company path started |
| Weeks 3–6 | Streaks + daily Rudolf + phone save | The daily loop exists |
| Weeks 7–10 | Pocket import + Wrapped + campaign build-up | Launch assets ready |
| Weeks 11–12 | Product Hunt launch + founding close | Public launch done; founding closed |
| Months 3–4 | Pro + Paddle + GDPR | First € and $ payments |
| Months 5–6 | EU soft launch + tests | Worldwide, safely |
| Months 6–9 | Community picks + friend streaks | Social layer v1 |
| Months 9–12 | Profiles + referrals + scaling | Investor-ready numbers |

---

## Decide today (write the answer next to each)

1. **Owners:** who owns each pillar? + one backup each + the tie-breaker → ___
2. **Chat tool:** Slack or Discord? (suggestion: Discord — free history + voice rooms) → ___
3. **Weekly call slot** in the 6:30–10pm IST / 2–5:30pm CET window → ___
4. **Equity evening date** (within 2 weeks) → ___
5. **Founding:** confirm hide-counter-now + close-by-deadline approach → ___
6. **WhatsApp:** keep running or pause until P2? (review at week 6 either way) → ___
7. **Build in public:** yes/no, and who posts from their account → ___
8. **Targets confirmed:** the goal-ladder numbers on the dashboard → ___
9. **Spend approved:** 2nd Claude Code seat (~$20–50/mo), font license, CA retainer → ___
10. **Free-plan trim:** agree in principle now, announce in P2 → ___

## Answers to the open questions from the brainstorm

- **Mobile app or not?** Not now. Phone-save (1.3) covers the mobile need
  without Apple/Google's 15–30% cut. Real decision at 3.5, with usage data.
- **WhatsApp integration?** It works today but it's our least predictable
  cost. Keep until week 6, then decide with the cost data (1.8).
- **AI cost for development?** Claude Code seats ~$20–50/month each (we need
  2), separate from the app's AI bill ($30–300/mo, capped by 0.4). The
  Anthropic startup credits application (0.19) can cover much of the app
  bill.
- **Sentry or Datadog?** Sentry free tier + a simple uptime check. Datadog
  is enterprise-grade and priced like it — overkill for us (0.5).
- **Advisor monthly check?** Yes — one friendly engineer, one hour a month,
  paid in dinner or tiny equity (1.14).
- **Build in Public roadmap?** Recommended yes — it's our cheapest channel
  and Rudolf gives it a recurring character — but it's a call decision (#7).
