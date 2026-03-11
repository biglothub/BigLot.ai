import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			'$env/dynamic/private': path.resolve('./src/lib/__mocks__/$env.dynamic.private.ts'),
			'$env/dynamic/public': path.resolve('./src/lib/__mocks__/$env.dynamic.public.ts')
		}
	},
	test: {
		include: ['src/**/*.test.ts'],
		globals: true,
		setupFiles: ['./src/lib/__test__/setup.ts']
	}
});
