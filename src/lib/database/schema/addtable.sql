-- // file location: src/lib/database/schema/addtable.sql
-- // description: defines supplemental tables added beyond reference schema

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS dark_mode boolean DEFAULT false;
