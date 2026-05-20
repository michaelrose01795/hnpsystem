
-- FIX THIS AS IT SAID "Failed to generate title: API error happened while trying to communicate with the server.



-- ============================================================================
-- WEBSITE CONTENT + SHOP MIGRATION
-- ============================================================================
-- Backs:
--   1. The public /website single-scroll marketing page (src/singlescroll/WebsitePage.js).
--      Replaces the static data modules under src/singlescroll/data/* with a
--      writable, queryable source of truth.
--   2. The staff /staff/website-manager CMS (src/features/websiteManager/) which
--      mutates this content.
--   3. The new /website/shop e-commerce section + cart + checkout + orders.
--
-- Naming:
--   website_*  -- marketing-page content
--   shop_*     -- e-commerce catalog, cart, orders
--
-- ID convention:
--   * "Singleton" config tables (brand, hero, about, contact, footer, etc.)
--     each have exactly one row keyed by id='default'. Modelled as columns
--     (not a single jsonb blob) so individual fields can be queried/indexed
--     and the staff CMS can patch fields in isolation.
--   * Collection tables (vehicles, offers, reviews, team, timeline, blog,
--     trust_points, partner_brands, ratings) use stable text PKs so the seed
--     script can stamp the human-readable ids already used by the existing
--     data modules (e.g. 'new-swift', 'rev-judge-marcusjoy').
--   * Shop orders use UUID PKs (non-guessable). Cart items / order items
--     use bigint PKs (transient ids).
--
-- Row-Level Security:
--   * SELECT is open to anon on every website_* / shop_products / shop_categories
--     table - this is public marketing content / a public catalog.
--   * INSERT / UPDATE / DELETE require service_role. Staff API routes must use
--     supabaseService (the service role client) when writing.
--   * shop_carts / shop_cart_items / shop_orders / shop_order_items are
--     locked: anon may SELECT only by the row's own guest_token / order_number
--     (enforced by API routes; RLS is permissive here so the API can mediate).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SINGLETON SITE CONFIG TABLES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.website_brand (
  id text PRIMARY KEY DEFAULT 'default',
  name text NOT NULL,
  logo_url text,
  logo_white_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS public.website_hero (
  id text PRIMARY KEY DEFAULT 'default',
  eyebrow text,
  headline text NOT NULL,
  subhead text,
  background_url text,
  ctas jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{label, href, variant}]
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS public.website_about (
  id text PRIMARY KEY DEFAULT 'default',
  eyebrow text,
  title text NOT NULL,
  body jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of paragraph strings
  image_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS public.website_sell_your_car (
  id text PRIMARY KEY DEFAULT 'default',
  eyebrow text,
  title text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,    -- [{n, title, body}]
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of bullet strings
  cta_label text,
  cta_href text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS public.website_service_parts (
  id text PRIMARY KEY DEFAULT 'default',
  eyebrow text,
  title text NOT NULL,
  body jsonb NOT NULL DEFAULT '[]'::jsonb,  -- array of paragraph strings
  hours jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{days, time}]
  image_url text,
  cta_label text,
  cta_href text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS public.website_motability (
  id text PRIMARY KEY DEFAULT 'default',
  eyebrow text,
  title text NOT NULL,
  body jsonb NOT NULL DEFAULT '[]'::jsonb,         -- array of paragraph strings
  payments text,
  range_brands jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{brand, models[]}]
  cta_label text,
  cta_href text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS public.website_parts_content (
  id text PRIMARY KEY DEFAULT 'default',
  eyebrow text,
  title text NOT NULL,
  body jsonb NOT NULL DEFAULT '[]'::jsonb,   -- array of paragraph strings
  brands jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{name, note}]
  cta_label text,
  cta_href text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS public.website_contact (
  id text PRIMARY KEY DEFAULT 'default',
  eyebrow text,
  title text NOT NULL,
  phone text,
  phone_href text,
  address jsonb NOT NULL DEFAULT '[]'::jsonb,       -- array of address line strings
  sales_hours jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{days, time}]
  service_hours jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{days, time}]
  socials jsonb NOT NULL DEFAULT '[]'::jsonb,       -- [{label, href}]
  map_embed text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS public.website_footer (
  id text PRIMARY KEY DEFAULT 'default',
  legal_links jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of label strings
  fca_reg text,
  credit_disclosure text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

-- Sell-Your-Car and other singleton tables also seed exactly one 'default' row.

-- ----------------------------------------------------------------------------
-- 2. COLLECTION TABLES (rows = list items rendered on /website)
-- ----------------------------------------------------------------------------

-- Trust highlights bar under the hero (e.g. "Since 1947", "120-point inspection")
CREATE TABLE IF NOT EXISTS public.website_trust_points (
  id text PRIMARY KEY,
  value text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS website_trust_points_sort_idx ON public.website_trust_points (sort_order);

-- "Authorised retailer for" partner-brand logo strip
CREATE TABLE IF NOT EXISTS public.website_partner_brands (
  id text PRIMARY KEY,
  name text NOT NULL,
  logo_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS website_partner_brands_sort_idx ON public.website_partner_brands (sort_order);

-- Review rating sources (AutoTrader, Trustpilot etc.)
CREATE TABLE IF NOT EXISTS public.website_ratings (
  id text PRIMARY KEY,
  source text NOT NULL,
  score text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS website_ratings_sort_idx ON public.website_ratings (sort_order);

-- Featured vehicles for the /website car gallery (Phase 5 will replace 'new' / 'used'
-- rows with live reads from the inventory; manual rows remain for hero/feature cars).
CREATE TABLE IF NOT EXISTS public.website_vehicles (
  id text PRIMARY KEY,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('new', 'used')),
  brand text NOT NULL,
  model text NOT NULL,
  year integer,
  price_text text,                            -- "From £21,699", "0% PCP available"
  miles text,                                 -- nullable / free-text
  badge text,                                 -- optional pill ("0% APR")
  image_url text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS website_vehicles_type_idx ON public.website_vehicles (vehicle_type, sort_order);

CREATE TABLE IF NOT EXISTS public.website_offers (
  id text PRIMARY KEY,
  title text NOT NULL,
  headline text NOT NULL,
  body text,
  image_url text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS website_offers_sort_idx ON public.website_offers (sort_order);

CREATE TABLE IF NOT EXISTS public.website_reviews (
  id text PRIMARY KEY,
  customer_name text NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  source text NOT NULL,         -- "Google", "AutoTrader", "Trustpilot", ...
  review_date text,             -- free-text ("March 2026") - kept as text for editor flexibility
  quote text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS website_reviews_sort_idx ON public.website_reviews (sort_order);

CREATE TABLE IF NOT EXISTS public.website_team_departments (
  id text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS public.website_team_members (
  id text PRIMARY KEY,
  name text NOT NULL,
  role text,
  department_id text REFERENCES public.website_team_departments(id) ON DELETE SET NULL,
  photo_url text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS website_team_members_dept_idx ON public.website_team_members (department_id, sort_order);

CREATE TABLE IF NOT EXISTS public.website_timeline (
  id text PRIMARY KEY,
  year text NOT NULL,            -- text not integer: existing data includes "1950s", "1980s"
  title text NOT NULL,
  body text,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS website_timeline_sort_idx ON public.website_timeline (sort_order);

CREATE TABLE IF NOT EXISTS public.website_blog_posts (
  id text PRIMARY KEY,
  title text NOT NULL,
  post_date text,                          -- free-text date as currently rendered
  excerpt text,
  body text,                               -- full body for future detail page
  image_url text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS website_blog_posts_sort_idx ON public.website_blog_posts (sort_order);

-- ----------------------------------------------------------------------------
-- 3. SEO / META PER PAGE (one row per public-website "page" the manager exposes)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.website_seo (
  page_key text PRIMARY KEY,           -- 'home', 'new-cars', 'used-cars', 'offers', 'sell-your-car', ...
  meta_title text NOT NULL,
  meta_description text,
  slug text,
  canonical text,
  og_image text,
  indexed boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

-- ----------------------------------------------------------------------------
-- 4. PAGE STATUS / AUDIT
-- ----------------------------------------------------------------------------
-- One row per "page" in the staff manager (Homepage, New Cars, Used Cars, Offers,
-- Sell Your Car, Service & Parts, Motability, About, Blog, Contact, Shop).

CREATE TABLE IF NOT EXISTS public.website_pages (
  page_key text PRIMARY KEY,
  name text NOT NULL,
  route text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  last_edited_by text,
  last_edited_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.website_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor text,
  action text NOT NULL,           -- "Edited content", "Uploaded media", ...
  target text NOT NULL,           -- name of the thing edited
  page_key text                   -- optional FK-ish reference to website_pages
);
CREATE INDEX IF NOT EXISTS website_activity_occurred_idx ON public.website_activity (occurred_at DESC);

-- ----------------------------------------------------------------------------
-- 5. MEDIA LIBRARY
-- ----------------------------------------------------------------------------
-- Tracks every image / video shown on /website plus uploads queued in the manager.
-- For Phase 1 the URL is canonical (assets remain on 67degreescdn). Phase 2+ will
-- introduce Supabase Storage-backed uploads via the storage_path column.

CREATE TABLE IF NOT EXISTS public.website_media (
  id text PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  size_kb integer,
  storage_path text,            -- Supabase Storage object key once self-hosted uploads land
  used_on text,                 -- human label ("Homepage - Hero", "About Us - Team", ...)
  uploaded_by text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS website_media_uploaded_idx ON public.website_media (uploaded_at DESC);

-- ============================================================================
-- 6. SHOP - catalog (Phase 4 read path)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shop_categories (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS shop_categories_sort_idx ON public.shop_categories (sort_order);

CREATE TABLE IF NOT EXISTS public.shop_products (
  id text PRIMARY KEY,
  category_id text REFERENCES public.shop_categories(id) ON DELETE SET NULL,
  sku text UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price_pence integer NOT NULL CHECK (price_pence >= 0),
  compare_at_price_pence integer,                              -- optional "RRP" strike-through
  image_url text,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,                  -- additional image URLs
  stock_qty integer NOT NULL DEFAULT 0,
  fit_brands jsonb NOT NULL DEFAULT '[]'::jsonb,               -- ["Suzuki", "KGM", "Mitsubishi"]
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS shop_products_category_idx ON public.shop_products (category_id, sort_order);
CREATE INDEX IF NOT EXISTS shop_products_status_idx ON public.shop_products (status);

-- ----------------------------------------------------------------------------
-- 7. SHOP - carts (signed-in customers or anonymous guest tokens)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shop_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  guest_token text UNIQUE,                  -- random opaque token for anon carts (cookie-backed)
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'converted', 'abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_carts_customer_idx ON public.shop_carts (customer_id);
CREATE INDEX IF NOT EXISTS shop_carts_status_idx ON public.shop_carts (status);

CREATE TABLE IF NOT EXISTS public.shop_cart_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cart_id uuid NOT NULL REFERENCES public.shop_carts(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.shop_products(id) ON DELETE RESTRICT,
  qty integer NOT NULL CHECK (qty > 0),
  unit_price_pence integer NOT NULL,        -- snapshot of product price when added
  added_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_cart_items_cart_idx ON public.shop_cart_items (cart_id);
CREATE UNIQUE INDEX IF NOT EXISTS shop_cart_items_unique ON public.shop_cart_items (cart_id, product_id);

-- ----------------------------------------------------------------------------
-- 8. SHOP - orders (one row per checkout, line items per product)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,        -- human-friendly e.g. "HNP-2026-0001"
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  contact_email text NOT NULL,              -- snapshot for guest checkouts
  contact_phone text,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {name, line1, line2, city, postcode, country}
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment', 'paid', 'fulfilling', 'shipped', 'completed', 'cancelled', 'refunded'
  )),
  subtotal_pence integer NOT NULL,
  shipping_pence integer NOT NULL DEFAULT 0,
  tax_pence integer NOT NULL DEFAULT 0,
  total_pence integer NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  stripe_session_id text UNIQUE,            -- Phase 4.5 - Stripe Checkout Session id
  stripe_payment_intent text UNIQUE,        -- Phase 4.5 - Stripe Payment Intent id
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX IF NOT EXISTS shop_orders_customer_idx ON public.shop_orders (customer_id);
CREATE INDEX IF NOT EXISTS shop_orders_status_idx ON public.shop_orders (status);
CREATE INDEX IF NOT EXISTS shop_orders_created_idx ON public.shop_orders (created_at DESC);

CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id text REFERENCES public.shop_products(id) ON DELETE SET NULL,
  sku text,                                 -- snapshot
  name text NOT NULL,                       -- snapshot
  qty integer NOT NULL CHECK (qty > 0),
  unit_price_pence integer NOT NULL,
  line_total_pence integer NOT NULL
);
CREATE INDEX IF NOT EXISTS shop_order_items_order_idx ON public.shop_order_items (order_id);

-- ============================================================================
-- 9. updated_at TRIGGERS
-- ============================================================================
-- Common BEFORE-UPDATE trigger that stamps updated_at on row change.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'website_brand','website_hero','website_about','website_sell_your_car',
    'website_service_parts','website_motability','website_parts_content',
    'website_contact','website_footer','website_trust_points','website_partner_brands',
    'website_ratings','website_vehicles','website_offers','website_reviews',
    'website_team_departments','website_team_members','website_timeline',
    'website_blog_posts','website_seo',
    'shop_categories','shop_products','shop_carts','shop_orders'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at_on_%1$s ON public.%1$I; '
      'CREATE TRIGGER set_updated_at_on_%1$s '
      'BEFORE UPDATE ON public.%1$I '
      'FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t
    );
  END LOOP;
END
$$;

-- ============================================================================
-- 10. ROW-LEVEL SECURITY
-- ============================================================================
-- Public marketing tables: anon may SELECT (only published rows enforced
--   by API queries). service_role bypasses RLS so server-side writes work.
-- Cart / order tables: RLS enabled but permissive at row level; the API
--   routes mediate access by guest_token / authenticated customer_id.

DO $$
DECLARE
  t text;
  public_tables text[] := ARRAY[
    'website_brand','website_hero','website_about','website_sell_your_car',
    'website_service_parts','website_motability','website_parts_content',
    'website_contact','website_footer','website_trust_points','website_partner_brands',
    'website_ratings','website_vehicles','website_offers','website_reviews',
    'website_team_departments','website_team_members','website_timeline',
    'website_blog_posts','website_seo','website_pages','website_media','website_activity',
    'shop_categories','shop_products'
  ];
  protected_tables text[] := ARRAY[
    'shop_carts','shop_cart_items','shop_orders','shop_order_items'
  ];
BEGIN
  FOREACH t IN ARRAY public_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_anon_read ON public.%1$I;', t);
    EXECUTE format(
      'CREATE POLICY %1$s_anon_read ON public.%1$I FOR SELECT TO anon, authenticated USING (true);',
      t
    );
  END LOOP;

  FOREACH t IN ARRAY protected_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    -- API routes use service_role for these; no anon/authenticated policies.
  END LOOP;
END
$$;
