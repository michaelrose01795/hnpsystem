-- file location: supabase/migrations/20260901120000_website_builder_nav_design_layout.sql
--
-- Website Manager -> site builder. Adds the three tables the staff builder
-- needs so that the /website top bar, section running order and visual design
-- stop being hard-coded in React and become editable content like every other
-- website_* section.
--
--   website_nav             collection  the public /website top-bar links
--   website_section_layout  collection  running order / visibility / headings
--                                       of the blocks on the /website scroller
--   website_design          singleton   accent, radius, spacing, nav options
--
-- All three plug into the existing generic CMS plumbing:
--   * SECTION_TABLES in src/lib/database/website.js
--   * /api/website/sections/[section]        (GET / PATCH / POST)
--   * /api/website/sections/[section]/[id]   (PATCH / DELETE)
--   * /api/website/sections/[section]/reorder
-- so no new API routes are required.
--
-- Security mirrors the existing website content tables exactly (see
-- 20260814150000_harden_supabase_rls_and_function_permissions.sql):
--   anon / authenticated get SELECT only, gated by an RLS predicate;
--   every write goes through the service-role client in an API route.
--
-- Idempotent: safe to re-run.

begin;

/* ==========================================================================
   1. website_nav -- the public top bar
   ==========================================================================
   `href` is an in-page anchor ("#cars") or an absolute path ("/website/shop").
   `filter` is optional and only meaningful for anchors that land on the cars
   section: it pre-selects the vehicle filter ("new" / "used").
   `sort_order` is maintained by the generic /reorder endpoint, which upserts
   only { id, sort_order, updated_* }. Every other column therefore carries a
   default so that partial upsert can never trip a NOT NULL constraint. */
create table if not exists public.website_nav (
  id          text primary key,
  label       text        not null default '',
  href        text        not null default '#top',
  filter      text,
  sort_order  integer     not null default 0,
  status      text        not null default 'published',
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create index if not exists website_nav_sort_order_idx
  on public.website_nav (sort_order);

comment on table public.website_nav is
  'Public /website primary navigation links. Managed from /website-manager -> Top bar.';

/* ==========================================================================
   2. website_section_layout -- running order, visibility and headings
   ==========================================================================
   One row per block on the /website single-scroll page. `id` is the block key
   WebsitePage renders against (hero, brands, cars, offers, shop, sell,
   service, motability, about, reviews, team, blog, contact) -- NOT a website
   page_key. status = 'draft' hides the block from the public site. */
create table if not exists public.website_section_layout (
  id          text primary key,
  label       text        not null default '',
  anchor      text,
  eyebrow     text,
  title       text,
  lead        text,
  tint        boolean     not null default false,
  sort_order  integer     not null default 0,
  status      text        not null default 'published',
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create index if not exists website_section_layout_sort_order_idx
  on public.website_section_layout (sort_order);

comment on table public.website_section_layout is
  'Running order, visibility and heading copy for each block of the public /website page.';

/* ==========================================================================
   3. website_design -- one row, id = 'default'
   ==========================================================================
   Every column maps to a CSS custom property applied to `.ws-page` by
   WebsitePage, so the values are literal CSS lengths / colours rather than
   abstract scales. Keeping them as text means adding a new design control
   never needs another migration to widen a numeric type. */
create table if not exists public.website_design (
  id                text primary key default 'default',
  accent_hex        text        not null default '#b91c1c',
  accent_hover_hex  text        not null default '#981717',
  default_theme     text        not null default 'dark',
  container_width   text        not null default '1200px',
  corner_radius     text        not null default '18px',
  button_radius     text        not null default '999px',
  section_spacing   text        not null default 'comfortable',
  nav_height        text        not null default '66px',
  logo_height       text        not null default '38px',
  heading_font      text        not null default 'system',
  nav_sticky        boolean     not null default true,
  show_nav_phone    boolean     not null default true,
  show_nav_account  boolean     not null default true,
  show_brand_strip  boolean     not null default true,
  updated_at        timestamptz not null default now(),
  updated_by        text,
  constraint website_design_single_row check (id = 'default')
);

comment on table public.website_design is
  'Singleton visual design settings for the public /website. Applied as CSS custom properties on .ws-page.';

commit;

/* ==========================================================================
   4. Seed -- mirrors the values that were hard-coded in React before this
      migration, so applying it changes nothing visible until staff edit it.
   ========================================================================== */

insert into public.website_nav (id, label, href, filter, sort_order, status) values
  ('new',        'New',               '#cars',       'new',  0, 'published'),
  ('used',       'Used',              '#cars',       'used', 1, 'published'),
  ('offers',     'Offers',            '#offers',     null,   2, 'published'),
  ('shop',       'Shop',              '#shop',       null,   3, 'published'),
  ('sell',       'Sell Your Car',     '#sell',       null,   4, 'published'),
  ('service',    'Service & Parts',   '#service',    null,   5, 'published'),
  ('motability', 'Motability',        '#motability', null,   6, 'published'),
  ('about',      'About Us',          '#about',      null,   7, 'published'),
  ('blog',       'Blog',              '#blog',       null,   8, 'published'),
  ('contact',    'Contact Us',        '#contact',    null,   9, 'published')
on conflict (id) do nothing;

insert into public.website_section_layout
  (id, label, anchor, eyebrow, title, lead, tint, sort_order, status)
values
  ('hero', 'Hero banner', 'top', null, null, null, false, 0, 'published'),
  ('brands', 'Partner brand strip', null, null, 'Authorised retailer for', null, true, 1, 'published'),
  ('cars', 'Featured vehicles', 'cars', 'Our Cars', 'Find your next car at Humphries & Parks',
   'Every used car arrives with a 120-point inspection, a minimum 6-month MOT and a free 6-month warranty. New Suzuki, KGM and Mitsubishi available with manufacturer offers.',
   false, 2, 'published'),
  ('offers', 'Manufacturer offers', 'offers', 'Latest Offers', 'Current manufacturer offers',
   'Finance and savings available across the Suzuki range - speak to the team for full terms.',
   true, 3, 'published'),
  ('shop', 'Shop', 'shop', 'Shop', 'Parts & accessories',
   'Genuine Suzuki, KGM and Mitsubishi parts and accessories - shipped UK-wide. Add to cart and checkout in minutes.',
   true, 4, 'published'),
  ('sell', 'Sell Your Car', 'sell', null, null,
   'We buy any car - any age, any mileage, any make - with free home collection and instant payment.',
   false, 5, 'published'),
  ('service', 'Service & Parts', 'service', null, null, null, true, 6, 'published'),
  ('motability', 'Motability', 'motability', null, null, null, false, 7, 'published'),
  ('about', 'About Us', 'about', null, null, null, true, 8, 'published'),
  ('reviews', 'Customer reviews', 'reviews', 'Reviews', 'Why families across Kent keep coming back',
   'Independently verified reviews from AutoTrader, JudgeService, Google and Trustpilot.',
   false, 9, 'published'),
  ('team', 'Meet the team', 'team', 'Meet the Team', 'The people behind Humphries & Parks',
   'Three generations of family ownership and a team that treats every customer as one of our own.',
   true, 10, 'published'),
  ('blog', 'Blog', 'blog', 'Blog', 'Helpful guides for car buyers in Kent',
   'Practical, plain-English advice from the showroom floor.',
   false, 11, 'published'),
  ('contact', 'Contact', 'contact', null, null, null, true, 12, 'published')
on conflict (id) do nothing;

insert into public.website_design (id) values ('default')
on conflict (id) do nothing;

/* ==========================================================================
   5. RLS -- read-only for anon/authenticated, writes are service-role only.
      Same shape as the public website content block in
      20260814150000_harden_supabase_rls_and_function_permissions.sql.
   ========================================================================== */
do $rls$
declare
  public_table record;
  policy_row   record;
begin
  for public_table in
    select *
    from (values
      ('website_design',         'true'),
      ('website_nav',            'status = ''published'''),
      ('website_section_layout', 'status = ''published''')
    ) as configured(table_name, predicate)
  loop
    execute format('alter table public.%I enable row level security', public_table.table_name);
    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      public_table.table_name
    );
    execute format(
      'grant select on table public.%I to anon, authenticated',
      public_table.table_name
    );

    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = public_table.table_name
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        policy_row.policyname,
        public_table.table_name
      );
    end loop;

    execute format(
      'create policy hnp_public_read_only on public.%I for select to anon, authenticated using (%s)',
      public_table.table_name,
      public_table.predicate
    );
  end loop;
end
$rls$;
