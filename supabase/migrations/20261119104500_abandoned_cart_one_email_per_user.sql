-- One abandoned-cart email per user with ALL products across their carts.
-- Previously each cart row triggered its own email (e.g. 4 carts × 1 item = 4 emails).

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
    v_images := public.build_listing_images_email_strip(
      r.listing_id, v_listing_url, r.image_url, 4
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
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="width:100%%;margin:8px 0 4px;">
  <tr><td style="padding:0 0 10px;font-size:11px;font-weight:700;color:#D81B60;text-transform:uppercase;letter-spacing:1.2px;">Your cart · %s item(s)</td></tr>
  %s
  %s
</table>
$wrap$,
    v_count::text,
    v_html,
    CASE
      WHEN v_more > 0 THEN
        '<tr><td style="padding:0 0 8px;font-size:13px;color:#5c5c6e;">+ '
        || v_more::text
        || ' more item(s) — open cart to see everything</td></tr>'
      ELSE ''
    END
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.build_user_cart_items_email_carousel(uuid, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_user_cart_items_email_carousel(uuid, text, text, integer) TO service_role;

COMMENT ON FUNCTION public.build_user_cart_items_email_carousel(uuid, text, text, integer) IS
  'Single email product list for all active/abandoned cart lines belonging to one user.';

CREATE OR REPLACE FUNCTION public.process_abandoned_carts(
  p_limit integer DEFAULT 50
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r RECORD;
  v_cart_id uuid;
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
  -- One row per user: combine every open cart so we never send N emails for N products.
  FOR r IN
    SELECT
      c.user_id,
      array_agg(c.id ORDER BY GREATEST(
        COALESCE(c.last_activity_at, c.updated_at, c.created_at),
        COALESCE(c.updated_at, c.created_at)
      ) DESC) AS cart_ids,
      SUM(COALESCE(c.total_amount, 0)) AS total_amount,
      COALESCE(MAX(c.currency), 'INR') AS currency,
      -- Most recent activity across carts (shopping in any cart resets idle).
      MAX(GREATEST(
        COALESCE(c.last_activity_at, c.updated_at, c.created_at),
        COALESCE(c.updated_at, c.created_at)
      )) AS last_activity_at
    FROM public.carts c
    WHERE c.user_id IS NOT NULL
      AND c.status IN ('active', 'abandoned')
      AND COALESCE(c.total_amount, 0) > 0
      AND c.converted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.cart_items ci
        WHERE ci.cart_id = c.id AND ci.saved_for_later = false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.commerce_checkout_groups g
        WHERE g.cart_id = c.id
          AND g.status = 'awaiting_payment'
          AND g.paid_at IS NULL
          AND g.cancelled_at IS NULL
      )
    GROUP BY c.user_id
    ORDER BY MAX(GREATEST(
      COALESCE(c.last_activity_at, c.updated_at, c.created_at),
      COALESCE(c.updated_at, c.created_at)
    )) ASC
    LIMIT GREATEST(p_limit, 1)
  LOOP
    v_idle := now() - r.last_activity_at;
    IF v_idle >= c_max_idle THEN
      CONTINUE;
    END IF;

    -- Cadence is per user across all their carts (prevents one email per cart).
    SELECT COALESCE(MAX(l.stage), 0)::smallint, MAX(l.created_at)
    INTO v_max_stage, v_last_sent
    FROM public.cart_reminder_log l
    WHERE l.user_id = r.user_id
      AND l.cart_id = ANY (r.cart_ids);

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

    -- Skip if this stage was already logged for any of the user's carts.
    IF EXISTS (
      SELECT 1 FROM public.cart_reminder_log l
      WHERE l.user_id = r.user_id
        AND l.cart_id = ANY (r.cart_ids)
        AND l.stage = v_stage
    ) THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(ci.quantity), 0)::integer
    INTO v_item_count
    FROM public.cart_items ci
    WHERE ci.cart_id = ANY (r.cart_ids)
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

    v_cart_id := r.cart_ids[1]; -- primary (most recently active) cart for context
    v_cart_total := trim(both from to_char(COALESCE(r.total_amount, 0), 'FM999999990.00'))
      || ' ' || COALESCE(r.currency, 'INR');
    v_action_url := rtrim(v_app_base, '/') || '/cart';
    v_cart_items_html := public.build_user_cart_items_email_carousel(
      r.user_id,
      v_app_base,
      COALESCE(r.currency, 'INR'),
      20
    );

    UPDATE public.carts
    SET status = 'abandoned', updated_at = now()
    WHERE id = ANY (r.cart_ids)
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
          'cart_id', v_cart_id,
          'cart_ids', to_jsonb(r.cart_ids),
          'stage', v_stage
        ),
        'cart',
        v_cart_id,
        NULL,
        NULL,
        NULL,
        CASE WHEN v_stage <= 2 THEN 5 WHEN v_stage = 3 THEN 4 ELSE 3 END,
        NULL
      );
    EXCEPTION WHEN OTHERS THEN
      v_notification_id := NULL;
    END;

    -- Mark every cart at this stage so we never fan out one email per cart/product.
    INSERT INTO public.cart_reminder_log (cart_id, user_id, stage, notification_id)
    SELECT cart_id, r.user_id, v_stage, v_notification_id
    FROM unnest(r.cart_ids) AS cart_id
    ON CONFLICT (cart_id, stage) DO NOTHING;

    IF v_notification_id IS NOT NULL THEN
      INSERT INTO public.notification_event_queue (
        event_key, recipient_id, payload, scheduled_for, status
      ) VALUES (
        'dispatch_notification',
        r.user_id,
        jsonb_build_object(
          'notification_id', v_notification_id,
          'cart_id', v_cart_id,
          'cart_ids', to_jsonb(r.cart_ids),
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
$fn$;

COMMENT ON FUNCTION public.process_abandoned_carts(integer) IS
  'One abandoned-cart nudge per user listing ALL products across their open carts (1h/24h/48h then daily).';

UPDATE public.notification_templates
SET
  title_template = 'You left {{item_count}} item(s) behind',
  message_template = '{{item_count}} item(s) · {{cart_total}}. Finish checkout in one place.',
  updated_at = now()
WHERE template_key = 'cart_abandoned_customer';
