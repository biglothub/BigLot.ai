import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSupabaseAdminClientMock } = vi.hoisted(() => ({
	getSupabaseAdminClientMock: vi.fn()
}));

vi.mock('$lib/server/supabaseAdmin.server', () => ({
	getSupabaseAdminClient: getSupabaseAdminClientMock
}));

import {
	createChatRecord,
	deleteChatRecord,
	getChatMessages,
	listChats,
	saveChatMessage,
	validateBiglotUserId
} from './chatPersistence.server';

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
type Schema = Record<string, string[]>;

class MockQueryBuilder {
	private action: 'select' | 'insert' | 'delete' = 'select';
	private readonly filters: Array<(row: Row) => boolean> = [];
	private selectedColumns = '*';
	private singleMode = false;
	private orderBy: { column: string; ascending: boolean } | null = null;
	private limitCount: number | null = null;
	private insertPayload: Row[] = [];
	private errorMessage: string | null = null;

	constructor(
		private readonly table: string,
		private readonly tables: Tables,
		private readonly schema: Schema
	) {}

	private hasColumn(column: string): boolean {
		return (this.schema[this.table] ?? []).includes(column);
	}

	private setMissingColumnError(column: string) {
		if (!this.errorMessage) {
			this.errorMessage = `column ${column} does not exist`;
		}
	}

	select(columns = '*') {
		this.selectedColumns = columns;
		if (columns !== '*') {
			for (const column of columns.split(',').map((value) => value.trim()).filter(Boolean)) {
				if (!this.hasColumn(column)) {
					this.setMissingColumnError(column);
				}
			}
		}
		return this;
	}

	insert(payload: Row | Row[]) {
		this.action = 'insert';
		this.insertPayload = Array.isArray(payload) ? payload : [payload];

		for (const row of this.insertPayload) {
			for (const key of Object.keys(row)) {
				if (!this.hasColumn(key)) {
					this.setMissingColumnError(key);
					return this;
				}
			}
		}

		return this;
	}

	delete() {
		this.action = 'delete';
		return this;
	}

	eq(column: string, value: unknown) {
		if (!this.hasColumn(column)) {
			this.setMissingColumnError(column);
			return this;
		}

		this.filters.push((row) => row[column] === value);
		return this;
	}

	order(column: string, options: { ascending?: boolean } = {}) {
		if (!this.hasColumn(column)) {
			this.setMissingColumnError(column);
			return this;
		}

		this.orderBy = {
			column,
			ascending: options.ascending ?? true
		};
		return this;
	}

	limit(count: number) {
		this.limitCount = count;
		return this;
	}

	single() {
		this.singleMode = true;
		return this;
	}

	private project(rows: Row[]): Row[] {
		if (this.selectedColumns === '*') return rows;
		const columns = this.selectedColumns
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean);

		return rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])));
	}

	private async execute() {
		if (this.errorMessage) {
			return { data: null, error: { message: this.errorMessage } };
		}

		const rows = this.tables[this.table] ?? [];

		if (this.action === 'insert') {
			const inserted = this.insertPayload.map((row, index) => ({
				id: row.id ?? `${this.table}_${rows.length + index + 1}`,
				...row
			}));
			this.tables[this.table] = [...rows, ...inserted];
			const projected = this.project(inserted);

			if (this.singleMode) {
				return { data: projected[0] ?? null, error: projected[0] ? null : { message: 'no rows' } };
			}

			return { data: projected, error: null };
		}

		if (this.action === 'delete') {
			const kept = rows.filter((row) => !this.filters.every((filter) => filter(row)));
			this.tables[this.table] = kept;
			return { data: null, error: null };
		}

		let selected = rows.filter((row) => this.filters.every((filter) => filter(row)));

		if (this.orderBy) {
			const { column, ascending } = this.orderBy;
			selected.sort((left, right) => {
				const leftValue = left[column];
				const rightValue = right[column];
				if (leftValue === rightValue) return 0;
				return ascending
					? String(leftValue).localeCompare(String(rightValue))
					: String(rightValue).localeCompare(String(leftValue));
			});
		}

		if (this.limitCount !== null) {
			selected = selected.slice(0, this.limitCount);
		}

		const projected = this.project(selected);

		if (this.singleMode) {
			if (projected.length !== 1) {
				return {
					data: null,
					error: { message: 'JSON object requested, multiple (or no) rows returned' }
				};
			}

			return { data: projected[0], error: null };
		}

		return { data: projected, error: null };
	}

	then<TResult1 = Awaited<ReturnType<MockQueryBuilder['execute']>>, TResult2 = never>(
		onfulfilled?:
			| ((value: Awaited<ReturnType<MockQueryBuilder['execute']>>) => TResult1 | PromiseLike<TResult1>)
			| null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
	) {
		return this.execute().then(onfulfilled, onrejected);
	}
}

function createMockSupabase(tables: Tables, schema: Schema) {
	return {
		from(table: string) {
			return new MockQueryBuilder(table, tables, schema);
		}
	};
}

describe('chatPersistence.server', () => {
	beforeEach(() => {
		getSupabaseAdminClientMock.mockReset();
	});

	it('rejects invalid biglotUserId', () => {
		expect(() => validateBiglotUserId('short')).toThrow('Invalid biglotUserId');
	});

	it('lists only chats owned by the current browser identity', async () => {
		getSupabaseAdminClientMock.mockReturnValue(
			createMockSupabase(
				{
					chats: [
						{ id: 'chat-1', title: 'Mine', created_at: '2026-03-10T10:00:00Z', biglot_user_id: 'user-12345' },
						{ id: 'chat-2', title: 'Other', created_at: '2026-03-11T10:00:00Z', biglot_user_id: 'user-99999' }
					]
				},
				{
					chats: ['id', 'title', 'created_at', 'biglot_user_id']
				}
			)
		);

		await expect(listChats('user-12345')).resolves.toEqual([
			{ id: 'chat-1', title: 'Mine', created_at: '2026-03-10T10:00:00Z', biglot_user_id: 'user-12345' }
		]);
	});

	it('loads messages only for an owned chat and rejects other users', async () => {
		getSupabaseAdminClientMock.mockReturnValue(
			createMockSupabase(
				{
					chats: [
						{ id: 'chat-1', biglot_user_id: 'user-12345' },
						{ id: 'chat-2', biglot_user_id: 'user-99999' }
					],
					messages: [
						{ id: 'm1', chat_id: 'chat-1', role: 'assistant', content: 'hello', created_at: '2026-03-10T10:00:00Z' },
						{ id: 'm2', chat_id: 'chat-2', role: 'assistant', content: 'secret', created_at: '2026-03-11T10:00:00Z' }
					]
				},
				{
					chats: ['id', 'biglot_user_id'],
					messages: ['id', 'chat_id', 'role', 'content', 'created_at']
				}
			)
		);

		await expect(getChatMessages({ chatId: 'chat-1', biglotUserId: 'user-12345' })).resolves.toEqual([
			{ id: 'm1', chat_id: 'chat-1', role: 'assistant', content: 'hello', created_at: '2026-03-10T10:00:00Z' }
		]);
		await expect(getChatMessages({ chatId: 'chat-2', biglotUserId: 'user-12345' })).rejects.toThrow(
			'Chat not found'
		);
	});

	it('deletes only the current user chat', async () => {
		const tables: Tables = {
			chats: [
				{ id: 'chat-1', title: 'Mine', biglot_user_id: 'user-12345' },
				{ id: 'chat-2', title: 'Other', biglot_user_id: 'user-99999' }
			]
		};

		getSupabaseAdminClientMock.mockReturnValue(
			createMockSupabase(tables, {
				chats: ['id', 'title', 'biglot_user_id']
			})
		);

		await deleteChatRecord({ chatId: 'chat-1', biglotUserId: 'user-12345' });

		expect(tables.chats).toEqual([{ id: 'chat-2', title: 'Other', biglot_user_id: 'user-99999' }]);
		await expect(deleteChatRecord({ chatId: 'chat-2', biglotUserId: 'user-12345' })).rejects.toThrow(
			'Chat not found'
		);
	});

	it('falls back when the chats table has no biglot_user_id column', async () => {
		const tables: Tables = { chats: [] };
		getSupabaseAdminClientMock.mockReturnValue(
			createMockSupabase(tables, {
				chats: ['id', 'title', 'created_at']
			})
		);

		await expect(createChatRecord({ biglotUserId: 'user-12345', title: 'Legacy Chat' })).resolves.toEqual({
			id: 'chats_1',
			title: 'Legacy Chat'
		});
		expect(tables.chats).toEqual([{ id: 'chats_1', title: 'Legacy Chat' }]);
	});

	it('strips unsupported message columns when saving into a legacy schema', async () => {
		const tables: Tables = {
			chats: [{ id: 'chat-legacy' }],
			messages: []
		};

		getSupabaseAdminClientMock.mockReturnValue(
			createMockSupabase(tables, {
				chats: ['id'],
				messages: ['id', 'chat_id', 'role', 'content']
			})
		);

		await expect(
			saveChatMessage({
				chatId: 'chat-legacy',
				biglotUserId: 'user-12345',
				role: 'assistant',
				content: 'hello',
				fileName: 'report.md',
				mode: 'coach',
				channel: 'web',
				runId: 'run-1',
				contentBlocks: [{ type: 'text', content: 'hello' }]
			})
		).resolves.toEqual({ id: 'messages_1' });

		expect(tables.messages).toEqual([
			{ id: 'messages_1', chat_id: 'chat-legacy', role: 'assistant', content: 'hello' }
		]);
	});
});
