-- Profile is an invariant Account sidebar action and is not an assignable module.
-- Remove the retired module from existing per-user sidebar layout snapshots.
UPDATE public.users
SET sidebar_access = jsonb_set(
  sidebar_access,
  '{modules}',
  COALESCE(
    (
      SELECT jsonb_agg(assigned.module_value ORDER BY assigned.ordinality)
      FROM jsonb_array_elements(sidebar_access->'modules') WITH ORDINALITY
        AS assigned(module_value, ordinality)
      WHERE assigned.module_value->>'key' IS DISTINCT FROM 'department-account'
    ),
    '[]'::jsonb
  ),
  true
)
WHERE sidebar_access IS NOT NULL
  AND jsonb_typeof(sidebar_access->'modules') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(sidebar_access->'modules') AS assigned(module_value)
    WHERE assigned.module_value->>'key' = 'department-account'
  );
