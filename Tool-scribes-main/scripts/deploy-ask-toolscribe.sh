#!/bin/bash
# 1. Get a Supabase access token: https://supabase.com/dashboard/account/tokens
# 2. Set it as env var or replace below
# 3. Run: bash scripts/deploy-ask-toolscribe.sh

SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_your_token_here}"

npx supabase functions deploy ask-toolscribe \
  --project-ref qglvwvpsegrucrhcpzxd \
  --no-verify-jwt

# Set the Gemini API key (required for the function to work)
npx supabase secrets set GEMINI_API_KEY=your_gemini_api_key \
  --project-ref qglvwvpsegrucrhcpzxd
