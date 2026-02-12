# BigLot.ai - Trader's Personal AI Assistant 📈🤖 #BigLot

BigLot.ai is a modern, trader-focused AI chat application designed to analyze markets, provide trading insights, and act as a 24/7 personal trading assistant.

## Features ✨

- **Trader Aesthetics**: A premium "Deep Space Black & Gold" theme inspired by professional trading terminals.
- **Glassmorphism UI**: Modern, sleek interface with glassmorphism effects and smooth animations.
- **Real-time Streaming**: Chat responses stream in real-time for a responsive experience.
- **Markdown Support**: Beautifully renders code blocks, tables, lists, and formatted text.
- **Agent Modes**: Switch between **Coach**, **Market Analyst**, and **PineScript Engineer** modes inside chat.
- **Chat History**: Persistent chat history with **Supabase** backend integration.
- **Session Management**: Automatically creates new sessions; supports deleting old chats.
- **Copy & Feedback**: Easy-to-use copy buttons with visual feedback and message rating actions.

## Tech Stack 🛠️

- **Frontend**: [SvelteKit](https://kit.svelte.dev/) (Svelte 5 Runes)
- **Styling**: [TailwindCSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide Svelte](https://lucide.dev/guide/packages/lucide-svelte)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **AI Model**: OpenAI GPT-4o Integration

## Getting Started 🚀

### Prerequisites

- Node.js (v18+)
- Supabase Account
- OpenAI API Key

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
   PUBLIC_SUPABASE_URL=your_supabase_url
   PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the development server:
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

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

## License 📄

This project is licensed under the MIT License.
