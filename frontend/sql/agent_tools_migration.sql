-- Agent Tools Migration
-- Adds support for structured content blocks and tool execution tracking

-- 1. Add content_blocks JSONB column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS content_blocks jsonb;

-- 2. Tool execution log for debugging and analytics
CREATE TABLE IF NOT EXISTS tool_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id uuid REFERENCES chats(id) ON DELETE CASCADE,
    message_id uuid,
    tool_name text NOT NULL,
    tool_args jsonb NOT NULL DEFAULT '{}',
    result_status text NOT NULL DEFAULT 'pending',  -- pending, success, error, timeout
    result_data jsonb,
    error_message text,
    execution_time_ms integer,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_executions_chat ON tool_executions(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool ON tool_executions(tool_name, created_at DESC);

-- 3. Price alerts table (for Phase 4)
CREATE TABLE IF NOT EXISTS price_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    biglot_user_id text NOT NULL,
    symbol text NOT NULL,
    condition text NOT NULL,  -- 'above' | 'below' | 'cross'
    target_price numeric NOT NULL,
    current_price numeric,
    status text NOT NULL DEFAULT 'active',  -- active, triggered, cancelled
    triggered_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON price_alerts(biglot_user_id, status);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(symbol, status) WHERE status = 'active';
