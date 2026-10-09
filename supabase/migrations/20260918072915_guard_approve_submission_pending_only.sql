-- approve_submission had no status guard, unlike reject_submission, so
-- approving the same submission twice (double-click / retry / race) created
-- DUPLICATE tools. Mirror reject_submission's guard.

CREATE OR REPLACE FUNCTION public.approve_submission(submission_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  sub_record RECORD;
  new_tool_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tool_submissions WHERE id = submission_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Submission not found or already processed';
  END IF;

  SELECT * INTO sub_record FROM tool_submissions WHERE id = submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  -- 1. Insert into tools - makes the tool visible in Discovery
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

  -- 2. Auto-save to submitter's vault - makes the tool appear in their Vault
  IF sub_record.submitted_by IS NOT NULL THEN
    INSERT INTO vault_items (user_id, tool_id)
    VALUES (sub_record.submitted_by, new_tool_id)
    ON CONFLICT (user_id, tool_id) DO NOTHING;
  END IF;

  -- 3. Mark the submission as approved
  UPDATE tool_submissions
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = submission_id;

  RETURN new_tool_id;
END;
$function$;