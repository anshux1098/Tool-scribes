# 1. Get a Supabase access token: https://supabase.com/dashboard/account/tokens
# 2. Run this script from project root

$SUPABASE_ACCESS_TOKEN = "sbp_your_token_here"

npx supabase functions deploy ask-toolscribe `
  --project-ref qglvwvpsegrucrhcpzxd `
  --no-verify-jwt

npx supabase secrets set GEMINI_API_KEY=your_gemini_api_key `
  --project-ref qglvwvpsegrucrhcpzxd
