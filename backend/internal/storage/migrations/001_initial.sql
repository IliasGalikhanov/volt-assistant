CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS datasets (
 id text PRIMARY KEY, owner text REFERENCES sessions(id) ON DELETE CASCADE,
 name text NOT NULL, kind text NOT NULL CHECK (kind IN ('synthetic','upload','ekt')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS products (
 dataset text NOT NULL REFERENCES datasets(id) ON DELETE CASCADE, sku text NOT NULL,
 document jsonb NOT NULL, PRIMARY KEY(dataset,sku)
);
CREATE TABLE IF NOT EXISTS carts (
 session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 dataset text NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0, lines jsonb NOT NULL DEFAULT '[]', PRIMARY KEY(session_id,dataset)
);
CREATE TABLE IF NOT EXISTS proposals (
 id text PRIMARY KEY, session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 dataset text NOT NULL REFERENCES datasets(id) ON DELETE CASCADE, revision bigint NOT NULL,
 lines jsonb NOT NULL, status text NOT NULL DEFAULT 'pending', expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS messages (
 id bigserial PRIMARY KEY, session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 dataset text NOT NULL REFERENCES datasets(id) ON DELETE CASCADE, role text NOT NULL, document jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS jobs (
 id text PRIMARY KEY, session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 dataset text NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
 kind text NOT NULL, status text NOT NULL DEFAULT 'queued', filename text NOT NULL,
 original_name text NOT NULL, result jsonb NOT NULL DEFAULT '{}', error text NOT NULL DEFAULT '',
 attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_pending_idx ON jobs(status,created_at);
CREATE INDEX IF NOT EXISTS messages_session_idx ON messages(session_id,dataset,id);
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
