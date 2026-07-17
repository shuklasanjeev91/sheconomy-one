-- ============================================================
-- Migration: cms_setup
-- Description: Content Management System — tables, RLS, storage,
--              SEO helpers, and increment RPCs.
-- Idempotent: safe on databases that already have CMS applied.
-- Roles: A=Admin, V=Vendor, U=User (via cms_get_role / profiles.role)
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE cms_content_type AS ENUM ('post', 'page', 'product', 'announcement');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cms_content_status AS ENUM ('draft', 'review', 'scheduled', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cms_media_type AS ENUM ('image', 'video', 'document', 'audio', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cms_categories (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  parent_id   UUID         REFERENCES public.cms_categories(id) ON DELETE SET NULL,
  cover_url   TEXT,
  sort_order  INTEGER      DEFAULT 0    NOT NULL,
  is_active   BOOLEAN      DEFAULT true NOT NULL,
  created_by  UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ  DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cms_categories_slug ON public.cms_categories(slug);
CREATE INDEX IF NOT EXISTS idx_cms_categories_parent_id ON public.cms_categories(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cms_categories_active ON public.cms_categories(is_active);

CREATE TABLE IF NOT EXISTS public.cms_tags (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name       VARCHAR(60) NOT NULL UNIQUE,
  slug       VARCHAR(80) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cms_tags_slug ON public.cms_tags(slug);

CREATE TABLE IF NOT EXISTS public.cms_media (
  id           UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by  UUID           REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name    VARCHAR(255)   NOT NULL,
  file_size    BIGINT         NOT NULL,
  mime_type    VARCHAR(100)   NOT NULL,
  media_type   cms_media_type NOT NULL DEFAULT 'other',
  bucket_id    VARCHAR(100)   NOT NULL,
  storage_path TEXT           NOT NULL UNIQUE,
  public_url   TEXT,
  width        INTEGER,
  height       INTEGER,
  alt_text     TEXT,
  caption      TEXT,
  folder       VARCHAR(255)   DEFAULT '/' NOT NULL,
  is_active    BOOLEAN        DEFAULT true NOT NULL,
  created_at   TIMESTAMPTZ    DEFAULT now() NOT NULL,
  updated_at   TIMESTAMPTZ    DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cms_media_uploaded_by ON public.cms_media(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_cms_media_type ON public.cms_media(media_type);
CREATE INDEX IF NOT EXISTS idx_cms_media_bucket ON public.cms_media(bucket_id);
CREATE INDEX IF NOT EXISTS idx_cms_media_folder ON public.cms_media(folder);
CREATE INDEX IF NOT EXISTS idx_cms_media_created_at ON public.cms_media(created_at);

CREATE TABLE IF NOT EXISTS public.cms_content (
  id              UUID               DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id       UUID               NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  category_id     UUID               REFERENCES public.cms_categories(id) ON DELETE SET NULL,
  type            cms_content_type   NOT NULL DEFAULT 'post',
  status          cms_content_status NOT NULL DEFAULT 'draft',
  title           VARCHAR(300)       NOT NULL,
  slug            VARCHAR(320)       NOT NULL UNIQUE,
  excerpt         TEXT,
  body            TEXT,
  body_format     VARCHAR(20)        DEFAULT 'markdown' NOT NULL
                  CHECK (body_format IN ('markdown','html','plain')),
  cover_image_id  UUID               REFERENCES public.cms_media(id) ON DELETE SET NULL,
  seo_title       VARCHAR(160),
  seo_description VARCHAR(320),
  seo_keywords    TEXT[],
  canonical_url   TEXT,
  published_at    TIMESTAMPTZ,
  scheduled_at    TIMESTAMPTZ,
  view_count      INTEGER            DEFAULT 0 NOT NULL,
  like_count      INTEGER            DEFAULT 0 NOT NULL,
  comment_count   INTEGER            DEFAULT 0 NOT NULL,
  is_featured     BOOLEAN            DEFAULT false NOT NULL,
  allow_comments  BOOLEAN            DEFAULT true  NOT NULL,
  vendor_id       UUID               REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata        JSONB              DEFAULT '{}'::jsonb NOT NULL,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ        DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ        DEFAULT now() NOT NULL
);

-- SEO columns on cms_content (from former 004_cms_seo)
ALTER TABLE public.cms_content
  ADD COLUMN IF NOT EXISTS og_title        VARCHAR(300),
  ADD COLUMN IF NOT EXISTS og_description  VARCHAR(200),
  ADD COLUMN IF NOT EXISTS og_image_id     UUID REFERENCES public.cms_media(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS og_type         VARCHAR(30) DEFAULT 'article',
  ADD COLUMN IF NOT EXISTS twitter_card    VARCHAR(20) DEFAULT 'summary_large_image',
  ADD COLUMN IF NOT EXISTS twitter_title   VARCHAR(300),
  ADD COLUMN IF NOT EXISTS twitter_description VARCHAR(200),
  ADD COLUMN IF NOT EXISTS twitter_image_id UUID REFERENCES public.cms_media(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS robots_index    BOOLEAN DEFAULT true  NOT NULL,
  ADD COLUMN IF NOT EXISTS robots_follow   BOOLEAN DEFAULT true  NOT NULL,
  ADD COLUMN IF NOT EXISTS robots_extra    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS schema_org      JSONB DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS sitemap_priority     NUMERIC(2,1) DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS sitemap_changefreq   VARCHAR(10) DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS sitemap_exclude      BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS focus_keyword   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS seo_score       SMALLINT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cms_content_author_id ON public.cms_content(author_id);
CREATE INDEX IF NOT EXISTS idx_cms_content_category_id ON public.cms_content(category_id);
CREATE INDEX IF NOT EXISTS idx_cms_content_type ON public.cms_content(type);
CREATE INDEX IF NOT EXISTS idx_cms_content_status ON public.cms_content(status);
CREATE INDEX IF NOT EXISTS idx_cms_content_slug ON public.cms_content(slug);
CREATE INDEX IF NOT EXISTS idx_cms_content_published_at ON public.cms_content(published_at) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cms_content_scheduled_at ON public.cms_content(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cms_content_featured ON public.cms_content(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_cms_content_vendor_id ON public.cms_content(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cms_content_not_deleted ON public.cms_content(created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cms_content_fts ON public.cms_content
  USING gin(to_tsvector('english',
    coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(body,'')
  ));

CREATE TABLE IF NOT EXISTS public.cms_content_tag_map (
  content_id UUID NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES public.cms_tags(id)    ON DELETE CASCADE,
  PRIMARY KEY (content_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_cms_tag_map_tag_id ON public.cms_content_tag_map(tag_id);

CREATE TABLE IF NOT EXISTS public.cms_content_media (
  id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID    NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  media_id   UUID    NOT NULL REFERENCES public.cms_media(id)   ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  UNIQUE (content_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_cms_content_media_content ON public.cms_content_media(content_id);

CREATE TABLE IF NOT EXISTS public.cms_content_versions (
  id          UUID               DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id  UUID               NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  version_no  INTEGER            NOT NULL,
  title       VARCHAR(300)       NOT NULL,
  body        TEXT,
  body_format VARCHAR(20)        NOT NULL DEFAULT 'markdown',
  status      cms_content_status NOT NULL,
  saved_by    UUID               REFERENCES auth.users(id) ON DELETE SET NULL,
  change_note TEXT,
  created_at  TIMESTAMPTZ        DEFAULT now() NOT NULL,
  UNIQUE (content_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_cms_versions_content_id ON public.cms_content_versions(content_id);
CREATE INDEX IF NOT EXISTS idx_cms_versions_created_at ON public.cms_content_versions(created_at);

CREATE TABLE IF NOT EXISTS public.cms_blog_comments (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id  UUID        NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id   UUID        REFERENCES public.cms_blog_comments(id) ON DELETE CASCADE,
  body        TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  is_approved BOOLEAN     DEFAULT false NOT NULL,
  is_flagged  BOOLEAN     DEFAULT false NOT NULL,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cms_comments_content_id ON public.cms_blog_comments(content_id);
CREATE INDEX IF NOT EXISTS idx_cms_comments_author_id ON public.cms_blog_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_cms_comments_parent_id ON public.cms_blog_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cms_comments_approved ON public.cms_blog_comments(is_approved);
CREATE INDEX IF NOT EXISTS idx_cms_comments_not_deleted ON public.cms_blog_comments(created_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.cms_blog_likes (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID        NOT NULL REFERENCES public.cms_content(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (content_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cms_likes_content_id ON public.cms_blog_likes(content_id);
CREATE INDEX IF NOT EXISTS idx_cms_likes_user_id ON public.cms_blog_likes(user_id);

CREATE TABLE IF NOT EXISTS public.cms_seo (
  id                  UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id          UUID         REFERENCES public.cms_content(id)    ON DELETE CASCADE,
  category_id         UUID         REFERENCES public.cms_categories(id) ON DELETE CASCADE,
  custom_path         VARCHAR(500) UNIQUE,
  meta_title          VARCHAR(60)  NOT NULL,
  meta_description    VARCHAR(160),
  focus_keyword       VARCHAR(100),
  canonical_url       TEXT,
  robots_index        BOOLEAN      DEFAULT true  NOT NULL,
  robots_follow       BOOLEAN      DEFAULT true  NOT NULL,
  robots_extra        VARCHAR(100),
  og_title            VARCHAR(300),
  og_description      VARCHAR(500),
  og_image_id         UUID         REFERENCES public.cms_media(id) ON DELETE SET NULL,
  og_type             VARCHAR(30)  DEFAULT 'website',
  twitter_card        VARCHAR(20)  DEFAULT 'summary_large_image',
  twitter_title       VARCHAR(300),
  twitter_description VARCHAR(200),
  twitter_image_id    UUID         REFERENCES public.cms_media(id) ON DELETE SET NULL,
  schema_org          JSONB        DEFAULT '[]'::jsonb NOT NULL,
  sitemap_priority    NUMERIC(2,1) DEFAULT 0.5,
  sitemap_changefreq  VARCHAR(10)  DEFAULT 'weekly',
  sitemap_exclude     BOOLEAN      DEFAULT false NOT NULL,
  seo_score           SMALLINT     DEFAULT 0,
  created_by          UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by          UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ  DEFAULT now() NOT NULL,
  updated_at          TIMESTAMPTZ  DEFAULT now() NOT NULL,
  CONSTRAINT cms_seo_one_target CHECK (
    (content_id  IS NOT NULL)::int
    + (category_id IS NOT NULL)::int
    + (custom_path IS NOT NULL)::int
    = 1
  ),
  UNIQUE (content_id),
  UNIQUE (category_id)
);

CREATE INDEX IF NOT EXISTS idx_cms_seo_content_id ON public.cms_seo(content_id) WHERE content_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cms_seo_category_id ON public.cms_seo(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cms_seo_custom_path ON public.cms_seo(custom_path) WHERE custom_path IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cms_seo_redirects (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  from_path     VARCHAR(500) NOT NULL UNIQUE,
  to_path       VARCHAR(500),
  redirect_code SMALLINT    DEFAULT 301 NOT NULL
    CHECK (redirect_code IN (301, 302, 307, 308, 410)),
  is_active     BOOLEAN     DEFAULT true NOT NULL,
  hit_count     INTEGER     DEFAULT 0   NOT NULL,
  note          TEXT,
  created_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cms_seo_redirects_from_path ON public.cms_seo_redirects(from_path);
CREATE INDEX IF NOT EXISTS idx_cms_seo_redirects_is_active ON public.cms_seo_redirects(is_active);

-- ============================================================
-- HELPERS / TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.cms_get_role()
RETURNS CHAR AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.cms_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cms_categories_updated_at ON public.cms_categories;
CREATE TRIGGER trg_cms_categories_updated_at
  BEFORE UPDATE ON public.cms_categories
  FOR EACH ROW EXECUTE FUNCTION public.cms_set_updated_at();

DROP TRIGGER IF EXISTS trg_cms_media_updated_at ON public.cms_media;
CREATE TRIGGER trg_cms_media_updated_at
  BEFORE UPDATE ON public.cms_media
  FOR EACH ROW EXECUTE FUNCTION public.cms_set_updated_at();

DROP TRIGGER IF EXISTS trg_cms_content_updated_at ON public.cms_content;
CREATE TRIGGER trg_cms_content_updated_at
  BEFORE UPDATE ON public.cms_content
  FOR EACH ROW EXECUTE FUNCTION public.cms_set_updated_at();

DROP TRIGGER IF EXISTS trg_cms_comments_updated_at ON public.cms_blog_comments;
CREATE TRIGGER trg_cms_comments_updated_at
  BEFORE UPDATE ON public.cms_blog_comments
  FOR EACH ROW EXECUTE FUNCTION public.cms_set_updated_at();

DROP TRIGGER IF EXISTS trg_cms_seo_updated_at ON public.cms_seo;
CREATE TRIGGER trg_cms_seo_updated_at
  BEFORE UPDATE ON public.cms_seo
  FOR EACH ROW EXECUTE FUNCTION public.cms_set_updated_at();

DROP TRIGGER IF EXISTS trg_cms_seo_redirects_updated_at ON public.cms_seo_redirects;
CREATE TRIGGER trg_cms_seo_redirects_updated_at
  BEFORE UPDATE ON public.cms_seo_redirects
  FOR EACH ROW EXECUTE FUNCTION public.cms_set_updated_at();

CREATE OR REPLACE FUNCTION public.cms_set_version_no()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version_no := COALESCE(
    (SELECT MAX(version_no) + 1 FROM public.cms_content_versions WHERE content_id = NEW.content_id),
    1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cms_version_no ON public.cms_content_versions;
CREATE TRIGGER trg_cms_version_no
  BEFORE INSERT ON public.cms_content_versions
  FOR EACH ROW EXECUTE FUNCTION public.cms_set_version_no();

CREATE OR REPLACE FUNCTION public.cms_sync_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.cms_content SET like_count = like_count + 1 WHERE id = NEW.content_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.cms_content SET like_count = GREATEST(like_count-1, 0) WHERE id = OLD.content_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cms_like_count ON public.cms_blog_likes;
CREATE TRIGGER trg_cms_like_count
  AFTER INSERT OR DELETE ON public.cms_blog_likes
  FOR EACH ROW EXECUTE FUNCTION public.cms_sync_like_count();

CREATE OR REPLACE FUNCTION public.cms_sync_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.cms_content SET comment_count = comment_count + 1 WHERE id = NEW.content_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.cms_content SET comment_count = GREATEST(comment_count-1, 0) WHERE id = OLD.content_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cms_comment_count ON public.cms_blog_comments;
CREATE TRIGGER trg_cms_comment_count
  AFTER INSERT OR DELETE ON public.cms_blog_comments
  FOR EACH ROW EXECUTE FUNCTION public.cms_sync_comment_count();

CREATE OR REPLACE FUNCTION public.cms_set_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status <> 'published' THEN
    NEW.published_at = COALESCE(NEW.published_at, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cms_published_at ON public.cms_content;
CREATE TRIGGER trg_cms_published_at
  BEFORE UPDATE ON public.cms_content
  FOR EACH ROW EXECUTE FUNCTION public.cms_set_published_at();

CREATE OR REPLACE FUNCTION public.cms_auto_create_seo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'published'
     AND OLD.status <> 'published'
     AND NOT EXISTS (SELECT 1 FROM public.cms_seo WHERE content_id = NEW.id)
  THEN
    INSERT INTO public.cms_seo (
      content_id, meta_title, meta_description, focus_keyword, canonical_url, created_by
    ) VALUES (
      NEW.id,
      coalesce(NEW.seo_title, left(NEW.title, 60)),
      coalesce(NEW.seo_description, left(NEW.excerpt, 160)),
      NEW.focus_keyword,
      NEW.canonical_url,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cms_content_auto_seo ON public.cms_content;
CREATE TRIGGER trg_cms_content_auto_seo
  AFTER UPDATE ON public.cms_content
  FOR EACH ROW EXECUTE FUNCTION public.cms_auto_create_seo();

-- Missing from legacy service usage — atomic counters
CREATE OR REPLACE FUNCTION public.cms_increment_view_count(p_content_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.cms_content
  SET view_count = view_count + 1
  WHERE id = p_content_id
    AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.cms_increment_redirect_hit(p_redirect_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.cms_seo_redirects
  SET hit_count = hit_count + 1
  WHERE id = p_redirect_id
    AND is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cms_increment_view_count(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cms_increment_redirect_hit(UUID) TO anon, authenticated;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.cms_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content_tag_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_blog_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_blog_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_seo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_seo_redirects ENABLE ROW LEVEL SECURITY;

-- categories
DROP POLICY IF EXISTS "cms_categories: public read" ON public.cms_categories;
DROP POLICY IF EXISTS "cms_categories: admin all" ON public.cms_categories;
CREATE POLICY "cms_categories: public read"
  ON public.cms_categories FOR SELECT USING (is_active = true);
CREATE POLICY "cms_categories: admin all"
  ON public.cms_categories FOR ALL
  USING (public.cms_get_role() = 'A')
  WITH CHECK (public.cms_get_role() = 'A');

-- tags
DROP POLICY IF EXISTS "cms_tags: public read" ON public.cms_tags;
DROP POLICY IF EXISTS "cms_tags: admin all" ON public.cms_tags;
CREATE POLICY "cms_tags: public read"
  ON public.cms_tags FOR SELECT USING (true);
CREATE POLICY "cms_tags: admin all"
  ON public.cms_tags FOR ALL
  USING (public.cms_get_role() = 'A')
  WITH CHECK (public.cms_get_role() = 'A');

-- media (public can read active rows so cover/gallery joins work)
DROP POLICY IF EXISTS "cms_media: public read active" ON public.cms_media;
DROP POLICY IF EXISTS "cms_media: owner read" ON public.cms_media;
DROP POLICY IF EXISTS "cms_media: admin read all" ON public.cms_media;
DROP POLICY IF EXISTS "cms_media: admin/vendor insert" ON public.cms_media;
DROP POLICY IF EXISTS "cms_media: owner or admin update" ON public.cms_media;
DROP POLICY IF EXISTS "cms_media: admin delete" ON public.cms_media;
CREATE POLICY "cms_media: public read active"
  ON public.cms_media FOR SELECT USING (is_active = true);
CREATE POLICY "cms_media: admin/vendor insert"
  ON public.cms_media FOR INSERT
  WITH CHECK (uploaded_by = auth.uid() AND public.cms_get_role() IN ('A','V'));
CREATE POLICY "cms_media: owner or admin update"
  ON public.cms_media FOR UPDATE
  USING (uploaded_by = auth.uid() OR public.cms_get_role() = 'A');
CREATE POLICY "cms_media: admin delete"
  ON public.cms_media FOR DELETE USING (public.cms_get_role() = 'A');

-- content
DROP POLICY IF EXISTS "cms_content: public read published" ON public.cms_content;
DROP POLICY IF EXISTS "cms_content: author read own" ON public.cms_content;
DROP POLICY IF EXISTS "cms_content: vendor read own" ON public.cms_content;
DROP POLICY IF EXISTS "cms_content: admin read all" ON public.cms_content;
DROP POLICY IF EXISTS "cms_content: author insert" ON public.cms_content;
DROP POLICY IF EXISTS "cms_content: author update own draft" ON public.cms_content;
DROP POLICY IF EXISTS "cms_content: admin update all" ON public.cms_content;
DROP POLICY IF EXISTS "cms_content: admin delete" ON public.cms_content;
CREATE POLICY "cms_content: public read published"
  ON public.cms_content FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL);
CREATE POLICY "cms_content: author read own"
  ON public.cms_content FOR SELECT USING (author_id = auth.uid());
CREATE POLICY "cms_content: vendor read own"
  ON public.cms_content FOR SELECT
  USING (vendor_id = auth.uid() AND public.cms_get_role() = 'V');
CREATE POLICY "cms_content: admin read all"
  ON public.cms_content FOR SELECT USING (public.cms_get_role() = 'A');
CREATE POLICY "cms_content: author insert"
  ON public.cms_content FOR INSERT
  WITH CHECK (author_id = auth.uid() AND public.cms_get_role() IN ('A','V'));
CREATE POLICY "cms_content: author update own draft"
  ON public.cms_content FOR UPDATE
  USING (author_id = auth.uid() AND status IN ('draft','review'));
CREATE POLICY "cms_content: admin update all"
  ON public.cms_content FOR UPDATE USING (public.cms_get_role() = 'A');
CREATE POLICY "cms_content: admin delete"
  ON public.cms_content FOR DELETE USING (public.cms_get_role() = 'A');

-- tag map / gallery
DROP POLICY IF EXISTS "cms_tag_map: public read" ON public.cms_content_tag_map;
DROP POLICY IF EXISTS "cms_tag_map: author or admin manage" ON public.cms_content_tag_map;
CREATE POLICY "cms_tag_map: public read"
  ON public.cms_content_tag_map FOR SELECT USING (true);
CREATE POLICY "cms_tag_map: author or admin manage"
  ON public.cms_content_tag_map FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cms_content c
      WHERE c.id = content_id
        AND (c.author_id = auth.uid() OR public.cms_get_role() = 'A')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cms_content c
      WHERE c.id = content_id
        AND (c.author_id = auth.uid() OR public.cms_get_role() = 'A')
    )
  );

DROP POLICY IF EXISTS "cms_content_media: public read" ON public.cms_content_media;
DROP POLICY IF EXISTS "cms_content_media: author or admin manage" ON public.cms_content_media;
CREATE POLICY "cms_content_media: public read"
  ON public.cms_content_media FOR SELECT USING (true);
CREATE POLICY "cms_content_media: author or admin manage"
  ON public.cms_content_media FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cms_content c
      WHERE c.id = content_id
        AND (c.author_id = auth.uid() OR public.cms_get_role() = 'A')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cms_content c
      WHERE c.id = content_id
        AND (c.author_id = auth.uid() OR public.cms_get_role() = 'A')
    )
  );

-- versions
DROP POLICY IF EXISTS "cms_versions: author read own" ON public.cms_content_versions;
DROP POLICY IF EXISTS "cms_versions: admin read all" ON public.cms_content_versions;
DROP POLICY IF EXISTS "cms_versions: author insert" ON public.cms_content_versions;
DROP POLICY IF EXISTS "cms_versions: admin delete" ON public.cms_content_versions;
CREATE POLICY "cms_versions: author read own"
  ON public.cms_content_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cms_content c
      WHERE c.id = content_id AND c.author_id = auth.uid()
    )
  );
CREATE POLICY "cms_versions: admin read all"
  ON public.cms_content_versions FOR SELECT
  USING (public.cms_get_role() = 'A');
CREATE POLICY "cms_versions: author insert"
  ON public.cms_content_versions FOR INSERT
  WITH CHECK (
    saved_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.cms_content c
      WHERE c.id = content_id
        AND (c.author_id = auth.uid() OR public.cms_get_role() = 'A')
    )
  );
CREATE POLICY "cms_versions: admin delete"
  ON public.cms_content_versions FOR DELETE
  USING (public.cms_get_role() = 'A');

-- comments
DROP POLICY IF EXISTS "cms_comments: public read approved" ON public.cms_blog_comments;
DROP POLICY IF EXISTS "cms_comments: author read own" ON public.cms_blog_comments;
DROP POLICY IF EXISTS "cms_comments: admin read all" ON public.cms_blog_comments;
DROP POLICY IF EXISTS "cms_comments: user insert" ON public.cms_blog_comments;
DROP POLICY IF EXISTS "cms_comments: author update own" ON public.cms_blog_comments;
DROP POLICY IF EXISTS "cms_comments: admin update all" ON public.cms_blog_comments;
DROP POLICY IF EXISTS "cms_comments: admin delete" ON public.cms_blog_comments;
CREATE POLICY "cms_comments: public read approved"
  ON public.cms_blog_comments FOR SELECT
  USING (
    is_approved = true AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.cms_content c
      WHERE c.id = content_id AND c.status = 'published'
    )
  );
CREATE POLICY "cms_comments: author read own"
  ON public.cms_blog_comments FOR SELECT USING (author_id = auth.uid());
CREATE POLICY "cms_comments: admin read all"
  ON public.cms_blog_comments FOR SELECT USING (public.cms_get_role() = 'A');
CREATE POLICY "cms_comments: user insert"
  ON public.cms_blog_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.cms_content c
      WHERE c.id = content_id
        AND c.status = 'published'
        AND c.allow_comments = true
    )
  );
CREATE POLICY "cms_comments: author update own"
  ON public.cms_blog_comments FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "cms_comments: admin update all"
  ON public.cms_blog_comments FOR UPDATE USING (public.cms_get_role() = 'A');
CREATE POLICY "cms_comments: admin delete"
  ON public.cms_blog_comments FOR DELETE USING (public.cms_get_role() = 'A');

-- likes
DROP POLICY IF EXISTS "cms_likes: public read" ON public.cms_blog_likes;
DROP POLICY IF EXISTS "cms_likes: user insert" ON public.cms_blog_likes;
DROP POLICY IF EXISTS "cms_likes: user delete own" ON public.cms_blog_likes;
DROP POLICY IF EXISTS "cms_likes: admin delete" ON public.cms_blog_likes;
CREATE POLICY "cms_likes: public read"
  ON public.cms_blog_likes FOR SELECT USING (true);
CREATE POLICY "cms_likes: user insert"
  ON public.cms_blog_likes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.cms_content c
      WHERE c.id = content_id AND c.status = 'published'
    )
  );
CREATE POLICY "cms_likes: user delete own"
  ON public.cms_blog_likes FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "cms_likes: admin delete"
  ON public.cms_blog_likes FOR DELETE USING (public.cms_get_role() = 'A');

-- seo (unified on cms_get_role — legacy mixed get_profile_role)
DROP POLICY IF EXISTS "cms_seo: public read" ON public.cms_seo;
DROP POLICY IF EXISTS "cms_seo: admin all" ON public.cms_seo;
DROP POLICY IF EXISTS "cms_seo: vendor manage own content seo" ON public.cms_seo;
CREATE POLICY "cms_seo: public read"
  ON public.cms_seo FOR SELECT USING (true);
CREATE POLICY "cms_seo: admin all"
  ON public.cms_seo FOR ALL
  USING (public.cms_get_role() = 'A')
  WITH CHECK (public.cms_get_role() = 'A');
CREATE POLICY "cms_seo: vendor manage own content seo"
  ON public.cms_seo FOR ALL
  USING (
    public.cms_get_role() = 'V'
    AND content_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.cms_content c
      WHERE c.id = content_id AND c.vendor_id = auth.uid()
    )
  )
  WITH CHECK (
    public.cms_get_role() = 'V'
    AND content_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.cms_content c
      WHERE c.id = content_id AND c.vendor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cms_seo_redirects: public read active" ON public.cms_seo_redirects;
DROP POLICY IF EXISTS "cms_seo_redirects: admin all" ON public.cms_seo_redirects;
CREATE POLICY "cms_seo_redirects: public read active"
  ON public.cms_seo_redirects FOR SELECT USING (is_active = true);
CREATE POLICY "cms_seo_redirects: admin all"
  ON public.cms_seo_redirects FOR ALL
  USING (public.cms_get_role() = 'A')
  WITH CHECK (public.cms_get_role() = 'A');

-- ============================================================
-- GRANTS
-- ============================================================
GRANT ALL ON public.cms_categories TO authenticated;
GRANT ALL ON public.cms_tags TO authenticated;
GRANT ALL ON public.cms_media TO authenticated;
GRANT ALL ON public.cms_content TO authenticated;
GRANT ALL ON public.cms_content_tag_map TO authenticated;
GRANT ALL ON public.cms_content_media TO authenticated;
GRANT ALL ON public.cms_content_versions TO authenticated;
GRANT ALL ON public.cms_blog_comments TO authenticated;
GRANT ALL ON public.cms_blog_likes TO authenticated;
GRANT ALL ON public.cms_seo TO authenticated;
GRANT ALL ON public.cms_seo_redirects TO authenticated;

GRANT SELECT ON public.cms_categories TO anon;
GRANT SELECT ON public.cms_tags TO anon;
GRANT SELECT ON public.cms_media TO anon;
GRANT SELECT ON public.cms_content TO anon;
GRANT SELECT ON public.cms_content_tag_map TO anon;
GRANT SELECT ON public.cms_content_media TO anon;
GRANT SELECT ON public.cms_blog_comments TO anon;
GRANT SELECT ON public.cms_blog_likes TO anon;
GRANT SELECT ON public.cms_seo TO anon;
GRANT SELECT ON public.cms_seo_redirects TO anon;

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cms-media', 'cms-media', true,
  52428800,
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif','image/svg+xml',
    'video/mp4','video/webm',
    'audio/mpeg','audio/ogg'
  ]
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cms-private', 'cms-private', false,
  104857600,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'image/jpeg','image/png','image/webp'
  ]
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "cms-media: public read" ON storage.objects;
DROP POLICY IF EXISTS "cms-media: admin/vendor upload" ON storage.objects;
DROP POLICY IF EXISTS "cms-media: owner or admin update" ON storage.objects;
DROP POLICY IF EXISTS "cms-media: admin delete" ON storage.objects;
CREATE POLICY "cms-media: public read"
  ON storage.objects FOR SELECT USING (bucket_id = 'cms-media');
CREATE POLICY "cms-media: admin/vendor upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cms-media'
    AND auth.role() = 'authenticated'
    AND public.cms_get_role() IN ('A','V')
  );
CREATE POLICY "cms-media: owner or admin update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'cms-media'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.cms_get_role() = 'A')
  );
CREATE POLICY "cms-media: admin delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'cms-media' AND public.cms_get_role() = 'A');

DROP POLICY IF EXISTS "cms-private: owner read" ON storage.objects;
DROP POLICY IF EXISTS "cms-private: admin read all" ON storage.objects;
DROP POLICY IF EXISTS "cms-private: authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "cms-private: owner or admin update" ON storage.objects;
DROP POLICY IF EXISTS "cms-private: owner or admin delete" ON storage.objects;
CREATE POLICY "cms-private: owner read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'cms-private'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "cms-private: admin read all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cms-private' AND public.cms_get_role() = 'A');
CREATE POLICY "cms-private: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cms-private'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "cms-private: owner or admin update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'cms-private'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.cms_get_role() = 'A')
  );
CREATE POLICY "cms-private: owner or admin delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cms-private'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.cms_get_role() = 'A')
  );

-- ============================================================
-- SITEMAP VIEW
-- ============================================================
CREATE OR REPLACE VIEW public.cms_sitemap_feed AS
  SELECT
    '/content/' || c.slug AS path,
    c.published_at AS last_modified,
    coalesce(s.sitemap_priority, c.sitemap_priority, 0.5) AS priority,
    coalesce(s.sitemap_changefreq, c.sitemap_changefreq, 'weekly') AS changefreq
  FROM public.cms_content c
  LEFT JOIN public.cms_seo s ON s.content_id = c.id
  WHERE c.status = 'published'
    AND c.deleted_at IS NULL
    AND coalesce(s.sitemap_exclude, c.sitemap_exclude, false) = false

  UNION ALL

  SELECT
    '/category/' || cat.slug AS path,
    cat.updated_at AS last_modified,
    coalesce(s.sitemap_priority, 0.6) AS priority,
    coalesce(s.sitemap_changefreq, 'weekly') AS changefreq
  FROM public.cms_categories cat
  LEFT JOIN public.cms_seo s ON s.category_id = cat.id
  WHERE cat.is_active = true
    AND coalesce(s.sitemap_exclude, false) = false

  UNION ALL

  SELECT
    s.custom_path AS path,
    s.updated_at AS last_modified,
    s.sitemap_priority AS priority,
    s.sitemap_changefreq AS changefreq
  FROM public.cms_seo s
  WHERE s.custom_path IS NOT NULL
    AND s.sitemap_exclude = false;

GRANT SELECT ON public.cms_sitemap_feed TO anon, authenticated;
