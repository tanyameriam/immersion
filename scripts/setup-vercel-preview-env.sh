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

# A single Vercel env var record can target several environments at once, and
# `vercel env rm <name> preview` deletes the WHOLE record - taking the
# Production value with it. That is exactly how production lost every
# FIREBASE_* var (and CRON_SECRET) on 2026-08-12 and ran for five days with
# placeholder config: login 401'd for real users and the Telegram bot went
# silent. So: back production up first, then put back anything the removals
# took with them.
PROD_BACKUP="$(mktemp -t vercel-prod-env.XXXXXX)"
trap 'rm -f "$PROD_BACKUP"' EXIT

echo "── Backing up the Production environment first…"
vercel env pull "$PROD_BACKUP" --environment=production --yes >/dev/null
echo "   saved $(grep -c '^[A-Z]' "$PROD_BACKUP") Production vars"

prod_value() { # prod_value NAME -> value as it existed in Production, or ""
  sed -n "s/^$1=//p" "$PROD_BACKUP" | head -1 | sed -e 's/^"//' -e 's/"$//'
}

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
  # --value= (equals form) so values starting with "-" (the private key's
  # "-----BEGIN") aren't parsed as options; piping via stdin makes the CLI's
  # "which Git branch?" prompt hit EOF and silently create nothing.
  # --force overwrites vars a previous partial run already added.
  vercel env add "$name" preview --value="${ADD[$name]}" --yes --force >/dev/null \
    && echo "   added: $name" || { echo "   FAILED: $name"; exit 1; }
done

echo "── Verifying Production survived, restoring anything the removals took…"
PROD_NOW="$(vercel env ls production 2>/dev/null | awk '{print $1}')"
restored=0
for name in "${!ADD[@]}"; do
  grep -qx "$name" <<<"$PROD_NOW" && continue
  value="$(prod_value "$name")"
  if [ -z "$value" ]; then
    echo "   ⚠️  $name is missing from Production and was not in the backup - set it by hand!"
    continue
  fi
  vercel env add "$name" production --value="$value" --yes --force >/dev/null \
    && { echo "   restored to Production: $name"; restored=$((restored + 1)); } \
    || { echo "   FAILED to restore Production: $name"; exit 1; }
done
[ "$restored" -eq 0 ] && echo "   Production untouched, nothing to restore"

echo
echo "✅ Preview env now points at layrrrd-test. Your Preview CRON_SECRET: $CRON"
if [ "$restored" -gt 0 ]; then
  echo "⚠️  Restored $restored Production var(s). Redeploy production so the"
  echo "    running build picks them up: vercel redeploy <current-prod-url>"
fi
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
