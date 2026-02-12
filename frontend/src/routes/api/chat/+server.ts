import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import { env } from '$env/dynamic/private';

type IncomingMessage = {
    role: 'user' | 'assistant' | 'system';
    content?: unknown;
    image_url?: unknown;
};

function isRole(value: unknown): value is IncomingMessage['role'] {
    return value === 'user' || value === 'assistant' || value === 'system';
}

export const POST: RequestHandler = async ({ request }) => {
    if (!env.OPENAI_API_KEY) {
        return json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
    }

    let payload: any;
    try {
        payload = await request.json();
    } catch {
        return json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const messagesRaw = payload?.messages;
    if (!Array.isArray(messagesRaw)) {
        return json({ error: '`messages` must be an array' }, { status: 400 });
    }

    const MAX_MESSAGES = 50;
    const MAX_CHARS = 8000;

    const safeMessages = (messagesRaw as IncomingMessage[])
        .filter((m) => m && typeof m === 'object' && isRole((m as any).role))
        .map((m) => {
            const role = (m as any).role as IncomingMessage['role'];
            const content = typeof (m as any).content === 'string' ? (m as any).content : '';
            const image_url = typeof (m as any).image_url === 'string' ? (m as any).image_url : undefined;
            return { role, content: content.slice(0, MAX_CHARS), image_url };
        })
        .filter((m) => (m.content && m.content.trim().length > 0) || (m.role === 'user' && m.image_url))
        .slice(-MAX_MESSAGES);

    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    // Create formatted messages for OpenAI
    const formattedMessages = [
        { 
            role: "system", 
            content: `You are BigLot.ai, an elite AI assistant for traders and a world-class Pine Script v6 expert.

PINESCRIPT RULES (MUST FOLLOW):
- Always use //@version=6 as the FIRST line.
- Use namespaced functions: ta.sma(), ta.ema(), ta.rsi(), ta.atr(), ta.crossover(), math.abs(), math.max(), input.int(), input.float(), input.source(), input.color(), input.bool().
- ALL plot(), plotshape(), plotchar(), hline(), fill(), bgcolor(), plotcandle(), plotbar() MUST be at GLOBAL scope. NEVER inside if/for/while/function blocks.
- ALL input() calls MUST be at GLOBAL scope.
- Use 'var' for variables that persist across bars and ':=' for reassignment.
- Handle na values with nz() or na() checks.
- Use color.new() for transparency, e.g., color.new(color.red, 30).
- For conditional plots, calculate the value conditionally but plot at global scope: plot(condition ? value : na).
- Never mix indicator() and strategy() in the same script.

When users ask for indicators, provide complete, copy-paste ready PineScript v6 code that will compile without errors on TradingView.
Provide accurate market analysis, risk management advice, and professional trading strategies.
Your tone is professional, concise, and objective. Use markdown effectively.`
        },
        ...safeMessages.map((m) => {
            // Only allow images from the user; ignore images on assistant messages.
            if (m.role === 'user' && m.image_url) {
                return {
                    role: m.role,
                    content: [
                        { type: 'text', text: m.content || 'Analyze this image.' },
                        { type: 'image_url', image_url: { url: m.image_url } }
                    ]
                };
            }
            return { role: m.role, content: m.content };
        })
    ];

    let stream;
    try {
        stream = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: formattedMessages as any,
            stream: true,
        });
    } catch (e: any) {
        return json({ error: e?.message || 'Failed to call OpenAI' }, { status: 502 });
    }

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
        async start(controller) {
            try {
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    if (content) controller.enqueue(encoder.encode(content));
                }
            } catch {
                // Client will surface a generic error. We can't send a JSON error mid-stream.
            } finally {
                controller.close();
            }
        }
    });

    return new Response(readableStream, {
        headers: {
            // We stream plain text chunks; this is not an SSE stream.
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
        }
    });
};
