-- Amazon-style seller catalog: product types, identifiers, typed attributes,
-- compliance documents, and A+ modules. Child rows cascade with the listing.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS product_type_id uuid,
  ADD COLUMN IF NOT EXISTS item_condition text;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_item_condition_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_item_condition_check
  CHECK (
    item_condition IS NULL
    OR item_condition IN (
      'new',
      'used_like_new',
      'used_very_good',
      'used_good',
      'used_acceptable',
      'refurbished'
    )
  );

CREATE TABLE IF NOT EXISTS public.product_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category_id text REFERENCES public.categories (category_id) ON DELETE SET NULL,
  family text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  variation_themes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_product_type_id_fkey;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_product_type_id_fkey
  FOREIGN KEY (product_type_id)
  REFERENCES public.product_types (id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS listings_product_type_id_idx
  ON public.listings (product_type_id);

CREATE TABLE IF NOT EXISTS public.product_type_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id uuid NOT NULL REFERENCES public.product_types (id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  description text,
  group_name text NOT NULL DEFAULT 'details',
  data_type text NOT NULL,
  unit text,
  is_required boolean NOT NULL DEFAULT false,
  is_recommended boolean NOT NULL DEFAULT false,
  is_variation_axis boolean NOT NULL DEFAULT false,
  max_length integer,
  min_value numeric,
  max_value numeric,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_type_id, code),
  CONSTRAINT product_type_attributes_data_type_check
    CHECK (data_type IN ('text', 'number', 'boolean', 'enum', 'multi_enum', 'measurement', 'date'))
);

CREATE TABLE IF NOT EXISTS public.product_type_attribute_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id uuid NOT NULL REFERENCES public.product_type_attributes (id) ON DELETE CASCADE,
  value text NOT NULL,
  label text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  UNIQUE (attribute_id, value)
);

CREATE TABLE IF NOT EXISTS public.product_type_compliance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id uuid NOT NULL REFERENCES public.product_types (id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  description text,
  is_required boolean NOT NULL DEFAULT false,
  document_types text[] NOT NULL DEFAULT '{}',
  display_order integer NOT NULL DEFAULT 0,
  UNIQUE (product_type_id, code)
);

CREATE TABLE IF NOT EXISTS public.listing_product_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  variation_id uuid REFERENCES public.listing_variations (id) ON DELETE CASCADE,
  product_id_type text NOT NULL DEFAULT 'none',
  product_id_value text,
  gtin_exemption boolean NOT NULL DEFAULT false,
  gtin_exemption_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_product_identifiers_type_check
    CHECK (product_id_type IN ('upc', 'ean', 'gtin', 'isbn', 'none')),
  CONSTRAINT listing_product_identifiers_reason_check
    CHECK (
      gtin_exemption_reason IS NULL
      OR gtin_exemption_reason IN (
        'handmade',
        'private_label',
        'bundle',
        'part',
        'brand_exemption'
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS listing_product_identifiers_parent_uidx
  ON public.listing_product_identifiers (listing_id)
  WHERE variation_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS listing_product_identifiers_child_uidx
  ON public.listing_product_identifiers (listing_id, variation_id)
  WHERE variation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.listing_attribute_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  variation_id uuid REFERENCES public.listing_variations (id) ON DELETE CASCADE,
  attribute_id uuid NOT NULL REFERENCES public.product_type_attributes (id) ON DELETE CASCADE,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS listing_attribute_values_parent_uidx
  ON public.listing_attribute_values (listing_id, attribute_id)
  WHERE variation_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS listing_attribute_values_child_uidx
  ON public.listing_attribute_values (listing_id, variation_id, attribute_id)
  WHERE variation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.listing_compliance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  requirement_code text NOT NULL,
  document_type text NOT NULL,
  file_url text NOT NULL,
  file_name text,
  expires_on date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_compliance_documents_listing_idx
  ON public.listing_compliance_documents (listing_id, requirement_code);

CREATE TABLE IF NOT EXISTS public.listing_aplus_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  module_type text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  headline text,
  body text,
  image_url text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_aplus_modules_type_check
    CHECK (module_type IN ('image_text', 'three_image_text', 'comparison', 'text'))
);

CREATE INDEX IF NOT EXISTS listing_aplus_modules_listing_idx
  ON public.listing_aplus_modules (listing_id, display_order);

-- ---------------------------------------------------------------------------
-- Seed helpers (dropped at the end of this migration)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._listing_family_for_category(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_name, '') ~* 'food|grocery|snack|gourmet|spice|pickle|edible' THEN 'food'
    WHEN coalesce(p_name, '') ~* 'beauty|cosmetic|skincare|makeup|hair' THEN 'beauty'
    WHEN coalesce(p_name, '') ~* 'jewel' THEN 'jewelry'
    WHEN coalesce(p_name, '') ~* 'kid|baby|child|infant' THEN 'kids'
    WHEN coalesce(p_name, '') ~* 'electronic|appliance|gadget' THEN 'electronics'
    WHEN coalesce(p_name, '') ~* 'apparel|fashion|cloth|wear|saree|ethnic|dress' THEN 'apparel'
    WHEN coalesce(p_name, '') ~* 'wellness|health|fitness|yoga|ayur' THEN 'wellness'
    WHEN coalesce(p_name, '') ~* 'home|decor|kitchen|living|furnish' THEN 'home'
    WHEN coalesce(p_name, '') ~* 'digital|download|course|ebook' THEN 'digital'
    ELSE 'general'
  END;
$$;

CREATE OR REPLACE FUNCTION public._listing_variation_themes(p_family text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_family = 'digital' THEN '[]'::jsonb
    ELSE '[
      {"code":"color","label":"Color","axes":["Color"]},
      {"code":"size","label":"Size","axes":["Size"]},
      {"code":"color_size","label":"Color and size","axes":["Color","Size"]}
    ]'::jsonb
  END;
$$;

CREATE OR REPLACE FUNCTION public._add_product_type_attribute(
  p_type uuid,
  p_code text,
  p_label text,
  p_data_type text,
  p_required boolean,
  p_recommended boolean,
  p_axis boolean,
  p_order integer,
  p_unit text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.product_type_attributes (
    product_type_id, code, label, data_type, is_required, is_recommended,
    is_variation_axis, display_order, unit, group_name
  )
  VALUES (
    p_type, p_code, p_label, p_data_type, p_required, p_recommended,
    p_axis, p_order, p_unit, 'details'
  )
  ON CONFLICT (product_type_id, code) DO UPDATE
    SET label = EXCLUDED.label,
        data_type = EXCLUDED.data_type,
        is_required = EXCLUDED.is_required,
        is_recommended = EXCLUDED.is_recommended,
        is_variation_axis = EXCLUDED.is_variation_axis,
        display_order = EXCLUDED.display_order,
        unit = EXCLUDED.unit,
        updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._add_attribute_option(
  p_attr uuid,
  p_value text,
  p_label text,
  p_order integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.product_type_attribute_options (attribute_id, value, label, display_order)
  VALUES (p_attr, p_value, p_label, p_order)
  ON CONFLICT (attribute_id, value) DO UPDATE
    SET label = EXCLUDED.label,
        display_order = EXCLUDED.display_order;
END;
$$;

CREATE OR REPLACE FUNCTION public._seed_color_size(p_type uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_color uuid;
  v_size uuid;
BEGIN
  v_color := public._add_product_type_attribute(p_type, 'color', 'Color', 'enum', false, true, true, 10, NULL);
  v_size := public._add_product_type_attribute(p_type, 'size', 'Size', 'enum', false, true, true, 20, NULL);
  PERFORM public._add_attribute_option(v_color, opt.value, opt.label, opt.ord)
  FROM (
    VALUES
      ('Black', 'Black', 1),
      ('White', 'White', 2),
      ('Red', 'Red', 3),
      ('Blue', 'Blue', 4),
      ('Green', 'Green', 5),
      ('Pink', 'Pink', 6),
      ('Beige', 'Beige', 7),
      ('Brown', 'Brown', 8),
      ('Gold', 'Gold', 9),
      ('Silver', 'Silver', 10),
      ('Multi', 'Multi', 11)
  ) AS opt(value, label, ord);
  PERFORM public._add_attribute_option(v_size, opt.value, opt.label, opt.ord)
  FROM (
    VALUES
      ('XS', 'XS', 1),
      ('S', 'S', 2),
      ('M', 'M', 3),
      ('L', 'L', 4),
      ('XL', 'XL', 5),
      ('XXL', 'XXL', 6),
      ('Free size', 'Free size', 7)
  ) AS opt(value, label, ord);
  PERFORM public._add_product_type_attribute(p_type, 'material', 'Material', 'text', false, true, false, 30, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public._seed_listing_product_type(
  p_code text,
  p_name text,
  p_family text,
  p_category_id text,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
  v_attr uuid;
BEGIN
  INSERT INTO public.product_types (code, name, description, category_id, family, variation_themes, is_active)
  VALUES (
    p_code,
    p_name,
    coalesce(p_description, p_name),
    p_category_id,
    p_family,
    public._listing_variation_themes(p_family),
    true
  )
  ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        category_id = COALESCE(EXCLUDED.category_id, public.product_types.category_id),
        family = EXCLUDED.family,
        variation_themes = EXCLUDED.variation_themes,
        updated_at = now()
  RETURNING id INTO v_id;

  IF p_family <> 'digital' THEN
    PERFORM public._seed_color_size(v_id);
  END IF;

  IF p_family = 'apparel' THEN
    v_attr := public._add_product_type_attribute(v_id, 'fabric_type', 'Fabric', 'enum', true, false, false, 40, NULL);
    PERFORM public._add_attribute_option(v_attr, opt.value, opt.label, opt.ord)
    FROM (
      VALUES
        ('Cotton', 'Cotton', 1),
        ('Silk', 'Silk', 2),
        ('Linen', 'Linen', 3),
        ('Wool', 'Wool', 4),
        ('Polyester', 'Polyester', 5),
        ('Blend', 'Blend', 6)
    ) AS opt(value, label, ord);
    PERFORM public._add_product_type_attribute(v_id, 'care', 'Care', 'text', false, true, false, 50, NULL);
  ELSIF p_family = 'beauty' THEN
    PERFORM public._add_product_type_attribute(v_id, 'ingredients', 'Ingredients', 'text', true, false, false, 40, NULL);
    v_attr := public._add_product_type_attribute(v_id, 'skin_type', 'Skin type', 'multi_enum', false, true, false, 50, NULL);
    PERFORM public._add_attribute_option(v_attr, opt.value, opt.label, opt.ord)
    FROM (
      VALUES
        ('All', 'All', 1),
        ('Dry', 'Dry', 2),
        ('Oily', 'Oily', 3),
        ('Combination', 'Combination', 4),
        ('Sensitive', 'Sensitive', 5)
    ) AS opt(value, label, ord);
    PERFORM public._add_product_type_attribute(v_id, 'volume', 'Volume', 'measurement', true, false, false, 60, 'ml');
    INSERT INTO public.product_type_compliance_requirements (
      product_type_id, code, label, description, is_required, document_types, display_order
    )
    VALUES (
      v_id,
      'ingredient_list',
      'Ingredient list',
      'Upload the ingredient declaration or a lab report.',
      true,
      ARRAY['ingredient_declaration', 'lab_report'],
      1
    )
    ON CONFLICT (product_type_id, code) DO NOTHING;
  ELSIF p_family = 'jewelry' THEN
    v_attr := public._add_product_type_attribute(v_id, 'metal', 'Metal', 'enum', true, false, false, 40, NULL);
    PERFORM public._add_attribute_option(v_attr, opt.value, opt.label, opt.ord)
    FROM (
      VALUES
        ('Gold', 'Gold', 1),
        ('Silver', 'Silver', 2),
        ('Brass', 'Brass', 3),
        ('Steel', 'Steel', 4),
        ('Fashion metal', 'Fashion metal', 5)
    ) AS opt(value, label, ord);
    PERFORM public._add_product_type_attribute(v_id, 'stone', 'Stone', 'text', false, true, false, 50, NULL);
    PERFORM public._add_product_type_attribute(v_id, 'hallmark', 'Hallmark', 'boolean', false, true, false, 60, NULL);
  ELSIF p_family = 'food' THEN
    PERFORM public._add_product_type_attribute(v_id, 'ingredients', 'Ingredients', 'text', true, false, false, 40, NULL);
    PERFORM public._add_product_type_attribute(v_id, 'allergens', 'Allergens', 'text', true, false, false, 50, NULL);
    PERFORM public._add_product_type_attribute(v_id, 'net_weight', 'Net weight', 'measurement', true, false, false, 60, 'g');
    PERFORM public._add_product_type_attribute(v_id, 'vegetarian', 'Vegetarian', 'boolean', true, false, false, 70, NULL);
    INSERT INTO public.product_type_compliance_requirements (
      product_type_id, code, label, description, is_required, document_types, display_order
    )
    VALUES (
      v_id,
      'fssai',
      'FSSAI license',
      'Upload the FSSAI license or registration.',
      true,
      ARRAY['fssai_license', 'lab_report'],
      1
    )
    ON CONFLICT (product_type_id, code) DO NOTHING;
  ELSIF p_family = 'home' THEN
    PERFORM public._add_product_type_attribute(v_id, 'primary_material', 'Primary material', 'text', true, false, false, 40, NULL);
    PERFORM public._add_product_type_attribute(v_id, 'assembly_required', 'Assembly required', 'boolean', false, true, false, 50, NULL);
  ELSIF p_family = 'wellness' THEN
    PERFORM public._add_product_type_attribute(v_id, 'ingredients', 'Ingredients', 'text', false, true, false, 40, NULL);
    v_attr := public._add_product_type_attribute(v_id, 'form', 'Form', 'enum', false, true, false, 50, NULL);
    PERFORM public._add_attribute_option(v_attr, opt.value, opt.label, opt.ord)
    FROM (
      VALUES
        ('Oil', 'Oil', 1),
        ('Powder', 'Powder', 2),
        ('Capsule', 'Capsule', 3),
        ('Cream', 'Cream', 4)
    ) AS opt(value, label, ord);
  ELSIF p_family = 'kids' THEN
    v_attr := public._add_product_type_attribute(v_id, 'age_grade', 'Age grade', 'enum', true, false, false, 40, NULL);
    PERFORM public._add_attribute_option(v_attr, opt.value, opt.label, opt.ord)
    FROM (
      VALUES
        ('0-3 months', '0–3 months', 1),
        ('3-12 months', '3–12 months', 2),
        ('1-3 years', '1–3 years', 3),
        ('3-6 years', '3–6 years', 4),
        ('6-12 years', '6–12 years', 5),
        ('12+', '12+', 6)
    ) AS opt(value, label, ord);
    INSERT INTO public.product_type_compliance_requirements (
      product_type_id, code, label, description, is_required, document_types, display_order
    )
    VALUES (
      v_id,
      'age_grade',
      'Age-grade certificate',
      'Upload a safety or age-grade certificate.',
      true,
      ARRAY['age_grade_certificate', 'safety_certificate'],
      1
    )
    ON CONFLICT (product_type_id, code) DO NOTHING;
  ELSIF p_family = 'electronics' THEN
    PERFORM public._add_product_type_attribute(v_id, 'wattage', 'Wattage', 'number', false, true, false, 40, 'W');
    INSERT INTO public.product_type_compliance_requirements (
      product_type_id, code, label, description, is_required, document_types, display_order
    )
    VALUES (
      v_id,
      'bis',
      'BIS certificate',
      'Upload the BIS registration certificate.',
      true,
      ARRAY['bis_certificate'],
      1
    )
    ON CONFLICT (product_type_id, code) DO NOTHING;
  ELSIF p_family = 'digital' THEN
    v_attr := public._add_product_type_attribute(v_id, 'file_format', 'File format', 'enum', true, false, false, 10, NULL);
    PERFORM public._add_attribute_option(v_attr, opt.value, opt.label, opt.ord)
    FROM (
      VALUES
        ('PDF', 'PDF', 1),
        ('Video', 'Video', 2),
        ('Audio', 'Audio', 3),
        ('ZIP', 'ZIP', 4),
        ('Other', 'Other', 5)
    ) AS opt(value, label, ord);
  END IF;

  RETURN v_id;
END;
$$;

DO $$
DECLARE
  cat record;
  fam text;
  type_code text;
BEGIN
  PERFORM public._seed_listing_product_type(
    'general',
    'General merchandise',
    'general',
    NULL,
    'Fallback product type when a browse category has no closer match.'
  );
  PERFORM public._seed_listing_product_type(
    'digital_download',
    'Digital download',
    'digital',
    NULL,
    'Files, courses, and other downloads.'
  );

  FOR cat IN
    SELECT category_id, category, description
    FROM public.categories
    WHERE parent_id IS NULL
      AND status = 'A'
  LOOP
    fam := public._listing_family_for_category(cat.category);
    type_code := 'cat_' || left(replace(cat.category_id::text, '-', ''), 40);
    PERFORM public._seed_listing_product_type(
      type_code,
      cat.category,
      fam,
      cat.category_id,
      cat.description
    );
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public._seed_listing_product_type(text, text, text, uuid, text);
DROP FUNCTION IF EXISTS public._seed_color_size(uuid);
DROP FUNCTION IF EXISTS public._add_attribute_option(uuid, text, text, integer);
DROP FUNCTION IF EXISTS public._add_product_type_attribute(uuid, text, text, text, boolean, boolean, boolean, integer, text);
DROP FUNCTION IF EXISTS public._listing_variation_themes(text);
DROP FUNCTION IF EXISTS public._listing_family_for_category(text);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.listing_managed_by_current_user(p_listing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.listings l
    JOIN public.shops s ON s.id = l.shop_id
    WHERE l.id = p_listing_id
      AND (
        s.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'A'
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.listing_managed_by_current_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listing_managed_by_current_user(uuid) TO authenticated;

ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_type_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_type_attribute_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_type_compliance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_product_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_aplus_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_types_public_read ON public.product_types;
CREATE POLICY product_types_public_read
  ON public.product_types FOR SELECT TO anon, authenticated
  USING (is_active OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'A'
  ));

DROP POLICY IF EXISTS product_types_admin_write ON public.product_types;
CREATE POLICY product_types_admin_write
  ON public.product_types FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'A'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'A'));

DROP POLICY IF EXISTS product_type_attributes_public_read ON public.product_type_attributes;
CREATE POLICY product_type_attributes_public_read
  ON public.product_type_attributes FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS product_type_attributes_admin_write ON public.product_type_attributes;
CREATE POLICY product_type_attributes_admin_write
  ON public.product_type_attributes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'A'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'A'));

DROP POLICY IF EXISTS product_type_attribute_options_public_read ON public.product_type_attribute_options;
CREATE POLICY product_type_attribute_options_public_read
  ON public.product_type_attribute_options FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS product_type_attribute_options_admin_write ON public.product_type_attribute_options;
CREATE POLICY product_type_attribute_options_admin_write
  ON public.product_type_attribute_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'A'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'A'));

DROP POLICY IF EXISTS product_type_compliance_public_read ON public.product_type_compliance_requirements;
CREATE POLICY product_type_compliance_public_read
  ON public.product_type_compliance_requirements FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS product_type_compliance_admin_write ON public.product_type_compliance_requirements;
CREATE POLICY product_type_compliance_admin_write
  ON public.product_type_compliance_requirements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'A'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'A'));

DROP POLICY IF EXISTS listing_product_identifiers_manage ON public.listing_product_identifiers;
CREATE POLICY listing_product_identifiers_manage
  ON public.listing_product_identifiers FOR ALL TO authenticated
  USING (public.listing_managed_by_current_user(listing_id))
  WITH CHECK (public.listing_managed_by_current_user(listing_id));

DROP POLICY IF EXISTS listing_attribute_values_read ON public.listing_attribute_values;
CREATE POLICY listing_attribute_values_read
  ON public.listing_attribute_values FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS listing_attribute_values_write ON public.listing_attribute_values;
CREATE POLICY listing_attribute_values_write
  ON public.listing_attribute_values FOR ALL TO authenticated
  USING (public.listing_managed_by_current_user(listing_id))
  WITH CHECK (public.listing_managed_by_current_user(listing_id));

DROP POLICY IF EXISTS listing_compliance_documents_manage ON public.listing_compliance_documents;
CREATE POLICY listing_compliance_documents_manage
  ON public.listing_compliance_documents FOR ALL TO authenticated
  USING (public.listing_managed_by_current_user(listing_id))
  WITH CHECK (public.listing_managed_by_current_user(listing_id));

DROP POLICY IF EXISTS listing_aplus_modules_read ON public.listing_aplus_modules;
CREATE POLICY listing_aplus_modules_read
  ON public.listing_aplus_modules FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS listing_aplus_modules_write ON public.listing_aplus_modules;
CREATE POLICY listing_aplus_modules_write
  ON public.listing_aplus_modules FOR ALL TO authenticated
  USING (public.listing_managed_by_current_user(listing_id))
  WITH CHECK (public.listing_managed_by_current_user(listing_id));

GRANT SELECT ON public.product_types TO anon, authenticated;
GRANT SELECT ON public.product_type_attributes TO anon, authenticated;
GRANT SELECT ON public.product_type_attribute_options TO anon, authenticated;
GRANT SELECT ON public.product_type_compliance_requirements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_types TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_type_attributes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_type_attribute_options TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_type_compliance_requirements TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_product_identifiers TO authenticated;
GRANT SELECT ON public.listing_attribute_values TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.listing_attribute_values TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_compliance_documents TO authenticated;
GRANT SELECT ON public.listing_aplus_modules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.listing_aplus_modules TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-compliance',
  'listing-compliance',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS listing_compliance_owner_select ON storage.objects;
CREATE POLICY listing_compliance_owner_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'listing-compliance'
    AND (
      EXISTS (
        SELECT 1 FROM public.shops s
        WHERE s.id::text = (storage.foldername(name))[1]
          AND s.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'A'
      )
    )
  );

DROP POLICY IF EXISTS listing_compliance_owner_insert ON storage.objects;
CREATE POLICY listing_compliance_owner_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'listing-compliance'
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND (
          s.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'A'
          )
        )
    )
  );

DROP POLICY IF EXISTS listing_compliance_owner_update ON storage.objects;
CREATE POLICY listing_compliance_owner_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'listing-compliance'
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'listing-compliance'
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS listing_compliance_owner_delete ON storage.objects;
CREATE POLICY listing_compliance_owner_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'listing-compliance'
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.user_id = auth.uid()
    )
  );

-- Append columns so CREATE OR REPLACE keeps the existing view column order.
CREATE OR REPLACE VIEW public.listing_details_view AS
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
        'variation_id', li.variation_id
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
  ) AS sections,
  l.item_condition,
  l.product_type_id
FROM listings l
JOIN shops s ON l.shop_id = s.id;
