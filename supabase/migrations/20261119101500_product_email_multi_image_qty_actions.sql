-- App-wide product email cards: multi-image strip, Buy now / Add to cart, qty ±.

CREATE OR REPLACE FUNCTION public.build_listing_images_email_strip(
  p_listing_id uuid,
  p_listing_url text,
  p_fallback_image text DEFAULT NULL,
  p_limit integer DEFAULT 4
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_html text := '';
  v_count integer := 0;
  r RECORD;
  v_placeholder text := COALESCE(
    NULLIF(p_fallback_image, ''),
    'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/sheconomy-logo/1024X1024.png'
  );
BEGIN
  IF p_listing_id IS NULL THEN
    RETURN '';
  END IF;

  FOR r IN
    SELECT li.image_url
    FROM public.listing_images li
    WHERE li.listing_id = p_listing_id
      AND COALESCE(li.image_url, '') <> ''
    ORDER BY li.is_primary DESC, li.display_order ASC, li.created_at ASC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_count := v_count + 1;
    v_html := v_html || format(
      $img$
<td align="center" valign="middle" style="padding:0 4px 0 0;">
  <a href="%s" style="text-decoration:none;border:0;">
    <img src="%s" alt="" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:cover;border-radius:10px;border:1px solid #f3d6e3;" />
  </a>
</td>
$img$,
      public.escape_html_text(p_listing_url),
      public.escape_html_text(r.image_url)
    );
  END LOOP;

  IF v_count = 0 THEN
    v_html := format(
      $img$
<td align="center" valign="middle" style="padding:0 4px 0 0;">
  <a href="%s" style="text-decoration:none;border:0;">
    <img src="%s" alt="" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:cover;border-radius:10px;border:1px solid #f3d6e3;" />
  </a>
</td>
$img$,
      public.escape_html_text(p_listing_url),
      public.escape_html_text(v_placeholder)
    );
  END IF;

  RETURN format(
    $wrap$
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;">
  <tr>%s</tr>
</table>
$wrap$,
    v_html
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.build_listing_images_email_strip(uuid, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_listing_images_email_strip(uuid, text, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.build_listing_promo_email_html(
  p_listing_id uuid,
  p_app_base text DEFAULT 'https://www.sheconomy.in',
  p_currency text DEFAULT 'INR',
  p_price numeric DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_base text := rtrim(COALESCE(NULLIF(p_app_base, ''), 'https://www.sheconomy.in'), '/');
  v_title text;
  v_shop text;
  v_slug text;
  v_price_num numeric;
  v_price text;
  v_listing_url text;
  v_add_url text;
  v_buy_url text;
  v_images text;
  v_currency text := COALESCE(NULLIF(p_currency, ''), 'INR');
BEGIN
  IF p_listing_id IS NULL THEN
    RETURN '';
  END IF;

  SELECT
    l.title,
    l.slug,
    s.shop_name,
    COALESCE(p_price, l.price)
  INTO v_title, v_slug, v_shop, v_price_num
  FROM public.listings l
  LEFT JOIN public.shops s ON s.id = l.shop_id
  WHERE l.id = p_listing_id;

  IF v_title IS NULL THEN
    RETURN '';
  END IF;

  v_listing_url := v_base || '/listing/' || COALESCE(NULLIF(v_slug, ''), p_listing_id::text);
  v_add_url := v_base || '/cart?email_op=add&listing=' || p_listing_id::text;
  v_buy_url := v_listing_url || '?email_op=buy&listing=' || p_listing_id::text;
  v_price := CASE
    WHEN v_price_num IS NULL THEN ''
    ELSE trim(both from to_char(v_price_num, 'FM999999990.00')) || ' ' || v_currency
  END;
  v_images := public.build_listing_images_email_strip(p_listing_id, v_listing_url, NULL, 4);

  RETURN format(
    $card$
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="width:100%%;margin:8px 0 12px;border:1px solid #f3d6e3;border-radius:16px;overflow:hidden;background:#ffffff;">
  <tr>
    <td style="padding:14px 16px;">
      %s
      <a href="%s" style="text-decoration:none;color:#1a1a2e;">
        <div style="font-size:16px;font-weight:800;line-height:1.35;color:#1a1a2e;">%s</div>
      </a>
      %s
      %s
      <div style="margin-top:14px;">
        <a href="%s" style="display:inline-block;margin:0 8px 8px 0;background:linear-gradient(135deg,#D81B60 0%%,#FF5E9B 50%%,#FF8C42 100%%);color:#ffffff;font-weight:700;font-size:13px;text-decoration:none;padding:10px 18px;border-radius:999px;">Buy now</a>
        <a href="%s" style="display:inline-block;margin:0 0 8px 0;background:#ffffff;color:#D81B60;font-weight:700;font-size:13px;text-decoration:none;padding:10px 18px;border-radius:999px;border:1px solid #D81B60;">Add to cart</a>
      </div>
    </td>
  </tr>
</table>
$card$,
    v_images,
    public.escape_html_text(v_listing_url),
    public.escape_html_text(v_title),
    CASE WHEN v_shop IS NULL OR v_shop = '' THEN ''
         ELSE '<div style="margin-top:4px;font-size:12px;color:#5c5c6e;">' || public.escape_html_text(v_shop) || '</div>' END,
    CASE WHEN v_price = '' THEN ''
         ELSE '<div style="margin-top:8px;font-size:15px;font-weight:800;color:#D81B60;">' || public.escape_html_text(v_price) || '</div>' END,
    public.escape_html_text(v_buy_url),
    public.escape_html_text(v_add_url)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.build_listing_promo_email_html(uuid, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_listing_promo_email_html(uuid, text, text, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.build_order_items_email_html(
  p_order_id uuid,
  p_app_base text DEFAULT 'https://www.sheconomy.in',
  p_currency text DEFAULT 'INR',
  p_shop_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 8
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_base text := rtrim(COALESCE(NULLIF(p_app_base, ''), 'https://www.sheconomy.in'), '/');
  v_currency text := COALESCE(NULLIF(p_currency, ''), 'INR');
  v_rows text := '';
  v_count integer := 0;
  v_more integer := 0;
  r RECORD;
  v_title text;
  v_price text;
  v_listing_url text;
  v_images text;
  v_buy_again text;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN '';
  END IF;

  FOR r IN
    SELECT
      oi.id,
      oi.listing_id,
      oi.product_title,
      oi.quantity,
      oi.unit_price,
      oi.vendor_id,
      l.slug AS listing_slug
    FROM public.order_items oi
    LEFT JOIN public.listings l ON l.id = oi.listing_id
    WHERE oi.order_id = p_order_id
      AND (p_shop_id IS NULL OR oi.vendor_id = p_shop_id)
    ORDER BY oi.created_at ASC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_count := v_count + 1;
    v_title := public.escape_html_text(COALESCE(NULLIF(r.product_title, ''), 'Ordered item'));
    v_price := trim(both from to_char(COALESCE(r.unit_price, 0), 'FM999999990.00')) || ' ' || v_currency;
    v_listing_url := v_base || '/listing/' || COALESCE(NULLIF(r.listing_slug, ''), r.listing_id::text);
    v_buy_again := v_base || '/cart?email_op=add&listing=' || r.listing_id::text;
    v_images := public.build_listing_images_email_strip(r.listing_id, v_listing_url, NULL, 3);

    v_rows := v_rows || format(
      $row$
<tr>
  <td style="padding:0 0 14px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="width:100%%;border:1px solid #f3d6e3;border-radius:14px;background:#ffffff;">
      <tr>
        <td style="padding:12px 14px;">
          %s
          <div style="font-size:14px;font-weight:700;color:#1a1a2e;">%s</div>
          <div style="margin-top:4px;font-size:13px;color:#5c5c6e;">Qty %s · %s</div>
          <div style="margin-top:10px;">
            <a href="%s" style="display:inline-block;margin:0 8px 0 0;background:linear-gradient(135deg,#D81B60 0%%,#FF5E9B 50%%,#FF8C42 100%%);color:#ffffff;font-weight:700;font-size:12px;text-decoration:none;padding:8px 14px;border-radius:999px;">Buy again</a>
            <a href="%s" style="display:inline-block;background:#ffffff;color:#D81B60;font-weight:700;font-size:12px;text-decoration:none;padding:8px 14px;border-radius:999px;border:1px solid #D81B60;">View product</a>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>
$row$,
      v_images,
      v_title,
      COALESCE(r.quantity, 1)::text,
      public.escape_html_text(v_price),
      public.escape_html_text(v_buy_again),
      public.escape_html_text(v_listing_url)
    );
  END LOOP;

  IF v_rows = '' THEN
    RETURN '';
  END IF;

  SELECT GREATEST(
    COALESCE((
      SELECT COUNT(*)::integer FROM public.order_items oi
      WHERE oi.order_id = p_order_id
        AND (p_shop_id IS NULL OR oi.vendor_id = p_shop_id)
    ), 0) - v_count,
    0
  ) INTO v_more;

  RETURN format(
    $wrap$
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="width:100%%;margin:8px 0 4px;">
  <tr><td style="padding:0 0 10px;font-size:11px;font-weight:700;color:#D81B60;text-transform:uppercase;letter-spacing:1.2px;">Your items</td></tr>
  %s
  %s
</table>
$wrap$,
    v_rows,
    CASE WHEN v_more > 0 THEN '<tr><td style="padding:0 0 8px;font-size:13px;color:#5c5c6e;">+ ' || v_more::text || ' more item(s)</td></tr>' ELSE '' END
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.build_order_items_email_html(uuid, text, text, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_order_items_email_html(uuid, text, text, uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.build_cart_items_email_carousel(
  p_cart_id uuid,
  p_app_base text DEFAULT 'https://www.sheconomy.in',
  p_currency text DEFAULT 'INR',
  p_limit integer DEFAULT 6
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_base text := rtrim(COALESCE(NULLIF(p_app_base, ''), 'https://www.sheconomy.in'), '/');
  v_currency text := COALESCE(NULLIF(p_currency, ''), 'INR');
  v_html text := '';
  v_count integer := 0;
  v_more integer := 0;
  r RECORD;
  v_title text;
  v_shop text;
  v_variant text;
  v_price text;
  v_qty integer;
  v_listing_url text;
  v_buy_url text;
  v_inc_url text;
  v_dec_url text;
  v_images text;
BEGIN
  IF p_cart_id IS NULL THEN
    RETURN '';
  END IF;

  v_buy_url := v_base || '/checkout';

  FOR r IN
    SELECT
      ci.id AS cart_item_id,
      ci.title,
      ci.image_url,
      ci.unit_price,
      ci.quantity,
      ci.shop_name,
      ci.variant_name,
      ci.variant_value,
      ci.listing_id,
      ci.variant_id,
      l.slug AS listing_slug
    FROM public.cart_items ci
    LEFT JOIN public.listings l ON l.id = ci.listing_id
    WHERE ci.cart_id = p_cart_id
      AND ci.saved_for_later = false
    ORDER BY ci.updated_at DESC NULLS LAST, ci.created_at DESC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_count := v_count + 1;
    v_qty := COALESCE(r.quantity, 1);
    v_title := public.escape_html_text(COALESCE(NULLIF(r.title, ''), 'Item in your cart'));
    v_shop := public.escape_html_text(NULLIF(r.shop_name, ''));
    v_variant := NULLIF(trim(both from concat_ws(' · ', NULLIF(r.variant_name, ''), NULLIF(r.variant_value, ''))), '');
    IF v_variant IS NOT NULL THEN
      v_variant := public.escape_html_text(v_variant);
    END IF;
    v_price := trim(both from to_char(COALESCE(r.unit_price, 0), 'FM999999990.00')) || ' ' || v_currency;
    v_listing_url := v_base || '/listing/' || COALESCE(NULLIF(r.listing_slug, ''), r.listing_id::text);
    v_inc_url := v_base || '/cart?email_op=inc&item=' || r.cart_item_id::text;
    v_dec_url := v_base || '/cart?email_op=dec&item=' || r.cart_item_id::text;
    v_images := public.build_listing_images_email_strip(
      r.listing_id,
      v_listing_url,
      r.image_url,
      4
    );

    v_html := v_html || format(
      $card$
<tr>
  <td style="padding:0 0 14px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="width:100%%;border:1px solid #f3d6e3;border-radius:16px;overflow:hidden;background:#ffffff;">
      <tr>
        <td style="padding:14px 16px;">
          %s
          <a href="%s" style="text-decoration:none;color:#1a1a2e;">
            <div style="font-size:15px;font-weight:800;line-height:1.35;color:#1a1a2e;">%s</div>
          </a>
          %s
          %s
          <div style="margin-top:8px;font-size:15px;font-weight:800;color:#D81B60;">%s</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
            <tr>
              <td style="padding-right:8px;">
                <a href="%s" style="display:inline-block;min-width:34px;text-align:center;background:#fff5f8;color:#D81B60;font-weight:800;font-size:16px;text-decoration:none;padding:8px 12px;border-radius:10px;border:1px solid #f3d6e3;">−</a>
              </td>
              <td style="padding-right:8px;font-size:14px;font-weight:700;color:#1a1a2e;">Qty %s</td>
              <td>
                <a href="%s" style="display:inline-block;min-width:34px;text-align:center;background:#fff5f8;color:#D81B60;font-weight:800;font-size:16px;text-decoration:none;padding:8px 12px;border-radius:10px;border:1px solid #f3d6e3;">+</a>
              </td>
            </tr>
          </table>
          <div style="margin-top:14px;">
            <a href="%s" style="display:inline-block;margin:0 8px 8px 0;background:linear-gradient(135deg,#D81B60 0%%,#FF5E9B 50%%,#FF8C42 100%%);color:#ffffff;font-weight:700;font-size:13px;text-decoration:none;padding:10px 18px;border-radius:999px;">Buy now</a>
            <a href="%s" style="display:inline-block;margin:0 0 8px 0;background:#ffffff;color:#D81B60;font-weight:700;font-size:13px;text-decoration:none;padding:10px 18px;border-radius:999px;border:1px solid #D81B60;">View product</a>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>
$card$,
      v_images,
      public.escape_html_text(v_listing_url),
      v_title,
      CASE WHEN v_shop IS NULL THEN '' ELSE '<div style="margin-top:4px;font-size:12px;color:#5c5c6e;">' || v_shop || '</div>' END,
      CASE WHEN v_variant IS NULL THEN '' ELSE '<div style="margin-top:2px;font-size:12px;color:#9ca3af;">' || v_variant || '</div>' END,
      public.escape_html_text(v_price),
      public.escape_html_text(v_dec_url),
      v_qty::text,
      public.escape_html_text(v_inc_url),
      public.escape_html_text(v_buy_url),
      public.escape_html_text(v_listing_url)
    );
  END LOOP;

  IF v_html = '' THEN
    RETURN '';
  END IF;

  SELECT GREATEST(
    COALESCE((SELECT COUNT(*)::integer FROM public.cart_items ci WHERE ci.cart_id = p_cart_id AND ci.saved_for_later = false), 0) - v_count,
    0
  ) INTO v_more;

  RETURN format(
    $wrap$
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="width:100%%;margin:8px 0 4px;">
  <tr><td style="padding:0 0 10px;font-size:11px;font-weight:700;color:#D81B60;text-transform:uppercase;letter-spacing:1.2px;">Your cart</td></tr>
  %s
  %s
</table>
$wrap$,
    v_html,
    CASE WHEN v_more > 0 THEN '<tr><td style="padding:0 0 8px;font-size:13px;color:#5c5c6e;">+ ' || v_more::text || ' more item(s) in your cart — open cart to manage all</td></tr>' ELSE '' END
  );
END;
$fn$;

UPDATE public.notification_templates
SET
  email_subject_template = 'Your SHEconomy cart is waiting — buy before it''s gone',
  email_body_template = $html$
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#D81B60;text-transform:uppercase;letter-spacing:1.5px;">Cart reminder</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.25;">Still thinking it over?</h2>
<p style="margin:0 0 14px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi {{customer_name}}, you left <strong style="color:#1a1a2e;">{{item_count}}</strong> item(s) (<strong style="color:#1a1a2e;">{{cart_total}}</strong>) in your cart. Use + / − to change quantity, or Buy now to checkout.</p>
{{cart_items_html}}
<div style="text-align:center;margin:20px 0 8px;"><a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,#D81B60 0%,#FF5E9B 50%,#FF8C42 100%);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:50px;box-shadow:0 4px 14px rgba(216,27,96,0.35);letter-spacing:0.3px;">Return to cart &amp; checkout</a></div>
$html$,
  updated_at = now()
WHERE template_key = 'cart_abandoned_customer';

UPDATE public.notification_templates
SET
  email_body_template = $html$
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#D81B60;text-transform:uppercase;letter-spacing:1.5px;">Checkout reminder</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.25;">Your order is almost done</h2>
<p style="margin:0 0 14px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi {{customer_name}}, payment is still pending for <strong style="color:#1a1a2e;">{{item_count}}</strong> item(s) · <strong style="color:#1a1a2e;">{{checkout_total}}</strong>.</p>
{{cart_items_html}}
<div style="text-align:center;margin:20px 0 8px;"><a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,#D81B60 0%,#FF5E9B 50%,#FF8C42 100%);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:50px;box-shadow:0 4px 14px rgba(216,27,96,0.35);letter-spacing:0.3px;">Complete payment</a></div>
$html$,
  updated_at = now()
WHERE template_key = 'checkout_abandoned_customer';

UPDATE public.notification_templates
SET
  email_body_template = $html$
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#D81B60;text-transform:uppercase;letter-spacing:1.5px;">Order confirmed</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.25;">Thanks for your order!</h2>
<p style="margin:0 0 14px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi {{customer_name}}, order <strong style="color:#1a1a2e;">#{{order_number}}</strong> is confirmed.</p>
{{order_items_html}}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:8px 0 16px;">
<tr><td style="padding:10px 0;color:#1a1a2e;">{{item_summary}}</td><td align="right" style="padding:10px 0;font-weight:700;color:#1a1a2e;">{{customer_currency}} {{customer_subtotal_amount}}</td></tr>
</table>
<div style="text-align:center;margin:20px 0 8px;"><a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,#D81B60 0%,#FF5E9B 50%,#FF8C42 100%);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:50px;">View order</a></div>
$html$,
  updated_at = now()
WHERE template_key = 'order_confirmed_customer';

UPDATE public.notification_templates
SET
  email_body_template = COALESCE(
    NULLIF(email_body_template, ''),
    $html$
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#D81B60;text-transform:uppercase;letter-spacing:1.5px;">Order placed</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.25;">We received your order</h2>
<p style="margin:0 0 14px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi {{customer_name}}, order <strong style="color:#1a1a2e;">#{{order_number}}</strong> · {{total_items}} item(s) from {{shop_names}}.</p>
{{order_items_html}}
<div style="text-align:center;margin:20px 0 8px;"><a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,#D81B60 0%,#FF5E9B 50%,#FF8C42 100%);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:50px;">Track order</a></div>
$html$
  ),
  updated_at = now()
WHERE template_key = 'order_placed_customer'
  AND (email_body_template IS NULL OR position('order_items_html' in email_body_template) = 0);

-- Force inject order_items_html into order_placed if missing
UPDATE public.notification_templates
SET
  email_body_template = regexp_replace(
    email_body_template,
    '(Hi \{\{customer_name\}\}[\s\S]*?</p>)',
    E'\\1\n{{order_items_html}}',
    1
  ),
  updated_at = now()
WHERE template_key = 'order_placed_customer'
  AND position('{{order_items_html}}' in COALESCE(email_body_template, '')) = 0;

UPDATE public.notification_templates
SET
  email_subject_template = COALESCE(NULLIF(email_subject_template, ''), '{{shop_name}} just listed {{listing_title}}'),
  email_body_template = $html$
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#D81B60;text-transform:uppercase;letter-spacing:1.5px;">New from {{shop_name}}</p>
<h2 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#1a1a2e;line-height:1.25;">{{listing_title}}</h2>
<p style="margin:0 0 14px;color:#5c5c6e;font-size:15px;line-height:1.7;">A shop you follow just added something new. Add it to cart or buy now from this email.</p>
{{listing_card_html}}
<div style="text-align:center;margin:16px 0 8px;"><a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,#D81B60 0%,#FF5E9B 50%,#FF8C42 100%);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:50px;">View product</a></div>
$html$,
  updated_at = now()
WHERE template_key = 'shop_follower_new_listing';

UPDATE public.notification_templates
SET
  email_subject_template = COALESCE(NULLIF(email_subject_template, ''), '{{product_name}} is back in stock'),
  email_body_template = $html$
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#D81B60;text-transform:uppercase;letter-spacing:1.5px;">Back in stock</p>
<h2 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#1a1a2e;line-height:1.25;">{{product_name}} is available again</h2>
<p style="margin:0 0 14px;color:#5c5c6e;font-size:15px;line-height:1.7;">From {{shop_name}}. Grab it before it sells out — add to cart or buy now.</p>
{{listing_card_html}}
<div style="text-align:center;margin:16px 0 8px;"><a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,#D81B60 0%,#FF5E9B 50%,#FF8C42 100%);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:50px;">View product</a></div>
$html$,
  updated_at = now()
WHERE template_key = 'product_back_in_stock';

UPDATE public.notification_templates
SET
  email_body_template = CASE
    WHEN position('{{order_items_html}}' in COALESCE(email_body_template, '')) > 0 THEN email_body_template
    WHEN position('{{items_summary}}' in COALESCE(email_body_template, '')) > 0 THEN
      replace(email_body_template, '{{items_summary}}', '{{order_items_html}}{{items_summary}}')
    ELSE email_body_template || E'\n{{order_items_html}}'
  END,
  updated_at = now()
WHERE template_key IN ('new_order_vendor', 'cod_order_vendor', 'order_confirmed_seller', 'payment_received_vendor', 'order_status_update_vendor')
  AND position('{{order_items_html}}' in COALESCE(email_body_template, '')) = 0;

-- ---------------------------------------------------------------------------
-- Wire listing promo HTML into follower + back-in-stock notifications
CREATE OR REPLACE FUNCTION public.notify_new_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r record;
  v_shop_name text;
  v_shop_owner uuid;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://www.sheconomy.in'
  );
  v_action_url text;
  v_card text;
  v_became_visible boolean := false;
  v_notified integer := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_became_visible := (
      NEW.listing_status = 'active'
      AND COALESCE(NEW.is_active, false) = true
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_became_visible := (
      NEW.listing_status = 'active'
      AND COALESCE(NEW.is_active, false) = true
      AND (
        OLD.listing_status IS DISTINCT FROM 'active'
        OR COALESCE(OLD.is_active, false) = false
      )
    );
  END IF;

  IF NOT v_became_visible OR NEW.shop_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT shop_name, user_id INTO v_shop_name, v_shop_owner
  FROM public.shops
  WHERE id = NEW.shop_id;

  IF v_shop_name IS NULL THEN
    RETURN NEW;
  END IF;

  v_action_url := rtrim(v_app_base, '/') || '/listing/' || COALESCE(NEW.slug, NEW.id::text);
  v_card := public.build_listing_promo_email_html(NEW.id, v_app_base, 'INR', NEW.price);

  FOR r IN
    SELECT sf.user_id
    FROM public.shop_follows sf
    WHERE sf.shop_id = NEW.shop_id
      AND sf.status = 'active'
      AND sf.user_id IS DISTINCT FROM v_shop_owner
    LIMIT 200
  LOOP
    BEGIN
      PERFORM public.create_notification_from_template(
        'shop_follower_new_listing',
        r.user_id,
        jsonb_build_object(
          'shop_name', v_shop_name,
          'listing_title', COALESCE(NEW.title, 'a new product'),
          'action_url', v_action_url,
          'listing_card_html', COALESCE(v_card, ''),
          'listing_id', NEW.id
        ),
        'listing',
        NEW.id,
        'shop',
        NEW.shop_id
      );
      v_notified := v_notified + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    EXIT WHEN v_notified >= 200;
  END LOOP;

  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.notify_listing_back_in_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r RECORD;
  v_notification_id uuid;
  v_shop_name text;
  v_product_name text;
  v_action_url text;
  v_card text;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://www.sheconomy.in'
  );
  v_prev_qty numeric;
  v_new_qty numeric;
BEGIN
  v_prev_qty := COALESCE(OLD.quantity, OLD.stock, 0);
  v_new_qty := COALESCE(NEW.quantity, NEW.stock, 0);

  IF NOT (v_prev_qty <= 0 AND v_new_qty > 0) THEN
    RETURN NEW;
  END IF;

  v_product_name := NEW.title;
  SELECT s.shop_name INTO v_shop_name FROM public.shops s WHERE s.id = NEW.shop_id;
  v_action_url := rtrim(v_app_base, '/') || '/listing/' || COALESCE(NEW.slug, NEW.id::text);
  v_card := public.build_listing_promo_email_html(NEW.id, v_app_base, 'INR', NEW.price);

  FOR r IN
    SELECT a.id AS alert_id, a.user_id
    FROM public.listing_stock_alerts a
    WHERE a.listing_id = NEW.id
      AND a.notified_at IS NULL
    LIMIT 200
  LOOP
    BEGIN
      v_notification_id := public.create_notification_from_template(
        'product_back_in_stock',
        r.user_id,
        jsonb_build_object(
          'product_name', COALESCE(v_product_name, 'An item'),
          'shop_name', COALESCE(v_shop_name, 'a shop'),
          'product_id', NEW.id,
          'action_url', v_action_url,
          'listing_card_html', COALESCE(v_card, ''),
          'listing_id', NEW.id
        ),
        'listing',
        NEW.id
      );
    EXCEPTION WHEN OTHERS THEN
      v_notification_id := NULL;
    END;

    UPDATE public.listing_stock_alerts
    SET notified_at = now()
    WHERE id = r.alert_id;

    IF v_notification_id IS NOT NULL THEN
      INSERT INTO public.notification_event_queue (
        event_key, recipient_id, payload, scheduled_for, status
      ) VALUES (
        'dispatch_notification',
        r.user_id,
        jsonb_build_object('notification_id', v_notification_id, 'listing_id', NEW.id),
        now(),
        'pending'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$fn$;

-- Enrich order notification variables with product HTML cards
CREATE OR REPLACE FUNCTION public.dispatch_marketplace_order_notifications(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_record RECORD;
  v_vendor_records RECORD;
  v_admin_id uuid;
  v_customer_variables jsonb;
  v_vendor_variables jsonb;
  v_payment_mode text;
  v_payment_status text;
  v_shipping_method text;
  v_seller_template text;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.idempotency_key = 'order_placed_customer:' || p_order_id::text
  ) THEN
    RETURN;
  END IF;

  -- Legacy short-window dedupe for rows written before idempotency_key existed
  IF EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.context_id = p_order_id
      AND n.type = 'order_placed_customer'
      AND n.created_at > now() - interval '5 minutes'
      AND n.idempotency_key IS NULL
  ) THEN
    RETURN;
  END IF;

  SELECT
    op.payment_mode::text,
    op.payment_status::text
  INTO v_payment_mode, v_payment_status
  FROM public.order_payments op
  WHERE op.order_id = p_order_id
  ORDER BY op.created_at DESC
  LIMIT 1;

  v_payment_mode := coalesce(v_payment_mode, 'pending');
  v_payment_status := coalesce(v_payment_status, 'pending');

  SELECT
    o.id,
    o.order_number,
    o.customer_total_amount,
    o.total_amount,
    o.customer_currency,
    o.currency,
    o.customer_subtotal_amount,
    o.customer_shipping_amount,
    o.customer_tax_amount,
    o.customer_discount_amount,
    o.order_status::text AS order_status,
    o.created_at,
    o.user_id,
    count(oi.id) AS item_count,
    coalesce(p.full_name, 'Valued Customer') AS customer_name,
    coalesce(p.phone, '') AS customer_phone,
    coalesce(string_agg(DISTINCT s.shop_name, ', '), 'Shop') AS shop_names,
    max(s.logo_url) AS brand_logo_url,
    coalesce(
      sa.address_line_1 || ', ' || sa.city || ', ' || sa.state || ' - ' || sa.postal_code,
      'Address not available'
    ) AS shipping_address,
    coalesce(
      ba.address_line_1 || ', ' || ba.city || ', ' || ba.state || ' - ' || ba.postal_code,
      sa.address_line_1 || ', ' || sa.city
    ) AS billing_address
  INTO v_order_record
  FROM public.orders o
  LEFT JOIN public.order_items oi ON o.id = oi.order_id
  LEFT JOIN public.profiles p ON o.user_id = p.id
  LEFT JOIN public.shops s ON oi.vendor_id = s.id
  LEFT JOIN public.addresses sa ON o.shipping_address_id = sa.id
  LEFT JOIN public.addresses ba ON o.billing_address_id = ba.id
  WHERE o.id = p_order_id
  GROUP BY
    o.id, o.order_number, o.customer_total_amount, o.total_amount, o.customer_currency, o.currency,
    o.customer_subtotal_amount, o.customer_shipping_amount, o.customer_tax_amount,
    o.customer_discount_amount, o.order_status, o.created_at, o.user_id,
    p.full_name, p.phone,
    sa.address_line_1, sa.city, sa.state, sa.postal_code,
    ba.address_line_1, ba.city, ba.state, ba.postal_code;

  IF v_order_record.id IS NULL OR coalesce(v_order_record.item_count, 0) = 0 THEN
    RETURN;
  END IF;

  SELECT coalesce(od.delivery_mode::text, 'Standard Shipping')
  INTO v_shipping_method
  FROM public.order_delivery od
  WHERE od.order_id = p_order_id
  LIMIT 1;

  v_shipping_method := coalesce(v_shipping_method, 'Standard Shipping');

  v_customer_variables := jsonb_build_object(
    'order_number', v_order_record.order_number,
    'order_id', v_order_record.id::text,
    'total_amount', round(coalesce(v_order_record.customer_total_amount, v_order_record.total_amount, 0), 2),
    'customer_total_amount', round(coalesce(v_order_record.customer_total_amount, v_order_record.total_amount, 0), 2),
    'customer_currency', coalesce(v_order_record.customer_currency, v_order_record.currency, 'INR'),
    'customer_subtotal_amount', round(coalesce(v_order_record.customer_subtotal_amount, 0), 2),
    'customer_shipping_amount', round(coalesce(v_order_record.customer_shipping_amount, 0), 2),
    'customer_tax_amount', round(coalesce(v_order_record.customer_tax_amount, 0), 2),
    'customer_discount_amount', round(coalesce(v_order_record.customer_discount_amount, 0), 2),
    'item_count', coalesce(v_order_record.item_count, 0),
    'total_items', coalesce(v_order_record.item_count, 0),
    'customer_name', v_order_record.customer_name,
    'customer_phone', v_order_record.customer_phone,
    'order_date', v_order_record.created_at::text,
    'payment_mode', CASE
      WHEN v_payment_mode = 'cod' THEN 'Cash on Delivery'
      WHEN v_payment_mode = 'online' THEN 'Online Payment'
      ELSE 'Payment Pending'
    END,
    'order_status', v_order_record.order_status,
    'shop_names', v_order_record.shop_names,
    'shipping_address', v_order_record.shipping_address,
    'billing_address', coalesce(v_order_record.billing_address, v_order_record.shipping_address),
    'brand_logo_url', coalesce(v_order_record.brand_logo_url, ''),
    'shipping_method', v_shipping_method,
    'support_email', 'info@sheconomy.in',
    'order_items_html', public.build_order_items_email_html(
      v_order_record.id,
      'https://www.sheconomy.in',
      coalesce(v_order_record.customer_currency, v_order_record.currency, 'INR'),
      NULL,
      8
    ),
    'item_summary', coalesce(
      (SELECT string_agg(oi.product_title || ' (Qty: ' || oi.quantity || ')', ', ')
       FROM public.order_items oi WHERE oi.order_id = v_order_record.id),
      'Items'
    ),
    'action_url', 'https://www.sheconomy.in/orders/' || v_order_record.id::text
  );

  BEGIN
    PERFORM public.create_notification_idempotent(
      'order_placed_customer',
      v_order_record.user_id,
      'order_placed_customer:' || v_order_record.id::text,
      v_customer_variables,
      public.get_order_context(),
      v_order_record.id,
      NULL,
      NULL,
      2,
      NULL,
      'atomic_checkout'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'dispatch_marketplace_order_notifications customer %: %', p_order_id, SQLERRM;
  END;

  FOR v_vendor_records IN
    SELECT
      s.id AS shop_id,
      s.user_id AS vendor_user_id,
      coalesce(s.shop_name, 'Shop') AS shop_name,
      s.shop_currency AS shop_currency,
      count(oi.id) AS vendor_item_count,
      coalesce(sum(oi.unit_price * oi.quantity), 0) AS vendor_order_value,
      coalesce(p.full_name, 'Shop Owner') AS shop_owner_name,
      string_agg(oi.product_title || ' (Qty: ' || oi.quantity || ')', ', ') AS items_summary
    FROM public.order_items oi
    JOIN public.shops s ON oi.vendor_id = s.id
    LEFT JOIN public.profiles p ON s.user_id = p.id
    WHERE oi.order_id = p_order_id
    GROUP BY s.id, s.user_id, s.shop_name, s.shop_currency, p.full_name
  LOOP
    v_vendor_variables := jsonb_build_object(
      'order_number', v_order_record.order_number,
      'order_id', v_order_record.id::text,
      'order_value', round(coalesce(v_vendor_records.vendor_order_value, 0), 2),
      'vendor_order_value', round(coalesce(v_vendor_records.vendor_order_value, 0), 2),
      'shop_currency', coalesce(v_vendor_records.shop_currency, v_order_record.currency, 'INR'),
      'customer_name', v_order_record.customer_name,
      'shop_owner_name', v_vendor_records.shop_owner_name,
      'shop_id', v_vendor_records.shop_id::text,
      'shop_name', v_vendor_records.shop_name,
      'item_count', v_vendor_records.vendor_item_count,
      'items_summary', coalesce(v_vendor_records.items_summary, 'Items'),
      'order_items_html', public.build_order_items_email_html(
        v_order_record.id,
        'https://www.sheconomy.in',
        coalesce(v_vendor_records.shop_currency, v_order_record.currency, 'INR'),
        v_vendor_records.shop_id,
        8
      ),
      'payment_status', CASE
        WHEN v_payment_mode = 'cod' THEN 'Cash on Delivery'
        WHEN v_payment_status = 'completed' THEN 'Paid Online'
        WHEN v_payment_status = 'pending' THEN 'Payment Pending'
        ELSE 'Payment Processing'
      END,
      'currency_note', CASE
        WHEN v_order_record.customer_currency IS DISTINCT FROM v_vendor_records.shop_currency
        THEN 'Note: Customer paid in ' || coalesce(v_order_record.customer_currency, 'INR')
          || '. Amount shown in your shop currency: '
          || coalesce(v_vendor_records.shop_currency, v_order_record.currency, 'INR')
        ELSE ''
      END,
      'customer_phone', v_order_record.customer_phone,
      'vendor_cod_amount', CASE
        WHEN v_payment_mode = 'cod' THEN round(v_vendor_records.vendor_order_value, 2)
        ELSE NULL
      END
    );

    v_seller_template := CASE
      WHEN v_payment_mode = 'cod' THEN 'cod_order_vendor'
      ELSE 'order_confirmed_seller'
    END;

    BEGIN
      PERFORM public.create_notification_idempotent(
        v_seller_template,
        v_vendor_records.vendor_user_id,
        v_seller_template || ':' || v_order_record.id::text || ':' || v_vendor_records.shop_id::text,
        v_vendor_variables,
        public.get_vendor_order_context(),
        v_order_record.id,
        public.get_shop_context(),
        v_vendor_records.shop_id,
        1,
        NULL,
        'atomic_checkout'
      );
    EXCEPTION WHEN OTHERS THEN
      -- Fall back to legacy new_order_vendor if order_confirmed_seller missing in older envs
      BEGIN
        PERFORM public.create_notification_idempotent(
          CASE WHEN v_payment_mode = 'cod' THEN 'cod_order_vendor' ELSE 'new_order_vendor' END,
          v_vendor_records.vendor_user_id,
          'new_order_vendor:' || v_order_record.id::text || ':' || v_vendor_records.shop_id::text,
          v_vendor_variables,
          public.get_vendor_order_context(),
          v_order_record.id,
          public.get_shop_context(),
          v_vendor_records.shop_id,
          1,
          NULL,
          'atomic_checkout'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'dispatch_marketplace_order_notifications vendor %: %', v_vendor_records.shop_id, SQLERRM;
      END;
    END;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.notification_templates
    WHERE template_key = 'new_order_admin' AND is_active = true
  ) THEN
    FOR v_admin_id IN
      SELECT id FROM public.profiles WHERE role = 'A'
    LOOP
      BEGIN
        PERFORM public.create_notification_idempotent(
          'new_order_admin',
          v_admin_id,
          'new_order_admin:' || v_order_record.id::text || ':' || v_admin_id::text,
          v_customer_variables,
          public.get_order_context(),
          v_order_record.id,
          NULL,
          NULL,
          2,
          NULL,
          'atomic_checkout'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'dispatch_marketplace_order_notifications admin %: %', v_admin_id, SQLERRM;
      END;
    END LOOP;
  END IF;
END;
$function$

