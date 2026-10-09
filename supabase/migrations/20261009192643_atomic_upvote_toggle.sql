-- ============================================================================
-- Close the decrement hole in the upvote counter (finding #7)
--
-- increment_upvote(tool_id, delta) validated delta in (-1, 1) and checked that
-- the caller held an upvote row -- but ONLY to reject delta = 1:
--
--   if not exists (select 1 from upvotes where user_id = auth.uid() ...) then
--     if delta = 1 then
--       raise exception 'No upvote exists to increment';
--     end if;
--   end if;
--   update tools set upvotes = upvotes + delta where id = tool_id;
--
-- So a caller with no upvote row could pass delta = -1 in a loop and drive any
-- tool's counter negative. The client made this trivial: toggleUpvote DELETES
-- the upvote row first and only then calls the RPC with -1, so the RPC always
-- saw the exact state its guard was supposed to reject.
--
-- Two separate defects, actually:
--
--   1. The counter was INCREMENTED. Every increment is a chance to drift --
--      if the row insert succeeded and the RPC failed, or vice versa, the
--      stored total permanently disagrees with count(*) in upvotes, and there
--      is no reconciliation anywhere. The client's two round-trips were not in
--      a transaction.
--   2. The ownership guard was conditional on delta.
--
-- Both are removed by deriving the counter instead of adjusting it, and by
-- deleting the delta parameter so there is nothing to forge.
--
-- Migration 20261009192135 already closed the client-side write path, so this
-- was the only remaining way to forge tools.upvotes.
--
-- `upvotes` carries UNIQUE (user_id, tool_id), so count(*) is a sound source
-- of truth and one user can hold at most one vote per tool.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.toggle_upvote(p_tool_id uuid)
RETURNS TABLE(upvoted boolean, upvotes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
declare
  v_uid uuid := auth.uid();
  v_deleted integer := 0;
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_tool_id is null then
    raise exception 'Tool id is required';
  end if;

  -- Serialise concurrent toggles on this tool, so two simultaneous requests
  -- cannot each compute a count that the other then overwrites.
  perform 1 from tools where id = p_tool_id for update;
  if not found then
    raise exception 'No such tool: %', p_tool_id;
  end if;

  -- Read-and-delete in one statement. RETURNING makes the decision atomic,
  -- so there is no window between "do I have a vote?" and "remove it" for a
  -- concurrent request to slip through.
  delete from public.upvotes
    where user_id = v_uid and tool_id = p_tool_id
    returning 1 into v_deleted;

  -- v_deleted = 0 means there was no row, so this tap is an upvote.
  if v_deleted = 0 then
    insert into public.upvotes (user_id, tool_id)
      values (v_uid, p_tool_id)
      on conflict (user_id, tool_id) do nothing;
  end if;

  -- Derive, never adjust. The counter is now a pure function of the upvotes
  -- table, so it cannot go negative, cannot drift, and self-heals on the next
  -- toggle for that tool.
  select count(*)::integer into v_count
    from public.upvotes where tool_id = p_tool_id;

  update tools set upvotes = v_count where id = p_tool_id;

  return query select (v_deleted = 0), v_count;
end;
$function$;

-- Authenticated users must be able to call it; that is the entire point.
revoke execute on function public.toggle_upvote(uuid) from public, anon;
grant execute on function public.toggle_upvote(uuid) to authenticated;

-- Retire increment_upvote. With the client now calling toggle_upvote it has no
-- callers, and leaving it executable would leave the decrement hole open
-- through the back door. The function body is kept so the history stays
-- readable, but it is no longer reachable from the API.
revoke execute on function public.increment_upvote(uuid, integer) from public, anon, authenticated;

comment on function public.toggle_upvote(uuid) is
  'Atomic upvote toggle. Derives tools.upvotes from count(*) in upvotes rather than incrementing it. Replaces increment_upvote, which could be used to drive any counter negative.';
comment on function public.increment_upvote(uuid, integer) is
  'RETIRED -- no longer executable by any API role. Its ownership guard only rejected delta = 1, so a caller with no upvote row could pass delta = -1 repeatedly. Use toggle_upvote().';
