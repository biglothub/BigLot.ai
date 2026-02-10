<script lang="ts">
    import {
        Bot,
        User,
        Copy,
        Check,
        ThumbsUp,
        ThumbsDown,
        RefreshCcw,
    } from "lucide-svelte";
    import { chatState } from "$lib/state/chat.svelte";
    import Markdown from "./Markdown.svelte";

    let copiedIndex = $state<number | null>(null);

    function copyToClipboard(text: string, index: number) {
        navigator.clipboard.writeText(text);
        copiedIndex = index;
        setTimeout(() => {
            if (copiedIndex === index) copiedIndex = null;
        }, 2000);
    }
</script>

<div
    class="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
>
    <div class="max-w-3xl mx-auto space-y-8 pb-32">
        {#each chatState.messages as message, i}
            <div
                class="flex flex-col gap-4 {message.role === 'user'
                    ? 'items-end'
                    : 'items-start'}"
            >
                <div
                    class="flex gap-4 max-w-[85%] {message.role === 'user'
                        ? 'flex-row-reverse'
                        : ''}"
                >
                    <!-- Avatar -->
                    <div
                        class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
            {message.role === 'assistant'
                            ? 'bg-gradient-to-br from-primary to-yellow-600 text-black shadow-lg shadow-primary/20'
                            : 'bg-secondary border border-border text-foreground/80'}"
                    >
                        {#if message.role === "assistant"}
                            <Bot size={18} />
                        {:else}
                            <User size={18} />
                        {/if}
                    </div>

                    <!-- Message Content -->
                    <div class="flex flex-col gap-2 w-full min-w-0">
                        <div
                            class="text-sm font-semibold text-foreground/80 px-1"
                        >
                            {message.role === "assistant" ? "BigLot.ai" : "You"}
                        </div>

                        <div
                            class="text-base text-foreground leading-relaxed flex flex-col gap-3"
                        >
                            {#if message.image_url}
                                <div
                                    class="relative max-w-sm rounded-2xl overflow-hidden border border-white/10 group"
                                >
                                    <img
                                        src={message.image_url}
                                        alt="Attached preview"
                                        class="w-full h-auto max-h-[400px] object-cover"
                                    />
                                </div>
                            {/if}

                            {#if message.role === "assistant"}
                                <Markdown content={message.content} />
                            {:else}
                                <div class="whitespace-pre-wrap">
                                    {message.content}
                                </div>
                            {/if}
                        </div>

                        <!-- Actions -->
                        {#if message.content}
                            <div
                                class="flex items-center gap-2 mt-1 {message.role ===
                                'user'
                                    ? 'justify-end'
                                    : ''}"
                            >
                                <button
                                    onclick={() =>
                                        copyToClipboard(message.content, i)}
                                    class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-md transition-colors"
                                    title="Copy"
                                >
                                    {#if copiedIndex === i}
                                        <Check
                                            size={14}
                                            class="text-green-500"
                                        />
                                    {:else}
                                        <Copy size={14} />
                                    {/if}
                                </button>

                                {#if message.role === "assistant"}
                                    <button
                                        class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-md transition-colors"
                                        title="Regenerate"
                                    >
                                        <RefreshCcw size={14} />
                                    </button>
                                    <div
                                        class="h-3 w-px bg-white/10 mx-1"
                                    ></div>
                                    <button
                                        class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-md transition-colors"
                                        title="Good response"
                                    >
                                        <ThumbsUp size={14} />
                                    </button>
                                    <button
                                        class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-md transition-colors"
                                        title="Bad response"
                                    >
                                        <ThumbsDown size={14} />
                                    </button>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        {/each}
    </div>
</div>
