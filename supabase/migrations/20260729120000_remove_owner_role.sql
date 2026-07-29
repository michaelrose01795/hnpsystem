-- The Owner application role has been retired. Preserve any existing staff
-- accounts by moving them to the remaining top-level administrative role.
UPDATE public.users
SET
  role = 'Admin Manager',
  updated_at = now()
WHERE lower(trim(role)) = 'owner';
