# Rudolf WhatsApp Integration Brief

## Status

Both phases are implemented in code:

- **Phase 1 (chat):** `lib/whatsapp/` (send, chat, linking),
  `app/api/whatsapp/webhook` + `app/api/whatsapp/link`, the shared Rudolf
  brain in `lib/rudolf/chat.ts`. Users connect from the dashboard's
  "Where should Rudolf reach you?" card or Profile → Newsletter Delivery.
- **Phase 2 (weekly digest on WhatsApp):** WhatsApp is a third digest
  channel next to email and Telegram. The cron asks first, exactly like
  Telegram, and only sends the digest after a yes. The ask is a free normal
  message when the user messaged Rudolf in the last 23h, otherwise the
  approved `WHATSAPP_DIGEST_TEMPLATE` (paid), capped per month by
  `WHATSAPP_TEMPLATE_MONTHLY_CAP` with email as the fallback. See
  `lib/whatsapp/digest.ts`. Replying STOP switches the digest back to email.
  Proactive nudges are not built: Rudolf no longer sends those on any
  channel.

What remains is the Meta side - follow the walkthrough below, test first.

## Summary

WhatsApp can be added as another Rudolf channel next to Telegram. The best first version is WhatsApp for user-initiated chat: users message Rudolf, send links, ask for recommendations, and Rudolf replies in the same conversational style as Telegram.

The main difference is cost and messaging rules. Telegram bot messages are free and flexible. WhatsApp Business Platform is free for normal support-style replies inside the 24-hour customer-service window, but proactive messages usually require approved templates and are charged per delivered message.

## Cost Overview

| Item | Expected cost |
| --- | ---: |
| Meta Developer account | Free |
| WhatsApp Business Account | Free |
| WhatsApp Cloud API direct integration | Free |
| Template creation and submission | Free |
| User messages Rudolf first, Rudolf replies within 24 hours | Free |
| User sends a link to save, Rudolf replies | Free |
| User asks for recommendations, Rudolf replies | Free |
| Weekly digest sent proactively | Paid per delivered template message |
| Rudolf fresh-picks nudge sent proactively | Paid per delivered template message |
| Dedicated WhatsApp phone number | Cost of owning/maintaining the number |
| AI/API cost for Rudolf intelligence | Same as today |
| App hosting/webhooks | Same as current app hosting unless traffic grows |

Meta charges WhatsApp Business Platform messages when they are delivered. Pricing depends on the recipient country and message category: service, utility, authentication, or marketing.

For Rudolf, the practical split is:

| Rudolf behavior | Likely category | Cost |
| --- | --- | ---: |
| Reply to a user message | Service | Free inside 24-hour window |
| Save a pasted link | Service | Free inside 24-hour window |
| Answer a recommendation question | Service | Free inside 24-hour window |
| Send weekly digest without a recent user message | Utility or Marketing | Paid |
| Send fresh picks or reactivation nudges | Marketing likely | Paid |

As a planning rule: WhatsApp chat is basically free; proactive messages cost money. For 100 users chatting with Rudolf, the Meta messaging cost can be near zero if users initiate the conversations. For 100-1,000 proactive digests or nudges per month, expect costs to move from a few euros into tens of euros depending on countries and category.

## Template Approval

Templates are required when Rudolf starts or resumes a conversation outside the 24-hour customer-service window.

Template submission itself is free. Approval time is usually minutes to a few hours for simple templates, but it can take up to 24 hours or require resubmission if Meta rejects the wording.

Examples of templates Rudolf may need:

- Weekly digest notification
- Fresh picks nudge
- Reconnect or reactivation message
- Pause/resume confirmation, if sent proactively

## Limitations Compared With Telegram

- WhatsApp has a 24-hour customer-service window. Rudolf can respond freely only after the user messages first, and only within that window.
- Outside the 24-hour window, Rudolf usually needs a pre-approved template.
- Proactive WhatsApp messages cost money.
- Template wording is controlled and cannot be fully improvised by Rudolf.
- Formatting is more limited than Telegram HTML messages.
- Users must opt in clearly before receiving proactive WhatsApp messages.
- Users connect via their WhatsApp phone identity, not a Telegram username.

## Getting The User Phone Number

Use a WhatsApp link and QR code, similar to the current Telegram connect flow.

1. User clicks `Connect WhatsApp` in Layrrrd.
2. The app creates a one-time code, for example `wa_7K29`.
3. The app shows a button and QR code pointing to:

   ```text
   https://wa.me/RUDOLF_BUSINESS_NUMBER?text=connect%20wa_7K29
   ```

4. User opens WhatsApp and sends the prefilled message.
5. WhatsApp sends the message to Layrrrd's webhook.
6. The webhook receives the user's WhatsApp sender ID/phone number.
7. Layrrrd stores that identity against the user's profile.

The user does not need to manually type their phone number in the app. They reveal their WhatsApp identity by messaging Rudolf.

## Setup Walkthrough

One Meta app has exactly one webhook callback URL, so QA and production
need **separate Meta apps** (same as the separate Telegram bots). Do the
whole thing for test first, QA it, then repeat for production.

### A. Test (test.layrrrd.com, Meta's free test number)

1. **Create the app.** developers.facebook.com → My Apps → Create app →
   use case "Connect with customers through WhatsApp". Link (or create) the
   Meta Business portfolio when asked. Name it e.g. "Rudolf (test)".
2. **Grab the ids.** WhatsApp → API Setup shows a free test number. Note
   its **Phone number ID** (→ `WHATSAPP_PHONE_NUMBER_ID`) and the number
   itself, digits only with country code (→ `WHATSAPP_BUSINESS_NUMBER`).
3. **Allow your testers.** The test number can only talk to up to 5
   verified recipients: under "To", add and verify each QA tester's
   WhatsApp number. Anyone not on this list gets nothing back.
4. **Permanent token.** The token on API Setup expires in 24h. Instead:
   business.facebook.com → Settings → Users → System users → Add (Admin) →
   Assign assets: the app and the WhatsApp account (full control) →
   Generate token, expiry "Never", permissions
   `whatsapp_business_messaging` and `whatsapp_business_management`
   (→ `WHATSAPP_ACCESS_TOKEN`).
5. **App secret.** App settings → Basic → App secret
   (→ `WHATSAPP_APP_SECRET`).
6. **Verify token.** Any random string, e.g. `openssl rand -hex 32`
   (→ `WHATSAPP_VERIFY_TOKEN`).
7. **Set the env vars** in Vercel, **Preview** scope (branch `test`) only,
   plus `.env.test` locally. Then redeploy `test` so the webhook can answer
   Meta's verification call.
8. **Point the webhook.** WhatsApp → Configuration → Webhook → Edit:
   callback `https://test.layrrrd.com/api/whatsapp/webhook`, verify token
   from step 6 → Verify and save. Then under Webhook fields, **subscribe
   to `messages`**. (If Vercel Deployment Protection is on for Preview and
   verification fails with 401, append
   `?x-vercel-protection-bypass=<Protection Bypass for Automation secret>`
   to the callback URL.)
9. **Digest template.** business.facebook.com → WhatsApp Manager →
   Message templates → Create:
   - Category **Utility**, name `digest_ready`, language English (`en`)
   - Body: `Woof, your Layrrrd week is ready, {{1}} 🐕 Want it now? I'll
     send it over in a few short messages.` (sample value for {{1}}: `Sam`)
   - Buttons → Quick reply: `Yes please` and `No thanks` (these exact
     words are what Rudolf's yes/no check matches)

   Set `WHATSAPP_DIGEST_TEMPLATE=digest_ready`,
   `WHATSAPP_DIGEST_TEMPLATE_LANG=en`. Meta may re-categorize it as
   Marketing, which is pricier - check the category after approval.
10. **Deploy the Firestore rules** (they now stop clients from setting a
    chat id themselves): `npx firebase-tools deploy --only firestore --project test`.

**QA checklist on test.layrrrd.com:**

- Dashboard card → WhatsApp → scan QR / open link → send → "You're in!"
  arrives, the card disappears, Profile shows WhatsApp as the digest channel.
- Paste a link in WhatsApp → saved to the library with a summary.
- Ask "what did I save about X?" → sensible answer.
- Digest, window open: message Rudolf, then run
  `curl -H "Authorization: Bearer $CRON_SECRET" "https://test.layrrrd.com/api/cron/weekly-digest?force=1"`
  → a free-form ask arrives; reply yes → digest arrives.
- Digest, window closed: in the Firestore console set the tester's
  `whatsappLastInboundAt` to two days ago, run the cron again → the
  template with buttons arrives; tap Yes please → digest arrives.
- Send STOP → confirmation; Profile now shows Email.
- Disconnect in Profile → messages get the "connect first" reply.

### B. Production (after QA passes)

1. A second Meta app ("Rudolf"), same steps 1, 4-6, 9 as above.
2. **Real number:** WhatsApp → API Setup → Add phone number. It must not be
   registered on any WhatsApp app; verify by SMS/call, set a display name
   (Meta reviews it) and a two-step PIN.
3. **Billing:** WhatsApp Manager → add a payment method - paid templates
   fail without one.
4. **Business verification** (Business Settings → Security Centre) lifts
   the low new-account messaging limits.
5. Env vars in Vercel **Production** scope only; set
   `WHATSAPP_TEMPLATE_MONTHLY_CAP` to what you're willing to spend.
6. Webhook callback on the production domain
   (`https://<prod domain>/api/whatsapp/webhook`), subscribe to `messages`.
7. `npm run backup`, then
   `npx firebase-tools deploy --only firestore --project prod`.

## Recommended Rollout

Phase 1 should be WhatsApp chat only:

- Connect WhatsApp via link/QR code
- Save pasted links
- Reply to questions
- Send recommendations when the user asks
- Keep weekly digest and proactive nudges on Telegram/email for now

Phase 2 (built) adds the weekly digest on WhatsApp:

- One approved template (the digest ask), used only outside the 24h window
- Monthly template count in Firestore `whatsappUsage/{YYYY-MM}`
- Opt-in by choosing WhatsApp as the digest channel; STOP to opt out
- Monthly template cap with email fallback (nudges are not built)

This keeps the first WhatsApp launch close to the current Telegram Rudolf experience while avoiding surprise template costs.
