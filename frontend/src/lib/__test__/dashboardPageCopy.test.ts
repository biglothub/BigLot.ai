import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('dashboard page copy', () => {
    const source = readFileSync(
        new URL('../../routes/dashboard/+page.svelte', import.meta.url),
        'utf8'
    );

    it('imports all required dashboard components', () => {
        expect(source).toContain('import Sidebar from "$lib/components/Sidebar.svelte";');
        expect(source).toContain("import GoldHeroPanel from '$lib/components/dashboard/GoldHeroPanel.svelte';");
        expect(source).toContain("import MacroStrip from '$lib/components/dashboard/MacroStrip.svelte';");
        expect(source).toContain("import DashboardMiniChart from '$lib/components/dashboard/DashboardMiniChart.svelte';");
    });

    it('imports dashboard types and constants', () => {
        expect(source).toContain("from '$lib/types/dashboardMeta';");
        expect(source).toContain('DASHBOARD_TIMEFRAMES');
        expect(source).toContain('DashboardTimeframe');
    });

    it('renders the hero section with title and description', () => {
        expect(source).toContain('Gold Dashboard');
        expect(source).toContain('Live market framing');
        expect(source).toContain('A premium snapshot of gold price, macro pressure, COT positioning, and');
        expect(source).toContain('chart context for fast market orientation.');
    });

    it('contains all five panel eyebrows and titles', () => {
        expect(source).toContain('System health');
        expect(source).toContain('Source availability and freshness');
        expect(source).toContain('Gold pulse');
        expect(source).toContain('Spot, Thai gold, and range context');
        expect(source).toContain('Market assessment');
        expect(source).toContain('Market Assessment');
        expect(source).toContain('Gold chart');
        expect(source).toContain('GC=F Gold Futures');
        expect(source).toContain('Positioning');
        expect(source).toContain('COT Positioning');
        expect(source).toContain('Macro context');
        expect(source).toContain('Dollar, yields, equities, and bias');
    });

    it('uses the correct layout grid classes', () => {
        expect(source).toContain('content-stack');
        expect(source).toContain('feature-grid');
        expect(source).toContain('market-grid');
        expect(source).toContain('source-grid');
        expect(source).toContain('timeframe-switcher');
        expect(source).toContain('dashboard-panel-health');
        expect(source).not.toContain('dashboard-panel-compact');
    });

    it('defines the four source labels in order', () => {
        expect(source).toContain("sourceOrder: DashboardSource[] = ['gold', 'macro', 'cot', 'chart']");
        expect(source).toContain("gold: 'Gold'");
        expect(source).toContain("macro: 'Macro'");
        expect(source).toContain("cot: 'COT'");
        expect(source).toContain("chart: 'Chart'");
    });
});
