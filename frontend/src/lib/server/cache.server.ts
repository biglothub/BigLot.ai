// In-memory cache with TTL for tool results and API responses

type CacheEntry<T = unknown> = {
	data: T;
	expiresAt: number;
};

class ToolCache {
	private store = new Map<string, CacheEntry>();
	private cleanupIntervalMs = 5 * 60 * 1000; // 5 minutes
	private lastCleanup = Date.now();

	get<T>(key: string): T | null {
		this.maybeCleanup();
		const entry = this.store.get(key);
		if (!entry) return null;
		if (Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return null;
		}
		return entry.data as T;
	}

	set<T>(key: string, data: T, ttlMs: number): void {
		this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
	}

	generateKey(tool: string, args: Record<string, unknown>): string {
		const sortedArgs = Object.keys(args)
			.sort()
			.reduce(
				(acc, k) => {
					acc[k] = args[k];
					return acc;
				},
				{} as Record<string, unknown>
			);
		return `${tool}:${JSON.stringify(sortedArgs)}`;
	}

	private maybeCleanup(): void {
		if (Date.now() - this.lastCleanup < this.cleanupIntervalMs) return;
		this.lastCleanup = Date.now();
		const now = Date.now();
		for (const [key, entry] of this.store) {
			if (now > entry.expiresAt) {
				this.store.delete(key);
			}
		}
	}
}

export const toolCache = new ToolCache();
