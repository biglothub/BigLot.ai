<script lang="ts">
    import { marked } from "marked";
    import DOMPurify from "isomorphic-dompurify";

    export let content = "";

    // Configure marked if needed (e.g. highlight.js integration later)
    // marked.setOptions({ ... });

    // marked + {@html} is an XSS footgun if you don't sanitize.
    $: html = DOMPurify.sanitize(marked.parse(content || "") as string);
</script>

<div class="prose-gold markdown-body">
    {@html html}
</div>

<style>
    /* Local overrides if needed, but mainly relying on global .prose-gold */
</style>
