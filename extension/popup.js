/* global chrome */
const cfg = window.LAYRRRD_CONFIG;

const pageTitleEl = document.getElementById("page-title");
const pageDomainEl = document.getElementById("page-domain");
const pageFaviconEl = document.getElementById("page-favicon");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");
const searchEl = document.getElementById("search");
const listEl = document.getElementById("list");
const labelEl = document.getElementById("library-label");
const dashboardEl = document.getElementById("dashboard");
const accountLineEl = document.getElementById("account-line");
const accountEmailEl = document.getElementById("account-email");
const switchAccountEl = document.getElementById("switch-account");

const RECENT_COUNT = 3;
const SEARCH_COUNT = 6;

let currentTab = null;
let cachedIdToken = null;
let cachedEmail = null;
let allItems = [];

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = "status" + (kind ? " " + kind : "");
}

// Show the active tab's favicon, title, and domain.
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  currentTab = tabs[0];
  if (currentTab) {
    pageTitleEl.textContent = currentTab.title || currentTab.url || "This page";
    try {
      pageDomainEl.textContent = new URL(currentTab.url).hostname.replace(
        /^www\./,
        "",
      );
    } catch {
      pageDomainEl.textContent = "";
    }
    if (currentTab.favIconUrl) {
      pageFaviconEl.src = currentTab.favIconUrl;
      pageFaviconEl.hidden = false;
    }
  } else {
    pageTitleEl.textContent = "Couldn't read the current tab.";
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
 * web app + backend use) via the Firebase Auth REST API - no bundled SDK.
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
  return { idToken: data.idToken, email: data.email || null };
}

/** Show which Google account saves are going to, so a wrong-account or
 * empty-looking library is explainable at a glance. */
function updateAccountLine() {
  if (cachedEmail) {
    accountEmailEl.textContent = cachedEmail;
    accountLineEl.hidden = false;
  } else {
    accountLineEl.hidden = true;
  }
}

/**
 * Full sign-in: Google token → Firebase ID token, with a one-shot retry for a
 * stale cached Google token. Cached for the lifetime of this popup.
 */
async function getIdToken(interactive) {
  if (cachedIdToken) return cachedIdToken;
  let accessToken = await getGoogleAccessToken(interactive);
  let result;
  try {
    result = await getFirebaseIdToken(accessToken);
  } catch (err) {
    await new Promise((r) =>
      chrome.identity.removeCachedAuthToken({ token: accessToken }, r),
    );
    accessToken = await getGoogleAccessToken(interactive);
    result = await getFirebaseIdToken(accessToken);
  }
  cachedIdToken = result.idToken;
  cachedEmail = result.email;
  updateAccountLine();
  return cachedIdToken;
}

/** Forget the current Google grant and sign in again (account picker). */
async function switchAccount() {
  cachedIdToken = null;
  cachedEmail = null;
  updateAccountLine();
  await new Promise((r) => chrome.identity.clearAllCachedAuthTokens(r));
  allItems = [];
  listEl.textContent = "";
  const loading = document.createElement("div");
  loading.className = "empty";
  loading.textContent = "Switching account…";
  listEl.appendChild(loading);
  await loadLibrary(true);
}

/* ---------- Save (input) ---------- */

/**
 * Capture the page content from the tab itself. The user's browser has
 * already passed bot checks, logins, and JS rendering, so this succeeds on
 * pages the server can't read (Cloudflare-protected journals, paywalls).
 * Returns null where scripting isn't allowed (chrome://, Web Store, PDFs) -
 * the save then falls back to server-side extraction as before.
 */
async function capturePage() {
  if (!currentTab?.id) return null;
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => {
        const meta = (sel) =>
          document.querySelector(sel)?.getAttribute("content")?.trim() || "";
        // Prefer the article/main region; body as a last resort brings some
        // nav noise, which the summarizer tolerates.
        const root =
          document.querySelector("article") ||
          document.querySelector("main") ||
          document.body;
        const text = (root?.innerText || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 20000);
        return {
          title: meta('meta[property="og:title"]') || document.title || "",
          description:
            meta('meta[property="og:description"]') ||
            meta('meta[name="description"]') ||
            "",
          image: meta('meta[property="og:image"]') || "",
          text,
        };
      },
    });
    const page = injection?.result;
    return page && page.text ? page : null;
  } catch {
    return null;
  }
}

async function save() {
  if (!currentTab?.url) return;
  saveBtn.disabled = true;
  setStatus("Reading the page…");

  try {
    const content = await capturePage();

    setStatus("Signing you in…");
    const idToken = await getIdToken(true);

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
        content: content || undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Save API ${res.status}: ${body.slice(0, 120)}`);
    }
    // The API says whether this was a fresh save or an existing bookmark
    // (201/created:true vs 200/created:false) — tell the user the truth.
    const data = await res.json().catch(() => null);
    if (data && data.created === false && data.reprocess) {
      // An earlier save couldn't be read (bot wall / paywall); this save
      // brought the page content from the browser, so it's being re-read.
      setStatus("Already saved. Layrrrd is re-reading it from this tab.", "ok");
    } else if (data && data.created === false) {
      setStatus("Already in your library.", "info");
    } else {
      setStatus("Saved! Layrrrd is reading it now.", "ok");
    }
    // Show the save in the list right away.
    if (data?.item) {
      allItems = [data.item, ...allItems.filter((i) => i.id !== data.item.id)];
      render(searchEl.value);
    }
  } catch (err) {
    console.error(err);
    setStatus(String(err && err.message ? err.message : err), "err");
    saveBtn.disabled = false;
  }
}

/* ---------- Library (output) ---------- */

function itemMeta(item) {
  const bits = [];
  if (item.domain) bits.push(item.domain);
  const mins = item.ai?.readingTime;
  if (mins) bits.push(`${mins} min`);
  if (item.createdAt) bits.push(item.createdAt.slice(0, 10));
  return bits.join(" · ");
}

function render(query) {
  const q = (query || "").trim().toLowerCase();
  const matches = q
    ? allItems.filter((item) => {
        const haystack = [
          item.title,
          item.domain,
          item.ai?.tldr,
          ...(item.ai?.topics ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return q.split(/\s+/).every((word) => haystack.includes(word));
      })
    : allItems;
  const shown = matches.slice(0, q ? SEARCH_COUNT : RECENT_COUNT);

  labelEl.textContent = q
    ? `${matches.length} match${matches.length === 1 ? "" : "es"}`
    : "Your recent saves";

  listEl.textContent = "";
  if (shown.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = q
      ? "Nothing matches that yet. Try another word?"
      : "No saves yet. This page could be your first!";
    listEl.appendChild(empty);
    return;
  }

  for (const item of shown) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "item";
    row.title = item.read ? "" : "Unread";

    const dot = document.createElement("span");
    dot.className = "dot" + (item.read ? " read" : "");
    const text = document.createElement("div");
    text.className = "text";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = item.title || item.url;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = itemMeta(item);
    text.appendChild(title);
    text.appendChild(meta);
    row.appendChild(dot);
    row.appendChild(text);
    row.addEventListener("click", () => chrome.tabs.create({ url: item.url }));
    listEl.appendChild(row);
  }
}

function showSignedOut() {
  listEl.textContent = "";
  const empty = document.createElement("div");
  empty.className = "empty";
  empty.append(
    "Sign in with the same Google account you use for Layrrrd to see your saves. ",
  );
  const link = document.createElement("a");
  link.textContent = "Sign in";
  link.addEventListener("click", () => loadLibrary(true));
  empty.appendChild(link);
  listEl.appendChild(empty);
}

async function loadLibrary(interactive) {
  try {
    const idToken = await getIdToken(interactive);
    const res = await fetch(`${cfg.APP_URL}/api/items`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error(`List API ${res.status}`);
    const data = await res.json();
    allItems = Array.isArray(data.items) ? data.items : [];
    render(searchEl.value);
    // Exact-URL match means this page is already saved; variant URLs are
    // still resolved by the save API itself.
    if (currentTab?.url && allItems.some((i) => i.url === currentTab.url)) {
      setStatus("This page is already in your library.", "info");
    }
  } catch (err) {
    console.error(err);
    if (interactive) {
      listEl.textContent = "";
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Couldn't load your library. Try again in a moment.";
      listEl.appendChild(empty);
    } else {
      // Not signed in yet (or token expired) — don't interrupt with a popup.
      showSignedOut();
    }
  }
}

let searchTimer = null;
searchEl.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => render(searchEl.value), 120);
});

dashboardEl.addEventListener("click", () =>
  chrome.tabs.create({ url: `${cfg.APP_URL}/dashboard` }),
);

switchAccountEl.addEventListener("click", () => {
  switchAccount().catch((err) => {
    console.error(err);
    setStatus("Couldn't switch accounts. Try again?", "err");
  });
});

saveBtn.addEventListener("click", save);

// Load the library on open — silently if already signed in.
loadLibrary(false);
