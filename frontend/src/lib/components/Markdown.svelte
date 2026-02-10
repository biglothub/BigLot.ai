<script lang="ts">
    import { marked } from "marked";

    export let content = "";

    // Configure marked if needed (e.g. highlight.js integration later)
    // marked.setOptions({ ... });

    $: html = marked.parse(content || "");
</script>

<div class="prose-gold markdown-body">
    {@html html}
</div>

<style>
    /* Local overrides if needed, but mainly relying on global .prose-gold */
</style>
