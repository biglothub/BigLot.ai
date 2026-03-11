import { beforeEach } from 'vitest';
import { env as privateEnv } from '../__mocks__/$env.dynamic.private';
import { env as publicEnv } from '../__mocks__/$env.dynamic.public';

// Reset all env stubs before each test
beforeEach(() => {
	for (const key of Object.keys(privateEnv)) delete privateEnv[key];
	for (const key of Object.keys(publicEnv)) delete publicEnv[key];
});
