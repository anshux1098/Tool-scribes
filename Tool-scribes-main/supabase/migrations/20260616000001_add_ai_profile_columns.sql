-- Add AI profile columns to tools
ALTER TABLE tools ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS best_for text[];
ALTER TABLE tools ADD COLUMN IF NOT EXISTS strengths text[];
ALTER TABLE tools ADD COLUMN IF NOT EXISTS limitations text[];
ALTER TABLE tools ADD COLUMN IF NOT EXISTS pricing_notes text;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS learning_curve text;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS beginner_friendly boolean;

-- Add AI profile columns to tool_submissions
ALTER TABLE tool_submissions ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE tool_submissions ADD COLUMN IF NOT EXISTS best_for text[];
ALTER TABLE tool_submissions ADD COLUMN IF NOT EXISTS strengths text[];
ALTER TABLE tool_submissions ADD COLUMN IF NOT EXISTS limitations text[];
ALTER TABLE tool_submissions ADD COLUMN IF NOT EXISTS pricing_notes text;
ALTER TABLE tool_submissions ADD COLUMN IF NOT EXISTS learning_curve text;
ALTER TABLE tool_submissions ADD COLUMN IF NOT EXISTS beginner_friendly boolean;

-- Add missing feature columns to tool_submissions
ALTER TABLE tool_submissions ADD COLUMN IF NOT EXISTS is_free boolean default true;
ALTER TABLE tool_submissions ADD COLUMN IF NOT EXISTS platforms text[] default '{web}';
ALTER TABLE tool_submissions ADD COLUMN IF NOT EXISTS signup_required boolean default false;

-- Must drop before recreating with different return types
DROP FUNCTION IF EXISTS get_submissions_for_review();
DROP FUNCTION IF EXISTS approve_submission(uuid);

-- Updated get_submissions_for_review with ai_summary + feature fields
CREATE OR REPLACE FUNCTION get_submissions_for_review()
RETURNS TABLE(
  id UUID, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, status TEXT,
  url TEXT, normalized_domain TEXT, title TEXT, description TEXT,
  category TEXT, icon TEXT, favicon TEXT, og_image TEXT,
  screenshot_url TEXT,
  submitted_by UUID, reviewed_by UUID, reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT, matched_tool_id UUID,
  submitter_email TEXT,
  ai_summary TEXT,
  is_free BOOLEAN, platforms TEXT[], signup_required BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT
      s.id, s.created_at, s.updated_at, s.status,
      s.url, s.normalized_domain, s.title, s.description,
      s.category, s.icon, s.favicon, s.og_image,
      s.screenshot_url,
      s.submitted_by, s.reviewed_by, s.reviewed_at,
      s.rejection_reason, s.matched_tool_id,
      u.email::TEXT,
      s.ai_summary,
      s.is_free, s.platforms, s.signup_required
    FROM tool_submissions s
    LEFT JOIN auth.users u ON u.id = s.submitted_by
    ORDER BY s.created_at DESC;
END;
$$;

-- Real approve_submission: copies submission→tool incl. ai_summary + feature columns
CREATE OR REPLACE FUNCTION approve_submission(submission_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  sub_record RECORD;
  new_tool_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO sub_record FROM tool_submissions WHERE id = submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  INSERT INTO tools (
    name, url, description, category, icon, favicon, og_image, screenshot_url,
    price_model, is_open_source, requires_login,
    is_free, platforms, signup_required,
    added_by,
    ai_summary
  ) VALUES (
    sub_record.title, sub_record.url, sub_record.description, sub_record.category,
    sub_record.icon, sub_record.favicon, sub_record.og_image, sub_record.screenshot_url,
    'free', FALSE, FALSE,
    sub_record.is_free, sub_record.platforms, sub_record.signup_required,
    sub_record.submitted_by,
    sub_record.ai_summary
  )
  RETURNING id INTO new_tool_id;

  UPDATE tool_submissions
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = submission_id;

  RETURN new_tool_id;
END;
$$;
