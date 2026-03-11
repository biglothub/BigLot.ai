import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('analytics page copy', () => {
    it('labels indicator metrics as library-wide shared data', () => {
        const source = readFileSync(
            new URL('../../routes/analytics/+page.svelte', import.meta.url),
            'utf8'
        );

        expect(source).toContain('Library-wide');
        expect(source).toContain('shared across all users');
    });
});
