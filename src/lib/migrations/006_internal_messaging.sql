-- file location: src/lib/migrations/006_internal_messaging.sql
-- Purpose: Introduce internal messaging threads, membership, and group chat support

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS public.message_threads (
  thread_id SERIAL PRIMARY KEY,
  thread_type TEXT NOT NULL DEFAULT 'direct' CHECK (thread_type IN ('direct', 'group')),
  title TEXT,
  unique_hash TEXT UNIQUE,
  created_by INTEGER REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.message_thread_members (
  member_id SERIAL PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES public.message_threads(thread_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ
);

ALTER TABLE public.message_thread_members
  ADD CONSTRAINT message_thread_members_unique UNIQUE (thread_id, user_id);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS thread_id INTEGER REFERENCES public.message_threads(thread_id) ON DELETE CASCADE;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_message_threads_updated_at ON public.message_threads (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_thread_members_user ON public.message_thread_members (user_id);
CREATE INDEX IF NOT EXISTS idx_thread_members_thread ON public.message_thread_members (thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_created ON public.messages (thread_id, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_thread_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR THREADS
-- ============================================

DROP POLICY IF EXISTS "threads_select_members_only" ON public.message_threads;
DROP POLICY IF EXISTS "threads_insert_by_creator" ON public.message_threads;
DROP POLICY IF EXISTS "threads_update_by_creator" ON public.message_threads;

CREATE POLICY "threads_select_members_only"
  ON public.message_threads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.message_thread_members m
      WHERE m.thread_id = message_threads.thread_id
        AND m.user_id = get_current_user_id()
    )
    OR get_user_role() = 'admin'
  );

CREATE POLICY "threads_insert_by_creator"
  ON public.message_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = get_current_user_id()
    OR get_user_role() = 'admin'
  );

CREATE POLICY "threads_update_by_creator"
  ON public.message_threads FOR UPDATE
  TO authenticated
  USING (
    created_by = get_current_user_id()
    OR get_user_role() = 'admin'
  );

-- ============================================
-- RLS POLICIES FOR MEMBERS
-- ============================================

DROP POLICY IF EXISTS "members_select_own_threads" ON public.message_thread_members;
DROP POLICY IF EXISTS "members_insert_for_threads" ON public.message_thread_members;
DROP POLICY IF EXISTS "members_update_own_row" ON public.message_thread_members;
DROP POLICY IF EXISTS "members_delete_own_row" ON public.message_thread_members;

CREATE POLICY "members_select_own_threads"
  ON public.message_thread_members FOR SELECT
  TO authenticated
  USING (
    user_id = get_current_user_id()
    OR EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.thread_id = message_thread_members.thread_id
        AND t.created_by = get_current_user_id()
    )
    OR get_user_role() = 'admin'
  );

CREATE POLICY "members_insert_for_threads"
  ON public.message_thread_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = get_current_user_id()
    OR EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.thread_id = message_thread_members.thread_id
        AND t.created_by = get_current_user_id()
    )
    OR get_user_role() = 'admin'
  );

CREATE POLICY "members_update_own_row"
  ON public.message_thread_members FOR UPDATE
  TO authenticated
  USING (
    user_id = get_current_user_id()
    OR EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.thread_id = message_thread_members.thread_id
        AND t.created_by = get_current_user_id()
    )
    OR get_user_role() = 'admin'
  );

CREATE POLICY "members_delete_own_row"
  ON public.message_thread_members FOR DELETE
  TO authenticated
  USING (
    user_id = get_current_user_id()
    OR EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.thread_id = message_thread_members.thread_id
        AND t.created_by = get_current_user_id()
    )
    OR get_user_role() = 'admin'
  );

-- ============================================
-- UPDATE MESSAGE POLICIES TO HONOUR THREAD MEMBERSHIP
-- ============================================

DROP POLICY IF EXISTS "user_send_messages" ON public.messages;
DROP POLICY IF EXISTS "user_view_messages" ON public.messages;
DROP POLICY IF EXISTS "user_update_messages" ON public.messages;
DROP POLICY IF EXISTS "user_delete_messages" ON public.messages;

CREATE POLICY "user_send_messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = get_current_user_id()
    AND (
      receiver_id IS NOT NULL
      OR (
        messages.thread_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.message_thread_members m
          WHERE m.thread_id = messages.thread_id
            AND m.user_id = get_current_user_id()
        )
      )
    )
  );

CREATE POLICY "user_view_messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    sender_id = get_current_user_id()
    OR receiver_id = get_current_user_id()
    OR (
      messages.thread_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.message_thread_members m
        WHERE m.thread_id = messages.thread_id
          AND m.user_id = get_current_user_id()
      )
    )
    OR get_user_role() = 'admin'
  );

CREATE POLICY "user_update_messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    receiver_id = get_current_user_id()
    OR sender_id = get_current_user_id()
    OR get_user_role() = 'admin'
  );

CREATE POLICY "user_delete_messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (
    sender_id = get_current_user_id()
    OR get_user_role() = 'admin'
  );
