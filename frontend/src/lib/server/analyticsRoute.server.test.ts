import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSupabaseAdminClientMock } = vi.hoisted(() => ({
    getSupabaseAdminClientMock: vi.fn()
}));

vi.mock('$lib/server/supabaseAdmin.server', () => ({
    getSupabaseAdminClient: getSupabaseAdminClientMock
}));

import { GET } from '../../routes/api/analytics/+server';

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

class MockQueryBuilder {
    private readonly rows: Row[];
    private filters: Array<(row: Row) => boolean> = [];
    private orderBy: { column: string; ascending: boolean } | null = null;
    private limitCount: number | null = null;
    private selectedColumns = '*';
    private includeCount = false;
    private headOnly = false;

    constructor(rows: Row[]) {
        this.rows = rows;
    }

    select(columns = '*', options: { count?: 'exact'; head?: boolean } = {}) {
        this.selectedColumns = columns;
        this.includeCount = options.count === 'exact';
        this.headOnly = options.head === true;
        return this;
    }

    eq(column: string, value: unknown) {
        this.filters.push((row) => row[column] === value);
        return this;
    }

    in(column: string, values: unknown[]) {
        const allowed = new Set(values);
        this.filters.push((row) => allowed.has(row[column]));
        return this;
    }

    order(column: string, options: { ascending?: boolean } = {}) {
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

    private projectRows(rows: Row[]): Row[] {
        if (this.selectedColumns === '*') return rows;

        const columns = this.selectedColumns
            .split(',')
            .map((column) => column.trim())
            .filter(Boolean);

        return rows.map((row) =>
            Object.fromEntries(columns.map((column) => [column, row[column]]))
        );
    }

    private async execute() {
        let rows = [...this.rows].filter((row) => this.filters.every((filter) => filter(row)));
        const count = rows.length;

        if (this.orderBy) {
            const { column, ascending } = this.orderBy;
            rows.sort((a, b) => {
                const left = a[column];
                const right = b[column];

                if (left === right) return 0;
                if (left == null) return ascending ? -1 : 1;
                if (right == null) return ascending ? 1 : -1;
                return ascending
                    ? String(left).localeCompare(String(right))
                    : String(right).localeCompare(String(left));
            });
        }

        if (this.limitCount !== null) {
            rows = rows.slice(0, this.limitCount);
        }

        return {
            data: this.headOnly ? null : this.projectRows(rows),
            error: null,
            count: this.includeCount ? count : null
        };
    }

    then<TResult1 = Awaited<ReturnType<MockQueryBuilder['execute']>>, TResult2 = never>(
        onfulfilled?: ((value: Awaited<ReturnType<MockQueryBuilder['execute']>>) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
        return this.execute().then(onfulfilled, onrejected);
    }
}

function createMockSupabase(tables: Tables) {
    return {
        from(table: string) {
            return new MockQueryBuilder(tables[table] ?? []);
        }
    };
}

describe('GET /api/analytics', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-11T12:00:00Z'));
        getSupabaseAdminClientMock.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns 400 when biglotUserId is missing', async () => {
        const response = await GET({
            url: new URL('https://biglot.test/api/analytics')
        } as Parameters<typeof GET>[0]);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'biglotUserId is required'
        });
    });

    it('keeps the response shape and scopes chats, prompts, and modes to the current user', async () => {
        getSupabaseAdminClientMock.mockReturnValue(
            createMockSupabase({
                chats: [
                    { id: 'chat-1', biglot_user_id: 'user-1' },
                    { id: 'chat-2', biglot_user_id: 'user-1' },
                    { id: 'chat-3', biglot_user_id: 'user-2' }
                ],
                messages: [
                    {
                        chat_id: 'chat-1',
                        role: 'user',
                        mode: 'coach',
                        created_at: '2026-03-10T08:00:00.000Z'
                    },
                    {
                        chat_id: 'chat-1',
                        role: 'assistant',
                        mode: 'coach',
                        created_at: '2026-03-10T08:01:00.000Z'
                    },
                    {
                        chat_id: 'chat-1',
                        role: 'user',
                        mode: 'gold',
                        created_at: '2026-03-09T08:00:00.000Z'
                    },
                    {
                        chat_id: 'chat-2',
                        role: 'user',
                        mode: 'macro',
                        created_at: '2026-03-01T08:00:00.000Z'
                    },
                    {
                        chat_id: 'chat-3',
                        role: 'user',
                        mode: 'pinescript',
                        created_at: '2026-03-10T08:00:00.000Z'
                    }
                ],
                custom_indicators: [
                    { name: 'Trend Ribbon', created_at: '2026-03-07T10:00:00.000Z' },
                    { name: 'Volume Profile', created_at: '2026-03-11T09:00:00.000Z' }
                ]
            })
        );

        const response = await GET({
            url: new URL('https://biglot.test/api/analytics?biglotUserId=user-1')
        } as Parameters<typeof GET>[0]);

        expect(response.status).toBe(200);

        await expect(response.json()).resolves.toEqual({
            stats: {
                totalChats: 2,
                totalMessages: 3,
                totalIndicators: 2,
                recentChatsLast7Days: 1
            },
            agentModes: {
                coach: 1,
                gold: 1,
                macro: 1
            },
            recentIndicators: [
                { name: 'Volume Profile', created_at: '2026-03-11T09:00:00.000Z' },
                { name: 'Trend Ribbon', created_at: '2026-03-07T10:00:00.000Z' }
            ],
            period: 'last_7_days'
        });
    });

    it('returns zero user-scoped activity when the user has no chats while keeping library fields present', async () => {
        getSupabaseAdminClientMock.mockReturnValue(
            createMockSupabase({
                chats: [],
                messages: [
                    {
                        chat_id: 'other-chat',
                        role: 'user',
                        mode: 'coach',
                        created_at: '2026-03-11T10:00:00.000Z'
                    }
                ],
                custom_indicators: [
                    { name: 'Mean Reversion', created_at: '2026-03-08T10:00:00.000Z' }
                ]
            })
        );

        const response = await GET({
            url: new URL('https://biglot.test/api/analytics?biglotUserId=user-9')
        } as Parameters<typeof GET>[0]);

        expect(response.status).toBe(200);

        await expect(response.json()).resolves.toEqual({
            stats: {
                totalChats: 0,
                totalMessages: 0,
                totalIndicators: 1,
                recentChatsLast7Days: 0
            },
            agentModes: {},
            recentIndicators: [
                { name: 'Mean Reversion', created_at: '2026-03-08T10:00:00.000Z' }
            ],
            period: 'last_7_days'
        });
    });
});
