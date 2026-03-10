-- BigLot.ai Phase 1 observability and feedback

ALTER TABLE messages ADD COLUMN IF NOT EXISTS run_id uuid;

CREATE TABLE IF NOT EXISTS agent_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id uuid REFERENCES chats(id) ON DELETE SET NULL,
    biglot_user_id text,
    mode text,
    chat_mode text NOT NULL DEFAULT 'normal',
    route_type text NOT NULL DEFAULT 'direct_answer',
    provider text,
    model text,
    client_ip text,
    message_count integer NOT NULL DEFAULT 0,
    has_image_input boolean NOT NULL DEFAULT false,
    last_user_message text,
    status text NOT NULL DEFAULT 'running',
    plan_used boolean NOT NULL DEFAULT false,
    tool_call_count integer NOT NULL DEFAULT 0,
    text_output_length integer NOT NULL DEFAULT 0,
    error_message text,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_chat_created_at
    ON agent_runs (chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_user_created_at
    ON agent_runs (biglot_user_id, created_at DESC);

ALTER TABLE tool_executions ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL;
ALTER TABLE tool_executions ADD COLUMN IF NOT EXISTS tool_call_id text;

CREATE INDEX IF NOT EXISTS idx_tool_executions_run_created_at
    ON tool_executions (run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_step_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    plan_id text,
    step_id text NOT NULL,
    title text,
    tool_name text,
    status text NOT NULL DEFAULT 'pending',
    result text,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (run_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_step_runs_run_created_at
    ON agent_step_runs (run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
    biglot_user_id text,
    feedback text NOT NULL,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_feedback_run_created_at
    ON message_feedback (run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_feedback_user_created_at
    ON message_feedback (biglot_user_id, created_at DESC);

-- Enable RLS (service_role client bypasses RLS automatically)
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_step_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;

-- Users can view their own agent runs
CREATE POLICY "Users can view own agent_runs" ON agent_runs
    FOR SELECT
    USING (biglot_user_id = (SELECT auth.uid()::text));

-- Users can view step runs for their own agent runs
CREATE POLICY "Users can view own step_runs" ON agent_step_runs
    FOR SELECT
    USING (
        run_id IN (
            SELECT id FROM agent_runs
            WHERE biglot_user_id = (SELECT auth.uid()::text)
        )
    );

-- Users can view and insert their own feedback
CREATE POLICY "Users can view own feedback" ON message_feedback
    FOR SELECT
    USING (biglot_user_id = (SELECT auth.uid()::text));

CREATE POLICY "Users can insert own feedback" ON message_feedback
    FOR INSERT
    WITH CHECK (biglot_user_id = (SELECT auth.uid()::text));

-- DEV CONVENIENCE: To disable RLS in development, uncomment:
-- ALTER TABLE agent_runs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE agent_step_runs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE message_feedback DISABLE ROW LEVEL SECURITY;
