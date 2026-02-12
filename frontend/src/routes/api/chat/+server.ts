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
        ...messages.map((m: any) => {
            if (m.image_url) {
                return {
                    role: m.role,
                    content: [
                        { type: "text", text: m.content || "Analyze this image." },
                        { type: "image_url", image_url: { url: m.image_url } }
                    ]
                };
            }
            return { role: m.role, content: m.content };
        })
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
