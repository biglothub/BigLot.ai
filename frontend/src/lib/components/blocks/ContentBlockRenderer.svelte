<script lang="ts">
    import type { ContentBlock } from "$lib/types/contentBlock";
    import TextBlock from "./TextBlock.svelte";
    import MetricCard from "./MetricCard.svelte";
    import ChartBlock from "./ChartBlock.svelte";
    import TableBlock from "./TableBlock.svelte";
    import ImageBlock from "./ImageBlock.svelte";
    import EmbedBlock from "./EmbedBlock.svelte";
    import NewsList from "./NewsList.svelte";
    import ErrorBlock from "./ErrorBlock.svelte";
    import PlanBlock from "./PlanBlock.svelte";

    let { block }: { block: ContentBlock } = $props();
</script>

{#if block.type === "text"}
    <TextBlock content={block.content} />
{:else if block.type === "metric_card"}
    <MetricCard title={block.title} metrics={block.metrics} />
{:else if block.type === "chart"}
    <ChartBlock
        chartType={block.chartType}
        symbol={block.symbol}
        interval={block.interval}
        data={block.data}
        indicators={block.indicators}
    />
{:else if block.type === "table"}
    <TableBlock title={block.title} headers={block.headers} rows={block.rows} />
{:else if block.type === "image"}
    <ImageBlock url={block.url} alt={block.alt} caption={block.caption} />
{:else if block.type === "embed"}
    <EmbedBlock url={block.url} height={block.height} title={block.title} />
{:else if block.type === "news_list"}
    <NewsList items={block.items} />
{:else if block.type === "error"}
    <ErrorBlock message={block.message} tool={block.tool} />
{:else if block.type === "plan"}
    <PlanBlock plan={block} />
{/if}
