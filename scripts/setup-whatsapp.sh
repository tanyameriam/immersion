#!/usr/bin/env bash
# Wire Rudolf's WhatsApp channel into one environment, after the browser-only
# Meta steps are done (create the Meta app, add test recipients, generate the
# System User token - see docs/rudolf-whatsapp-integration.md).
#
# Reads the WHATSAPP_* values from the env file, then:
#   1. checks the token can see the phone number,
#   2. sets the WhatsApp vars in Vercel for the given scope,
#   3. subscribes the Meta app to the WhatsApp Business Account,
#   4. submits the digest_ready template (skipped if it already exists;
#      a refusal - always the case on Meta's test account - only warns),
#   5. waits until the deployed webhook answers Meta's handshake,
#   6. registers the webhook callback + "messages" field with Meta.
#
# Needs `vercel login` (project linked) beforehand. Redeploy happens between
# steps 4 and 5: the script waits for you (or the caller) to deploy.
#
# Usage:
#   bash scripts/setup-whatsapp.sh .env.test preview https://test.layrrrd.com
#   bash scripts/setup-whatsapp.sh .env.prod production https://layrrrd.com
set -euo pipefail

ENV_FILE="${1:?Usage: setup-whatsapp.sh <env-file> <preview|production> <base-url>}"
SCOPE="${2:?scope: preview or production}"
BASE_URL="${3:?base url, e.g. https://test.layrrrd.com}"
GRAPH="https://graph.facebook.com/v23.0"
TEMPLATE="digest_ready"

[ -f "$ENV_FILE" ] || { echo "No such file: $ENV_FILE"; exit 1; }
set -a; source "$ENV_FILE"; set +a

for v in WHATSAPP_APP_ID WHATSAPP_APP_SECRET WHATSAPP_ACCESS_TOKEN \
         WHATSAPP_PHONE_NUMBER_ID WHATSAPP_BUSINESS_ACCOUNT_ID \
         WHATSAPP_BUSINESS_NUMBER; do
  [ -n "${!v:-}" ] || { echo "Missing $v in $ENV_FILE"; exit 1; }
done

# A verify token is ours to invent; mint one once and keep it in the file.
if [ -z "${WHATSAPP_VERIFY_TOKEN:-}" ]; then
  WHATSAPP_VERIFY_TOKEN=$(openssl rand -hex 32)
  echo "WHATSAPP_VERIFY_TOKEN=$WHATSAPP_VERIFY_TOKEN" >> "$ENV_FILE"
  echo "── Generated WHATSAPP_VERIFY_TOKEN (saved to $ENV_FILE)"
fi
WHATSAPP_BUSINESS_NUMBER=$(echo "$WHATSAPP_BUSINESS_NUMBER" | tr -cd '0-9')

graph() { # graph METHOD PATH [curl args…] - fails loudly on a Graph error
  local method=$1 path=$2; shift 2
  local out
  out=$(curl -sS -X "$method" "$GRAPH/$path" "$@")
  if echo "$out" | grep -q '"error"'; then
    echo "$out" >&2
    return 1
  fi
  echo "$out"
}
AUTH=(-H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN")

echo "── 1. Checking the token…"
graph GET "$WHATSAPP_PHONE_NUMBER_ID?fields=display_phone_number,verified_name" "${AUTH[@]}"
echo

# Meta's free test WhatsApp account can't create its own templates (only use
# Meta's samples), so a refusal here is a warning, not a stop: without the
# template, digest asks outside the 24h window simply fall back to email.
echo "── 2. Submitting the $TEMPLATE template…"
TEMPLATE_OK=0
existing=$(graph GET "$WHATSAPP_BUSINESS_ACCOUNT_ID/message_templates?name=$TEMPLATE&fields=name,status,category" "${AUTH[@]}" || true)
if echo "$existing" | grep -q "\"name\":\"$TEMPLATE\""; then
  echo "   already exists: $existing"
  TEMPLATE_OK=1
elif graph POST "$WHATSAPP_BUSINESS_ACCOUNT_ID/message_templates" "${AUTH[@]}" \
    -H "Content-Type: application/json" --data @- <<'JSON'
{
  "name": "digest_ready",
  "language": "en",
  "category": "UTILITY",
  "components": [
    {
      "type": "BODY",
      "text": "Woof, your Layrrrd week is ready, {{1}} 🐕 Want it now? I'll send it over in a few short messages.",
      "example": { "body_text": [["Sam"]] }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "QUICK_REPLY", "text": "Yes please" },
        { "type": "QUICK_REPLY", "text": "No thanks" }
      ]
    }
  ]
}
JSON
then
  echo
  TEMPLATE_OK=1
else
  echo "   ⚠ Template refused (expected on Meta's test account) - continuing"
  echo "     without it; digest asks outside the 24h window go by email."
fi

echo "── 3. Setting Vercel $SCOPE env vars…"
declare -A VARS=(
  [WHATSAPP_ACCESS_TOKEN]="$WHATSAPP_ACCESS_TOKEN"
  [WHATSAPP_PHONE_NUMBER_ID]="$WHATSAPP_PHONE_NUMBER_ID"
  [WHATSAPP_BUSINESS_NUMBER]="$WHATSAPP_BUSINESS_NUMBER"
  [WHATSAPP_VERIFY_TOKEN]="$WHATSAPP_VERIFY_TOKEN"
  [WHATSAPP_APP_SECRET]="$WHATSAPP_APP_SECRET"
  [WHATSAPP_DIGEST_TEMPLATE_LANG]="en"
  [WHATSAPP_TEMPLATE_MONTHLY_CAP]="${WHATSAPP_TEMPLATE_MONTHLY_CAP:-50}"
)
for name in "${!VARS[@]}"; do
  # Same form as setup-vercel-preview-env.sh: --value= so nothing is read
  # from stdin, --force so reruns overwrite.
  npx vercel env add "$name" "$SCOPE" --value="${VARS[$name]}" --yes --force >/dev/null \
    && echo "   set: $name" || { echo "   FAILED: $name"; exit 1; }
done
if [ "$TEMPLATE_OK" = 1 ]; then
  npx vercel env add WHATSAPP_DIGEST_TEMPLATE "$SCOPE" --value="$TEMPLATE" --yes --force >/dev/null \
    && echo "   set: WHATSAPP_DIGEST_TEMPLATE"
else
  npx vercel env rm WHATSAPP_DIGEST_TEMPLATE "$SCOPE" -y >/dev/null 2>&1 || true
  echo "   (WHATSAPP_DIGEST_TEMPLATE left unset)"
fi

echo "── 4. Subscribing the app to the WhatsApp Business Account…"
graph POST "$WHATSAPP_BUSINESS_ACCOUNT_ID/subscribed_apps" "${AUTH[@]}"
echo

CALLBACK="$BASE_URL/api/whatsapp/webhook"
echo "── 5. Waiting for $CALLBACK to answer the handshake (redeploy now if you haven't)…"
for i in $(seq 1 60); do
  got=$(curl -s "$CALLBACK?hub.mode=subscribe&hub.verify_token=$WHATSAPP_VERIFY_TOKEN&hub.challenge=ping" || true)
  [ "$got" = "ping" ] && { echo "   webhook is live"; break; }
  [ "$i" = 60 ] && { echo "   gave up after 10 min - is the new deploy live?"; exit 1; }
  sleep 10
done

echo "── 6. Registering the webhook with Meta…"
graph POST "$WHATSAPP_APP_ID/subscriptions" \
  --data-urlencode "object=whatsapp_business_account" \
  --data-urlencode "callback_url=$CALLBACK" \
  --data-urlencode "verify_token=$WHATSAPP_VERIFY_TOKEN" \
  --data-urlencode "fields=messages" \
  --data-urlencode "access_token=$WHATSAPP_APP_ID|$WHATSAPP_APP_SECRET"
echo

echo "✅ WhatsApp wired for $SCOPE. Send \"help\" to +$WHATSAPP_BUSINESS_NUMBER from a"
echo "   verified recipient to check, then connect from $BASE_URL/dashboard."
