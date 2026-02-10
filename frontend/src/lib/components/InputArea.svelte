<script lang="ts">
    import {
        Send,
        Paperclip,
        Mic,
        Image,
        Globe,
        Loader2,
        Plus,
        GripHorizontal,
    } from "lucide-svelte";
    import { chatState } from "$lib/state/chat.svelte";

    let input = $state("");
    let fileInput: HTMLInputElement;

    async function handleSend() {
        if ((!input.trim() && !chatState.selectedImage) || chatState.isLoading)
            return;
        const content = input;
        const imageUrl = chatState.selectedImage;
        input = ""; // Clear immediately
        chatState.clearSelectedImage();
        await chatState.sendMessage(content, imageUrl || undefined);
    }

    function handleFileClick() {
        fileInput?.click();
    }

    async function handleFileChange(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            chatState.selectedImage = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }
</script>

<div class="w-full max-w-3xl mx-auto p-4">
    <!-- Image Preview -->
    {#if chatState.selectedImage}
        <div class="mb-2 relative inline-block group">
            <img
                src={chatState.selectedImage}
                alt="Selected"
                class="w-20 h-20 object-cover rounded-xl border border-white/20"
            />
            <button
                onclick={() => chatState.clearSelectedImage()}
                class="absolute -top-2 -right-2 bg-secondary text-foreground p-1 rounded-full border border-white/10 hover:bg-destructive hover:text-white transition-colors"
                title="Remove Image"
            >
                <Plus size={12} class="rotate-45" />
            </button>
        </div>
    {/if}

    <div
        class="relative bg-secondary/80 backdrop-blur-xl border border-white/10 focus-within:border-white/20 transition-all rounded-[2rem] shadow-2xl flex items-end p-2 gap-2"
    >
        <!-- Left Actions -->
        <input
            type="file"
            accept="image/*"
            bind:this={fileInput}
            onchange={handleFileChange}
            class="hidden"
        />
        <button
            onclick={handleFileClick}
            class="p-2.5 text-muted-foreground hover:text-primary hover:bg-white/5 rounded-full transition-colors mb-0.5"
            title="Add Image"
        >
            <Image size={20} />
        </button>

        <!-- Textarea -->
        <textarea
            bind:value={input}
            onkeydown={handleKeydown}
            disabled={chatState.isLoading}
            placeholder="Ask anything..."
            class="flex-1 bg-transparent border-0 ring-0 focus:ring-0 text-foreground placeholder:text-muted-foreground resize-none py-3 min-h-[44px] max-h-[200px] scrollbar-none disabled:opacity-50 text-base"
            rows="1"
        ></textarea>

        <!-- Right Actions -->
        <div class="flex items-center gap-1 mb-0.5">
            <button
                onclick={handleSend}
                class="p-2.5 rounded-full transition-all duration-200
          {(input.trim() || chatState.selectedImage) && !chatState.isLoading
                    ? 'bg-primary text-secondary font-bold hover:opacity-90'
                    : 'bg-white/5 text-muted-foreground cursor-not-allowed'}"
                disabled={(!input.trim() && !chatState.selectedImage) ||
                    chatState.isLoading}
            >
                {#if chatState.isLoading}
                    <Loader2 size={18} class="animate-spin" />
                {:else}
                    <Send size={18} />
                {/if}
            </button>
        </div>
    </div>

    <div class="mt-3 text-center text-xs text-muted-foreground/50">
        BigLot.ai can make mistakes. Consider checking important information.
    </div>
</div>
