/* global chrome */
const cfg = window.LAYRRRD_CONFIG;

const pageEl = document.getElementById("page");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

let currentTab = null;

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = "status" + (kind ? " " + kind : "");
}

// Show the active tab's title/url.
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  currentTab = tabs[0];
  if (currentTab) {
    pageEl.textContent = currentTab.title || currentTab.url || "This page";
  } else {
    pageEl.textContent = "Couldn't read the current tab.";
    saveBtn.disabled = true;
  }
});

/** Get a Google OAuth access token via chrome.identity. */
function getGoogleAccessToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || "No token"));
      } else {
        resolve(token);
      }
    });
  });
}

/**
 * Exchange the Google access token for a Firebase ID token (same identity the
 * web app + backend use) via the Firebase Auth REST API — no bundled SDK.
 */
async function getFirebaseIdToken(accessToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${cfg.FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `access_token=${accessToken}&providerId=google.com`,
        requestUri: cfg.APP_URL,
        returnSecureToken: true,
        returnIdpCredential: true,
      }),
    },
  );
  if (!res.ok) throw new Error("Firebase sign-in failed");
  const data = await res.json();
  return data.idToken;
}

async function save() {
  if (!currentTab?.url) return;
  saveBtn.disabled = true;
  setStatus("Signing you in…");

  try {
    let accessToken = await getGoogleAccessToken(true);
    let idToken;
    try {
      idToken = await getFirebaseIdToken(accessToken);
    } catch (err) {
      // Cached Google token may be stale — clear and retry once.
      await new Promise((r) =>
        chrome.identity.removeCachedAuthToken({ token: accessToken }, r),
      );
      accessToken = await getGoogleAccessToken(true);
      idToken = await getFirebaseIdToken(accessToken);
    }

    setStatus("Saving…");
    const res = await fetch(`${cfg.APP_URL}/api/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        url: currentTab.url,
        title: currentTab.title || undefined,
        favicon: currentTab.favIconUrl || undefined,
      }),
    });

    if (!res.ok) throw new Error(`Save failed (${res.status})`);
    setStatus("Saved! Layrrrd is reading it now.", "ok");
  } catch (err) {
    console.error(err);
    setStatus("Couldn't save. Please try again.", "err");
    saveBtn.disabled = false;
  }
}

saveBtn.addEventListener("click", save);
