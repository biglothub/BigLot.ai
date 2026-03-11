-- Custom Bots: user-created AI assistants with custom prompts and tool selections
-- Similar to OpenAI's Custom GPTs — personal use only, does not affect core agent modes

CREATE TABLE IF NOT EXISTS custom_bots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    biglot_user_id text NOT NULL,
    name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    description text DEFAULT '' CHECK (char_length(description) <= 500),
    avatar text DEFAULT '🤖' CHECK (char_length(avatar) <= 10),
    system_prompt text NOT NULL CHECK (char_length(system_prompt) BETWEEN 10 AND 8000),
    tools text[] DEFAULT '{}',
    default_model text DEFAULT NULL,
    conversation_starters jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_custom_bots_user ON custom_bots (biglot_user_id);
CREATE INDEX IF NOT EXISTS idx_custom_bots_user_active ON custom_bots (biglot_user_id, is_active);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_custom_bots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_custom_bots_updated_at ON custom_bots;
CREATE TRIGGER trg_custom_bots_updated_at
    BEFORE UPDATE ON custom_bots
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_bots_updated_at();

-- RLS: direct client access is denied.
-- This table is intended to be accessed only by trusted server code using the
-- Supabase service-role key, which bypasses RLS and enforces biglot_user_id
-- scoping in application logic.
ALTER TABLE custom_bots ENABLE ROW LEVEL SECURITY;
