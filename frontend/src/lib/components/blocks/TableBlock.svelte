<script lang="ts">
    let {
        title,
        headers,
        rows,
    }: {
        title?: string;
        headers: string[];
        rows: (string | number)[][];
    } = $props();
</script>

<div class="table-block">
    {#if title}
        <div class="table-header">
            <span class="table-title">{title}</span>
        </div>
    {/if}
    <div class="table-scroll">
        <table>
            <thead>
                <tr>
                    {#each headers as header}
                        <th>{header}</th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#each rows as row}
                    <tr>
                        {#each row as cell}
                            <td>{cell}</td>
                        {/each}
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>

<style>
    .table-block {
        border-radius: 12px;
        overflow: hidden;
        background: rgba(13, 17, 23, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(12px);
    }

    .table-header {
        padding: 10px 14px;
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .table-title {
        font-size: 13px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
    }

    .table-scroll {
        overflow-x: auto;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
    }

    th {
        padding: 8px 14px;
        text-align: left;
        font-weight: 600;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
        letter-spacing: 0.3px;
        background: rgba(255, 255, 255, 0.02);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        white-space: nowrap;
    }

    td {
        padding: 8px 14px;
        color: rgba(255, 255, 255, 0.85);
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        font-variant-numeric: tabular-nums;
    }

    tr:last-child td {
        border-bottom: none;
    }

    tr:hover td {
        background: rgba(255, 255, 255, 0.02);
    }
</style>
