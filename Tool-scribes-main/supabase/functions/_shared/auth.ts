// ─── Caller authentication for edge functions ─────────────────
//
// These functions use SUPABASE_SERVICE_ROLE_KEY to reach PostgREST, which
// bypasses RLS entirely. That makes verifying the caller here the ONLY
// thing standing between an anonymous request and a privileged write.
// Never add a service-role write without calling authenticate() first.

export interface Caller {
  userId: string;
  isAdmin: boolean;
  isModerator: boolean;
}

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

/** Pull the bearer token out of the Authorization header. */
function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Resolves the caller from the request's JWT.
 * Returns null when the token is absent, malformed, expired, or unknown.
 */
export async function authenticate(req: Request): Promise<Caller | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const supabaseUrl = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

  // Validate the JWT against the auth server using the service key as the
  // apikey. This does not "use" the service key for data access — it only
  // lets us verify the presented token.
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return null;

  const user = await userRes.json();
  const userId = user?.id as string | undefined;
  if (!userId) return null;

  // Role checks run as the CALLER (their own bearer token), so auth.uid()
  // resolves correctly inside is_admin()/is_moderator(). Using the service
  // key here would make every request look privileged.
  const callRoleRpc = async (fn: "is_admin" | "is_moderator") => {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      if (!res.ok) return false;
      return (await res.json()) === true;
    } catch {
      // Fail closed: an unreachable role check means no privilege.
      return false;
    }
  };

  return {
    userId,
    isAdmin: await callRoleRpc("is_admin"),
    isModerator: await callRoleRpc("is_moderator"),
  };
}