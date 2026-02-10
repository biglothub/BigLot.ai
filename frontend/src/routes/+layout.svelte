<script lang="ts">
	import "../app.css";
	let { children } = $props();
</script>

<div
	class="h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary selection:text-primary-foreground overflow-hidden"
>
	{@render children()}
</div>
