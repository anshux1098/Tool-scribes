alter table tools add column if not exists deleted_at timestamptz default null;
alter table collections add column if not exists deleted_at timestamptz default null;

-- Update existing RPCs or queries that fetch tools/collections
-- to add: where deleted_at is null
-- Do NOT delete this data from the DB going forward — set deleted_at = now() instead.
