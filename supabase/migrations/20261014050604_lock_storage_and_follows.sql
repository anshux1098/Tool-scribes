-- ============================================================================
-- Lock down storage buckets, the follow graph, and vault recommendations
--
-- Four HIGH findings from CODE_REVIEW.md, three of which are schema-level.
--
-- 1. Public storage buckets had no limits
--    avatars / banners / collection-covers were all
--    `file_size_limit = null, allowed_mime_types = null`, unlike `screenshots`
--    which was already capped. These buckets are PUBLIC and rendered inside
--    <img> on profile pages, so an HTML or SVG upload is served from the CDN
--    with its own content type -- stored XSS on a first-party origin. An
--    unbounded size limit is also a free storage-abuse vector.
--
--    Capped at 5 MiB to match `screenshots`. Verified before applying: the
--    largest object already in these buckets is 1,478,353 bytes, so nothing
--    existing is affected.
--
-- 2. `collection_followers` was world-readable
--    `cf: public read ... USING (true)` meant anyone, signed in or not, could
--    select every follow row site-wide -- the complete follower graph of every
--    user and every collection, including follows of PRIVATE collections.
--
--    Replaced with a policy that allows:
--      * your own follow rows, always;
--      * follow rows for a collection that is public, or that you own.
--    That is everything the client actually needs (follower counts on public
--    collections, "am I following this", your own follow feed), and nothing
--    more.
--
-- 3. `cf: owner insert` only checked user_id = auth.uid()
--    Nothing required the target collection to be public or yours, so a caller
--    could follow -- and then, via the read above, enumerate -- any private
--    collection UUID.
--
-- 4. `get_vault_recommendations(p_user_id, ...)` took the target user as a
--    parameter with no `= auth.uid()` comparison. It is SECURITY INVOKER and
--    `vault_items` has RLS (`user_id = auth.uid()`), so it was already
--    effectively closed -- the advisory finding was low-sensitivity for that
--    reason. The explicit guard is defence in depth: it keeps the function
--    correct if vault_items RLS is ever relaxed. The only caller,
--    DiscoverPage -> buildVaultRecs(user.id, 6), always passes the caller's own
--    id, so this cannot break it.
-- ============================================================================

-- ─── 1. bucket limits ─────────────────────────────────────────────────────────

update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
 where id in ('avatars', 'banners', 'collection-covers')
   and file_size_limit is null;

-- ─── 2 + 3. collection_followers policies ─────────────────────────────────────

drop policy if exists "cf: public read" on public.collection_followers;

create policy "cf: readable follows" on public.collection_followers
  for select to public
  using (
    user_id = auth.uid()
    or exists (
      select 1
        from public.collections c
       where c.id = collection_followers.collection_id
         and (c.is_public = true or c.user_id = auth.uid())
    )
  );

drop policy if exists "cf: owner insert" on public.collection_followers;

create policy "cf: owner insert" on public.collection_followers
  for insert to public
  with check (
    user_id = auth.uid()
    and exists (
      select 1
        from public.collections c
       where c.id = collection_followers.collection_id
         and (c.is_public = true or c.user_id = auth.uid())
    )
  );

-- ─── 4. get_vault_recommendations guard ───────────────────────────────────────

create or replace function public.get_vault_recommendations(p_user_id uuid, p_limit integer default 12)
returns table(rec_tool_id uuid, reason_type text, score bigint)
language plpgsql
stable
set search_path = public, pg_temp
as $function$
declare
  v_existing uuid[];
begin
  -- SECURITY INVOKER plus RLS on vault_items already restricted this to the
  -- caller, but the parameter should not be trusted on its own merits.
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;

  select coalesce(array_agg(tool_id), '{}'::uuid[]) into v_existing
    from public.vault_items
   where user_id = p_user_id;

  -- Body below is UNCHANGED from the deployed version (all three signals,
  -- same weights, same ordering). Only the guard above is new.
  return query
  -- Signal 1: collaborative filtering (weight 2x)
  select
    vt2.tool_id,
    'collaborative'::text,
    (count(*)::bigint * 2) as score
  from public.vault_items vt1
  join public.vault_items vt2
    on vt1.user_id = vt2.user_id and vt2.tool_id <> vt1.tool_id
  where vt1.tool_id = any(v_existing)
    and not (vt2.tool_id = any(v_existing))
  group by vt2.tool_id

  union all

  -- Signal 2: from followed collections
  select distinct
    ct.tool_id,
    'collection'::text,
    1::bigint as score
  from public.collection_followers cf
  join public.collection_tools ct on cf.collection_id = ct.collection_id
  where cf.user_id = p_user_id
    and not (ct.tool_id = any(v_existing))

  union all

  -- Signal 3: tools added by followed curators
  select distinct
    t.id,
    'curator'::text,
    1::bigint as score
  from public.follows f
  join public.tools t on t.added_by = f.following_id
  where f.follower_id = p_user_id
    and not (t.id = any(v_existing))

  order by score desc
  limit p_limit;
end;
$function$;

comment on function public.get_vault_recommendations(uuid, integer) is
  'Vault-derived recommendations for the CALLING user only. Previously took the target user as a parameter with no auth.uid() comparison; RLS on vault_items limited the impact, this makes it explicit.';