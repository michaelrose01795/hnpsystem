-- file location: src/lib/database/schema/news-feed-hub.sql
--
-- NEWS FEED -> DEALERSHIP COMMUNICATION HUB
--
-- Run this once, by hand, in the Supabase SQL editor (same convention as the
-- content_reactions migration). Everything here is additive and idempotent:
-- the existing public.news_updates rows keep working untouched, because every
-- new column carries a default that reproduces today's behaviour
-- (status = 'published', priority = 'normal', source = 'staff').
--
-- Also required, once, in Supabase Storage:
--   a PRIVATE bucket named  news-attachments
-- (server-side uploads/downloads go through the service key, so no storage
-- policies are needed -- see src/lib/database/newsFeed/attachments.js).
--
-- HOW TO RUN -- read this before pasting.
--
-- The Supabase SQL editor runs everything you paste as ONE transaction. Section 1
-- takes an AccessExclusiveLock on public.news_updates and would hold it until the
-- very last statement committed, while the running app keeps reading that same
-- table -- which is exactly how the "deadlock detected" error happens.
--
-- So run this file as FOUR separate SQL-editor executions, in order, waiting for
-- each to report success:
--
--   Section 1        (extend public.news_updates)
--   Sections 2-10    (create the new tables)
--   Section 11       (enable RLS)
--   Section 12       (select policies)
--
-- Each section starts at a "RUN SEPARATELY (n/4)" marker below. Every section is
-- idempotent, so re-running one after a failure is safe. The lock_timeout at the
-- top of each section makes a contended statement fail fast with a clear error
-- instead of deadlocking; if you hit one, just retry that section.

-- =========================== RUN SEPARATELY (1/4) ==========================
-- 1. Extend public.news_updates
-- ---------------------------------------------------------------------------
SET lock_timeout = '5s';

ALTER TABLE public.news_updates
  ADD COLUMN IF NOT EXISTS priority        text        NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS category        text        NOT NULL DEFAULT 'announcement',
  ADD COLUMN IF NOT EXISTS status          text        NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS source          text        NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS system_key      text,
  ADD COLUMN IF NOT EXISTS is_pinned       boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at       timestamp with time zone,
  ADD COLUMN IF NOT EXISTS pinned_by       integer,
  ADD COLUMN IF NOT EXISTS requires_ack    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ack_due_at      timestamp with time zone,
  ADD COLUMN IF NOT EXISTS publish_at      timestamp with time zone,
  ADD COLUMN IF NOT EXISTS expires_at      timestamp with time zone,
  ADD COLUMN IF NOT EXISTS published_at    timestamp with time zone,
  ADD COLUMN IF NOT EXISTS edited_at       timestamp with time zone,
  ADD COLUMN IF NOT EXISTS edit_count      integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count      integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_at      timestamp with time zone;

-- Existing rows predate publish tracking: treat their creation as publication.
UPDATE public.news_updates
   SET published_at = created_at
 WHERE published_at IS NULL
   AND status = 'published';

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_updates_priority_check') THEN
    ALTER TABLE public.news_updates
      ADD CONSTRAINT news_updates_priority_check
      CHECK (priority = ANY (ARRAY['normal'::text, 'important'::text, 'urgent'::text]));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_updates_status_check') THEN
    ALTER TABLE public.news_updates
      ADD CONSTRAINT news_updates_status_check
      CHECK (status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'published'::text, 'archived'::text]));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_updates_source_check') THEN
    ALTER TABLE public.news_updates
      ADD CONSTRAINT news_updates_source_check
      CHECK (source = ANY (ARRAY['staff'::text, 'system'::text]));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_updates_pinned_by_fkey') THEN
    ALTER TABLE public.news_updates
      ADD CONSTRAINT news_updates_pinned_by_fkey
      FOREIGN KEY (pinned_by) REFERENCES public.users(user_id);
  END IF;
END
$mig$;

-- Automated posts are deduplicated on their system_key (one daily summary per
-- day, one capacity alert per department per day, and so on).
CREATE UNIQUE INDEX IF NOT EXISTS news_updates_system_key_idx
  ON public.news_updates (system_key) WHERE system_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS news_updates_feed_idx
  ON public.news_updates (status, is_pinned DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS news_updates_schedule_idx
  ON public.news_updates (status, publish_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS news_updates_expiry_idx
  ON public.news_updates (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS news_updates_departments_idx
  ON public.news_updates USING gin (departments);

-- =========================== RUN SEPARATELY (2/4) ==========================
-- Sections 2-10: the new tables. These touch public.news_updates only through
-- their foreign keys, which take a ShareRowExclusiveLock rather than an
-- exclusive one, so the app keeps reading the feed while they run.
-- ---------------------------------------------------------------------------
SET lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 2. Read tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_post_reads (
  post_id uuid NOT NULL,
  user_id integer NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT news_post_reads_pkey PRIMARY KEY (post_id, user_id),
  CONSTRAINT news_post_reads_post_fkey FOREIGN KEY (post_id) REFERENCES public.news_updates(id) ON DELETE CASCADE,
  CONSTRAINT news_post_reads_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS news_post_reads_user_idx ON public.news_post_reads (user_id, read_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Required acknowledgements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_post_acknowledgements (
  post_id uuid NOT NULL,
  user_id integer NOT NULL,
  acknowledged_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT news_post_acknowledgements_pkey PRIMARY KEY (post_id, user_id),
  CONSTRAINT news_post_ack_post_fkey FOREIGN KEY (post_id) REFERENCES public.news_updates(id) ON DELETE CASCADE,
  CONSTRAINT news_post_ack_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS news_post_ack_user_idx ON public.news_post_acknowledgements (user_id);

-- ---------------------------------------------------------------------------
-- 4. Comments (one level of replies: parent_id points at a top-level comment)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  parent_id uuid,
  user_id integer NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT news_comments_pkey PRIMARY KEY (id),
  CONSTRAINT news_comments_post_fkey FOREIGN KEY (post_id) REFERENCES public.news_updates(id) ON DELETE CASCADE,
  CONSTRAINT news_comments_parent_fkey FOREIGN KEY (parent_id) REFERENCES public.news_comments(id) ON DELETE CASCADE,
  CONSTRAINT news_comments_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE INDEX IF NOT EXISTS news_comments_post_idx ON public.news_comments (post_id, created_at);

-- ---------------------------------------------------------------------------
-- 5. Attachments (bytes live in the private news-attachments storage bucket)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid,
  draft_key text,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  uploaded_by integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT news_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT news_attachments_post_fkey FOREIGN KEY (post_id) REFERENCES public.news_updates(id) ON DELETE CASCADE,
  CONSTRAINT news_attachments_user_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(user_id)
);
CREATE INDEX IF NOT EXISTS news_attachments_post_idx ON public.news_attachments (post_id);
CREATE INDEX IF NOT EXISTS news_attachments_draft_idx ON public.news_attachments (draft_key) WHERE draft_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. Links from a post to real DMS records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_post_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  record_type text NOT NULL,
  record_id text NOT NULL,
  label text,
  href text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT news_post_links_pkey PRIMARY KEY (id),
  CONSTRAINT news_post_links_post_fkey FOREIGN KEY (post_id) REFERENCES public.news_updates(id) ON DELETE CASCADE,
  CONSTRAINT news_post_links_type_check CHECK (record_type = ANY (ARRAY[
    'job_card'::text, 'customer'::text, 'vehicle'::text, 'appointment'::text,
    'delivery'::text, 'vhc'::text, 'stock'::text, 'invoice'::text
  ]))
);
CREATE INDEX IF NOT EXISTS news_post_links_post_idx ON public.news_post_links (post_id);
CREATE INDEX IF NOT EXISTS news_post_links_record_idx ON public.news_post_links (record_type, record_id);

-- ---------------------------------------------------------------------------
-- 7. Saved / bookmarked posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_bookmarks (
  post_id uuid NOT NULL,
  user_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT news_bookmarks_pkey PRIMARY KEY (post_id, user_id),
  CONSTRAINT news_bookmarks_post_fkey FOREIGN KEY (post_id) REFERENCES public.news_updates(id) ON DELETE CASCADE,
  CONSTRAINT news_bookmarks_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS news_bookmarks_user_idx ON public.news_bookmarks (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 8. @mentions (on a post, or on one of its comments)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_mentions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  comment_id uuid,
  mentioned_user_id integer NOT NULL,
  created_by integer,
  seen_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT news_mentions_pkey PRIMARY KEY (id),
  CONSTRAINT news_mentions_post_fkey FOREIGN KEY (post_id) REFERENCES public.news_updates(id) ON DELETE CASCADE,
  CONSTRAINT news_mentions_comment_fkey FOREIGN KEY (comment_id) REFERENCES public.news_comments(id) ON DELETE CASCADE,
  CONSTRAINT news_mentions_user_fkey FOREIGN KEY (mentioned_user_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS news_mentions_user_idx ON public.news_mentions (mentioned_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS news_mentions_unique_idx
  ON public.news_mentions (post_id, COALESCE(comment_id, '00000000-0000-0000-0000-000000000000'::uuid), mentioned_user_id);

-- ---------------------------------------------------------------------------
-- 9. Edit history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_post_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  revision integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  departments text[] NOT NULL DEFAULT ARRAY[]::text[],
  priority text,
  category text,
  edited_by integer,
  edited_by_name text,
  edited_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT news_post_revisions_pkey PRIMARY KEY (id),
  CONSTRAINT news_post_revisions_post_fkey FOREIGN KEY (post_id) REFERENCES public.news_updates(id) ON DELETE CASCADE,
  CONSTRAINT news_post_revisions_unique UNIQUE (post_id, revision)
);
CREATE INDEX IF NOT EXISTS news_post_revisions_post_idx ON public.news_post_revisions (post_id, revision DESC);

-- ---------------------------------------------------------------------------
-- 10. Per-user notification preferences for the feed
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_notification_preferences (
  user_id integer NOT NULL,
  notify_all boolean NOT NULL DEFAULT true,
  notify_urgent boolean NOT NULL DEFAULT true,
  notify_mentions boolean NOT NULL DEFAULT true,
  notify_acknowledgements boolean NOT NULL DEFAULT true,
  notify_comments boolean NOT NULL DEFAULT true,
  notify_system_posts boolean NOT NULL DEFAULT false,
  muted_categories text[] NOT NULL DEFAULT ARRAY[]::text[],
  muted_departments text[] NOT NULL DEFAULT ARRAY[]::text[],
  digest_frequency text NOT NULL DEFAULT 'realtime',
  feed_density text NOT NULL DEFAULT 'comfortable',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT news_notification_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT news_notification_preferences_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE,
  CONSTRAINT news_notification_preferences_digest_check
    CHECK (digest_frequency = ANY (ARRAY['realtime'::text, 'daily'::text, 'off'::text])),
  CONSTRAINT news_notification_preferences_density_check
    CHECK (feed_density = ANY (ARRAY['comfortable'::text, 'compact'::text]))
);

-- =========================== RUN SEPARATELY (3/4) ==========================
-- 11. RLS -- matches the rest of the schema: enabled, writes via the service key
-- ---------------------------------------------------------------------------
SET lock_timeout = '5s';

ALTER TABLE public.news_post_reads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_post_acknowledgements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_comments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_attachments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_post_links               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_bookmarks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_mentions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_post_revisions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_notification_preferences ENABLE ROW LEVEL SECURITY;

-- =========================== RUN SEPARATELY (4/4) ==========================
-- 12. Select policies
--
-- Reads stay open to the anon/authenticated client so the realtime refresh path
-- can re-read directly, exactly as public.content_reactions does today.
--
-- DROP ... IF EXISTS followed by CREATE is idempotent without reading the
-- pg_policies view. The earlier DO-block version did read it, which pulled the
-- catalog into the transaction's lock footprint and helped produce the deadlock
-- against the running app.
-- ---------------------------------------------------------------------------
SET lock_timeout = '5s';

DROP POLICY IF EXISTS news_post_reads_select ON public.news_post_reads;
CREATE POLICY news_post_reads_select               ON public.news_post_reads               FOR SELECT USING (true);

DROP POLICY IF EXISTS news_post_acknowledgements_select ON public.news_post_acknowledgements;
CREATE POLICY news_post_acknowledgements_select    ON public.news_post_acknowledgements    FOR SELECT USING (true);

DROP POLICY IF EXISTS news_comments_select ON public.news_comments;
CREATE POLICY news_comments_select                 ON public.news_comments                 FOR SELECT USING (true);

DROP POLICY IF EXISTS news_attachments_select ON public.news_attachments;
CREATE POLICY news_attachments_select              ON public.news_attachments              FOR SELECT USING (true);

DROP POLICY IF EXISTS news_post_links_select ON public.news_post_links;
CREATE POLICY news_post_links_select               ON public.news_post_links               FOR SELECT USING (true);

DROP POLICY IF EXISTS news_bookmarks_select ON public.news_bookmarks;
CREATE POLICY news_bookmarks_select                ON public.news_bookmarks                FOR SELECT USING (true);

DROP POLICY IF EXISTS news_mentions_select ON public.news_mentions;
CREATE POLICY news_mentions_select                 ON public.news_mentions                 FOR SELECT USING (true);

DROP POLICY IF EXISTS news_post_revisions_select ON public.news_post_revisions;
CREATE POLICY news_post_revisions_select           ON public.news_post_revisions           FOR SELECT USING (true);

DROP POLICY IF EXISTS news_notification_preferences_select ON public.news_notification_preferences;
CREATE POLICY news_notification_preferences_select ON public.news_notification_preferences FOR SELECT USING (true);
