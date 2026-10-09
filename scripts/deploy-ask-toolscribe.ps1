# Deploy the AI edge functions.
#
# 1. Get a Supabase access token: https://supabase.com/dashboard/account/tokens
# 2. $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
# 3. Run this script from the project root
#
# JWT verification is ON (see supabase/config.toml). Do NOT add
# --no-verify-jwt: both functions perform a service-role database write and
# authenticate() rejects anonymous callers. Disabling gateway verification
# would remove the outer layer of defence for no benefit.
#
# MIGRATION ORDER: apply supabase/migrations/ first. The rate limiter calls
# check_rate_limit(), which does not exist until its migration is applied.

$ErrorActionPreference = "Stop"

$ProjectRef = if ($env:SUPABASE_PROJECT_REF) { $env:SUPABASE_PROJECT_REF } else { "qglvwvpsegrucrhcpzxd" }

# Guard: these functions must never be deployed with gateway JWT
# verification disabled. Fail loudly rather than shipping a regression.
# Matches the flag as a command argument only, so the prose in comments
# explaining why it is banned does not trip the check.
$offenders = Select-String -Path (Join-Path $PSScriptRoot "*.ps*"), "supabase\config.toml" `
  -Pattern '^\s*--no-verify-jwt' -ErrorAction SilentlyContinue
if ($offenders) {
  $offenders | ForEach-Object { Write-Error "$($_.Path):$($_.LineNumber) passes --no-verify-jwt" }
  Write-Error "Both AI functions require authenticated callers. Refusing to deploy."
  exit 1
}

# Push any pending migrations before deploying code that depends on them.
npx supabase db push --project-id $ProjectRef
if ($LASTEXITCODE -ne 0) { throw "migration push failed; not deploying" }

npx supabase functions deploy ask-toolscribe --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw "ask-toolscribe deploy failed" }

npx supabase functions deploy generate-ai-profile --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw "generate-ai-profile deploy failed" }

# Secrets are set once via the dashboard or:
#   npx supabase secrets set OPENROUTER_API_KEY=... GEMINI_API_KEY=... --project-ref $ProjectRef