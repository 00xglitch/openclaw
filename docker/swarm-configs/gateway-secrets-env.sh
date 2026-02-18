#!/bin/sh
# Export Docker secrets as environment variables for gateway
# Called before gateway starts via entrypoint wrapper
set -e

for secret in openclaw_gateway_token anthropic_api_key claude_ai_session_key openrouter_api_key zep_api_key qdrant_api_key redis_password; do
  SECRET_FILE="/run/secrets/${secret}"
  if [ -f "$SECRET_FILE" ]; then
    VAR_NAME=$(echo "$secret" | tr '[:lower:]' '[:upper:]')
    export "$VAR_NAME"="$(cat "$SECRET_FILE")"
  fi
done

# Map specific vars
export OPENCLAW_GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN}"
export CLAUDE_WEB_SESSION_KEY="${CLAUDE_AI_SESSION_KEY}"
export CLAUDE_WEB_COOKIE="${CLAUDE_AI_SESSION_KEY}"
export ZEP_API_KEY="${ZEP_API_KEY}"

exec "$@"
