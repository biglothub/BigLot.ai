<script lang="ts">
    import type { GaugeBlock } from '$lib/types/contentBlock';

    let { title, value, label, thresholds }: GaugeBlock = $props();

    // SVG arc gauge — 180° semicircle
    const cx = 100, cy = 100, r = 80;
    const startAngle = 180; // leftmost
    const endAngle = 360;   // rightmost
    const totalDeg = 180;

    function polarToXY(angleDeg: number, radius: number) {
        const rad = (angleDeg * Math.PI) / 180;
        return {
            x: cx + radius * Math.cos(rad),
            y: cy + radius * Math.sin(rad)
        };
    }

    function arcPath(fromDeg: number, toDeg: number, radius: number): string {
        const from = polarToXY(fromDeg, radius);
        const to = polarToXY(toDeg, radius);
        const largeArc = toDeg - fromDeg > 180 ? 1 : 0;
        return `M ${from.x} ${from.y} A ${radius} ${radius} 0 ${largeArc} 1 ${to.x} ${to.y}`;
    }

    interface Threshold { value: number; color: string; label: string }
    type ArcSeg = { path: string; color: string };

    const pct = $derived(Math.max(0, Math.min(100, value)) / 100);
    const needleAngle = $derived(startAngle + pct * totalDeg);
    const needleTip = $derived(polarToXY(needleAngle, r - 10));
    const needleBase1 = $derived(polarToXY(needleAngle - 90, 8));
    const needleBase2 = $derived(polarToXY(needleAngle + 90, 8));
    const sorted = $derived([...(thresholds ?? [])].sort((a, b) => a.value - b.value) as Threshold[]);
    const defaultArcs = $derived.by(() => {
        const arcs: ArcSeg[] = [];
        let prev = 0;

        for (const t of sorted) {
            const fromDeg = startAngle + (prev / 100) * totalDeg;
            const toDeg = startAngle + (t.value / 100) * totalDeg;
            if (toDeg > fromDeg) {
                arcs.push({ path: arcPath(fromDeg, toDeg, r), color: t.color });
            }
            prev = t.value;
        }

        if (prev < 100) {
            const fromDeg = startAngle + (prev / 100) * totalDeg;
            arcs.push({ path: arcPath(fromDeg, startAngle + totalDeg, r), color: sorted.at(-1)?.color ?? '#6b7280' });
        }

        return arcs.length === 0 ? [
            { path: arcPath(180, 216, r), color: '#ef4444' },
            { path: arcPath(216, 252, r), color: '#f97316' },
            { path: arcPath(252, 288, r), color: '#eab308' },
            { path: arcPath(288, 324, r), color: '#84cc16' },
            { path: arcPath(324, 360, r), color: '#22c55e' }
        ] : arcs;
    });
</script>

<div class="gauge-block">
    <div class="gauge-title">{title}</div>
    <svg viewBox="20 20 160 105" width="220" height="130" class="gauge-svg" aria-label="{title}: {value}">
        <!-- Background track -->
        <path d={arcPath(180, 360, r)} fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="16" />

        <!-- Colored threshold arcs -->
        {#each defaultArcs as arc}
            <path d={arc.path} fill="none" stroke={arc.color} stroke-width="14" stroke-linecap="butt" />
        {/each}

        <!-- Needle -->
        <polygon
            points="{needleTip.x},{needleTip.y} {needleBase1.x},{needleBase1.y} {needleBase2.x},{needleBase2.y}"
            fill="#f8fafc"
            opacity="0.9"
        />
        <!-- Hub -->
        <circle cx={cx} cy={cy} r="6" fill="#1e293b" stroke="#f8fafc" stroke-width="1.5" />

        <!-- Value label -->
        <text x={cx} y={cy + 22} text-anchor="middle" font-size="13" fill="#f8fafc" font-weight="600">{value}</text>
    </svg>
    <div class="gauge-label">{label}</div>
</div>

<style>
    .gauge-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1rem;
        background: rgba(13, 17, 23, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        width: fit-content;
    }
    .gauge-title {
        font-size: 0.75rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.25rem;
    }
    .gauge-svg {
        display: block;
    }
    .gauge-label {
        font-size: 0.85rem;
        font-weight: 700;
        color: #f8fafc;
        margin-top: 0.25rem;
    }
</style>
