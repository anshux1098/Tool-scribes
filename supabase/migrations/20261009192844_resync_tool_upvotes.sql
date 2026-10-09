-- ============================================================================
-- Resync tools.upvotes from the upvotes table
--
-- Data repair for the drift the old increment-based design allowed.
--
-- toggleUpvote used to run two independent round-trips: write the upvote row
-- from the client, then call increment_upvote(tool_id, delta) to bump the
-- stored counter. Nothing tied them together, so whenever the second call
-- failed or was rejected, the row survived and the counter did not move. There
-- was no reconciliation anywhere in the codebase, so the disagreement was
-- permanent.
--
-- toggle_upvote() (migration 20261009200136) derives the counter from
-- count(*) instead of adjusting it, so drift can no longer be created. But the
-- drift already in the table has to be corrected once, and a single resync is
-- cheaper and more honest than waiting for each tool to be toggled.
--
-- Scanned before writing this: 4 tools disagree, all of them UNDERCOUNTED
-- (a vote row exists, stored = 0):
--
--   Raycast - Your shortcut to everything   stored 0, actual 2
--   NotebookLM                              stored 0, actual 2
--   Notion                                  stored 0, actual 1
--   Google AI Studio                        stored 0, actual 1
--
-- No tool had a negative counter, which is reassuring given finding #7 -- the
-- decrement hole was exploitable but had not been used.
--
-- Idempotent: recomputing from count(*) twice is a no-op the second time.
-- ============================================================================

UPDATE public.tools t
   SET upvotes = coalesce(u.n, 0)
  FROM (select tool_id, count(*)::integer as n
          from public.upvotes
         group by tool_id) u
 WHERE u.tool_id = t.id
   and t.upvotes <> u.n;

-- Tools with no votes at all must be zero, not whatever was left behind.
UPDATE public.tools t
   SET upvotes = 0
 WHERE t.upvotes <> 0
   and not exists (select 1 from public.upvotes u where u.tool_id = t.id);
