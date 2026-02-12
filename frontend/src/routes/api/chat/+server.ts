import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import { getSystemPrompt, normalizeAgentMode } from '$lib/agent/systemPrompts';

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

    const mode = normalizeAgentMode(payload?.mode);
    const systemPrompt = getSystemPrompt(mode);

    // Create formatted messages for OpenAI
    const formattedMessages = [
        { 
            role: "system", 
            content: systemPrompt
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
