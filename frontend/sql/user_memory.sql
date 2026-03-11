-- User Memory: persistent memory across chat sessions
-- Stores portfolio positions, preferences, watchlists, trade history, and notes

CREATE TABLE IF NOT EXISTS user_memory (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    biglot_user_id text NOT NULL,
    memory_type text NOT NULL CHECK (memory_type IN ('portfolio', 'preference', 'watchlist', 'trade_history', 'note')),
    key text NOT NULL,
    value jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (biglot_user_id, memory_type, key)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON user_memory (biglot_user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_user_type ON user_memory (biglot_user_id, memory_type);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_user_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_memory_updated_at ON user_memory;
CREATE TRIGGER trg_user_memory_updated_at
    BEFORE UPDATE ON user_memory
    FOR EACH ROW
    EXECUTE FUNCTION update_user_memory_updated_at();

-- RLS: direct client access is denied.
-- This table is intended to be accessed only by trusted server code using the
-- Supabase service-role key, which bypasses RLS and enforces biglot_user_id
-- scoping in application logic.
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own memory" ON user_memory;
DROP POLICY IF EXISTS "Users can insert own memory" ON user_memory;
DROP POLICY IF EXISTS "Users can update own memory" ON user_memory;
DROP POLICY IF EXISTS "Users can delete own memory" ON user_memory;
