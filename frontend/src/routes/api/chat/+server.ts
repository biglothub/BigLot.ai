import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getSystemPrompt, normalizeAgentMode } from '$lib/agent/systemPrompts';
import { getClientForModel, isAIModel } from '$lib/server/aiProvider.server';
import { checkRateLimit, RATE_LIMITS } from '$lib/server/rateLimiter.server';
import { runAgentLoop } from '$lib/server/agentLoop.server';
import { runDiscussionLoop } from '$lib/server/discussionLoop.server';
import {
	createAgentRun,
	logToolExecution,
	updateAgentRun,
	upsertAgentStepRun
} from '$lib/server/agentObservability.server';
import { classifyChatRoute, shouldEnablePlanning } from '$lib/server/chatRouting.server';
import { getMemoryContext } from '$lib/server/memory.server';
import { setMemoryToolUserId } from '$lib/server/tools/memory.tool';
import type { AgentRouteType, ContentBlock, ResearchReportBlock, ResearchSection } from '$lib/types/contentBlock';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

type IncomingMessage = {
    role: 'user' | 'assistant' | 'system';
    content?: unknown;
    image_url?: unknown;
};

function isRole(value: unknown): value is IncomingMessage['role'] {
    return value === 'user' || value === 'assistant' || value === 'system';
}

function sseEvent(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Parse streamed synthesis text into structured sections by ## headers */
function parseResearchSections(text: string): ResearchSection[] {
    const lines = text.split('\n');
    const sections: ResearchSection[] = [];
    let currentTitle = '';
    let currentLines: string[] = [];

    for (const line of lines) {
        const headerMatch = line.match(/^##\s+(.+)/);
        if (headerMatch) {
            if (currentTitle && currentLines.length > 0) {
                sections.push({
                    id: `section_${sections.length + 1}`,
                    title: currentTitle,
                    content: currentLines.join('\n').trim()
                });
            }
            currentTitle = headerMatch[1].trim();
            currentLines = [];
        } else {
            currentLines.push(line);
        }
    }

    // Push last section
    if (currentTitle && currentLines.length > 0) {
        sections.push({
            id: `section_${sections.length + 1}`,
            title: currentTitle,
            content: currentLines.join('\n').trim()
        });
    }

    // If no ## headers found, wrap entire text as single section
    if (sections.length === 0 && text.trim().length > 0) {
        sections.push({
            id: 'section_1',
            title: 'Research Findings',
            content: text.trim()
        });
    }

    return sections;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
    // Rate limiting
    const clientIp = getClientAddress() || 'unknown';
    const rateLimitResult = checkRateLimit(clientIp, RATE_LIMITS.chat);

    if (!rateLimitResult.allowed) {
        return json(
            { error: 'Too many requests. Please try again later.' },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000))
                }
            }
        );
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

    const chatId = typeof payload?.chatId === 'string' ? payload.chatId : null;
    const biglotUserId = typeof payload?.biglotUserId === 'string' ? payload.biglotUserId : null;

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
    const chatMode = payload?.chatMode === 'agent' ? 'agent' : payload?.chatMode === 'discussion' ? 'discussion' : 'normal';
    const latestUserMessage = [...safeMessages].reverse().find((m) => m.role === 'user');
    const lastUserMessage = latestUserMessage?.content ?? '';
    const routeType: AgentRouteType = chatMode === 'discussion'
        ? 'discussion'
        : classifyChatRoute({
              chatMode,
              mode,
              lastUserMessage,
              hasImageInput: safeMessages.some((m) => m.role === 'user' && !!m.image_url)
          });
    const isDeepResearch = routeType === 'deep_research';
    const planningEnabled = shouldEnablePlanning(chatMode, routeType);
    const systemPrompt = getSystemPrompt(mode, planningEnabled, isDeepResearch);

    // Select model based on chatMode — configurable via .env
    const normalModel = isAIModel(env.NORMAL_AI_MODEL) ? env.NORMAL_AI_MODEL : 'deepseek';
    const agentModel = isAIModel(env.AGENT_AI_MODEL) ? env.AGENT_AI_MODEL : 'gpt-4o';
    const selectedModel = chatMode === 'agent' || isDeepResearch ? agentModel : chatMode === 'discussion' ? agentModel : normalModel;

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

    // Set user ID for memory tools (before agent loop executes tools)
    setMemoryToolUserId(biglotUserId);

    // Fetch user memory context for personalization
    const memoryContext = biglotUserId ? await getMemoryContext(biglotUserId).catch(() => null) : null;

    // Build formatted messages for OpenAI
    const formattedMessages: ChatCompletionMessageParam[] = [
        {
            role: 'system',
            content: memoryContext ? `${systemPrompt}\n\n${memoryContext}` : systemPrompt
        },
        ...safeMessages.map((m): ChatCompletionMessageParam => {
            if (m.role === 'user' && m.image_url) {
                return {
                    role: 'user',
                    content: [
                        { type: 'text' as const, text: m.content || 'Analyze this image.' },
                        { type: 'image_url' as const, image_url: { url: m.image_url } }
                    ]
                };
            }
            return { role: m.role as 'user' | 'assistant' | 'system', content: m.content };
        })
    ];

    // SSE streaming
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
        async start(controller) {
            let runId: string | null = null;
            let planUsed = false;
            let toolCallCount = 0;
            let streamedText = '';
            const toolStarts = new Map<string, { name: string; args: Record<string, unknown>; startedAt: number }>();

            // Fire createAgentRun non-blocking so SSE stream starts immediately
            const runIdPromise = createAgentRun({
                chatId,
                biglotUserId,
                mode,
                chatMode,
                routeType,
                provider,
                model: selectedModel,
                clientIp,
                messageCount: safeMessages.length,
                hasImageInput,
                lastUserMessage
            }).then((id) => {
                runId = id;
                if (id) {
                    controller.enqueue(encoder.encode(sseEvent('run_id', { runId: id })));
                }
                return id;
            }).catch(() => null);

            try {
                controller.enqueue(
                    encoder.encode(
                        sseEvent('run_start', {
                            runId: null,
                            routeType,
                            mode,
                            chatMode,
                            model: selectedModel
                        })
                    )
                );

                if (chatMode === 'agent') {
                    // Agent mode: GPT-4o with tool calling via agent loop
                    const allBlocks: ContentBlock[] = [];

                    const researchStartTime = Date.now();

                    // Keep-alive interval to prevent idle timeout on long research
                    const keepAliveInterval = isDeepResearch
                        ? setInterval(() => {
                              try { controller.enqueue(encoder.encode(': keepalive\n\n')); } catch { /* stream closed */ }
                          }, 15_000)
                        : null;

                    const deepResearchMaxIterations = parseInt(env.DEEP_RESEARCH_MAX_ITERATIONS || '8', 10);

                    const resultBlocks = await runAgentLoop({
                        client,
                        apiModel,
                        messages: formattedMessages,
                        maxIterations: isDeepResearch ? deepResearchMaxIterations : 5,
                        maxPlanSteps: isDeepResearch ? 10 : 6,
                        planningEnabled,
                        currentMode: mode,
                        callbacks: {
                            onTextDelta: (text) => {
                                streamedText += text;
                                controller.enqueue(encoder.encode(sseEvent('text_delta', { content: text })));
                            },
                            onToolStart: (toolCallId, tool, args) => {
                                toolCallCount += 1;
                                toolStarts.set(toolCallId, { name: tool, args, startedAt: Date.now() });
                                controller.enqueue(
                                    encoder.encode(sseEvent('tool_start', { toolCallId, tool, args }))
                                );
                            },
                            onToolResult: (toolCallId, tool, result) => {
                                const started = toolStarts.get(toolCallId);
                                const executionTimeMs = started ? Date.now() - started.startedAt : null;
                                allBlocks.push(...result.contentBlocks);
                                controller.enqueue(
                                    encoder.encode(
                                        sseEvent('tool_result', {
                                            toolCallId,
                                            tool,
                                            blocks: result.contentBlocks,
                                            success: result.success,
                                            textSummary: result.textSummary
                                        })
                                    )
                                );

                                void logToolExecution({
                                    runId,
                                    chatId,
                                    toolCallId,
                                    toolName: tool,
                                    toolArgs: started?.args ?? {},
                                    resultStatus: result.success ? 'success' : 'error',
                                    resultData: {
                                        textSummary: result.textSummary,
                                        blockCount: result.contentBlocks.length,
                                        blockTypes: result.contentBlocks.map((block) => block.type)
                                    },
                                    errorMessage: result.success ? null : result.textSummary,
                                    executionTimeMs
                                });
                            },
                            onPlanCreate: (plan) => {
                                planUsed = true;
                                allBlocks.push(plan);
                                controller.enqueue(encoder.encode(sseEvent('plan_create', { plan })));
                            },
                            onPlanStepUpdate: (planId, stepId, status, result, stepMeta) => {
                                controller.enqueue(encoder.encode(sseEvent('plan_update', { planId, stepId, status, result })));
                                void upsertAgentStepRun({
                                    runId,
                                    planId,
                                    stepId,
                                    title: stepMeta?.title,
                                    toolName: stepMeta?.toolName,
                                    status,
                                    result
                                });
                            },
                            onPlanComplete: (planId, status) => {
                                controller.enqueue(encoder.encode(sseEvent('plan_complete', { planId, status })));
                            },
                            onHandoff: (targetMode, reason) => {
                                controller.enqueue(encoder.encode(sseEvent('agent_handoff', { targetMode, reason })));
                            },
                            onError: (message) => {
                                controller.enqueue(encoder.encode(sseEvent('error', { message })));
                            }
                        }
                    });

                    if (keepAliveInterval) clearInterval(keepAliveInterval);

                    for (const block of resultBlocks) {
                        if (!allBlocks.includes(block)) {
                            allBlocks.push(block);
                        }
                    }

                    // Post-process: build ResearchReportBlock for deep research
                    if (isDeepResearch && streamedText.length > 0) {
                        const sections = parseResearchSections(streamedText);
                        const report: ResearchReportBlock = {
                            type: 'research_report',
                            reportId: `research_${Date.now()}`,
                            title: `Research: ${lastUserMessage.slice(0, 60)}`,
                            query: lastUserMessage,
                            sections,
                            status: 'complete',
                            toolCallCount,
                            totalDurationMs: Date.now() - researchStartTime,
                            createdAt: researchStartTime,
                            updatedAt: Date.now()
                        };
                        allBlocks.push(report);
                        controller.enqueue(encoder.encode(sseEvent('research_report', { report })));
                    }

                    await runIdPromise;
                    if (runId) {
                        await updateAgentRun({
                            runId,
                            status: 'complete',
                            planUsed,
                            toolCallCount,
                            textOutputLength: streamedText.length
                        });
                    }

                    controller.enqueue(encoder.encode(sseEvent('done', { runId, routeType, contentBlocks: allBlocks })));
                } else if (chatMode === 'discussion') {
                    // Discussion mode: 3 AI panelists debate
                    const discussionBlocks = await runDiscussionLoop({
                        topic: lastUserMessage,
                        conversationHistory: formattedMessages,
                        callbacks: {
                            onDiscussionStart: (block) => {
                                controller.enqueue(encoder.encode(sseEvent('discussion_start', { block })));
                            },
                            onTurnStart: (discussionId, panelistId, round, model) => {
                                controller.enqueue(
                                    encoder.encode(
                                        sseEvent('discussion_turn_start', { discussionId, panelistId, round, model })
                                    )
                                );
                            },
                            onTextDelta: (text, panelistId) => {
                                streamedText += text;
                                controller.enqueue(encoder.encode(sseEvent('text_delta', { content: text, panelistId })));
                            },
                            onTurnEnd: (discussionId, panelistId, round) => {
                                controller.enqueue(
                                    encoder.encode(
                                        sseEvent('discussion_turn_end', { discussionId, panelistId, round })
                                    )
                                );
                            },
                            onRoundSkipped: (round, reason) => {
                                controller.enqueue(encoder.encode(sseEvent('discussion_round_skipped', { round, reason })));
                            },
                            onError: (message) => {
                                controller.enqueue(encoder.encode(sseEvent('error', { message })));
                            }
                        }
                    });

                    await runIdPromise;
                    if (runId) {
                        await updateAgentRun({
                            runId,
                            status: 'complete',
                            planUsed: false,
                            toolCallCount: 0,
                            textOutputLength: streamedText.length
                        });
                    }

                    controller.enqueue(encoder.encode(sseEvent('done', { runId, routeType, contentBlocks: discussionBlocks })));
                } else {
                    // Normal mode: DeepSeek direct streaming, no tools
                    const stream = await client.chat.completions.create({
                        model: apiModel,
                        messages: formattedMessages,
                        stream: true
                    });

                    for await (const chunk of stream) {
                        const text = chunk.choices[0]?.delta?.content;
                        if (text) {
                            streamedText += text;
                            controller.enqueue(encoder.encode(sseEvent('text_delta', { content: text })));
                        }
                    }

                    await runIdPromise;
                    if (runId) {
                        await updateAgentRun({
                            runId,
                            status: 'complete',
                            planUsed: false,
                            toolCallCount: 0,
                            textOutputLength: streamedText.length
                        });
                    }

                    controller.enqueue(encoder.encode(sseEvent('done', { runId, routeType, contentBlocks: [] })));
                }
            } catch (e: unknown) {
                const message = e instanceof Error ? e.message : `Failed to call ${provider}`;
                await runIdPromise.catch(() => null);
                if (runId) {
                    await updateAgentRun({
                        runId,
                        status: 'error',
                        planUsed,
                        toolCallCount,
                        textOutputLength: streamedText.length,
                        errorMessage: message
                    });
                }
                controller.enqueue(encoder.encode(sseEvent('error', { message })));
            } finally {
                controller.close();
            }
        }
    });

    return new Response(readableStream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-BigLot-Mode': mode,
            'X-BigLot-Model': selectedModel
        }
    });
};
