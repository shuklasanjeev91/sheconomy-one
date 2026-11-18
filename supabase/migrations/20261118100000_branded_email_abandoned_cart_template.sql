-- Fix abandoned-cart email copy/vars. Branded chrome is applied at send time
-- via supabase/functions/_shared/email-layout.ts (wrapEmailHtml).

UPDATE public.notification_templates
SET
  email_subject_template = 'Your SHEconomy cart is waiting',
  email_body_template = $html$
<p>Hi {{customer_name}},</p>
<p>Your cart with {{item_count}} item(s) ({{cart_total}}) is still waiting.</p>
<p><a href="{{action_url}}" style="display:inline-block;margin-top:8px;padding:12px 20px;background:#D81B60;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;">Return to cart</a></p>
$html$,
  push_title_template = COALESCE(NULLIF(push_title_template, ''), 'Items waiting in your cart'),
  push_body_template = COALESCE(
    NULLIF(push_body_template, ''),
    '{{item_count}} item(s) · {{cart_total}}. Tap to finish checkout.'
  ),
  whatsapp_template = COALESCE(
    NULLIF(whatsapp_template, ''),
    'Hi {{customer_name}}! You left {{item_count}} item(s) ({{cart_total}}) in your SHEconomy cart. Complete checkout: {{action_url}}'
  ),
  action_url_template = COALESCE(NULLIF(action_url_template, ''), '/cart'),
  updated_at = now()
WHERE template_key = 'cart_abandoned_customer';
