# Layrrrd Chrome Extension

One-click save: click the toolbar button on any page and it's saved to your
Layrrrd account, where the AI reads and summarizes it.

It uses the **same Firebase account** as the web app — sign in with the same
Google account and your saves show up on your dashboard.

## One-time setup

### 1. Fill in `config.js`

Open `extension/config.js` and set:

- `FIREBASE_API_KEY` — the same `NEXT_PUBLIC_FIREBASE_API_KEY` the web app uses
  (Firebase Console → Project settings → your Web app). It's a public value.
- `APP_URL` — `https://app.layrrrd.com` (or `http://localhost:3000` while
  developing locally).

### 2. Load the extension in Chrome

1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Chrome shows the extension and its **ID** (a long string). Copy it.

### 3. Create the Google sign-in client

1. In **Google Cloud Console** → APIs & Services → **Credentials** →
   **Create credentials → OAuth client ID**.
2. Application type: **Chrome Extension** (older consoles: "Chrome App").
3. Paste the extension **ID** from step 2.
4. Copy the generated **Client ID** and paste it into `manifest.json` under
   `oauth2.client_id`.

### 4. Pin the extension ID (so it doesn't change on reload)

An unpacked extension can change ID when reloaded, which breaks the OAuth
client. To keep it stable:

1. Package the extension once (`chrome://extensions` → **Pack extension**), or
   ask a developer to generate a key.
2. Add the resulting `"key": "..."` value as a top-level field in
   `manifest.json`.
3. Reload — the ID is now fixed.

(For a quick local test you can skip this and just re-paste the current ID into
the OAuth client whenever it changes.)

### 5. Make sure the domain is allowed

In **Firebase Console → Authentication → Settings → Authorized domains**, make
sure `app.layrrrd.com` (and `localhost`) are listed. This is the same list the
web app uses.

## Using it

1. Click the Layrrrd button in the Chrome toolbar on any page.
2. The first time, approve the Google sign-in popup.
3. Click **Save this page** → "Saved! Layrrrd is reading it now."
4. Open your dashboard — the item appears and fills in with its AI summary.
