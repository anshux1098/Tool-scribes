-- ============================================================================
-- Stop cross-account collection cloning and email enumeration (#8, #10)
--
-- Two SECURITY DEFINER functions the Supabase advisor flags as callable by
-- anon. Both take an identity from the caller and trust it.
--
-- #8 -- clone_public_collection(source_collection_id, target_user_id)
--   The owner was a PARAMETER, and the only validation was that the source
--   collection is public:
--
--     insert into collections (user_id, ...)
--     select target_user_id, name || ' (copy)', ...
--
--   So any caller could create collections owned by somebody else. Fixed by
--   deriving the owner from auth.uid() instead. The old two-argument signature
--   is kept as a wrapper that IGNORES its target_user_id argument entirely, so
--   a not-yet-migrated caller that still passes someone else's id gets its own
--   collection rather than writing into another account. Callers should
--   migrate to the one-argument form.
--
-- #10 -- get_creator_email(collection_id) / get_submitter_email(submission_id)
--   Both read auth.users.email with no authorization check and no
--   REVOKE FROM anon, so anyone could enumerate every user's email address by
--   iterating collection/submission UUIDs. REVOKE alone does not fix it --
--   they are SECURITY DEFINER, so an authenticated caller would still get
--   them. Each now also checks the caller is signed in and is the owner (or a
--   moderator/admin), so the data is not readable by anyone else.
--
-- Verified before writing this: both email functions and
-- clone_public_collection reported anon_exec = true.
-- ============================================================================

-- ─── #8: the clone RPC ───────────────────────────────────────────────────────

-- New canonical signature. Owner is always the caller.
CREATE OR REPLACE FUNCTION public.clone_public_collection(p_source_collection_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
declare
  v_uid uuid := auth.uid();
  v_new_collection_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from collections
     where id = p_source_collection_id and is_public = true
  ) then
    raise exception 'Collection not found or is not public';
  end if;

  insert into collections (user_id, name, description, is_public, cover_image_url)
  select v_uid, name || ' (copy)', description, false, cover_image_url
    from collections
   where id = p_source_collection_id
  returning id into v_new_collection_id;

  insert into collection_tools (collection_id, tool_id)
  select v_new_collection_id, tool_id
    from collection_tools
   where collection_id = p_source_collection_id;

  update collections set clone_count = clone_count + 1
   where id = p_source_collection_id;

  return v_new_collection_id;
end;
$function$;

-- Legacy two-argument form. target_user_id is deliberately ignored so any
-- caller still passing someone else's id gets their OWN collection instead.
-- Clients must migrate to clone_public_collection(p_source_collection_id).
--
-- Parameter names must stay exactly as they were: CREATE OR REPLACE refuses to
-- rename an input parameter (ERROR 42P13), so these are source_collection_id /
-- target_user_id, not the p_-prefixed names used by the new signature.
CREATE OR REPLACE FUNCTION public.clone_public_collection(
  source_collection_id uuid,
  target_user_id uuid
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  select public.clone_public_collection(source_collection_id);
$function$;

revoke execute on function public.clone_public_collection(uuid) from public, anon;
grant  execute on function public.clone_public_collection(uuid) to authenticated;
revoke execute on function public.clone_public_collection(uuid, uuid) from public, anon;
grant  execute on function public.clone_public_collection(uuid, uuid) to authenticated;

comment on function public.clone_public_collection(uuid) is
  'Clones a public collection into the calling user account. Owner is derived from auth.uid(); there is no owner parameter.';
comment on function public.clone_public_collection(uuid, uuid) is
  'DEPRECATED wrapper -- the second argument (target_user_id) is IGNORED and the clone always belongs to the caller. Kept so un-migrated callers fail safe rather than erroring. Use the one-argument form.';

-- ─── #10: email enumeration ──────────────────────────────────────────────────

-- Parameter names unchanged from the deployed versions; CREATE OR REPLACE
-- cannot rename input parameters (ERROR 42P13).
CREATE OR REPLACE FUNCTION public.get_creator_email(collection_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_email text;
begin
  -- Anonymous callers previously got any email here.
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select user_id into v_owner from collections where id = collection_id;
  if v_owner is null then
    raise exception 'No such collection';
  end if;

  -- Only the owner, or staff, may see the address. This is the check that was
  -- missing; the REVOKE below only closes the anonymous door.
  if v_owner <> v_uid and not (is_moderator() or is_admin()) then
    raise exception 'Not authorized';
  end if;

  select email into v_email from auth.users where id = v_owner;
  return v_email;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_submitter_email(submission_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
declare
  v_uid uuid := auth.uid();
  v_submitter uuid;
  v_email text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select submitted_by into v_submitter from tool_submissions where id = submission_id;
  if v_submitter is null then
    raise exception 'No such submission';
  end if;

  if v_submitter <> v_uid and not (is_moderator() or is_admin()) then
    raise exception 'Not authorized';
  end if;

  select email into v_email from auth.users where id = v_submitter;
  return v_email;
end;
$function$;

revoke execute on function public.get_creator_email(uuid) from public, anon;
grant  execute on function public.get_creator_email(uuid) to authenticated;
revoke execute on function public.get_submitter_email(uuid) from public, anon;
grant  execute on function public.get_submitter_email(uuid) to authenticated;

comment on function public.get_creator_email(uuid) is
  'Email of a collection owner. Restricted to that owner and staff. Previously readable by anyone, including anonymous callers.';
comment on function public.get_submitter_email(uuid) is
  'Email of a tool submitter. Restricted to that submitter and staff. Previously readable by anyone, including anonymous callers.';
