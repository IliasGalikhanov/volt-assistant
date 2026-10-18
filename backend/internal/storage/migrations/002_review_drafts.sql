ALTER TABLE jobs ADD COLUMN draft jsonb;
ALTER TABLE jobs ADD COLUMN draft_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN error_code text NOT NULL DEFAULT '';

