-- Shop-scoped Customer 360 / CRM: tags, notes, journeys, and scoring RPCs.

-- ---------------------------------------------------------------------------
-- Notes & tags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) > 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_customer_notes_shop_customer_idx
  ON public.shop_customer_notes (shop_id, customer_id, created_at DESC);

ALTER TABLE public.shop_customer_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_customer_notes_vendor ON public.shop_customer_notes;
CREATE POLICY shop_customer_notes_vendor
  ON public.shop_customer_notes FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.shop_customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag text NOT NULL CHECK (char_length(trim(tag)) > 0 AND char_length(tag) <= 40),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, customer_id, tag)
);

CREATE INDEX IF NOT EXISTS shop_customer_tags_shop_idx
  ON public.shop_customer_tags (shop_id, customer_id);

ALTER TABLE public.shop_customer_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_customer_tags_vendor ON public.shop_customer_tags;
CREATE POLICY shop_customer_tags_vendor
  ON public.shop_customer_tags FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Automated journeys
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_customer_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  segment text NOT NULL CHECK (
    segment IN ('churn_risk', 'high_intent', 'champion', 'at_risk', 'new')
  ),
  title text NOT NULL,
  message text NOT NULL,
  cooldown_days integer NOT NULL DEFAULT 14 CHECK (cooldown_days >= 1 AND cooldown_days <= 90),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, segment)
);

CREATE INDEX IF NOT EXISTS shop_customer_journeys_active_idx
  ON public.shop_customer_journeys (shop_id)
  WHERE is_active = true;

ALTER TABLE public.shop_customer_journeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_customer_journeys_vendor ON public.shop_customer_journeys;
CREATE POLICY shop_customer_journeys_vendor
  ON public.shop_customer_journeys FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.shop_customer_journey_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.shop_customer_journeys(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_id, customer_id, sent_at)
);

CREATE INDEX IF NOT EXISTS shop_customer_journey_sends_lookup_idx
  ON public.shop_customer_journey_sends (journey_id, customer_id, sent_at DESC);

ALTER TABLE public.shop_customer_journey_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_customer_journey_sends_vendor ON public.shop_customer_journey_sends;
CREATE POLICY shop_customer_journey_sends_vendor
  ON public.shop_customer_journey_sends FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Scoring helpers (keep in lockstep with commerce/lib/customer-crm-scoring.ts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_rfm_recency_score(p_days integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_days IS NULL THEN 1
    WHEN p_days <= 30 THEN 5
    WHEN p_days <= 60 THEN 4
    WHEN p_days <= 90 THEN 3
    WHEN p_days <= 180 THEN 2
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.crm_rfm_frequency_score(p_orders integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_orders, 0) >= 8 THEN 5
    WHEN p_orders >= 5 THEN 4
    WHEN p_orders >= 3 THEN 3
    WHEN p_orders >= 2 THEN 2
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.crm_rfm_monetary_score(p_spent numeric)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_spent, 0) >= 20000 THEN 5
    WHEN p_spent >= 8000 THEN 4
    WHEN p_spent >= 3000 THEN 3
    WHEN p_spent >= 1000 THEN 2
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.crm_rfm_segment(
  p_r integer,
  p_f integer,
  p_orders integer,
  p_is_follower boolean
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_orders, 0) = 0 THEN
      CASE WHEN coalesce(p_is_follower, false) THEN 'new' ELSE 'hibernating' END
    WHEN p_r >= 4 AND p_f >= 4 THEN 'champion'
    WHEN p_r >= 3 AND p_f >= 3 THEN 'loyal'
    WHEN p_r >= 4 AND p_f <= 2 AND coalesce(p_orders, 0) <= 1 THEN 'new'
    WHEN p_r >= 4 AND p_f <= 2 THEN 'promising'
    WHEN p_r <= 2 AND p_f >= 3 THEN 'at_risk'
    WHEN p_r = 1 THEN 'lost'
    WHEN p_r <= 2 THEN 'hibernating'
    ELSE 'promising'
  END;
$$;

CREATE OR REPLACE FUNCTION public.crm_churn_score(
  p_days integer,
  p_orders integer,
  p_refunded integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_orders, 0) <= 0 OR p_days IS NULL THEN 0
    ELSE least(
      100,
      round(
        least(70, (p_days::numeric / 120) * 70)
        + least(20, (coalesce(p_refunded, 0)::numeric / p_orders) * 40)
        + CASE WHEN p_orders = 1 AND p_days > 45 THEN 15 ELSE 0 END
      )::integer
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.crm_intent_score(
  p_cart_value numeric,
  p_wishlist integer,
  p_recent_views integer,
  p_days integer,
  p_abandoned boolean
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT least(
    100,
    (CASE WHEN coalesce(p_cart_value, 0) > 0 THEN 40 ELSE 0 END)
    + (CASE WHEN coalesce(p_abandoned, false) THEN 15 ELSE 0 END)
    + least(20, coalesce(p_wishlist, 0) * 8)
    + least(20, coalesce(p_recent_views, 0) * 7)
    + (CASE WHEN p_days IS NOT NULL AND p_days <= 14 AND coalesce(p_cart_value, 0) > 0 THEN 10 ELSE 0 END)
  );
$$;

CREATE OR REPLACE FUNCTION public.crm_predicted_clv(
  p_spent numeric,
  p_orders integer,
  p_days_since_first integer,
  p_churn integer
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_orders, 0) <= 0 THEN 0
    ELSE round(
      coalesce(p_spent, 0)
      + (p_spent / p_orders)
        * (p_orders::numeric / greatest(1, coalesce(p_days_since_first, 30)::numeric / 30.0))
        * (6 * (1 - coalesce(p_churn, 0)::numeric / 100.0)),
      2
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.crm_insight_text(
  p_segment text,
  p_churn integer,
  p_intent integer,
  p_orders integer,
  p_is_follower boolean,
  p_cart_value numeric
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parts text[] := ARRAY[]::text[];
BEGIN
  IF coalesce(p_churn, 0) >= 70 THEN
    parts := array_append(parts, 'High churn risk — they have not bought recently relative to a healthy repeat cycle.');
  ELSIF coalesce(p_churn, 0) >= 45 THEN
    parts := array_append(parts, 'Softening — a reminder or offer could bring them back.');
  END IF;
  IF coalesce(p_intent, 0) >= 50 THEN
    parts := array_append(parts, 'Purchase intent is elevated from cart, wishlist, or recent browsing.');
  END IF;
  IF p_segment = 'champion' THEN
    parts := array_append(parts, 'Champion buyer — high recency, frequency, and spend.');
  END IF;
  IF p_segment = 'new' AND coalesce(p_orders, 0) <= 1 THEN
    parts := array_append(parts, 'New to this shop — a second-order nudge can lift lifetime value.');
  END IF;
  IF coalesce(p_is_follower, false) AND coalesce(p_orders, 0) = 0 THEN
    parts := array_append(parts, 'Follows the shop but has not purchased yet.');
  END IF;
  IF coalesce(p_cart_value, 0) > 0 THEN
    parts := array_append(parts, 'Open cart currently holds items from this shop.');
  END IF;
  IF coalesce(array_length(parts, 1), 0) = 0 THEN
    RETURN 'Stable customer with no strong risk or intent signals right now.';
  END IF;
  RETURN array_to_string(parts[1:3], ' ');
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_shop_customer_journeys(p_shop_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.shops s WHERE s.id = p_shop_id AND s.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  INSERT INTO public.shop_customer_journeys (shop_id, name, segment, title, message, cooldown_days, is_active)
  VALUES
    (
      p_shop_id,
      'Win-back',
      'churn_risk',
      'We miss you',
      'It has been a while since your last order. Come back for something new from the shop.',
      14,
      false
    ),
    (
      p_shop_id,
      'High intent',
      'high_intent',
      'Your picks are waiting',
      'You left items in your cart or wishlist. Complete checkout when you are ready.',
      7,
      false
    ),
    (
      p_shop_id,
      'Champion thank-you',
      'champion',
      'Thank you for being a top customer',
      'You are one of our most valued shoppers. Watch for a personal offer next time you visit.',
      30,
      false
    )
  ON CONFLICT (shop_id, segment) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.shop_customer_crm_rows(p_shop_id uuid, p_limit integer DEFAULT 200)
RETURNS TABLE (
  customer_id uuid,
  display_name text,
  username text,
  avatar_url text,
  total_orders bigint,
  total_spent numeric,
  average_order_value numeric,
  first_order_at timestamptz,
  last_order_at timestamptz,
  days_since_last_order integer,
  rfm_segment text,
  clv numeric,
  predicted_clv numeric,
  churn_score integer,
  intent_score integer,
  insight text,
  is_follower boolean,
  open_cart_value numeric,
  wishlist_count integer,
  recent_view_count integer,
  refunded_orders bigint,
  tags text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ids AS (
    SELECT sa.customer_id AS uid
    FROM public.sales_analytics sa
    WHERE sa.shop_id = p_shop_id AND sa.customer_id IS NOT NULL
    UNION
    SELECT sf.user_id
    FROM public.shop_follows sf
    WHERE sf.shop_id = p_shop_id
  ),
  spend AS (
    SELECT
      sa.customer_id AS uid,
      count(DISTINCT sa.order_id)::bigint AS total_orders,
      coalesce(sum(sa.total_revenue), 0)::numeric AS total_spent,
      min(sa.ordered_at) AS first_order_at,
      max(sa.ordered_at) AS last_order_at,
      count(DISTINCT sa.order_id) FILTER (WHERE sa.is_refunded)::bigint AS refunded_orders
    FROM public.sales_analytics sa
    WHERE sa.shop_id = p_shop_id AND sa.customer_id IS NOT NULL
    GROUP BY sa.customer_id
  ),
  intent AS (
    SELECT
      i.uid,
      coalesce((
        SELECT sum(ci.total_price)
        FROM public.cart_items ci
        JOIN public.carts c ON c.id = ci.cart_id
        WHERE c.user_id = i.uid
          AND ci.shop_id = p_shop_id
          AND coalesce(ci.saved_for_later, false) = false
          AND c.status IN ('active', 'abandoned')
      ), 0)::numeric AS open_cart_value,
      coalesce((
        SELECT count(*)::integer
        FROM public.wishlists w
        JOIN public.listings l ON l.id = w.listing_id
        WHERE w.user_id = i.uid AND l.shop_id = p_shop_id
      ), 0) AS wishlist_count,
      coalesce((
        SELECT count(*)::integer
        FROM public.listing_recently_viewed v
        JOIN public.listings l ON l.id = v.listing_id
        WHERE v.user_id = i.uid
          AND l.shop_id = p_shop_id
          AND v.viewed_at >= now() - interval '7 days'
      ), 0) AS recent_view_count,
      EXISTS (
        SELECT 1
        FROM public.cart_items ci
        JOIN public.carts c ON c.id = ci.cart_id
        WHERE c.user_id = i.uid
          AND ci.shop_id = p_shop_id
          AND c.status = 'abandoned'
      ) AS abandoned
    FROM ids i
  )
  SELECT
    i.uid,
    coalesce(nullif(p.full_name, ''), nullif(p.username, ''), 'Customer'),
    p.username,
    p.avatar_url,
    coalesce(s.total_orders, 0),
    coalesce(s.total_spent, 0),
    CASE
      WHEN coalesce(s.total_orders, 0) > 0 THEN round(s.total_spent / s.total_orders, 2)
      ELSE 0
    END,
    s.first_order_at,
    s.last_order_at,
    CASE
      WHEN s.last_order_at IS NULL THEN NULL
      ELSE floor(extract(epoch FROM (now() - s.last_order_at)) / 86400)::integer
    END,
    public.crm_rfm_segment(
      public.crm_rfm_recency_score(
        CASE
          WHEN s.last_order_at IS NULL THEN NULL
          ELSE floor(extract(epoch FROM (now() - s.last_order_at)) / 86400)::integer
        END
      ),
      public.crm_rfm_frequency_score(coalesce(s.total_orders, 0)::integer),
      coalesce(s.total_orders, 0)::integer,
      EXISTS (SELECT 1 FROM public.shop_follows sf WHERE sf.shop_id = p_shop_id AND sf.user_id = i.uid)
    ),
    coalesce(s.total_spent, 0),
    public.crm_predicted_clv(
      coalesce(s.total_spent, 0),
      coalesce(s.total_orders, 0)::integer,
      CASE
        WHEN s.first_order_at IS NULL THEN NULL
        ELSE floor(extract(epoch FROM (now() - s.first_order_at)) / 86400)::integer
      END,
      public.crm_churn_score(
        CASE
          WHEN s.last_order_at IS NULL THEN NULL
          ELSE floor(extract(epoch FROM (now() - s.last_order_at)) / 86400)::integer
        END,
        coalesce(s.total_orders, 0)::integer,
        coalesce(s.refunded_orders, 0)::integer
      )
    ),
    public.crm_churn_score(
      CASE
        WHEN s.last_order_at IS NULL THEN NULL
        ELSE floor(extract(epoch FROM (now() - s.last_order_at)) / 86400)::integer
      END,
      coalesce(s.total_orders, 0)::integer,
      coalesce(s.refunded_orders, 0)::integer
    ),
    public.crm_intent_score(
      n.open_cart_value,
      n.wishlist_count,
      n.recent_view_count,
      CASE
        WHEN s.last_order_at IS NULL THEN NULL
        ELSE floor(extract(epoch FROM (now() - s.last_order_at)) / 86400)::integer
      END,
      n.abandoned
    ),
    public.crm_insight_text(
      public.crm_rfm_segment(
        public.crm_rfm_recency_score(
          CASE
            WHEN s.last_order_at IS NULL THEN NULL
            ELSE floor(extract(epoch FROM (now() - s.last_order_at)) / 86400)::integer
          END
        ),
        public.crm_rfm_frequency_score(coalesce(s.total_orders, 0)::integer),
        coalesce(s.total_orders, 0)::integer,
        EXISTS (SELECT 1 FROM public.shop_follows sf WHERE sf.shop_id = p_shop_id AND sf.user_id = i.uid)
      ),
      public.crm_churn_score(
        CASE
          WHEN s.last_order_at IS NULL THEN NULL
          ELSE floor(extract(epoch FROM (now() - s.last_order_at)) / 86400)::integer
        END,
        coalesce(s.total_orders, 0)::integer,
        coalesce(s.refunded_orders, 0)::integer
      ),
      public.crm_intent_score(
        n.open_cart_value,
        n.wishlist_count,
        n.recent_view_count,
        CASE
          WHEN s.last_order_at IS NULL THEN NULL
          ELSE floor(extract(epoch FROM (now() - s.last_order_at)) / 86400)::integer
        END,
        n.abandoned
      ),
      coalesce(s.total_orders, 0)::integer,
      EXISTS (SELECT 1 FROM public.shop_follows sf WHERE sf.shop_id = p_shop_id AND sf.user_id = i.uid),
      n.open_cart_value
    ),
    EXISTS (SELECT 1 FROM public.shop_follows sf WHERE sf.shop_id = p_shop_id AND sf.user_id = i.uid),
    n.open_cart_value,
    n.wishlist_count,
    n.recent_view_count,
    coalesce(s.refunded_orders, 0),
    coalesce(
      (
        SELECT array_agg(t.tag ORDER BY t.tag)
        FROM public.shop_customer_tags t
        WHERE t.shop_id = p_shop_id AND t.customer_id = i.uid
      ),
      ARRAY[]::text[]
    )
  FROM ids i
  LEFT JOIN spend s ON s.uid = i.uid
  LEFT JOIN intent n ON n.uid = i.uid
  LEFT JOIN public.profiles p ON p.id = i.uid
  ORDER BY coalesce(s.total_spent, 0) DESC, coalesce(s.last_order_at, to_timestamp(0)) DESC
  LIMIT greatest(coalesce(p_limit, 200), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.shop_customer_crm_rows(uuid, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_shop_customer_crm(p_shop_id uuid, p_limit integer DEFAULT 200)
RETURNS TABLE (
  customer_id uuid,
  display_name text,
  username text,
  avatar_url text,
  total_orders bigint,
  total_spent numeric,
  average_order_value numeric,
  first_order_at timestamptz,
  last_order_at timestamptz,
  days_since_last_order integer,
  rfm_segment text,
  clv numeric,
  predicted_clv numeric,
  churn_score integer,
  intent_score integer,
  insight text,
  is_follower boolean,
  open_cart_value numeric,
  wishlist_count integer,
  recent_view_count integer,
  refunded_orders bigint,
  tags text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.shops s WHERE s.id = p_shop_id AND s.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  PERFORM public.ensure_shop_customer_journeys(p_shop_id);
  RETURN QUERY SELECT * FROM public.shop_customer_crm_rows(p_shop_id, p_limit);
END;
$$;

REVOKE ALL ON FUNCTION public.get_shop_customer_crm(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_shop_customer_journeys(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shop_customer_crm(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_shop_customer_journeys(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_shop_customer_journeys(
  p_shop_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 80
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j record;
  c record;
  v_shop text;
  v_sent integer := 0;
  v_cap integer := greatest(coalesce(p_limit, 80), 1);
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF p_shop_id IS NULL THEN
      RAISE EXCEPTION 'shop required';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.shops s WHERE s.id = p_shop_id AND s.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  FOR j IN
    SELECT *
    FROM public.shop_customer_journeys
    WHERE is_active = true
      AND (p_shop_id IS NULL OR shop_id = p_shop_id)
  LOOP
    SELECT shop_name INTO v_shop FROM public.shops WHERE id = j.shop_id;
    FOR c IN
      SELECT r.*
      FROM public.shop_customer_crm_rows(j.shop_id, 200) r
      WHERE
        (j.segment = 'churn_risk' AND r.churn_score >= 60)
        OR (j.segment = 'high_intent' AND r.intent_score >= 50)
        OR (j.segment = 'champion' AND r.rfm_segment = 'champion')
        OR (j.segment = 'at_risk' AND r.rfm_segment = 'at_risk')
        OR (j.segment = 'new' AND r.rfm_segment = 'new')
    LOOP
      EXIT WHEN v_sent >= v_cap;
      IF EXISTS (
        SELECT 1
        FROM public.shop_customer_journey_sends s
        WHERE s.journey_id = j.id
          AND s.customer_id = c.customer_id
          AND s.sent_at >= now() - (j.cooldown_days || ' days')::interval
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.notifications (
        recipient_id, user_id, context_type, context_id, type, category,
        title, message, data, action_url, priority, channels, platform
      ) VALUES (
        c.customer_id,
        c.customer_id,
        'shop',
        j.shop_id,
        'customer_journey_' || j.segment,
        'promotional',
        j.title,
        j.message,
        jsonb_build_object(
          'shop_id', j.shop_id,
          'shop_name', v_shop,
          'journey_id', j.id,
          'segment', j.segment,
          'notification_kind', 'customer_journey'
        ),
        '/cart',
        2,
        ARRAY['in_app', 'push', 'email']::text[],
        'commerce'
      );

      INSERT INTO public.shop_customer_journey_sends (journey_id, shop_id, customer_id)
      VALUES (j.id, j.shop_id, c.customer_id);

      v_sent := v_sent + 1;
    END LOOP;
  END LOOP;

  RETURN v_sent;
END;
$$;

REVOKE ALL ON FUNCTION public.process_shop_customer_journeys(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_shop_customer_journeys(uuid, integer) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-shop-customer-journeys';
    PERFORM cron.schedule(
      'process-shop-customer-journeys',
      '40 10 * * *',
      $cron$SELECT public.process_shop_customer_journeys(NULL, 120)$cron$
    );
  END IF;
END $$;
