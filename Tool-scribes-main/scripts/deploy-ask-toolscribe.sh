#!/bin/bash
# Deploy the AI edge functions.
#
# 1. Get a Supabase access token: https://supabase.com/dashboard/account/tokens
# 2. export SUPABASE_ACCESS_TOKEN=...
# 3. Run: bash scripts/deploy-ask-toolscribe.sh
#
# JWT verification is ON (see supabase/config.toml). Do NOT add
# --no-verify-jwt: both functions perform a service-role database write and
# authenticate() rejects anonymous callers. Disabling gateway verification
# would remove the outer layer of defence for no benefit.
#
# MIGRATION ORDER: apply supabase/migrations/ first. The rate limiter calls
# check_rate_limit(), which does not exist until its migration is applied.

set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-qglvwvpsegrucrhcpzxd}"

# Guard: these functions must never be deployed with gateway JWT
# verification disabled. Fail loudly rather than shipping a regression.
# Matches the flag as a command argument only, so the prose in comments
# explaining why it is banned does not trip the check.
if grep -rnE '^[[:space:]]*--no-verify-jwt' scripts/ supabase/config.toml 2>/dev/null; then
  echo "ERROR: --no-verify-jwt passed to a deploy command." >&2
  echo "Both AI functions require authenticated callers. Refusing to deploy." >&2
  exit 1
fi

# Push any pending migrations before deploying code that depends on them.
npx supabase db push --project-id "$PROJECT_REF"

npx supabase functions deploy ask-toolscribe \
  --project-ref "$PROJECT_REF"

npx supabase functions deploy generate-ai-profile \
  --project-ref "$PROJECT_REF"

# Secrets are set once via the dashboard or:
#   npx supabase secrets set OPENROUTER_API_KEY=... GEMINI_API_KEY=... --project-ref "$PROJECT_REF"