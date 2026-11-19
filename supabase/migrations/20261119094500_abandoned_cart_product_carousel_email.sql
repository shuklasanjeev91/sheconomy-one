-- Abandoned / checkout reminder emails: product carousel with images + Buy now.
-- Line HTML is injected as {{cart_items_html}} (template substitution does not escape).

CREATE OR REPLACE FUNCTION public.escape_html_text(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT replace(
    replace(
      replace(
        replace(
          replace(COALESCE(p_text, ''), '&', '&amp;'),
          '<', '&lt;'
        ),
        '>', '&gt;'
      ),
      '"', '&quot;'
    ),
    '''', '&#39;'
  );
$$;

COMMENT ON FUNCTION public.escape_html_text(text) IS
  'Minimal HTML entity escape for email template fragments.';

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
AS $$
DECLARE
  v_base text := rtrim(COALESCE(NULLIF(p_app_base, ''), 'https://www.sheconomy.in'), '/');
  v_currency text := COALESCE(NULLIF(p_currency, ''), 'INR');
  v_html text := '';
  v_cards text := '';
  v_count integer := 0;
  v_more integer := 0;
  r RECORD;
  v_title text;
  v_shop text;
  v_variant text;
  v_price text;
  v_qty text;
  v_img text;
  v_listing_url text;
  v_buy_url text;
  v_placeholder text :=
    'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/sheconomy-logo/1024X1024.png';
BEGIN
  IF p_cart_id IS NULL THEN
    RETURN '';
  END IF;

  v_buy_url := v_base || '/cart';

  FOR r IN
    SELECT
      ci.title,
      ci.image_url,
      ci.unit_price,
      ci.quantity,
      ci.shop_name,
      ci.variant_name,
      ci.variant_value,
      ci.listing_id,
      l.slug AS listing_slug
    FROM public.cart_items ci
    LEFT JOIN public.listings l ON l.id = ci.listing_id
    WHERE ci.cart_id = p_cart_id
      AND ci.saved_for_later = false
    ORDER BY ci.updated_at DESC NULLS LAST, ci.created_at DESC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_count := v_count + 1;
    v_title := public.escape_html_text(COALESCE(NULLIF(r.title, ''), 'Item in your cart'));
    v_shop := public.escape_html_text(NULLIF(r.shop_name, ''));
    v_variant := NULLIF(
      trim(both from concat_ws(
        ' · ',
        NULLIF(r.variant_name, ''),
        NULLIF(r.variant_value, '')
      )),
      ''
    );
    IF v_variant IS NOT NULL THEN
      v_variant := public.escape_html_text(v_variant);
    END IF;

    v_price := trim(both from to_char(COALESCE(r.unit_price, 0), 'FM999999990.00'))
      || ' ' || v_currency;
    v_qty := 'Qty ' || COALESCE(r.quantity, 1)::text;
    v_img := COALESCE(NULLIF(r.image_url, ''), v_placeholder);
    v_listing_url := v_base || '/listing/' || COALESCE(NULLIF(r.listing_slug, ''), r.listing_id::text);

    -- Card: image on top, details + Buy now (email-safe nested tables).
    v_cards := v_cards || format(
      $card$
<td align="left" valign="top" width="48%%" style="width:48%%;padding:0 6px 16px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="width:100%%;border:1px solid #f3d6e3;border-radius:16px;overflow:hidden;background:#ffffff;">
    <tr>
      <td align="center" style="padding:0;background:#fff5f8;">
        <a href="%s" style="text-decoration:none;">
          <img src="%s" alt="%s" width="220" style="display:block;width:100%%;max-width:220px;height:160px;object-fit:cover;border:0;" />
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 14px 14px;">
        <a href="%s" style="text-decoration:none;color:#1a1a2e;">
          <div style="font-size:14px;font-weight:700;line-height:1.35;color:#1a1a2e;max-height:2.7em;overflow:hidden;">%s</div>
        </a>
        %s
        %s
        <div style="margin-top:8px;font-size:15px;font-weight:800;color:#D81B60;">%s</div>
        <div style="margin-top:2px;font-size:12px;color:#5c5c6e;">%s</div>
        <div style="margin-top:12px;">
          <a href="%s" style="display:inline-block;background:linear-gradient(135deg,#D81B60 0%%,#FF5E9B 50%%,#FF8C42 100%%);color:#ffffff;font-weight:700;font-size:13px;text-decoration:none;padding:10px 18px;border-radius:999px;">Buy now</a>
        </div>
      </td>
    </tr>
  </table>
</td>
$card$,
      v_listing_url,
      public.escape_html_text(v_img),
      v_title,
      v_listing_url,
      v_title,
      CASE
        WHEN v_shop IS NULL THEN ''
        ELSE '<div style="margin-top:4px;font-size:12px;color:#5c5c6e;">' || v_shop || '</div>'
      END,
      CASE
        WHEN v_variant IS NULL THEN ''
        ELSE '<div style="margin-top:2px;font-size:12px;color:#9ca3af;">' || v_variant || '</div>'
      END,
      public.escape_html_text(v_price),
      public.escape_html_text(v_qty),
      v_buy_url
    );

    -- Two cards per row for a carousel-like strip.
    IF v_count % 2 = 0 THEN
      v_html := v_html || '<tr>' || v_cards || '</tr>';
      v_cards := '';
    END IF;
  END LOOP;

  IF v_cards <> '' THEN
    -- Odd last card: stretch full width.
    v_html := v_html || '<tr>' || replace(
      replace(v_cards, 'width="48%"', 'width="100%"'),
      'width:48%',
      'width:100%'
    ) || '</tr>';
  END IF;

  IF v_html = '' THEN
    RETURN '';
  END IF;

  SELECT GREATEST(
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.cart_items ci
      WHERE ci.cart_id = p_cart_id
        AND ci.saved_for_later = false
    ), 0) - v_count,
    0
  )
  INTO v_more;

  RETURN format(
    $wrap$
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="width:100%%;margin:8px 0 4px;">
  <tr>
    <td style="padding:0 0 10px;font-size:11px;font-weight:700;color:#D81B60;text-transform:uppercase;letter-spacing:1.2px;">
      Your cart
    </td>
  </tr>
  %s
  %s
</table>
$wrap$,
    v_html,
    CASE
      WHEN v_more > 0 THEN
        '<tr><td style="padding:0 6px 8px;font-size:13px;color:#5c5c6e;">+ '
        || v_more::text
        || ' more item(s) in your cart</td></tr>'
      ELSE ''
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.build_cart_items_email_carousel(uuid, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_cart_items_email_carousel(uuid, text, text, integer) TO service_role;

COMMENT ON FUNCTION public.build_cart_items_email_carousel(uuid, text, text, integer) IS
  'Email-safe HTML product carousel for abandoned-cart / checkout reminder templates.';

-- ---------------------------------------------------------------------------
-- Template: cart abandoned
-- ---------------------------------------------------------------------------
UPDATE public.notification_templates
SET
  email_subject_template = 'Your SHEconomy cart is waiting — buy before it''s gone',
  email_body_template = $html$
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#D81B60;text-transform:uppercase;letter-spacing:1.5px;">Cart reminder</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.25;">Still thinking it over?</h2>
<p style="margin:0 0 14px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi {{customer_name}}, you left <strong style="color:#1a1a2e;">{{item_count}}</strong> item(s) (<strong style="color:#1a1a2e;">{{cart_total}}</strong>) in your cart. Tap Buy now on any product to finish checkout.</p>
{{cart_items_html}}
<div style="text-align:center;margin:20px 0 8px;"><a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,#D81B60 0%,#FF5E9B 50%,#FF8C42 100%);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:50px;box-shadow:0 4px 14px rgba(216,27,96,0.35);letter-spacing:0.3px;">Return to cart &amp; checkout</a></div>
<p style="margin:16px 0 0;color:#9ca3af;font-size:12px;line-height:1.6;text-align:center;">Items can sell out — complete your order while they are still available.</p>
$html$,
  push_body_template = '{{item_count}} item(s) · {{cart_total}}. Tap to finish checkout.',
  whatsapp_template = 'Hi {{customer_name}}! You left {{item_count}} item(s) ({{cart_total}}) in your SHEconomy cart. Buy now: {{action_url}}',
  action_url_template = '/cart',
  updated_at = now()
WHERE template_key = 'cart_abandoned_customer';

-- ---------------------------------------------------------------------------
-- Template: checkout abandoned
-- ---------------------------------------------------------------------------
UPDATE public.notification_templates
SET
  email_subject_template = 'Complete your SHEconomy checkout',
  email_body_template = $html$
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#D81B60;text-transform:uppercase;letter-spacing:1.5px;">Checkout reminder</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.25;">Your order is almost done</h2>
<p style="margin:0 0 14px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi {{customer_name}}, you started checkout but did not finish payment. <strong style="color:#1a1a2e;">{{item_count}}</strong> item(s) · <strong style="color:#1a1a2e;">{{checkout_total}}</strong> are still waiting.</p>
{{cart_items_html}}
<div style="text-align:center;margin:20px 0 8px;"><a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,#D81B60 0%,#FF5E9B 50%,#FF8C42 100%);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:50px;box-shadow:0 4px 14px rgba(216,27,96,0.35);letter-spacing:0.3px;">Complete payment</a></div>
$html$,
  updated_at = now()
WHERE template_key = 'checkout_abandoned_customer';

-- ---------------------------------------------------------------------------
-- process_abandoned_carts — include carousel HTML
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_abandoned_carts(
  p_limit integer DEFAULT 50
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_stage smallint;
  v_idle interval;
  v_item_count integer;
  v_notification_id uuid;
  v_processed integer := 0;
  v_customer_name text;
  v_cart_total text;
  v_action_url text;
  v_cart_items_html text;
  v_max_stage smallint;
  v_last_sent timestamptz;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://www.sheconomy.in'
  );
  c_daily_gap constant interval := interval '24 hours';
  c_max_stage constant smallint := 20;
  c_max_idle constant interval := interval '30 days';
BEGIN
  FOR r IN
    SELECT
      c.id AS cart_id,
      c.user_id,
      c.total_amount,
      c.currency,
      GREATEST(
        COALESCE(c.last_activity_at, c.updated_at, c.created_at),
        COALESCE(c.updated_at, c.created_at)
      ) AS idle_since
    FROM public.carts c
    WHERE c.user_id IS NOT NULL
      AND c.status IN ('active', 'abandoned')
      AND COALESCE(c.total_amount, 0) > 0
      AND EXISTS (
        SELECT 1 FROM public.cart_items ci
        WHERE ci.cart_id = c.id AND ci.saved_for_later = false
      )
      AND c.converted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.commerce_checkout_groups g
        WHERE g.cart_id = c.id
          AND g.status = 'awaiting_payment'
          AND g.paid_at IS NULL
          AND g.cancelled_at IS NULL
      )
    ORDER BY idle_since ASC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_idle := now() - r.idle_since;
    IF v_idle >= c_max_idle THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(MAX(l.stage), 0)::smallint, MAX(l.created_at)
    INTO v_max_stage, v_last_sent
    FROM public.cart_reminder_log l
    WHERE l.cart_id = r.cart_id;

    IF v_max_stage >= c_max_stage THEN
      CONTINUE;
    END IF;

    v_stage := NULL;

    IF v_max_stage >= 3 THEN
      IF v_last_sent IS NOT NULL
         AND (now() - v_last_sent) >= c_daily_gap
         AND v_idle >= interval '48 hours' THEN
        v_stage := v_max_stage + 1;
      ELSE
        CONTINUE;
      END IF;
    ELSIF v_idle >= interval '48 hours' AND v_max_stage < 3 THEN
      v_stage := CASE
        WHEN v_max_stage < 1 THEN 1
        WHEN v_max_stage < 2 THEN 2
        ELSE 3
      END;
    ELSIF v_idle >= interval '24 hours' AND v_max_stage < 2 THEN
      v_stage := CASE WHEN v_max_stage < 1 THEN 1 ELSE 2 END;
    ELSIF v_idle >= interval '1 hour' AND v_max_stage < 1 THEN
      v_stage := 1;
    ELSE
      CONTINUE;
    END IF;

    IF v_stage IS NULL OR v_stage <= v_max_stage THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.cart_reminder_log l
      WHERE l.cart_id = r.cart_id AND l.stage = v_stage
    ) THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(ci.quantity), 0)::integer
    INTO v_item_count
    FROM public.cart_items ci
    WHERE ci.cart_id = r.cart_id
      AND ci.saved_for_later = false;

    IF v_item_count <= 0 THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(
      NULLIF(p.full_name, ''),
      split_part(COALESCE(u.email, 'there'), '@', 1),
      'there'
    )
    INTO v_customer_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = r.user_id;

    v_cart_total := trim(both from to_char(COALESCE(r.total_amount, 0), 'FM999999990.00'))
      || ' ' || COALESCE(r.currency, 'INR');
    v_action_url := rtrim(v_app_base, '/') || '/cart';
    v_cart_items_html := public.build_cart_items_email_carousel(
      r.cart_id,
      v_app_base,
      COALESCE(r.currency, 'INR'),
      6
    );

    UPDATE public.carts
    SET status = 'abandoned', updated_at = now()
    WHERE id = r.cart_id
      AND status = 'active';

    BEGIN
      v_notification_id := public.create_notification_from_template(
        'cart_abandoned_customer',
        r.user_id,
        jsonb_build_object(
          'customer_name', v_customer_name,
          'user_name', v_customer_name,
          'item_count', v_item_count,
          'cart_total', v_cart_total,
          'action_url', v_action_url,
          'cart_items_html', COALESCE(v_cart_items_html, ''),
          'cart_id', r.cart_id,
          'stage', v_stage
        ),
        'cart',
        r.cart_id,
        NULL,
        NULL,
        NULL,
        CASE WHEN v_stage <= 2 THEN 5 WHEN v_stage = 3 THEN 4 ELSE 3 END,
        NULL
      );
    EXCEPTION WHEN OTHERS THEN
      v_notification_id := NULL;
    END;

    INSERT INTO public.cart_reminder_log (cart_id, user_id, stage, notification_id)
    VALUES (r.cart_id, r.user_id, v_stage, v_notification_id)
    ON CONFLICT (cart_id, stage) DO NOTHING;

    IF v_notification_id IS NOT NULL THEN
      INSERT INTO public.notification_event_queue (
        event_key, recipient_id, payload, scheduled_for, status
      ) VALUES (
        'dispatch_notification',
        r.user_id,
        jsonb_build_object(
          'notification_id', v_notification_id,
          'cart_id', r.cart_id,
          'stage', v_stage
        ),
        now(),
        'pending'
      );
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

COMMENT ON FUNCTION public.process_abandoned_carts(integer) IS
  'Abandoned-cart nudges at 1h/24h/48h then daily until conversion (max 20 / 30 days). Email includes product carousel.';

-- ---------------------------------------------------------------------------
-- process_abandoned_checkouts — include carousel HTML when cart_id present
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_abandoned_checkouts(
  p_limit integer DEFAULT 50
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_stage smallint;
  v_idle interval;
  v_item_count integer;
  v_notification_id uuid;
  v_processed integer := 0;
  v_customer_name text;
  v_checkout_total text;
  v_action_url text;
  v_cart_items_html text;
  v_max_stage smallint;
  v_last_sent timestamptz;
  v_app_base text := COALESCE(
    NULLIF(current_setting('app.settings.public_app_url', true), ''),
    'https://www.sheconomy.in'
  );
  c_daily_gap constant interval := interval '24 hours';
  c_max_stage constant smallint := 20;
  c_max_idle constant interval := interval '30 days';
BEGIN
  FOR r IN
    SELECT
      g.id AS checkout_group_id,
      g.buyer_id AS user_id,
      g.cart_id,
      g.total_amount,
      g.currency,
      COALESCE(g.updated_at, g.created_at) AS idle_since
    FROM public.commerce_checkout_groups g
    WHERE g.buyer_id IS NOT NULL
      AND g.status = 'awaiting_payment'
      AND g.paid_at IS NULL
      AND g.cancelled_at IS NULL
      AND COALESCE(g.total_amount, 0) > 0
      AND (g.expires_at IS NULL OR g.expires_at > now())
    ORDER BY idle_since ASC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_idle := now() - r.idle_since;
    IF v_idle >= c_max_idle THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(MAX(l.stage), 0)::smallint, MAX(l.created_at)
    INTO v_max_stage, v_last_sent
    FROM public.checkout_reminder_log l
    WHERE l.checkout_group_id = r.checkout_group_id;

    IF v_max_stage >= c_max_stage THEN
      CONTINUE;
    END IF;

    v_stage := NULL;

    IF v_max_stage >= 3 THEN
      IF v_last_sent IS NOT NULL
         AND (now() - v_last_sent) >= c_daily_gap
         AND v_idle >= interval '48 hours' THEN
        v_stage := v_max_stage + 1;
      ELSE
        CONTINUE;
      END IF;
    ELSIF v_idle >= interval '48 hours' AND v_max_stage < 3 THEN
      v_stage := CASE
        WHEN v_max_stage < 1 THEN 1
        WHEN v_max_stage < 2 THEN 2
        ELSE 3
      END;
    ELSIF v_idle >= interval '24 hours' AND v_max_stage < 2 THEN
      v_stage := CASE WHEN v_max_stage < 1 THEN 1 ELSE 2 END;
    ELSIF v_idle >= interval '1 hour' AND v_max_stage < 1 THEN
      v_stage := 1;
    ELSE
      CONTINUE;
    END IF;

    IF v_stage IS NULL OR v_stage <= v_max_stage THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.checkout_reminder_log l
      WHERE l.checkout_group_id = r.checkout_group_id AND l.stage = v_stage
    ) THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(ci.quantity), 0)::integer
    INTO v_item_count
    FROM public.cart_items ci
    WHERE r.cart_id IS NOT NULL
      AND ci.cart_id = r.cart_id
      AND ci.saved_for_later = false;

    IF v_item_count <= 0 THEN
      SELECT GREATEST(COALESCE(cardinality(g.selected_cart_item_ids), 0), 1)
      INTO v_item_count
      FROM public.commerce_checkout_groups g
      WHERE g.id = r.checkout_group_id;
    END IF;

    SELECT COALESCE(
      NULLIF(p.full_name, ''),
      split_part(COALESCE(u.email, 'there'), '@', 1),
      'there'
    )
    INTO v_customer_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = r.user_id;

    v_checkout_total := trim(both from to_char(COALESCE(r.total_amount, 0), 'FM999999990.00'))
      || ' ' || COALESCE(r.currency, 'INR');
    v_action_url := rtrim(v_app_base, '/') || '/checkout';
    v_cart_items_html := CASE
      WHEN r.cart_id IS NULL THEN ''
      ELSE public.build_cart_items_email_carousel(
        r.cart_id,
        v_app_base,
        COALESCE(r.currency, 'INR'),
        6
      )
    END;

    BEGIN
      v_notification_id := public.create_notification_from_template(
        'checkout_abandoned_customer',
        r.user_id,
        jsonb_build_object(
          'customer_name', v_customer_name,
          'user_name', v_customer_name,
          'item_count', v_item_count,
          'checkout_total', v_checkout_total,
          'cart_total', v_checkout_total,
          'action_url', v_action_url,
          'cart_items_html', COALESCE(v_cart_items_html, ''),
          'checkout_group_id', r.checkout_group_id,
          'cart_id', r.cart_id,
          'stage', v_stage
        ),
        'checkout_group',
        r.checkout_group_id,
        NULL,
        NULL,
        NULL,
        CASE WHEN v_stage <= 2 THEN 5 WHEN v_stage = 3 THEN 4 ELSE 3 END,
        NULL
      );
    EXCEPTION WHEN OTHERS THEN
      v_notification_id := NULL;
    END;

    INSERT INTO public.checkout_reminder_log (
      checkout_group_id, user_id, stage, notification_id
    ) VALUES (
      r.checkout_group_id, r.user_id, v_stage, v_notification_id
    )
    ON CONFLICT (checkout_group_id, stage) DO NOTHING;

    IF v_notification_id IS NOT NULL THEN
      INSERT INTO public.notification_event_queue (
        event_key, recipient_id, payload, scheduled_for, status
      ) VALUES (
        'dispatch_notification',
        r.user_id,
        jsonb_build_object(
          'notification_id', v_notification_id,
          'checkout_group_id', r.checkout_group_id,
          'stage', v_stage
        ),
        now(),
        'pending'
      );
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

COMMENT ON FUNCTION public.process_abandoned_checkouts(integer) IS
  'Checkout payment reminders with product carousel when cart lines are available.';
