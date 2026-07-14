# Rudolf WhatsApp Integration Brief

## Status

Phase 1 (chat only) is implemented in code: `lib/whatsapp/` (send, chat,
linking), `app/api/whatsapp/webhook` + `app/api/whatsapp/link`, the
`WhatsAppConnect` UI on the profile page, and the shared Rudolf chat brain in
`lib/rudolf/chat.ts` (used by both Telegram and WhatsApp). What remains is the
Meta side: setup steps 1-6 and 9-10 below, plus filling the `WHATSAPP_*`
environment variables (see `.env.example`). Phase 2 (proactive digests and
nudges over templates) is not built.

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

## Setup Steps

1. Create or verify a Meta Business Account.
2. Create a Meta Developer app.
3. Add the WhatsApp product to the app.
4. Create or connect a WhatsApp Business Account.
5. Add a dedicated phone number for Rudolf.
6. Generate a production access token.
7. Add environment variables:

   ```env
   WHATSAPP_ACCESS_TOKEN=
   WHATSAPP_PHONE_NUMBER_ID=
   WHATSAPP_BUSINESS_ACCOUNT_ID=
   WHATSAPP_VERIFY_TOKEN=
   WHATSAPP_APP_SECRET=
   WHATSAPP_BUSINESS_NUMBER=
   ```

8. Add a webhook route:

   ```text
   /api/whatsapp/webhook
   ```

9. Configure the webhook in Meta with the production callback URL.
10. Subscribe the webhook to WhatsApp message events.
11. Build WhatsApp send helpers, similar to Telegram:

   ```text
   lib/whatsapp/send.ts
   lib/whatsapp/linking.ts
   lib/whatsapp/chat.ts
   ```

12. Add WhatsApp fields to user profiles:

   ```ts
   whatsappWaId: string
   whatsappPhone: string
   whatsappName?: string
   notificationPreference: "email" | "telegram" | "whatsapp"
   ```

13. Add a `Connect WhatsApp` UI with QR code, open button, connected state, and disconnect action.
14. Reuse Rudolf's existing Telegram chat logic where possible:

   ```text
   lib/telegram/chat.ts
   lib/telegram/linking.ts
   lib/telegram/send.ts
   ```

15. Submit message templates for weekly digests and nudges before enabling proactive WhatsApp delivery.

## Recommended Rollout

Phase 1 should be WhatsApp chat only:

- Connect WhatsApp via link/QR code
- Save pasted links
- Reply to questions
- Send recommendations when the user asks
- Keep weekly digest and proactive nudges on Telegram/email for now

Phase 2 can add proactive WhatsApp delivery:

- Approved templates
- Cost tracking by country/category
- User opt-in and unsubscribe controls
- Budget guardrails for digests and nudges

This keeps the first WhatsApp launch close to the current Telegram Rudolf experience while avoiding surprise template costs.
