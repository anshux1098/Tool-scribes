ALTER TABLE tools DROP COLUMN IF EXISTS ai_profile_version;
ALTER TABLE tools ADD COLUMN ai_profile_version integer DEFAULT 1;

ALTER TABLE tool_submissions DROP COLUMN IF EXISTS ai_profile_version;
ALTER TABLE tool_submissions ADD COLUMN ai_profile_version integer DEFAULT 1;

DROP FUNCTION IF EXISTS approve_submission(uuid);

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
    ai_summary, ai_profile_generated_at, ai_profile_version
  ) VALUES (
    sub_record.title, sub_record.url, sub_record.description, sub_record.category,
    sub_record.icon, sub_record.favicon, sub_record.og_image, sub_record.screenshot_url,
    'free', FALSE, FALSE,
    sub_record.is_free, sub_record.platforms, sub_record.signup_required,
    sub_record.submitted_by,
    sub_record.ai_summary, sub_record.ai_profile_generated_at, sub_record.ai_profile_version
  )
  RETURNING id INTO new_tool_id;

  UPDATE tool_submissions
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = submission_id;

  RETURN new_tool_id;
END;
$$;
