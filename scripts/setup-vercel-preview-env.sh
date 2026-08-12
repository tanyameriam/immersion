#!/usr/bin/env bash
# One-shot setup of the Vercel PREVIEW environment (test.layrrrd.com) so that
# preview/QA deployments run against the layrrrd-test Firebase project instead
# of production. See docs/environments.md.
#
# What it does:
#   1. REMOVES the Preview scope from the production Firebase credentials
#      (today previews run with full prod admin access - the thing we're fixing).
#   2. Adds Preview-scoped values pointing at layrrrd-test, including the
#      service-account you downloaded from:
#      Firebase Console → layrrrd-test → Project settings → Service accounts
#      → Generate new private key
#
# Usage:
#   bash scripts/setup-vercel-preview-env.sh /path/to/layrrrd-test-sa.json
set -euo pipefail

SA_JSON="${1:?Usage: bash scripts/setup-vercel-preview-env.sh /path/to/layrrrd-test-service-account.json}"
[ -f "$SA_JSON" ] || { echo "No such file: $SA_JSON"; exit 1; }

CLIENT_EMAIL=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['client_email'])" "$SA_JSON")
PRIVATE_KEY=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['private_key'])" "$SA_JSON")
CRON=$(openssl rand -hex 32)

# layrrrd-test web app config (public by design; from firebase apps:sdkconfig).
declare -A ADD=(
  [NEXT_PUBLIC_FIREBASE_API_KEY]="AIzaSyATZxhp7LcBAXGkBpdxxQyEko3CQEwLubY"
  [NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN]="layrrrd-test.firebaseapp.com"
  [NEXT_PUBLIC_FIREBASE_PROJECT_ID]="layrrrd-test"
  [NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET]="layrrrd-test.firebasestorage.app"
  [NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID]="621425522405"
  [NEXT_PUBLIC_FIREBASE_APP_ID]="1:621425522405:web:93d45e728924160b60c60c"
  [FIREBASE_PROJECT_ID]="layrrrd-test"
  [FIREBASE_CLIENT_EMAIL]="$CLIENT_EMAIL"
  [FIREBASE_PRIVATE_KEY]="$PRIVATE_KEY"
  [NEXT_PUBLIC_APP_URL]="https://test.layrrrd.com"
  [CRON_SECRET]="$CRON"
)

echo "── Removing Preview scope from existing (production) values…"
for name in "${!ADD[@]}"; do
  vercel env rm "$name" preview -y >/dev/null 2>&1 \
    && echo "   removed: $name" || echo "   (not scoped to preview): $name"
done
# Prod-only secrets that previews must NOT inherit but get no test value here
# (previews simply run without them until you add test-service equivalents).
for name in ANTHROPIC_API_KEY; do
  : # ANTHROPIC_API_KEY is intentionally left shared - QA needs Rudolf/AI flows.
done

echo "── Adding Preview-scoped layrrrd-test values…"
for name in "${!ADD[@]}"; do
  # --value keeps this fully non-interactive; piping the value via stdin makes
  # the CLI's "which Git branch?" prompt hit EOF and silently create nothing.
  vercel env add "$name" preview --value "${ADD[$name]}" --yes >/dev/null \
    && echo "   added: $name" || { echo "   FAILED: $name"; exit 1; }
done

echo
echo "✅ Preview env now points at layrrrd-test. Your Preview CRON_SECRET: $CRON"
echo
echo "Still manual (dashboards, ~10 min total):"
echo "  • Vercel → immersion → Settings → Domains → Add test.layrrrd.com,"
echo "    set its Git Branch to: test"
echo "  • Vercel → Settings → Deployment Protection → disable for Previews"
echo "    (so QA testers don't hit a Vercel login wall)"
echo "  • Firebase Console → layrrrd-test → Authentication → Sign-in method:"
echo "    enable Email/Password and Google (same as prod)"
echo "  • Optional Preview vars when ready (same pattern):"
echo "    Razorpay TEST keys, a @BotFather test bot token, WhatsApp test number"
