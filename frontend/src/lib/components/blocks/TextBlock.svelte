<script lang="ts">
    import Markdown from "../Markdown.svelte";

    let { content }: { content: string } = $props();
</script>

<Markdown {content} />
