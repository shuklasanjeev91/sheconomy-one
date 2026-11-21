-- Return listings to the July 2026 shape: title, price, details, photos, and SEO.
-- Maker, personalization, and variation visibility columns added later are removed.

DROP VIEW IF EXISTS public.listing_details_view;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_who_made_check,
  DROP CONSTRAINT IF EXISTS listings_when_made_check,
  DROP CONSTRAINT IF EXISTS listings_what_is_it_check,
  DROP CONSTRAINT IF EXISTS listings_personalization_char_limit_check;

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS who_made,
  DROP COLUMN IF EXISTS when_made,
  DROP COLUMN IF EXISTS what_is_it,
  DROP COLUMN IF EXISTS personalization_enabled,
  DROP COLUMN IF EXISTS personalization_instructions,
  DROP COLUMN IF EXISTS personalization_char_limit,
  DROP COLUMN IF EXISTS personalization_required;

ALTER TABLE public.listing_variations
  DROP CONSTRAINT IF EXISTS listing_variations_processing_time_check;

ALTER TABLE public.listing_variations
  DROP COLUMN IF EXISTS processing_time_min,
  DROP COLUMN IF EXISTS processing_time_max,
  DROP COLUMN IF EXISTS is_visible;

CREATE VIEW public.listing_details_view AS
SELECT
  l.id,
  l.shop_id,
  l.title,
  l.description,
  l.listing_type,
  l.price,
  l.quantity,
  l.is_featured,
  l.is_active,
  l.listing_status,
  l.slug,
  l.meta_title,
  l.meta_description,
  l.tags,
  l.digital_file_url,
  l.digital_file_size,
  l.digital_file_type,
  l.download_limit,
  l.stock,
  l.sku,
  l.weight,
  l.dimensions,
  l.shipping_required,
  l.is_online,
  l.booking_duration_minutes,
  l.location_id,
  l.meeting_url,
  l.max_attendees,
  l.requires_approval,
  l.listing_metadata,
  l.created_at,
  l.updated_at,
  l.published_at,
  s.shop_name,
  s.shop_description,
  s.logo_url,
  s.verified AS shop_verified,
  s.shop_currency,
  s.shop_hours,
  s.social_links,
  (
    SELECT json_agg(
      json_build_object(
        'id', li.id,
        'image_url', li.image_url,
        'alt_text', li.alt_text,
        'is_primary', li.is_primary,
        'display_order', li.display_order,
        'variation_id', li.variation_id,
        'image_type', li.image_type
      )
      ORDER BY li.display_order, li.created_at
    )
    FROM listing_images li
    WHERE li.listing_id = l.id
  ) AS images,
  (
    SELECT json_agg(
      json_build_object(
        'id', lv.id,
        'variation_name', lv.variation_name,
        'variation_value', lv.variation_value,
        'price_adjustment', lv.price_adjustment,
        'price', lv.price,
        'mrp', lv.mrp,
        'tax_percent', lv.tax_percent,
        'price_includes_tax', lv.price_includes_tax,
        'hsn_code', lv.hsn_code,
        'weight', lv.weight,
        'stock', lv.stock,
        'sku', lv.sku,
        'is_available', lv.is_available,
        'variation_metadata', lv.variation_metadata
      )
      ORDER BY lv.display_order, lv.variation_name, lv.variation_value
    )
    FROM listing_variations lv
    WHERE lv.listing_id = l.id
  ) AS variations,
  (
    SELECT json_agg(
      json_build_object(
        'id', la.id,
        'attribute_name', la.attribute_name,
        'attribute_value', la.attribute_value,
        'attribute_type', la.attribute_type,
        'is_filterable', la.is_filterable
      )
      ORDER BY la.display_order, la.attribute_name
    )
    FROM listing_attributes la
    WHERE la.listing_id = l.id
  ) AS attributes,
  (
    SELECT json_agg(
      json_build_object(
        'id', lm.id,
        'material_name', lm.material_name,
        'percentage', lm.percentage,
        'is_primary', lm.is_primary,
        'is_sustainable', lm.is_sustainable,
        'certification', lm.certification
      )
      ORDER BY lm.is_primary DESC, lm.percentage DESC NULLS LAST
    )
    FROM listing_materials lm
    WHERE lm.listing_id = l.id
  ) AS materials,
  (
    SELECT json_agg(
      json_build_object(
        'id', ss.id,
        'section_name', ss.section_name,
        'description', ss.description,
        'slug', ss.slug
      )
    )
    FROM shop_sections ss
    JOIN listing_sections ls ON ss.id = ls.section_id
    WHERE ls.listing_id = l.id AND ss.is_active = true
  ) AS sections
FROM listings l
JOIN shops s ON l.shop_id = s.id;

GRANT SELECT ON public.listing_details_view TO anon, authenticated, service_role;
