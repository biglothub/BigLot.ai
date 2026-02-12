<script lang="ts">
    import Sidebar from "$lib/components/Sidebar.svelte";
    import IndicatorBuilder from "$lib/components/IndicatorBuilder.svelte";

    let sidebarOpen = $state(true);
</script>

<div
    class="flex h-full overflow-hidden bg-background text-foreground font-sans"
>
    <!-- Sidebar -->
    <Sidebar bind:isOpen={sidebarOpen} />

    <!-- Main Content -->
    <main
        class="flex-1 flex flex-col relative z-0 overflow-hidden h-full transition-all duration-300 ease-in-out"
        class:ml-64={sidebarOpen}
        class:ml-0={!sidebarOpen}
    >
        <IndicatorBuilder />
    </main>
</div>
