#!/usr/bin/env bash
set -euo pipefail
for required in COOLIFY_API_URL COOLIFY_API_TOKEN COOLIFY_APP_UUID SEOTAKATAK_HEALTH_URL; do
  if [[ -z "${!required:-}" ]]; then
    echo "::error::Missing production setting: $required"
    exit 1
  fi
done
if [[ ! "$COOLIFY_API_URL" =~ ^https://[a-zA-Z0-9.-]+(:[0-9]+)?/?$ ]] || [[ ! "$SEOTAKATAK_HEALTH_URL" =~ ^https://[a-zA-Z0-9.-]+(:[0-9]+)?/?$ ]]; then
  echo "::error::Trusted HTTPS origins required, without credentials or paths."
  exit 1
fi
if [[ ! "$COOLIFY_APP_UUID" =~ ^[a-zA-Z0-9_-]{8,100}$ ]]; then
  echo "::error::Invalid Coolify resource UUID."
  exit 1
fi
COOLIFY_API_URL="${COOLIFY_API_URL%/}"
SEOTAKATAK_HEALTH_URL="${SEOTAKATAK_HEALTH_URL%/}"
payload=$(printf '{"uuid":"%s","force":false}' "$COOLIFY_APP_UUID")
response=$(curl --fail --silent --show-error --max-time 25 \
  -X POST "$COOLIFY_API_URL/api/v1/deploy" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" -H "Content-Type: application/json" \
  --data "$payload")
deployment_uuid=$(printf '%s' "$response" | jq -er --arg resource "$COOLIFY_APP_UUID" \
  '[.deployments[]? | select(.resource_uuid == $resource) | .deployment_uuid] | first // empty') || {
  echo "::error::Coolify did not queue the requested app deployment."
  exit 1
}
if [[ ! "$deployment_uuid" =~ ^[a-zA-Z0-9_-]{8,100}$ ]]; then
  echo "::error::Unexpected deployment UUID."
  exit 1
fi
complete=false
for attempt in $(seq 1 35); do
  response=$(curl --fail --silent --show-error --max-time 25 \
    -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
    "$COOLIFY_API_URL/api/v1/deployments/$deployment_uuid") || {
    sleep 12
    continue
  }
  status=$(printf '%s' "$response" | jq -r '.status // "unknown"')
  case "$status" in
    finished|success) complete=true;break;;
    failed|error|cancelled|canceled) echo "::error::Deployment failed: $status";exit 1;;
    *) echo "Awaiting Coolify deployment ($attempt/35): $status";sleep 12;;
  esac
done
if [[ "$complete" != true ]]; then
  echo "::error::Coolify did not complete within verification window."
  exit 1
fi
for attempt in $(seq 1 12); do
  if curl --fail --silent --show-error --max-time 12 \
    "$SEOTAKATAK_HEALTH_URL/ready" | jq -e '.ok == true and .status == "ready" and .database == "reachable"' >/dev/null; then
    echo "SEOTAKATAK production ready."
    exit 0
  fi
  sleep 5
done
echo "::error::Coolify reported completion but the database-ready health check did not pass."
exit 1
