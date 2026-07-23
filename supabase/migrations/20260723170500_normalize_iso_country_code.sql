-- Required by atomic_marketplace_checkout (20260723170000). Safe to re-run.

CREATE OR REPLACE FUNCTION public.normalize_iso_country_code(p_value text)
RETURNS character varying(2)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_raw text := upper(trim(coalesce(p_value, '')));
BEGIN
  IF v_raw = '' THEN
    RETURN 'IN';
  END IF;

  IF char_length(v_raw) = 2 THEN
    RETURN v_raw;
  END IF;

  RETURN CASE
    WHEN v_raw IN ('IND', 'INDIA') THEN 'IN'
    WHEN v_raw IN ('USA', 'UNITED STATES', 'UNITED STATES OF AMERICA') THEN 'US'
    WHEN v_raw IN ('GBR', 'UK', 'UNITED KINGDOM', 'GREAT BRITAIN') THEN 'GB'
    WHEN v_raw IN ('AUS', 'AUSTRALIA') THEN 'AU'
    WHEN v_raw IN ('CAN', 'CANADA') THEN 'CA'
    WHEN v_raw IN ('ARE', 'UAE', 'UNITED ARAB EMIRATES') THEN 'AE'
    WHEN v_raw IN ('SGP', 'SINGAPORE') THEN 'SG'
    WHEN v_raw IN ('DEU', 'GERMANY') THEN 'DE'
    WHEN v_raw IN ('FRA', 'FRANCE') THEN 'FR'
    WHEN char_length(v_raw) = 3 THEN left(v_raw, 2)
    ELSE 'IN'
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_iso_country_code(text) TO authenticated;
