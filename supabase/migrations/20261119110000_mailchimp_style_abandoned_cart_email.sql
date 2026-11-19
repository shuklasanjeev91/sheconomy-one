-- Mailchimp-style abandoned-cart email:
-- horizontal product rows, deduped images, hero + summary + trust strip.

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

  -- Distinct image URLs so the same photo is never shown twice side-by-side.
  FOR r IN
    SELECT x.image_url
    FROM (
      SELECT DISTINCT ON (li.image_url)
        li.image_url,
        li.is_primary,
        li.display_order,
        li.created_at
      FROM public.listing_images li
      WHERE li.listing_id = p_listing_id
        AND COALESCE(li.image_url, '') <> ''
      ORDER BY li.image_url, li.is_primary DESC, li.display_order ASC, li.created_at ASC
    ) x
    ORDER BY x.is_primary DESC, x.display_order ASC, x.created_at ASC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_count := v_count + 1;
    v_html := v_html || format(
      $img$
<td align="center" valign="middle" style="padding:0 6px 0 0;">
  <a href="%s" style="text-decoration:none;border:0;">
    <img src="%s" alt="" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:cover;border-radius:12px;border:1px solid #f0d5e2;background:#fffaf8;" />
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
<td align="center" valign="middle" style="padding:0 6px 0 0;">
  <a href="%s" style="text-decoration:none;border:0;">
    <img src="%s" alt="" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:cover;border-radius:12px;border:1px solid #f0d5e2;background:#fffaf8;" />
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

-- Primary listing image for Mailchimp-style horizontal cart rows.
CREATE OR REPLACE FUNCTION public.listing_primary_image_url(
  p_listing_id uuid,
  p_fallback text DEFAULT NULL
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE(
    (
      SELECT li.image_url
      FROM public.listing_images li
      WHERE li.listing_id = p_listing_id
        AND COALESCE(li.image_url, '') <> ''
      ORDER BY li.is_primary DESC, li.display_order ASC, li.created_at ASC
      LIMIT 1
    ),
    NULLIF(p_fallback, ''),
    'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/sheconomy-logo/1024X1024.png'
  );
$fn$;

REVOKE ALL ON FUNCTION public.listing_primary_image_url(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listing_primary_image_url(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.build_user_cart_items_email_carousel(
  p_user_id uuid,
  p_app_base text DEFAULT 'https://www.sheconomy.in',
  p_currency text DEFAULT 'INR',
  p_limit integer DEFAULT 20
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
  v_line_total numeric := 0;
  v_subtotal numeric := 0;
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
  v_img text;
BEGIN
  IF p_user_id IS NULL THEN
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
    FROM public.carts c
    JOIN public.cart_items ci ON ci.cart_id = c.id
    LEFT JOIN public.listings l ON l.id = ci.listing_id
    WHERE c.user_id = p_user_id
      AND c.status IN ('active', 'abandoned')
      AND c.converted_at IS NULL
      AND ci.saved_for_later = false
      AND COALESCE(c.total_amount, 0) > 0
    ORDER BY ci.updated_at DESC NULLS LAST, ci.created_at DESC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_count := v_count + 1;
    v_qty := COALESCE(r.quantity, 1);
    v_line_total := COALESCE(r.unit_price, 0) * v_qty;
    v_subtotal := v_subtotal + v_line_total;
    v_title := public.escape_html_text(COALESCE(NULLIF(r.title, ''), 'Item in your cart'));
    v_shop := public.escape_html_text(NULLIF(r.shop_name, ''));
    v_variant := NULLIF(
      trim(both from concat_ws(' · ', NULLIF(r.variant_name, ''), NULLIF(r.variant_value, ''))),
      ''
    );
    IF v_variant IS NOT NULL THEN
      v_variant := public.escape_html_text(v_variant);
    END IF;
    v_price := trim(both from to_char(COALESCE(r.unit_price, 0), 'FM999999990.00'))
      || ' ' || v_currency;
    v_listing_url := v_base || '/listing/'
      || COALESCE(NULLIF(r.listing_slug, ''), r.listing_id::text);
    v_inc_url := v_base || '/cart?email_op=inc&item=' || r.cart_item_id::text;
    v_dec_url := v_base || '/cart?email_op=dec&item=' || r.cart_item_id::text;
    v_img := public.listing_primary_image_url(r.listing_id, r.image_url);

    v_html := v_html || format(
      $card$
<tr>
  <td style="padding:0 0 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="width:100%%;border:1px solid #f0d5e2;border-radius:18px;overflow:hidden;background:#ffffff;">
      <tr>
        <td width="120" valign="top" style="padding:16px 0 16px 16px;">
          <a href="%s" style="text-decoration:none;border:0;">
            <img src="%s" alt="" width="104" height="104" style="display:block;width:104px;height:104px;object-fit:cover;border-radius:14px;border:1px solid #f3dce6;background:#fff7fa;" />
          </a>
        </td>
        <td valign="top" style="padding:16px 18px 16px 14px;">
          <a href="%s" style="text-decoration:none;color:#1a1a2e;">
            <div style="font-size:15px;font-weight:800;line-height:1.35;color:#1a1a2e;">%s</div>
          </a>
          %s
          %s
          <div style="margin-top:8px;font-size:16px;font-weight:800;color:#D81B60;letter-spacing:0.2px;">%s</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
            <tr>
              <td style="padding-right:6px;">
                <a href="%s" style="display:inline-block;min-width:32px;text-align:center;background:#fff5f8;color:#D81B60;font-weight:800;font-size:15px;line-height:1;text-decoration:none;padding:9px 11px;border-radius:10px;border:1px solid #f0d5e2;">−</a>
              </td>
              <td style="padding:0 8px;font-size:13px;font-weight:700;color:#1a1a2e;white-space:nowrap;">Qty %s</td>
              <td style="padding-left:6px;">
                <a href="%s" style="display:inline-block;min-width:32px;text-align:center;background:#fff5f8;color:#D81B60;font-weight:800;font-size:15px;line-height:1;text-decoration:none;padding:9px 11px;border-radius:10px;border:1px solid #f0d5e2;">+</a>
              </td>
            </tr>
          </table>
          <div style="margin-top:14px;">
            <a href="%s" style="display:inline-block;margin:0 8px 8px 0;background:linear-gradient(135deg,#D81B60 0%%,#FF5E9B 55%%,#FF8C42 100%%);color:#ffffff;font-weight:700;font-size:13px;text-decoration:none;padding:11px 18px;border-radius:999px;box-shadow:0 3px 10px rgba(216,27,96,0.22);">Buy now</a>
            <a href="%s" style="display:inline-block;margin:0 0 8px 0;background:#ffffff;color:#D81B60;font-weight:700;font-size:13px;text-decoration:none;padding:10px 16px;border-radius:999px;border:1px solid #D81B60;">View product</a>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>
$card$,
      public.escape_html_text(v_listing_url),
      public.escape_html_text(v_img),
      public.escape_html_text(v_listing_url),
      v_title,
      CASE WHEN v_shop IS NULL THEN '' ELSE '<div style="margin-top:4px;font-size:12px;color:#6b7280;">' || v_shop || '</div>' END,
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
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.carts c
      JOIN public.cart_items ci ON ci.cart_id = c.id
      WHERE c.user_id = p_user_id
        AND c.status IN ('active', 'abandoned')
        AND c.converted_at IS NULL
        AND ci.saved_for_later = false
        AND COALESCE(c.total_amount, 0) > 0
    ), 0) - v_count,
    0
  )
  INTO v_more;

  RETURN format(
    $wrap$
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="width:100%%;margin:4px 0 8px;">
  <tr>
    <td style="padding:0 0 14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%">
        <tr>
          <td style="font-size:11px;font-weight:800;color:#D81B60;text-transform:uppercase;letter-spacing:1.4px;">Your saved items</td>
          <td align="right" style="font-size:12px;font-weight:700;color:#6b7280;">%s item(s)</td>
        </tr>
      </table>
    </td>
  </tr>
  %s
  %s
  <tr>
    <td style="padding:4px 0 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="width:100%%;background:#fff7fa;border:1px solid #f3d6e3;border-radius:14px;">
        <tr>
          <td style="padding:14px 16px;font-size:14px;color:#5c5c6e;">Cart subtotal</td>
          <td align="right" style="padding:14px 16px;font-size:16px;font-weight:800;color:#1a1a2e;">%s</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
$wrap$,
    v_count::text,
    v_html,
    CASE
      WHEN v_more > 0 THEN
        '<tr><td style="padding:0 0 12px;font-size:13px;color:#6b7280;">+ '
        || v_more::text
        || ' more item(s) — open cart to see everything</td></tr>'
      ELSE ''
    END,
    public.escape_html_text(
      trim(both from to_char(v_subtotal, 'FM999999990.00')) || ' ' || v_currency
    )
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.build_cart_items_email_carousel(
  p_cart_id uuid,
  p_app_base text DEFAULT 'https://www.sheconomy.in',
  p_currency text DEFAULT 'INR',
  p_limit integer DEFAULT 20
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
  v_subtotal numeric := 0;
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
  v_img text;
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
    v_subtotal := v_subtotal + (COALESCE(r.unit_price, 0) * v_qty);
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
    v_img := public.listing_primary_image_url(r.listing_id, r.image_url);

    v_html := v_html || format(
      $card$
<tr>
  <td style="padding:0 0 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="width:100%%;border:1px solid #f0d5e2;border-radius:18px;overflow:hidden;background:#ffffff;">
      <tr>
        <td width="120" valign="top" style="padding:16px 0 16px 16px;">
          <a href="%s" style="text-decoration:none;border:0;">
            <img src="%s" alt="" width="104" height="104" style="display:block;width:104px;height:104px;object-fit:cover;border-radius:14px;border:1px solid #f3dce6;background:#fff7fa;" />
          </a>
        </td>
        <td valign="top" style="padding:16px 18px 16px 14px;">
          <a href="%s" style="text-decoration:none;color:#1a1a2e;">
            <div style="font-size:15px;font-weight:800;line-height:1.35;color:#1a1a2e;">%s</div>
          </a>
          %s
          %s
          <div style="margin-top:8px;font-size:16px;font-weight:800;color:#D81B60;letter-spacing:0.2px;">%s</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
            <tr>
              <td style="padding-right:6px;">
                <a href="%s" style="display:inline-block;min-width:32px;text-align:center;background:#fff5f8;color:#D81B60;font-weight:800;font-size:15px;line-height:1;text-decoration:none;padding:9px 11px;border-radius:10px;border:1px solid #f0d5e2;">−</a>
              </td>
              <td style="padding:0 8px;font-size:13px;font-weight:700;color:#1a1a2e;white-space:nowrap;">Qty %s</td>
              <td style="padding-left:6px;">
                <a href="%s" style="display:inline-block;min-width:32px;text-align:center;background:#fff5f8;color:#D81B60;font-weight:800;font-size:15px;line-height:1;text-decoration:none;padding:9px 11px;border-radius:10px;border:1px solid #f0d5e2;">+</a>
              </td>
            </tr>
          </table>
          <div style="margin-top:14px;">
            <a href="%s" style="display:inline-block;margin:0 8px 8px 0;background:linear-gradient(135deg,#D81B60 0%%,#FF5E9B 55%%,#FF8C42 100%%);color:#ffffff;font-weight:700;font-size:13px;text-decoration:none;padding:11px 18px;border-radius:999px;box-shadow:0 3px 10px rgba(216,27,96,0.22);">Buy now</a>
            <a href="%s" style="display:inline-block;margin:0 0 8px 0;background:#ffffff;color:#D81B60;font-weight:700;font-size:13px;text-decoration:none;padding:10px 16px;border-radius:999px;border:1px solid #D81B60;">View product</a>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>
$card$,
      public.escape_html_text(v_listing_url),
      public.escape_html_text(v_img),
      public.escape_html_text(v_listing_url),
      v_title,
      CASE WHEN v_shop IS NULL THEN '' ELSE '<div style="margin-top:4px;font-size:12px;color:#6b7280;">' || v_shop || '</div>' END,
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
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="width:100%%;margin:4px 0 8px;">
  <tr>
    <td style="padding:0 0 14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%">
        <tr>
          <td style="font-size:11px;font-weight:800;color:#D81B60;text-transform:uppercase;letter-spacing:1.4px;">Your saved items</td>
          <td align="right" style="font-size:12px;font-weight:700;color:#6b7280;">%s item(s)</td>
        </tr>
      </table>
    </td>
  </tr>
  %s
  %s
  <tr>
    <td style="padding:4px 0 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="width:100%%;background:#fff7fa;border:1px solid #f3d6e3;border-radius:14px;">
        <tr>
          <td style="padding:14px 16px;font-size:14px;color:#5c5c6e;">Cart subtotal</td>
          <td align="right" style="padding:14px 16px;font-size:16px;font-weight:800;color:#1a1a2e;">%s</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
$wrap$,
    v_count::text,
    v_html,
    CASE WHEN v_more > 0 THEN '<tr><td style="padding:0 0 12px;font-size:13px;color:#6b7280;">+ ' || v_more::text || ' more item(s) — open cart to manage all</td></tr>' ELSE '' END,
    public.escape_html_text(trim(both from to_char(v_subtotal, 'FM999999990.00')) || ' ' || v_currency)
  );
END;
$fn$;

UPDATE public.notification_templates
SET
  email_subject_template = 'You left {{item_count}} item(s) in your SHEconomy cart',
  email_body_template = $html$
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:0 0 18px;">
  <tr>
    <td style="padding:12px 14px;background:#fff1f6;border:1px solid #f7d6e4;border-radius:12px;font-size:13px;line-height:1.5;color:#9d174d;">
      <strong style="color:#D81B60;">Still available</strong> — popular items sell out fast. Finish checkout while stock lasts.
    </td>
  </tr>
</table>
<p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#D81B60;text-transform:uppercase;letter-spacing:1.6px;">Cart reminder</p>
<h1 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;letter-spacing:-0.3px;">You left something behind</h1>
<p style="margin:0 0 18px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi {{customer_name}}, your cart still has <strong style="color:#1a1a2e;">{{item_count}} item(s)</strong> worth <strong style="color:#1a1a2e;">{{cart_total}}</strong>. Adjust quantity with + / −, or buy now in one tap.</p>
{{cart_items_html}}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:22px 0 8px;">
  <tr>
    <td align="center">
      <a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,#D81B60 0%,#FF5E9B 50%,#FF8C42 100%);color:#ffffff;font-weight:800;font-size:16px;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 6px 18px rgba(216,27,96,0.32);letter-spacing:0.2px;">Return to cart &amp; checkout</a>
    </td>
  </tr>
</table>
<p style="margin:10px 0 0;text-align:center;font-size:12px;color:#9ca3af;line-height:1.5;">Secure checkout · Women-led brands · Easy returns</p>
$html$,
  updated_at = now()
WHERE template_key = 'cart_abandoned_customer';

UPDATE public.notification_templates
SET
  email_subject_template = COALESCE(NULLIF(email_subject_template, ''), 'Your SHEconomy checkout is almost done'),
  email_body_template = $html$
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:0 0 18px;">
  <tr>
    <td style="padding:12px 14px;background:#fff1f6;border:1px solid #f7d6e4;border-radius:12px;font-size:13px;line-height:1.5;color:#9d174d;">
      <strong style="color:#D81B60;">Payment pending</strong> — complete checkout to lock in your items.
    </td>
  </tr>
</table>
<p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#D81B60;text-transform:uppercase;letter-spacing:1.6px;">Checkout reminder</p>
<h1 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;letter-spacing:-0.3px;">Your order is almost done</h1>
<p style="margin:0 0 18px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi {{customer_name}}, payment is still pending for <strong style="color:#1a1a2e;">{{item_count}}</strong> item(s) · <strong style="color:#1a1a2e;">{{checkout_total}}</strong>.</p>
{{cart_items_html}}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:22px 0 8px;">
  <tr>
    <td align="center">
      <a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,#D81B60 0%,#FF5E9B 50%,#FF8C42 100%);color:#ffffff;font-weight:800;font-size:16px;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 6px 18px rgba(216,27,96,0.32);letter-spacing:0.2px;">Complete payment</a>
    </td>
  </tr>
</table>
<p style="margin:10px 0 0;text-align:center;font-size:12px;color:#9ca3af;line-height:1.5;">Secure checkout · Women-led brands · Easy returns</p>
$html$,
  updated_at = now()
WHERE template_key = 'checkout_abandoned_customer';
