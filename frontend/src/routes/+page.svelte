<script lang="ts">
    import Sidebar from "$lib/components/Sidebar.svelte";
    import ChatArea from "$lib/components/ChatArea.svelte";
    import InputArea from "$lib/components/InputArea.svelte";
    import { chatState } from "$lib/state/chat.svelte";
    import { fade } from "svelte/transition";
</script>

<div
    class="flex h-screen overflow-hidden bg-background text-foreground font-sans"
>
    <!-- Sidebar -->
    <Sidebar />

    <!-- Main Content -->
    <main class="flex-1 flex flex-col relative z-0 overflow-hidden h-full">
        {#if chatState.messages.length === 0}
            <!-- Empty State / Home Page -->
            <div
                class="flex-1 flex flex-col items-center justify-center p-4"
                transition:fade
            >
                <div class="mb-8 text-center">
                    <h1 class="text-3xl font-semibold text-white mb-2">
                        Ready when you are.
                    </h1>
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
