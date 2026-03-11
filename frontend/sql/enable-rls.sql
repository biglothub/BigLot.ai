-- BigLot.ai - Enable Row Level Security on all public tables
-- Run this in the Supabase SQL Editor to fix security linter errors.
-- Service role bypasses RLS automatically, so server-side writes still work.

-- ============================================
-- CHATS
-- ============================================
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- ============================================
-- MESSAGES
-- ============================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CUSTOM INDICATORS
-- ============================================
ALTER TABLE public.custom_indicators ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TELEGRAM LINKS
-- ============================================
ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

-- ============================================
-- AGENT RUNS
-- ============================================
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- AGENT STEP RUNS
-- ============================================
ALTER TABLE public.agent_step_runs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- MESSAGE FEEDBACK
-- ============================================
ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PRICE ALERTS
-- User-facing; allow users to manage their own alerts.
-- ============================================
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own price_alerts" ON public.price_alerts
    FOR SELECT
    USING (biglot_user_id = (SELECT auth.uid()::text));

CREATE POLICY "Users can insert own price_alerts" ON public.price_alerts
    FOR INSERT
    WITH CHECK (biglot_user_id = (SELECT auth.uid()::text));

CREATE POLICY "Users can update own price_alerts" ON public.price_alerts
    FOR UPDATE
    USING (biglot_user_id = (SELECT auth.uid()::text));

CREATE POLICY "Users can delete own price_alerts" ON public.price_alerts
    FOR DELETE
    USING (biglot_user_id = (SELECT auth.uid()::text));

-- ============================================
-- TOOL EXECUTIONS
-- Internal table; service_role writes, users can read own (via chat).
-- ============================================
ALTER TABLE public.tool_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tool_executions" ON public.tool_executions
    FOR SELECT
    USING (
        chat_id IN (
            SELECT id FROM public.chats
            WHERE biglot_user_id = (SELECT auth.uid()::text)
        )
    );

-- ============================================
-- CHAT CHANNELS
-- Internal table; service_role writes, users can read own.
-- ============================================
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat_channels" ON public.chat_channels
    FOR SELECT
    USING (biglot_user_id = (SELECT auth.uid()::text));

-- ============================================
-- TELEGRAM LINK TOKENS
-- Short-lived server-side tokens; no direct user access via PostgREST.
-- Service role handles all reads/writes.
-- ============================================
ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TELEGRAM WEBHOOK EVENTS
-- Purely server-side. No user-facing access needed.
-- Service role handles all reads/writes.
-- ============================================
ALTER TABLE public.telegram_webhook_events ENABLE ROW LEVEL SECURITY;
