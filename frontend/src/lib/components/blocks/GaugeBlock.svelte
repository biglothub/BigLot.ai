<script lang="ts">
    import type { GaugeBlock } from '$lib/types/contentBlock';

    let { title, value, label, thresholds }: GaugeBlock = $props();

    const cx = 100, cy = 100, r = 80;
    const startAngle = 180;
    const endAngle = 360;
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

    // Label color based on value
    const labelColor = $derived(
        value <= 25 ? '#ef4444'
        : value <= 45 ? '#f97316'
        : value <= 60 ? '#eab308'
        : value <= 80 ? '#84cc16'
        : '#22c55e'
    );

    // Active arc color (color of the segment where needle points)
    const activeColor = $derived(() => {
        if (defaultArcs.length === 0) return '#f59e0b';
        for (let i = defaultArcs.length - 1; i >= 0; i--) {
            // approximate: just use the last arc color for the current value zone
        }
        const idx = Math.min(Math.floor(pct * defaultArcs.length), defaultArcs.length - 1);
        return defaultArcs[idx]?.color ?? '#f59e0b';
    });
</script>

<div class="gauge-block">
    <div class="gauge-title">{title}</div>
    <svg viewBox="20 20 160 105" width="220" height="130" class="gauge-svg" aria-label="{title}: {value}">
        <defs>
            <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#2d3748"/>
                <stop offset="100%" stop-color="#1a202c"/>
            </radialGradient>
            <filter id="needleGlow">
                <feGaussianBlur stdDeviation="1.5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>

        <!-- Background track -->
        <path d={arcPath(180, 360, r)} fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="16" />

        <!-- Colored threshold arcs -->
        {#each defaultArcs as arc}
            <path d={arc.path} fill="none" stroke={arc.color} stroke-width="13" stroke-linecap="butt" opacity="0.85"/>
        {/each}

        <!-- Needle with glow -->
        <g filter="url(#needleGlow)">
            <polygon
                points="{needleTip.x},{needleTip.y} {needleBase1.x},{needleBase1.y} {needleBase2.x},{needleBase2.y}"
                fill="#f8fafc"
                opacity="0.95"
            />
        </g>

        <!-- Hub -->
        <circle cx={cx} cy={cy} r="7" fill="url(#hubGrad)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
        <circle cx={cx} cy={cy} r="3" fill="rgba(255,255,255,0.5)" />

        <!-- Value label -->
        <text x={cx} y={cy + 22} text-anchor="middle" font-size="13" fill="rgba(255,255,255,0.9)" font-weight="700" font-variant-numeric="tabular-nums">{value}</text>
    </svg>
    <div class="gauge-label" style="color:{labelColor}">{label}</div>
</div>

<style>
    .gauge-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1rem 1rem 0.75rem;
        background: rgba(10, 12, 18, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 12px;
        width: fit-content;
    }
    .gauge-title {
        font-size: 0.62rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.35);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 0.1rem;
    }
    .gauge-svg {
        display: block;
    }
    .gauge-label {
        font-size: 0.82rem;
        font-weight: 700;
        margin-top: 0.1rem;
        letter-spacing: 0.02em;
    }
</style>
