// Announces the extension's presence to the Layrrrd web app so it can show
// "installed ✓" instead of the install prompt. Runs only on Layrrrd's own
// domains (see manifest content_scripts.matches).
document.documentElement.setAttribute("data-layrrrd-extension", "1");
