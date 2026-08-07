# Layrrrd Company Setup — one-time steps & recurring duties

**Where we are:** a live MVP taking real money, with nothing officially set
up. That's normal for an MVP — most likely payments are currently flowing
through an individual's Razorpay KYC (a de-facto sole proprietorship, which
is legal at this size). This file is the path from "side project that
charges money" to "real company," in order, with what repeats forever.

> Plain-language guide written by the team's AI, not a lawyer or CA. The
> first action below is hiring a CA precisely so every item here gets
> confirmed by a professional who knows your state and situation. Costs are
> rough 2026 ballparks.

Owner for everything in this file: the **Business** area (see
[PILLARS.md](PILLARS.md)). Linked from operating-plan task 2.6.

---

## Part 1 — One-time setup, in order

### Step 0 · The equity conversation (before ANY paperwork) — ₹0, one evening

Before incorporating you must decide, in writing, among the four of you:

- **Who owns what percentage.** Equal is simple but rarely right — weigh who
  started it, who's full-time, who took risk earliest. Decide now, while
  everyone is friends; this conversation only gets harder.
- **Vesting: non-negotiable.** Everyone's equity vests over 4 years with a
  1-year cliff (leave in month 6 → keep nothing; leave after year 1 → keep a
  quarter, and so on). Vesting is not distrust — it protects the three who
  stay from the one who leaves owning a dead quarter of the company. Every
  serious startup does this; every investor requires it.
- **What happens if someone leaves, stops working, or you disagree 2–2.**
- Note: this is separate from the roles/titles decision — equity is about
  ownership, not job titles, and it cannot wait the way titles can.

Write it as a **founders' agreement** (a CA/lawyer will formalize it during
incorporation; templates exist — the writing-it-down matters more than the
legalese). Include **IP assignment**: all four of you assign everything
built for Layrrrd — past and future — to the company. Without this, the
code legally belongs to whoever typed the prompts.

### Step 1 · Hire a CA — ~₹2,000–5,000/month retainer

One session with a chartered accountant who knows software/export startups.
They will run steps 2, 4, 5 and all of Part 2 for you. Ask founder friends
for a referral; a good CA is the single highest-leverage hire a
non-financial team can make. Everything below assumes the CA is driving.

### Step 2 · Incorporate a Private Limited company — ~₹10,000–25,000 all-in, 2–3 weeks

Private Limited (not LLP, not proprietorship) because you want investors
someday, limited liability today, and a clean structure for four
shareholders. The CA handles the mechanics on the MCA portal (digital
signatures for directors, name reservation — check "Layrrrd" and a backup —
then the SPICe+ incorporation form; PAN and TAN arrive automatically).
Your part: choose directors (2 minimum — all 4 can be shareholders without
all being directors), registered office address (a home address works), and
the equity split from Step 0.

### Step 3 · Company bank account — ₹0, days

A current account in the company's name (any major bank; pick one with a
decent app). From day one: **every rupee of Layrrrd money goes through this
account and only this account.** No company expenses from personal UPI —
mixing funds is the classic first-company mess and makes the audit painful.

### Step 4 · GST registration + LUT — ~₹2,000–5,000 via CA

Register for GST now rather than waiting for the ₹20 lakh threshold:
digital-service businesses hit compliance questions early, Razorpay
settlement under the company needs it, and EU sales count as exports —
filing a **LUT (Letter of Undertaking)** each year lets you export services
zero-rated instead of charging GST to foreign customers. Yes, this creates
monthly filings (Part 2) — that's what the CA is for.

### Step 5 · Move the money rails to the company

- **Razorpay:** re-KYC the account under the Private Limited (company PAN,
  bank account, GST) so payments legally flow to the company, not a person.
- **Paddle** (the Europe merchant-of-record from the operating plan): apply
  as the company — this is why incorporation comes before the EU launch.
- **Website legal pages:** Terms, Privacy, and Refund pages updated to name
  the legal entity, registered address, and support contact. Refund policy
  must match what you actually do — card networks decide disputes on this.

### Step 6 · Own the assets as a company

- **Domain, Google Workspace, Firebase, Vercel, GitHub org, social handles**
  — owned by (or transferred to) company-controlled accounts, paid from the
  company account, with the Business owner + one named backup holding admin
  access (per the playbook). No critical account should belong to a
  personal email.
- **Font license** (operating-plan 0.9) purchased in the company's name.

### Step 7 · Trademark "Layrrrd" — ~₹10,000–15,000 with a professional, per class

File in India first (word mark; consider Rudolf's name/character later).
Before the EU launch, search EU marks for conflicts and extend protection
(via the international Madrid system or a direct EU filing) — cheaper than
rebranding after German users know you.

### Step 8 · DPIIT "Startup India" recognition — ₹0, online

Free government recognition for startups: self-certification for several
compliances, easier access to benefits, and potential income-tax exemption
(the CA will say if it's worth applying for). Half a day of paperwork,
genuinely worth it.

### Step 9 · Later, not now (so you know what's deliberately skipped)

- **Salaries/payroll** — only when the company can actually pay them; that
  activates TDS and payroll compliance (CA handles when the day comes).
- **State registrations** (Shops & Establishments, Professional Tax) —
  state-dependent; ask the CA which apply to you.
- **Insurance** (cyber liability, D&O) — revisit at real revenue.
- **ESOP pool** — when you hire employee #1, not before.

---

## Part 2 — The recurring calendar (what "being a company" costs in time, forever)

The CA does nearly all of this; your job is to send them clean records
monthly and never miss the dates they give you.

| Rhythm | Duty | Who does the work |
| --- | --- | --- |
| **Monthly** | GST returns (sales + summary) | CA, from your invoices |
| **Monthly** | Bookkeeping: reconcile the bank account, Razorpay/Paddle settlements, and expenses | Business owner sends records → CA books them |
| **Monthly** | The unit-economics check (operating-plan 2.7) | Business owner |
| **Quarterly** | Advance income tax, if profitable | CA |
| **Quarterly** | TDS returns, once any salaries/contractor payments start | CA |
| **Quarterly** | Board meeting — for a 4-person company this is your first-Monday review with 15 extra minutes and written minutes; Pvt Ltds must hold at least 4 a year | All |
| **Yearly** | Statutory audit — mandatory for every Pvt Ltd regardless of size | Auditor (CA arranges) |
| **Yearly** | Annual filings to the corporate registry (financials + annual return) and the AGM | CA / company secretary |
| **Yearly** | Company income-tax return | CA |
| **Yearly** | Director KYC filing (each director) | CA |
| **Yearly** | Renew the GST export LUT | CA |
| **Yearly** | Review the founders' agreement & cap table — still true? | All 4 |
| **Every 10 years** | Trademark renewal | Set a calendar reminder now |

**Realistic ongoing cost of being official:** roughly ₹40,000–80,000/year
(CA retainer + audit + filings) plus a few hours a month of the Business
owner's time. That's the price of Razorpay under the right name, Paddle
being possible at all, investors being able to say yes, and nobody's
personal savings being on the line if something goes wrong.

---

## Part 3 — The people & stakes rulebook

Every messy startup breakup traces back to a small decision that was never
made while everyone was still friends. Make these decisions **now**, write
them into the founders' agreement, and they become boring paperwork instead
of a fight. The rule of thumb for all of them: *decide the rule before you
know who it will apply to.*

### If someone leaves

- **Unvested equity returns to the company automatically.** That's what
  vesting (Part 1, Step 0) is for — no negotiation needed at the worst
  possible moment.
- **Vested equity: the company gets right of first refusal.** A leaver can
  keep what they earned, but if they ever sell, the company/remaining
  founders get first chance to buy at a fair price. No strangers on the
  cap table by surprise.
- **Good leaver vs. bad leaver.** Leaving for life reasons (health, family,
  a job they need) = good leaver, keeps vested shares. Leaving to build a
  competitor, or being removed for cause = bad leaver, the agreement lets
  the company buy back even vested shares at a pre-agreed formula. Define
  both terms in the agreement — this clause matters exactly once, and on
  that day it's priceless.
- **Everyone signs confidentiality + IP assignment on day one** (in the
  founders' agreement). A polite non-solicit (don't poach the team or
  users) is reasonable; know that broad non-competes are hard to enforce
  in India — the IP assignment is your real protection.
- **The practical handover** is already designed: the absence protocol and
  named backups in [PILLARS.md](PILLARS.md) mean a departure loses you
  speed, not access or context.

### If someone joins

- **New people are employees or contractors first, co-founders never by
  default.** Contribution for 3–6 months before any equity conversation.
- **Equity for joiners comes from a pre-agreed pool, not ad-hoc gifts.**
  When incorporating, note the intent: early employees might get 0.25–2%
  each, always with the same 4-year/1-year-cliff vesting as founders. A
  formal ESOP scheme is set up when employee #1 actually arrives — but the
  *policy* is decided now, so nobody promises equity in a chat message.
- **Advisors:** 0.1–0.5% with vesting over 1–2 years, in writing, only for
  people who show up monthly. Never for a single intro or one coffee.
- **Contractors sign IP assignment before their first commit.** Includes
  friends helping "for fun" — especially friends.

### If contribution goes unequal (the most common 4-founder problem)

- Vesting already handles the extreme case (someone drifts away → they
  stop vesting when you formally part ways).
- For the slow version — one person at 10 hours a week while others do 50 —
  agree the mechanism now: it's raised at the monthly review as a normal
  agenda item ("effort check"), not saved up as resentment. Two honest
  options when it persists: rebalance areas, or renegotiate ownership going
  forward (never retroactively).
- **The deadlock rule:** with 4 people, 2–2 happens. The tie-breaker (from
  the operating plan's decision rules) resolves product/ops deadlocks. For
  company-level deadlocks (selling, shutting down, removing a founder),
  write the resolution into the agreement — commonly a named advisor as
  the deciding vote, or a pre-agreed buyout formula.

### Money between people and company (small decisions that prevent big fights)

- **No salaries until a revenue trigger.** Pick the number now (e.g. "when
  MRR covers costs plus ₹X for three straight months, everyone draws the
  same minimal stipend"). Equal stipends first; market salaries only when
  real money exists. Never let one person quietly draw while others don't.
- **Personal money already spent on Layrrrd (domains, fonts, AI bills):
  record it as a founder loan to the company**, repayable when the company
  can afford it — not a silent gift, not extra equity. Keep a simple
  running sheet from today.
- **Expense authority:** anything under ~₹2,000/month for tools = any area
  owner just does it and logs it; above that = Business owner approves;
  above ~₹25,000 = all four. Written in one line, ends a hundred debates.
- **Nobody personally guarantees company debts.** If a vendor or lender
  asks for a personal guarantee, that's an all-four decision.

---

## Part 4 — Money without funding: the bootstrap playbook

We have no funding, and that's the correct state right now — VCs fund
*metrics*, and our job for the next two quarters is to create them (the
operating plan's month-12 targets are exactly an investor checklist). Until
then, in order of preference:

1. **Revenue is the funding.** Founding close-out (task 1.6) + the Pro
   launch (task 2.1) are the plan. A ₹999–₹39–€39 annual plan means every
   100 subscribers ≈ ₹2.5–3 lakh/year of real, non-dilutive money.
2. **Startup credits — free money we qualify for today; apply this month:**
   - **Google for Startups / Firebase credits** — our database and auth
     bill covered for a year or more.
   - **Anthropic startup program** — credits against our single biggest
     variable cost, the AI bill.
   - **Vercel, PostHog, Notion, Sentry startup plans** — most of our stack
     has one; an afternoon of applications can wipe out most of the monthly
     budget in §Part 2 of the operating plan.
3. **Government & ecosystem, after DPIIT recognition (Step 8):** Startup
   India Seed Fund Scheme (grants/soft funding via incubators), state
   startup schemes, and incubators (NSRCEL, T-Hub, and similar) that give
   credits, mentorship, and small grants without taking meaningful equity.
   Pitch competitions are marketing with a cash prize — Growth can treat
   them as a channel.
4. **Each founder knows their own runway.** Everyone privately writes down
   "I can do this at current intensity until <month>" and shares the date
   (not the finances). The company plans around the shortest date honestly
   instead of discovering it in a resignation.
5. **Friends & family money: only as a last resort,** only in writing, only
   as a simple loan or SAFE-style note the CA reviews — never a handshake.
6. **What we don't do:** raise VC before the metrics exist (wasted months,
   bad terms), take revenue-based-financing offers that arrive by cold
   email, or spend on paid ads before organic channels are proven.

---

## Sequencing against the operating plan

- **This month:** Step 0 (equity evening — now including the Part 3
  rulebook) + Step 1 (CA hired) + the credit applications from Part 4.
- **Phase 1 (weeks 3–12):** Steps 2–4 run in the background via the CA
  while the team builds the habit loop — incorporation must be done
  **before** the Pro launch and the Paddle application completes.
- **Phase 2 (months 3–6):** Steps 5–8, matching operating-plan task 2.6.
- **Forever:** Part 2, on the CA's calendar; Part 3, in the founders'
  agreement where it quietly does its job.
