import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('dashboard page copy', () => {
    it('uses the shared shell and premium section headings', () => {
        const source = readFileSync(
            new URL('../../routes/dashboard/+page.svelte', import.meta.url),
            'utf8'
        );

        expect(source).toContain('import Sidebar from "$lib/components/Sidebar.svelte";');
        expect(source).toContain('Gold Dashboard');
        expect(source).toContain('System health');
        expect(source).toContain('Market Assessment');
        expect(source).toContain('Macro context');
    });
});
