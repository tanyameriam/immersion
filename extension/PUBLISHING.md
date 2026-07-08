# Publishing the Layrrrd Chrome extension

## ⚠️ IMPORTANT - when you start charging money, switch to "trader"

The Chrome Web Store publisher account is currently declared **non-trader**
(correct while Layrrrd is free, in testing, and not a registered business).

**The moment you turn on paid plans** (e.g. the "Founding members" subscription),
you must:
1. **Register a business** (you need a valid business address for this step).
2. In the Chrome Web Store Developer Console → **Account settings**, change the
   declaration from **non-trader → trader**.
3. Provide the business **postal address + phone + email** (these become
   **publicly visible** on the extension's store listing).

Not doing this once you charge money puts you out of compliance with EU (EEA)
consumer-protection rules. It's a quick change in the console - just don't forget
it when payments go live. The same "register a business first" applies to
Stripe/billing setup, so do them together.

---

## One-time setup to publish

Everything in `extension/` is already prepped (points at the live site, has
icons). To publish:

**1. Make the zip**
Zip the **contents** of the `extension/` folder - `manifest.json`, `popup.html`,
`popup.js`, `config.js`, and the `icons/` folder - so `manifest.json` sits at
the top level of the zip (not inside an `extension/` subfolder).

**2. Developer account**
[chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
→ sign in with Google → pay the one-time **$5** registration fee → declare
**non-trader** (see the reminder above) → add a contact email.

**3. Upload to get the extension ID**
**New item** → upload the zip → copy the permanent **Item ID**.

**4. Create the Google sign-in client (needs the Item ID)**
Google Cloud Console (project `layrrrd-18b1e`) → **APIs & Services →
Credentials → Create credentials → OAuth client ID → Chrome Extension** → paste
the Item ID → copy the **Client ID** → put it in `manifest.json` under
`oauth2.client_id` → re-zip → upload the new version.

**5. Store listing**
Short description, ≥1 screenshot (1280×800), category **Productivity**, the
128px icon (included), and a **privacy policy URL** →
`https://immersion-one.vercel.app/privacy`.

**6. Submit for review**
Google reviews in ~1–3 days. Once approved it's public and one-click Google
sign-in works.

## Config reference
- `extension/config.js` → `APP_URL` must match the live site. Update it to
  `https://app.layrrrd.com` when the custom domain goes live, then re-upload.
