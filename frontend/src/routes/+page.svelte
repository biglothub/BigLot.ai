<script lang="ts">
    import Sidebar from "$lib/components/Sidebar.svelte";
    import ChatArea from "$lib/components/ChatArea.svelte";
    import InputArea from "$lib/components/InputArea.svelte";
    import { chatState } from "$lib/state/chat.svelte";
    import AgentOrb from "$lib/components/AgentOrb.svelte";
    import { fade } from "svelte/transition";
</script>

<div
    class="flex h-screen overflow-hidden bg-background text-foreground font-sans"
>
    <!-- Sidebar -->
    <Sidebar />

    <!-- Main Content -->
    <main class="flex-1 flex flex-col relative z-0 overflow-hidden h-full">
        <!-- Top Bar (Persistent Agent Status) -->
        <div class="absolute top-4 right-4 z-50 pointer-events-none">
            {#if chatState.messages.length > 0}
                <AgentOrb
                    size="sm"
                    status={chatState.isLoading ? "analyzing" : "idle"}
                    showLabel={false}
                />
            {/if}
        </div>

        {#if chatState.messages.length === 0}
            <!-- Empty State / Home Page -->
            <div
                class="flex-1 flex flex-col items-center justify-center p-4"
                transition:fade
            >
                <div class="mb-12 scale-150">
                    <AgentOrb
                        size="lg"
                        status={chatState.isLoading ? "analyzing" : "idle"}
                    />
                </div>

                <div class="mb-8 text-center">
                    <h1
                        class="text-3xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 mb-2"
                    >
                        BigLot.ai
                    </h1>
                    <p class="text-muted-foreground">
                        Autonomous Trading Agent Platform
                    </p>
                </div>

                <div class="w-full max-w-3xl">
                    <InputArea />
                </div>
            </div>
        {:else}
            <!-- Chat Interface -->
            <div
                class="flex-1 flex flex-col h-full overflow-hidden"
                transition:fade
            >
                <ChatArea />
                <div
                    class="w-full border-t border-white/5 bg-background/50 backdrop-blur-sm pb-4"
                >
                    <InputArea />
                </div>
            </div>
        {/if}
    </main>
</div>
