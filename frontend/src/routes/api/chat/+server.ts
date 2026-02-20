import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getSystemPrompt, normalizeAgentMode } from '$lib/agent/systemPrompts';
import { getClientForModel, resolveDefaultAIModel } from '$lib/server/aiProvider.server';

type IncomingMessage = {
    role: 'user' | 'assistant' | 'system';
    content?: unknown;
    image_url?: unknown;
};

function isRole(value: unknown): value is IncomingMessage['role'] {
    return value === 'user' || value === 'assistant' || value === 'system';
}

export const POST: RequestHandler = async ({ request }) => {
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

    const mode = normalizeAgentMode(payload?.mode);
    const systemPrompt = getSystemPrompt(mode);

    // Debug-only helper to validate mode switching without calling OpenAI.
    // Set `BIGLOT_CHAT_ECHO_MODE=1` in server env to enable.
    const selectedModel = resolveDefaultAIModel();

    if (env.BIGLOT_CHAT_ECHO_MODE === '1') {
        return new Response(`Mode: ${mode}\nModel: ${selectedModel}\n`, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'X-BigLot-Mode': mode,
                'X-BigLot-Model': selectedModel
            }
        });
    }

    const hasImageInput = safeMessages.some((m) => m.role === 'user' && !!m.image_url);
    const { client, apiModel, provider, supportsImageInput } = getClientForModel(selectedModel);
    if (hasImageInput && !supportsImageInput) {
        return json(
            {
                error: `Model '${selectedModel}' does not support image input. Switch AI_MODEL to 'gpt-4o' or 'gpt-4o-mini'.`
            },
            { status: 400, headers: { 'X-BigLot-Mode': mode, 'X-BigLot-Model': selectedModel } }
        );
    }

    // Create formatted messages for the active model provider
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
        stream = await client.chat.completions.create({
            model: apiModel,
            messages: formattedMessages as any,
            stream: true,
        });
    } catch (e: any) {
        return json(
            { error: e?.message || `Failed to call ${provider}` },
            { status: 502, headers: { 'X-BigLot-Mode': mode, 'X-BigLot-Model': selectedModel } }
        );
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
            'X-BigLot-Mode': mode,
            'X-BigLot-Model': selectedModel
        }
    });
};
