# BigLot.ai - Trader's Personal AI Assistant 📈🤖 #BigLot

BigLot.ai is a modern, trader-focused AI chat application designed to analyze markets, provide trading insights, and act as a 24/7 personal trading assistant.

## Features ✨

- **Trader Aesthetics**: A premium "Deep Space Black & Gold" theme inspired by professional trading terminals.
- **Glassmorphism UI**: Modern, sleek interface with glassmorphism effects and smooth animations.
- **Real-time Streaming**: Chat responses stream in real-time for a responsive experience.
- **Markdown Support**: Beautifully renders code blocks, tables, lists, and formatted text.
- **Agent Modes**: Switch between **Coach**, **Recovery**, **Market Analyst**, and **PineScript Engineer** modes inside chat.
- **Chat History**: Persistent chat history with **Supabase** backend integration.
- **Session Management**: Automatically creates new sessions; supports deleting old chats.
- **Copy & Feedback**: Easy-to-use copy buttons with visual feedback and message rating actions.

## Tech Stack 🛠️

- **Frontend**: [SvelteKit](https://kit.svelte.dev/) (Svelte 5 Runes)
- **Styling**: [TailwindCSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide Svelte](https://lucide.dev/guide/packages/lucide-svelte)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **AI Model**: OpenAI GPT + DeepSeek Chat/R1 support with per-surface overrides for normal chat, agent chat, Telegram, and indicator generation

## Getting Started 🚀

### Prerequisites

- Node.js (v18+)
- Supabase Account
- OpenAI API Key (for OpenAI models)
- DeepSeek API Key (optional, required when any configured model uses `deepseek` or `deepseek-r1`)
- Telegram Bot Token + Username (optional, required for Telegram Phase 1)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/biglothub/BigLot.ai.git
   cd BigLot.ai/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Environment Variables:
   Create a `.env` file in the `frontend` directory:
   ```env
   OPENAI_API_KEY=your_openai_key
   DEEPSEEK_API_KEY=your_deepseek_key
   AI_MODEL=gpt-4o
   NORMAL_AI_MODEL=deepseek
   AGENT_AI_MODEL=gpt-4o
   PUBLIC_SUPABASE_URL=your_supabase_url
   PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   TAVILY_API_KEY=your_tavily_key
   DEEP_RESEARCH_MAX_ITERATIONS=8
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_BOT_USERNAME=your_bot_username
   TELEGRAM_WEBHOOK_SECRET=strong_random_secret
   TELEGRAM_REQUIRE_WEBHOOK_SECRET=0
   TELEGRAM_RATE_LIMIT_PER_MINUTE=15
   ```

   Model precedence:
   - `NORMAL_AI_MODEL`: normal web chat override
   - `AGENT_AI_MODEL`: agent/discussion/deep-research override
   - `AI_MODEL`: shared fallback for indicator generation, Telegram, and chat when the overrides above are unset

   Supported values for `AI_MODEL`, `NORMAL_AI_MODEL`, and `AGENT_AI_MODEL`:
   `gpt-4o`, `gpt-4o-mini`, `o3-mini`, `deepseek`, `deepseek-r1`, `claude-sonnet`, `claude-haiku`, `gemini-2.5-flash`, `gemini-2.5-pro`

4. (Optional) Switch model from backend config:
   ```bash
   cd frontend
   npm run switch -- deepseek
   ```
   This updates `AI_MODEL`, `NORMAL_AI_MODEL`, and `AGENT_AI_MODEL` together. Then restart the dev server.

5. Run the development server:
   ```bash
   npm run dev
   ```

## Database Schema (Supabase)

Run this SQL in your Supabase SQL Editor to set up the tables:

```sql
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS for development (Enable with policies for production)
ALTER TABLE chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

CREATE TABLE custom_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  code TEXT NOT NULL,
  config JSONB NOT NULL,
  generation_id TEXT,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE custom_indicators DISABLE ROW LEVEL SECURITY;
```

For Telegram Phase 1 (`Add Telegram Bot` + account linking + shared web/Telegram conversation), run:

```sql
-- paste SQL from frontend/sql/telegram_phase1.sql
```

Then point Telegram webhook to:

`POST /api/telegram/webhook`

Production notes:
- `TELEGRAM_WEBHOOK_SECRET` is required in production.
- Webhook retries are deduplicated using `telegram_webhook_events`.
- Duplicate Telegram message retries are deduplicated by `messages.external_message_id` unique index.
- `/unlink` command is supported directly in Telegram.
- Inbound Telegram user messages are rate-limited per account (`TELEGRAM_RATE_LIMIT_PER_MINUTE`).

Example webhook setup:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://www.biglot.ai/api/telegram/webhook",
    "secret_token":"<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

## License 📄

This project is licensed under the MIT License.
