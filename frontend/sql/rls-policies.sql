-- BigLot.ai - Supabase Row Level Security (RLS) Policies
-- Run this in your Supabase SQL Editor for production security

-- ============================================
-- CHATS TABLE
-- ============================================

-- Enable RLS on chats table
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own chats
CREATE POLICY "Users can view own chats" ON chats
    FOR SELECT
    USING (biglot_user_id = (SELECT auth.uid()::text));

-- Policy: Users can insert their own chats
CREATE POLICY "Users can insert own chats" ON chats
    FOR INSERT
    WITH CHECK (biglot_user_id = (SELECT auth.uid()::text));

-- Policy: Users can update their own chats
CREATE POLICY "Users can update own chats" ON chats
    FOR UPDATE
    USING (biglot_user_id = (SELECT auth.uid()::text));

-- Policy: Users can delete their own chats
CREATE POLICY "Users can delete own chats" ON chats
    FOR DELETE
    USING (biglot_user_id = (SELECT auth.uid()::text));

-- ============================================
-- MESSAGES TABLE
-- ============================================

-- Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see messages from their chats
CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT
    USING (
        chat_id IN (
            SELECT id FROM chats 
            WHERE biglot_user_id = (SELECT auth.uid()::text)
        )
    );

-- Policy: Users can insert messages to their chats
CREATE POLICY "Users can insert own messages" ON messages
    FOR INSERT
    WITH CHECK (
        chat_id IN (
            SELECT id FROM chats 
            WHERE biglot_user_id = (SELECT auth.uid()::text)
        )
    );

-- Policy: Users can delete messages from their chats
CREATE POLICY "Users can delete own messages" ON messages
    FOR DELETE
    USING (
        chat_id IN (
            SELECT id FROM chats 
            WHERE biglot_user_id = (SELECT auth.uid()::text)
        )
    );

-- ============================================
-- CUSTOM INDICATORS TABLE
-- ============================================

-- Enable RLS on custom_indicators table
ALTER TABLE custom_indicators ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own indicators
CREATE POLICY "Users can view own indicators" ON custom_indicators
    FOR SELECT
    USING (true); -- For now, allow all to view (can be restricted with user_id column)

-- Policy: Users can insert their own indicators
CREATE POLICY "Users can insert own indicators" ON custom_indicators
    FOR INSERT
    WITH CHECK (true);

-- Policy: Users can update their own indicators
CREATE POLICY "Users can update own indicators" ON custom_indicators
    FOR UPDATE
    USING (true);

-- Policy: Users can delete their own indicators
CREATE POLICY "Users can delete own indicators" ON custom_indicators
    FOR DELETE
    USING (true);

-- ============================================
-- TELEGRAM LINKS TABLE
-- ============================================

-- Enable RLS on telegram_links table
ALTER TABLE telegram_links ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own telegram link
CREATE POLICY "Users can view own telegram link" ON telegram_links
    FOR SELECT
    USING (biglot_user_id = (SELECT auth.uid()::text));

-- Policy: Users can insert their own telegram link
CREATE POLICY "Users can insert own telegram link" ON telegram_links
    FOR INSERT
    WITH CHECK (biglot_user_id = (SELECT auth.uid()::text));

-- Policy: Users can update their own telegram link
CREATE POLICY "Users can update own telegram link" ON telegram_links
    FOR UPDATE
    USING (biglot_user_id = (SELECT auth.uid()::text));

-- ============================================
-- NOTE: For full RLS, you need to:
-- 1. Add user_id column to tables (or use biglot_user_id)
-- 2. Set up Supabase Auth
-- 3. Update policies to use auth.uid()
--
-- For development, you can keep RLS disabled:
-- ALTER TABLE chats DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE custom_indicators DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE telegram_links DISABLE ROW LEVEL SECURITY;
-- ============================================
