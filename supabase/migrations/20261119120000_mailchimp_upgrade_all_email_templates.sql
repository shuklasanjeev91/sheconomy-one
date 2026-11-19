-- Upgrade every active notification email body to a Mailchimp-style fragment:
-- eyebrow + h1 hero + body + CTA + trust strip.
-- Outer chrome is still applied at send time via wrapEmailHtml.

CREATE OR REPLACE FUNCTION public.mailchimp_email_eyebrow(p_category text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE lower(COALESCE(p_category, ''))
    WHEN 'transactional' THEN 'Order update'
    WHEN 'promotional' THEN 'For you'
    WHEN 'social' THEN 'Community'
    WHEN 'system' THEN 'Account'
    WHEN 'onboarding' THEN 'Getting started'
    WHEN 'verification' THEN 'Verification'
    WHEN 'security' THEN 'Security'
    WHEN 'messages' THEN 'Messages'
    WHEN 'calls' THEN 'Calls'
    WHEN 'co-work' THEN 'Co-Work'
    WHEN 'class' THEN 'Classes'
    ELSE 'SHEconomy'
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.mailchimp_strip_emoji(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  -- Keep copy readable in heroes; strip common symbol/emoji blocks without surrogate literals.
  SELECT trim(both from regexp_replace(
    COALESCE(p_text, ''),
    '[⚠✅❌🚀🎉📦✏️❤️👍💬📣👥↩️⏰👋📹🎥📅🔒🏷️🛍️🎁🏁✏️⏸️⚠️📦]+',
    '',
    'g'
  ));
$fn$;

CREATE OR REPLACE FUNCTION public.build_mailchimp_email_fragment(
  p_eyebrow text,
  p_headline text,
  p_body_html text,
  p_cta_label text DEFAULT NULL,
  p_cta_url text DEFAULT NULL,
  p_banner_html text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  v_html text := '';
  v_headline text := NULLIF(trim(both from COALESCE(p_headline, '')), '');
  v_body text := trim(both from COALESCE(p_body_html, ''));
  v_cta_label text := NULLIF(trim(both from COALESCE(p_cta_label, '')), '');
  v_cta_url text := NULLIF(trim(both from COALESCE(p_cta_url, '')), '');
BEGIN
  IF COALESCE(p_banner_html, '') <> '' THEN
    v_html := v_html || p_banner_html;
  END IF;

  v_html := v_html
    || '<p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#D81B60;text-transform:uppercase;letter-spacing:1.6px;">'
    || COALESCE(NULLIF(trim(both from p_eyebrow), ''), 'SHEconomy')
    || '</p>';

  IF v_headline IS NOT NULL THEN
    v_html := v_html
      || '<h1 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;letter-spacing:-0.3px;">'
      || v_headline
      || '</h1>';
  END IF;

  IF v_body <> '' THEN
    v_html := v_html || v_body;
  END IF;

  IF v_cta_url IS NOT NULL AND v_cta_label IS NOT NULL
     AND position(lower(v_cta_url) in lower(v_body)) = 0 THEN
    v_html := v_html
      || '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:22px 0 8px;"><tr><td align="center">'
      || '<a href="' || v_cta_url || '" style="display:inline-block;background:linear-gradient(135deg,#D81B60 0%,#FF5E9B 50%,#FF8C42 100%);color:#ffffff;font-weight:800;font-size:15px;text-decoration:none;padding:15px 36px;border-radius:50px;box-shadow:0 6px 18px rgba(216,27,96,0.30);letter-spacing:0.2px;">'
      || v_cta_label
      || '</a></td></tr></table>';
  END IF;

  IF position('Women-led brands' in v_html) = 0 THEN
    v_html := v_html
      || '<p style="margin:14px 0 0;text-align:center;font-size:12px;color:#9ca3af;line-height:1.5;">Secure checkout · Women-led brands · Easy returns</p>';
  END IF;

  RETURN v_html;
END;
$fn$;

DO $$
DECLARE
  r RECORD;
  v_body text;
  v_eyebrow text;
  v_headline text;
  v_has_heading boolean;
  v_has_trust boolean;
  v_next text;
BEGIN
  FOR r IN
    SELECT
      id,
      template_key,
      category,
      title_template,
      message_template,
      email_body_template,
      action_button_text,
      action_url_template
    FROM public.notification_templates
    WHERE is_active = true
  LOOP
    -- Keep the already redesigned abandoned-cart hero as-is (just ensure trust).
    IF r.template_key = 'cart_abandoned_customer' THEN
      CONTINUE;
    END IF;

    v_body := COALESCE(r.email_body_template, '');
    v_eyebrow := public.mailchimp_email_eyebrow(r.category);
    v_headline := public.mailchimp_strip_emoji(COALESCE(r.title_template, ''));
    -- Prefer a short headline; fall back to template key words.
    IF v_headline = '' THEN
      v_headline := initcap(replace(r.template_key, '_', ' '));
    END IF;

    v_has_heading := v_body ~* '<h1|<h2';
    v_has_trust := position('Women-led brands' in v_body) > 0
      OR position('Secure checkout' in v_body) > 0;

    -- 1) Empty body → build full Mailchimp fragment from title/message/CTA.
    IF trim(both from v_body) = '' THEN
      v_next := public.build_mailchimp_email_fragment(
        v_eyebrow,
        v_headline,
        CASE
          WHEN COALESCE(r.message_template, '') <> '' THEN
            '<p style="margin:0 0 14px;color:#5c5c6e;font-size:15px;line-height:1.7;">'
            || r.message_template
            || '</p>'
          ELSE ''
        END,
        COALESCE(NULLIF(r.action_button_text, ''), 'Open SHEconomy'),
        NULLIF(r.action_url_template, '')
      );
      UPDATE public.notification_templates
      SET email_body_template = v_next,
          email_subject_template = COALESCE(
            NULLIF(email_subject_template, ''),
            public.mailchimp_strip_emoji(COALESCE(title_template, template_key))
          ),
          updated_at = now()
      WHERE id = r.id;
      CONTINUE;
    END IF;

    -- 2) Bodies without a hero heading → prepend eyebrow + h1, keep body, add trust/CTA.
    IF NOT v_has_heading THEN
      v_next := public.build_mailchimp_email_fragment(
        v_eyebrow,
        v_headline,
        v_body,
        CASE
          WHEN position('{{action_url}}' in v_body) > 0
            OR position('linear-gradient(135deg,#D81B60' in v_body) > 0 THEN NULL
          ELSE COALESCE(NULLIF(r.action_button_text, ''), 'Open SHEconomy')
        END,
        CASE
          WHEN position('{{action_url}}' in v_body) > 0
            OR position('linear-gradient(135deg,#D81B60' in v_body) > 0 THEN NULL
          ELSE NULLIF(r.action_url_template, '')
        END
      );
      UPDATE public.notification_templates
      SET email_body_template = v_next, updated_at = now()
      WHERE id = r.id;
      CONTINUE;
    END IF;

    -- 3) Existing branded fragments → promote h2→h1, tighten eyebrow, append trust.
    v_next := v_body;
    v_next := regexp_replace(v_next, '<h2(\s|>)', '<h1\1', 'gi');
    v_next := regexp_replace(v_next, '</h2>', '</h1>', 'gi');
    v_next := regexp_replace(
      v_next,
      '<h1([^>]*)style="[^"]*"',
      '<h1\1style="margin:0 0 12px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;letter-spacing:-0.3px;"',
      'gi'
    );
    v_next := regexp_replace(
      v_next,
      'letter-spacing:1\.5px',
      'letter-spacing:1.6px',
      'gi'
    );
    v_next := regexp_replace(
      v_next,
      'font-weight:700;color:#D81B60;text-transform:uppercase',
      'font-weight:800;color:#D81B60;text-transform:uppercase',
      'gi'
    );

    IF NOT v_has_trust THEN
      v_next := v_next
        || E'\n<p style="margin:14px 0 0;text-align:center;font-size:12px;color:#9ca3af;line-height:1.5;">Secure checkout · Women-led brands · Easy returns</p>';
    END IF;

    IF v_next IS DISTINCT FROM v_body THEN
      UPDATE public.notification_templates
      SET email_body_template = v_next, updated_at = now()
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- Align checkout abandoned with the cart Mailchimp pattern (already mostly upgraded).
UPDATE public.notification_templates
SET
  email_subject_template = COALESCE(
    NULLIF(email_subject_template, ''),
    'Complete your SHEconomy checkout'
  ),
  updated_at = now()
WHERE template_key = 'checkout_abandoned_customer';

COMMENT ON FUNCTION public.build_mailchimp_email_fragment(text, text, text, text, text, text) IS
  'Builds a Mailchimp-style email body fragment (eyebrow, h1, body, CTA, trust).';
