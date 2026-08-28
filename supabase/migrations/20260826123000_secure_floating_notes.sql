-- Floating Notes use NextAuth rather than Supabase Auth. Keep their complete
-- access boundary on the authenticated Next.js API and prevent the public
-- browser client from querying or mutating either table directly.
ALTER TABLE public.floating_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floating_note_shares ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.floating_notes FROM anon, authenticated;
REVOKE ALL ON TABLE public.floating_note_shares FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.floating_notes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.floating_note_shares TO service_role;
