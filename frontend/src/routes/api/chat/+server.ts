import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { env } from '$env/dynamic/private';

const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY ?? 'exclude-api-key-here' // In real app use env
});

export const POST: RequestHandler = async ({ request }) => {
    const { messages } = await request.json();

    // Create formatted messages for OpenAI
    const formattedMessages = [
        { role: "system", content: "You are BigLot.ai, an advanced AI assistant specifically designed for traders. You provide accurate market analysis, risk management advice, and trading strategies. Your tone is professional, concise, and objective. You use markdown to format your responses effectively." },
        ...messages
    ];

    const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: formattedMessages,
        stream: true,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
        async start(controller) {
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    controller.enqueue(encoder.encode(content));
                }
            }
            controller.close();
        }
    });

    return new Response(readableStream, {
        headers: {
            'Content-Type': 'text/event-stream'
        }
    });
};
