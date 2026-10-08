-- ============================================================================
-- Database-backed rate limiting for the AI edge functions
--
-- Root cause: the edge functions kept rate-limit counters in an in-process
-- Map. That is not a rate limit in practice:
--   * edge functions run many horizontally-scaled containers, so the real
--     ceiling was "containers x 10/minute", and a cold route handed out a
--     fresh bucket;
--   * the key was x-forwarded-for, a header the client sets freely, so
--     rotating it per request defeated the limit entirely;
--   * a setInterval kept the isolate alive purely for cleanup, billing CPU
--     for no benefit.
--
-- Counters now live here, keyed on a server-derived identifier (the
-- authenticated user id, resolved by _shared/auth.ts). The increment is a
-- single atomic upsert so concurrent requests from one user cannot race past
-- the limit.
--
-- The function is only executable by service_role, so the key is trusted to
-- be server-derived. authenticated/anon cannot call it directly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- No policies on purpose: the table is unreachable directly and is only
-- mutated through the SECURITY DEFINER function below, which service_role
-- calls exclusively.

CREATE INDEX IF NOT EXISTS rate_limit_counters_window_idx
  ON public.rate_limit_counters (window_started_at);

-- Atomically count one request and report whether it is within budget.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_limit integer DEFAULT 10,
  p_window_seconds integer DEFAULT 60
)
RETURNS TABLE(allowed boolean, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
declare
  v_count integer;
  v_window_started_at timestamptz;
  v_window_seconds integer := greatest(coalesce(p_window_seconds, 60), 1);
  v_limit integer := greatest(coalesce(p_limit, 10), 1);
begin
  if p_key is null or p_key = '' then
    raise exception 'Rate limit key is required';
  end if;

  -- Reset the counter once the window has elapsed, otherwise increment it.
  -- Done as a single upsert so two concurrent requests cannot both read the
  -- pre-increment value and both be admitted.
  insert into public.rate_limit_counters as c (key, count, window_started_at)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
                  when c.window_started_at <= now() - make_interval(secs => v_window_seconds)
                    then 1
                  else c.count + 1
                end,
        window_started_at = case
                  when c.window_started_at <= now() - make_interval(secs => v_window_seconds)
                    then now()
                  else c.window_started_at
                end
  returning c.count, c.window_started_at into v_count, v_window_started_at;

  return query
    select
      v_count <= v_limit,
      case
        when v_count <= v_limit then null
        else greatest(
          1,
          ceil(extract(epoch from (
            v_window_started_at + make_interval(secs => v_window_seconds) - now()
          )))::integer
        )
      end;
end;
$function$;

-- Only the edge functions (service_role) may call this. authenticated and
-- anon have no legitimate reason to, and a direct caller could otherwise
-- probe or poison another user's counter.
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- Opportunistic cleanup of expired windows, so the table tracks active
-- callers rather than growing forever. Cheap: bounded by the index above.
CREATE OR REPLACE FUNCTION public.prune_rate_limit_counters()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
declare
  v_removed integer;
begin
  delete from public.rate_limit_counters
    where window_started_at <= now() - interval '1 hour';
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$function$;

revoke execute on function public.prune_rate_limit_counters() from public, anon, authenticated;
grant execute on function public.prune_rate_limit_counters() to service_role;