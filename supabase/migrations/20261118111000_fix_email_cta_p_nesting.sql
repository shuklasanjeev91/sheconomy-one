-- Unwrap CTA divs incorrectly nested inside <p> from the prior fragment branding pass.
UPDATE public.notification_templates
SET
  email_body_template = regexp_replace(
    email_body_template,
    '<p[^>]*>[[:space:]]*(<div style="text-align:center;margin:24px 0 8px;"><a href="[^"]+" style="[^"]+">[^<]*</a></div>)[[:space:]]*</p>',
    '\1',
    'gi'
  ),
  updated_at = now()
WHERE coalesce(email_body_template, '') <> ''
  AND position('text-align:center;margin:24px 0 8px;' in email_body_template) > 0
  AND position('<!DOCTYPE' in upper(email_body_template)) = 0;
