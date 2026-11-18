-- Brand every plain (non-DOCTYPE) email_body_template:
-- - gradient CTA buttons for bare <a href="...">Label</a>
-- - readable paragraph styles for bare <p>
-- Full HTML templates already carry their own chrome and are left unchanged.
-- Runtime wrapEmailHtml / enhanceFragmentContent also styles fragments at send time.

UPDATE public.notification_templates
SET
  email_body_template = regexp_replace(
    regexp_replace(
      email_body_template,
      -- Bare paragraph open tags → branded body copy
      '<p>',
      '<p style="margin:0 0 14px;color:#5c5c6e;font-size:15px;line-height:1.7;">',
      'gi'
    ),
    -- Bare CTA links (href only, no style attr) → centered gradient pill
    '<a href="([^"]+)">([^<]+)</a>',
    '<div style="text-align:center;margin:24px 0 8px;"><a href="\1" style="display:inline-block;background:linear-gradient(135deg,#D81B60 0%,#FF5E9B 50%,#FF8C42 100%);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:50px;box-shadow:0 4px 14px rgba(216,27,96,0.35);letter-spacing:0.3px;">\2</a></div>',
    'gi'
  ),
  updated_at = now()
WHERE coalesce(email_body_template, '') <> ''
  AND position('<!DOCTYPE' in upper(email_body_template)) = 0
  AND position('<html' in lower(email_body_template)) = 0;
