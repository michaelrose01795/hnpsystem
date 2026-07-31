-- The technician request page belongs to the standard Tech sidebar module.
-- Backfill only users who already have that module assigned; custom modules
-- and every other standard module remain unchanged.
BEGIN;

WITH refreshed_tech_modules AS (
  SELECT
    users.user_id,
    jsonb_set(
      users.sidebar_access,
      '{modules}',
      (
        SELECT jsonb_agg(
          CASE
            WHEN assigned.module_value->>'key' = 'department-tech'
              AND NOT (COALESCE(assigned.module_value->'items', '[]'::jsonb) ? '/consumables-request')
            THEN jsonb_set(
              assigned.module_value,
              '{items}',
              COALESCE(assigned.module_value->'items', '[]'::jsonb)
                || jsonb_build_array('/consumables-request'),
              true
            )
            ELSE assigned.module_value
          END
          ORDER BY assigned.ordinality
        )
        FROM jsonb_array_elements(users.sidebar_access->'modules') WITH ORDINALITY
          AS assigned(module_value, ordinality)
      ),
      true
    ) AS sidebar_access
  FROM public.users
  WHERE users.sidebar_access IS NOT NULL
    AND jsonb_typeof(users.sidebar_access->'modules') = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(users.sidebar_access->'modules') AS assigned(module_value)
      WHERE assigned.module_value->>'key' = 'department-tech'
        AND NOT (COALESCE(assigned.module_value->'items', '[]'::jsonb) ? '/consumables-request')
    )
)
UPDATE public.users
SET sidebar_access = jsonb_set(
  refreshed_tech_modules.sidebar_access,
  '{items}',
  CASE
    WHEN COALESCE(refreshed_tech_modules.sidebar_access->'items', '[]'::jsonb) ? '/consumables-request'
    THEN COALESCE(refreshed_tech_modules.sidebar_access->'items', '[]'::jsonb)
    ELSE COALESCE(refreshed_tech_modules.sidebar_access->'items', '[]'::jsonb)
      || jsonb_build_array('/consumables-request')
  END,
  true
)
FROM refreshed_tech_modules
WHERE users.user_id = refreshed_tech_modules.user_id;

COMMIT;
