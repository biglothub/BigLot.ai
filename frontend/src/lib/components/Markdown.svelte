<script lang="ts">
    import { marked } from "marked";
    import sanitizeHtml from "sanitize-html";
    import hljs from "highlight.js";
    import { onMount } from "svelte";

    export let content = "";

    // Configure marked with GFM and syntax highlighting
    marked.setOptions({
        gfm: true,
        breaks: true,
    });

    // Custom renderer for code blocks with copy button
    const renderer = new marked.Renderer();

    renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
        let highlighted: string;
        let language = lang || "plaintext";

        try {
            if (lang && hljs.getLanguage(lang)) {
                highlighted = hljs.highlight(text, { language: lang }).value;
                language = hljs.getLanguage(lang)?.name || lang;
            } else {
                highlighted = hljs.highlightAuto(text).value;
            }
        } catch {
            highlighted = text;
        }

        const escapedCode = text
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        return `<div class="code-block-wrapper">
    <div class="code-header">
        <span class="code-language">${language}</span>
        <button class="copy-btn" data-code="${escapedCode}" onclick="copyCode(this)">Copy</button>
    </div>
    <pre><code class="hljs">${highlighted}</code></pre>
</div>`;
    };

    renderer.link = function ({ href, title, text }: { href: string; title?: string | null; text: string }) {
        const isExternal = href && (href.startsWith("http://") || href.startsWith("https://"));
        const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
        const titleAttr = title ? ` title="${title}"` : "";
        return `<a href="${href}"${titleAttr}${target}>${text}</a>`;
    };

    marked.use({ renderer });

    // Sanitization config - allow necessary tags for code blocks and tables
    const sanitizeConfig = {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            "div", "span", "button", "table", "thead", "tbody", "tr", "th", "td",
            "input", "img"
        ]),
        allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            div: ["class"],
            span: ["class"],
            button: ["class", "data-code", "onclick"],
            a: ["href", "title", "target", "rel"],
            code: ["class"],
            pre: ["class"],
            table: ["class"],
            th: ["class", "align"],
            td: ["class", "align"],
            input: ["type", "disabled", "checked"],
            img: ["src", "alt", "title", "class"],
        },
        allowedClasses: {
            div: ["code-block-wrapper", "code-header", "markdown-body", "hljs", "*"],
            span: ["code-language", "hljs-*", "*"],
            button: ["copy-btn"],
            code: ["hljs", "hljs-*"],
            pre: ["hljs"],
            table: ["*"],
            "*": ["*"],
        },
    };

    $: html = sanitizeHtml(marked.parse(content || "") as string, sanitizeConfig);

    // Copy function exposed to window
    onMount(() => {
        (window as any).copyCode = (btn: HTMLButtonElement) => {
            const code = btn.getAttribute("data-code") || "";
            navigator.clipboard.writeText(code).then(() => {
                const originalText = btn.textContent;
                btn.textContent = "Copied!";
                btn.classList.add("copied");
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.classList.remove("copied");
                }, 2000);
            });
        };

        return () => {
            delete (window as any).copyCode;
        };
    });
</script>

<div class="prose-gold markdown-body">
    {@html html}
</div>

<style>
    /* Code block styling */
    .markdown-body :global(.code-block-wrapper) {
        position: relative;
        margin: 1rem 0;
        border-radius: 0.5rem;
        overflow: hidden;
        background: #1e1e1e;
    }

    .markdown-body :global(.code-header) {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 1rem;
        background: #2d2d2d;
        border-bottom: 1px solid #404040;
    }

    .markdown-body :global(.code-language) {
        font-size: 0.75rem;
        color: #a0a0a0;
        text-transform: uppercase;
        font-weight: 500;
    }

    .markdown-body :global(.copy-btn) {
        padding: 0.25rem 0.75rem;
        font-size: 0.75rem;
        background: #404040;
        color: #e0e0e0;
        border: none;
        border-radius: 0.25rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .markdown-body :global(.copy-btn:hover) {
        background: #505050;
    }

    .markdown-body :global(.copy-btn.copied) {
        background: #22c55e;
        color: white;
    }

    .markdown-body :global(pre) {
        margin: 0;
        padding: 1rem;
        overflow-x: auto;
    }

    .markdown-body :global(pre code) {
        font-family: "Fira Code", "JetBrains Mono", Consolas, Monaco, monospace;
        font-size: 0.875rem;
        line-height: 1.6;
        white-space: pre;
        background: transparent;
    }

    .markdown-body :global(code:not(pre code)) {
        background: rgba(255, 255, 255, 0.1);
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        font-size: 0.875em;
        white-space: pre-wrap;
    }

    /* Table styling */
    .markdown-body :global(table) {
        width: 100%;
        border-collapse: collapse;
        margin: 1rem 0;
    }

    .markdown-body :global(th),
    .markdown-body :global(td) {
        border: 1px solid #404040;
        padding: 0.5rem 0.75rem;
        text-align: left;
    }

    .markdown-body :global(th) {
        background: rgba(255, 255, 255, 0.05);
        font-weight: 600;
    }

    .markdown-body :global(tr:hover) {
        background: rgba(255, 255, 255, 0.02);
    }

    /* External link indicator */
    .markdown-body :global(a[target="_blank"]::after) {
        content: " ↗";
        font-size: 0.75em;
        opacity: 0.7;
    }

    /* Highlight.js theme overrides for dark mode */
    .markdown-body :global(.hljs) {
        color: #abb2bf;
        background: transparent;
    }

    .markdown-body :global(.hljs-keyword),
    .markdown-body :global(.hljs-selector-tag),
    .markdown-body :global(.hljs-built_in) {
        color: #c678dd;
    }

    .markdown-body :global(.hljs-string),
    .markdown-body :global(.hljs-title) {
        color: #98c379;
    }

    .markdown-body :global(.hljs-number),
    .markdown-body :global(.hljs-literal) {
        color: #d19a66;
    }

    .markdown-body :global(.hljs-comment) {
        color: #5c6370;
        font-style: italic;
    }

    .markdown-body :global(.hljs-function) {
        color: #61afef;
    }

    .markdown-body :global(.hljs-variable),
    .markdown-body :global(.hljs-params) {
        color: #e06c75;
    }
</style>
