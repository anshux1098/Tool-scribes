-- ============================================================================
-- Fix toggle_upvote: it could only ever REMOVE a vote, never add one
--
-- Bug in 20261009192643, caught by probing the function before shipping it.
--
--   delete from public.upvotes
--     where user_id = v_uid and tool_id = p_tool_id
--     returning 1 into v_deleted;
--
--   if v_deleted = 0 then
--     insert into public.upvotes ...
--
-- In plpgsql, an INTO target fed by a statement that returns ZERO rows is set
-- to NULL -- the ":= 0" initialiser is overwritten, not preserved. So tapping
-- an un-upvoted tool left v_deleted NULL, `v_deleted = 0` evaluated to NULL
-- (falsy in plpgsql), and the INSERT was skipped entirely.
--
-- Observed directly:
--
--   step   upvoted  returned  stored
--   tap 1  null     0         0
--   tap 2  null     0         0
--
-- The upvote feature was completely dead in the up direction: every call was
-- a no-op, and a tool that had never been voted on could never receive its
-- first vote. Removing a vote happened to work, because a matching DELETE
-- does set v_deleted to 1.
--
-- Fix: ROW_COUNT is 0 for a zero-row DELETE, which is the semantics the
-- branch actually wants. RETURNING cannot express "matched nothing" as a
-- value, only as the absence of a row.
--
-- The counter derivation, the FOR UPDATE serialisation, the search_path
-- pinning and the grants are all unchanged and still correct.
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

  -- Read-and-delete in one statement, so there is no window between "do I
  -- have a vote?" and "remove it" for a concurrent request to slip through.
  --
  -- ROW_COUNT, not RETURNING INTO: a zero-row DELETE has no row to return,
  -- and RETURNING INTO would leave v_deleted NULL instead of 0.
  delete from public.upvotes
    where user_id = v_uid and tool_id = p_tool_id;
  get diagnostics v_deleted = row_count;

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
