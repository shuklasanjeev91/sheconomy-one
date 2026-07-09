-- Strict algorithmic sync for listings.is_featured (max ~5% of active catalog, capped at 150).
-- Manual pins: set listing_metadata = jsonb_set(COALESCE(listing_metadata, '{}'), '{featured_manual}', 'true').

CREATE OR REPLACE FUNCTION public.sync_listing_featured_flags(
  p_max_featured integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_featured integer;
  v_manual_count integer;
  v_updated integer := 0;
BEGIN
  SELECT COUNT(*)::integer
  INTO v_manual_count
  FROM listings l
  WHERE l.is_active = true
    AND l.listing_status = 'active'
    AND COALESCE((l.listing_metadata ->> 'featured_manual')::boolean, false) = true;

  SELECT LEAST(
    COALESCE(p_max_featured, 150),
    GREATEST(10, CEIL(active_count * 0.05)::integer)
  )
  INTO v_max_featured
  FROM (
    SELECT COUNT(*)::numeric AS active_count
    FROM listings l
    WHERE l.is_active = true
      AND l.listing_status = 'active'
  ) stats;

  WITH order_stats AS (
    SELECT
      oi.listing_id,
      COUNT(*) FILTER (
        WHERE oi.created_at >= NOW() - INTERVAL '90 days'
          AND oi.item_status IN (
            'confirmed', 'processing', 'shipped', 'in_transit',
            'out_for_delivery', 'delivered', 'completed', 'partially_shipped'
          )
      ) AS orders_90d,
      COUNT(*) FILTER (
        WHERE oi.item_status IN (
          'confirmed', 'processing', 'shipped', 'in_transit',
          'out_for_delivery', 'delivered', 'completed', 'partially_shipped'
        )
      ) AS orders_all
    FROM order_items oi
    GROUP BY oi.listing_id
  ),
  scored AS (
    SELECT
      l.id,
      COALESCE((l.listing_metadata ->> 'featured_manual')::boolean, false) AS is_manual,
      (
        COALESCE(os.orders_90d, 0) * 4.0
        + LEAST(COALESCE(os.orders_all, 0), 200) * 0.5
        + COALESCE(l.average_rating, 0) * COALESCE(l.total_reviews, 0) * 0.35
        + CASE
            WHEN COALESCE(l.average_rating, 0) >= 4.5
              AND COALESCE(l.total_reviews, 0) >= 5
            THEN 18
            ELSE 0
          END
        + CASE
            WHEN l.created_at >= NOW() - INTERVAL '14 days'
            THEN 6
            ELSE 0
          END
        + CASE WHEN s.verified IS TRUE THEN 8 ELSE 0 END
        + CASE
            WHEN COALESCE(s.average_rating, 0) >= 4.5
              AND COALESCE(s.total_reviews, 0) >= 10
            THEN 10
            ELSE 0
          END
      ) AS merit_score
    FROM listings l
    INNER JOIN shops s ON s.id = l.shop_id AND s.is_active = true
    LEFT JOIN order_stats os ON os.listing_id = l.id
    WHERE l.is_active = true
      AND l.listing_status = 'active'
      AND EXISTS (
        SELECT 1
        FROM listing_images li
        WHERE li.listing_id = l.id
      )
  ),
  manual AS (
    SELECT id
    FROM scored
    WHERE is_manual = true
  ),
  qualified AS (
    SELECT id, merit_score
    FROM scored
    WHERE is_manual = true
       OR merit_score >= 12
  ),
  ranked AS (
    SELECT
      q.id,
      ROW_NUMBER() OVER (ORDER BY q.merit_score DESC, q.id) AS rn
    FROM qualified q
    WHERE q.id NOT IN (SELECT id FROM manual)
  ),
  winners AS (
    SELECT id FROM manual
    UNION ALL
    SELECT id
    FROM ranked
    WHERE rn <= GREATEST(0, v_max_featured - v_manual_count)
  )
  UPDATE listings l
  SET
    is_featured = EXISTS (SELECT 1 FROM winners w WHERE w.id = l.id),
    updated_at = NOW()
  WHERE l.is_active = true
    AND l.listing_status = 'active'
    AND l.is_featured IS DISTINCT FROM EXISTS (
      SELECT 1 FROM winners w WHERE w.id = l.id
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_marketplace_recommended_listings(
  max_results integer DEFAULT 500
)
RETURNS TABLE (
  id uuid,
  recommendation_score numeric,
  order_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH order_stats AS (
    SELECT
      oi.listing_id,
      COUNT(*) FILTER (
        WHERE oi.created_at >= NOW() - INTERVAL '30 days'
          AND oi.item_status IN (
            'confirmed', 'processing', 'shipped', 'in_transit',
            'out_for_delivery', 'delivered', 'completed', 'partially_shipped'
          )
      ) AS orders_30d,
      COUNT(*) FILTER (
        WHERE oi.item_status IN (
          'confirmed', 'processing', 'shipped', 'in_transit',
          'out_for_delivery', 'delivered', 'completed', 'partially_shipped'
        )
      ) AS orders_all
    FROM order_items oi
    GROUP BY oi.listing_id
  ),
  scored AS (
    SELECT
      l.id,
      (
        COALESCE(os.orders_30d, 0) * 5.0
        + LEAST(COALESCE(os.orders_all, 0), 100) * 0.75
        + COALESCE(l.average_rating, 0) * COALESCE(l.total_reviews, 0) * 0.4
        + CASE
            WHEN COALESCE(l.average_rating, 0) >= 4.5
              AND COALESCE(l.total_reviews, 0) >= 5
            THEN 20
            ELSE 0
          END
        + CASE WHEN l.is_featured = true THEN 6 ELSE 0 END
        + CASE
            WHEN l.created_at >= NOW() - INTERVAL '14 days'
            THEN 8
            ELSE 0
          END
        + CASE WHEN s.verified IS TRUE THEN 6 ELSE 0 END
        + CASE
            WHEN COALESCE(s.average_rating, 0) >= 4.5
              AND COALESCE(s.total_reviews, 0) >= 10
            THEN 8
            ELSE 0
          END
      )::numeric AS recommendation_score,
      COALESCE(os.orders_all, 0)::integer AS order_count
    FROM listings l
    INNER JOIN shops s ON s.id = l.shop_id AND s.is_active = true
    LEFT JOIN order_stats os ON os.listing_id = l.id
    WHERE l.is_active = true
      AND l.listing_status = 'active'
      AND EXISTS (
        SELECT 1
        FROM listing_images li
        WHERE li.listing_id = l.id
      )
  )
  SELECT
    s.id,
    s.recommendation_score,
    s.order_count
  FROM scored s
  WHERE s.recommendation_score >= 8
  ORDER BY s.recommendation_score DESC, s.id
  LIMIT GREATEST(1, LEAST(max_results, 2000));
$$;

CREATE OR REPLACE FUNCTION public.request_listing_featured_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_try_advisory_xact_lock(hashtext('sync_listing_featured_flags')) THEN
    PERFORM public.sync_listing_featured_flags();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_request_listing_featured_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.request_listing_featured_sync();
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS order_items_featured_sync ON public.order_items;
CREATE TRIGGER order_items_featured_sync
  AFTER INSERT OR UPDATE OF item_status, quantity
  ON public.order_items
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_request_listing_featured_sync();

DROP TRIGGER IF EXISTS listing_reviews_featured_sync ON public.listing_reviews;
CREATE TRIGGER listing_reviews_featured_sync
  AFTER INSERT OR UPDATE OF review_status, rating
  ON public.listing_reviews
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_request_listing_featured_sync();

DROP TRIGGER IF EXISTS listings_featured_sync ON public.listings;
CREATE TRIGGER listings_featured_sync
  AFTER UPDATE OF average_rating, total_reviews, is_active, listing_status
  ON public.listings
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_request_listing_featured_sync();

GRANT EXECUTE ON FUNCTION public.sync_listing_featured_flags(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_marketplace_recommended_listings(integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_listing_featured_sync() TO service_role;

-- Initial backfill for existing data.
SELECT public.sync_listing_featured_flags();
