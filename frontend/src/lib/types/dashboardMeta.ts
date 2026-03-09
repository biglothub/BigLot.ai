export type ErrorKind = 'network' | 'parse' | 'stale' | 'range' | 'none';

export interface SourceMeta {
	source: string;
	fetchedAt: string;
	staleAfterMs: number;
	isStale: boolean;
	errorKind: ErrorKind;
	errorMessage?: string;
}

export interface DashboardMeta {
	sources: SourceMeta[];
	warnings: string[];
}
