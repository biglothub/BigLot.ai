import { describe, expect, it } from 'vitest';
import { applyDiscussionStreamEvent } from './discussionStream';
import type {
	ContentBlock,
	DiscussionBlock,
	SSEDiscussionTextDelta,
	SSEDiscussionTurnEnd,
	SSEDiscussionTurnStart
} from '$lib/types/contentBlock';

function createDiscussionBlock(): DiscussionBlock {
	return {
		type: 'discussion',
		discussionId: 'disc_1',
		topic: 'Gold outlook',
		panelists: [
			{ id: 'bull', name: 'Bull Analyst', model: 'gpt-4o', color: 'green', emoji: '🐂' },
			{ id: 'bear', name: 'Bear Analyst', model: 'deepseek', color: 'red', emoji: '🐻' },
			{ id: 'moderator', name: 'Judge', model: 'gpt-4o', color: 'amber', emoji: '⚖️' }
		],
		turns: [],
		status: 'running',
		createdAt: 1,
		updatedAt: 1
	};
}

function applyEvents(events: Array<SSEDiscussionTurnStart | SSEDiscussionTextDelta | SSEDiscussionTurnEnd>): ContentBlock[] {
	let blocks: ContentBlock[] = [createDiscussionBlock()];

	for (const [index, event] of events.entries()) {
		blocks = applyDiscussionStreamEvent(blocks, event, index + 10);
	}

	return blocks;
}

describe('applyDiscussionStreamEvent', () => {
	it('keeps the completed turn closed before the next turn starts', () => {
		const blocks = applyEvents([
			{
				event: 'discussion_turn_start',
				discussionId: 'disc_1',
				turnId: 'turn_bull_1',
				panelistId: 'bull',
				round: 1,
				model: 'gpt-4o'
			},
			{
				event: 'discussion_text_delta',
				discussionId: 'disc_1',
				turnId: 'turn_bull_1',
				panelistId: 'bull',
				round: 1,
				content: 'Bull case'
			},
			{
				event: 'discussion_turn_end',
				discussionId: 'disc_1',
				turnId: 'turn_bull_1',
				panelistId: 'bull',
				round: 1
			},
			{
				event: 'discussion_turn_start',
				discussionId: 'disc_1',
				turnId: 'turn_bear_1',
				panelistId: 'bear',
				round: 1,
				model: 'deepseek'
			}
		]);

		const discussion = blocks[0] as DiscussionBlock;
		expect(discussion.turns).toHaveLength(2);
		expect(discussion.turns[0].turnId).toBe('turn_bull_1');
		expect(discussion.turns[0].completedAt).toBeDefined();
		expect(discussion.turns[1].turnId).toBe('turn_bear_1');
		expect(discussion.turns[1].completedAt).toBeUndefined();
	});

	it('never appends a delta to a different turn for the same panelist', () => {
		const blocks = applyEvents([
			{
				event: 'discussion_turn_start',
				discussionId: 'disc_1',
				turnId: 'turn_bull_1',
				panelistId: 'bull',
				round: 1,
				model: 'gpt-4o'
			},
			{
				event: 'discussion_text_delta',
				discussionId: 'disc_1',
				turnId: 'turn_bull_1',
				panelistId: 'bull',
				round: 1,
				content: 'Round 1'
			},
			{
				event: 'discussion_turn_end',
				discussionId: 'disc_1',
				turnId: 'turn_bull_1',
				panelistId: 'bull',
				round: 1
			},
			{
				event: 'discussion_turn_start',
				discussionId: 'disc_1',
				turnId: 'turn_bull_2',
				panelistId: 'bull',
				round: 2,
				model: 'gpt-4o'
			},
			{
				event: 'discussion_text_delta',
				discussionId: 'disc_1',
				turnId: 'turn_bull_1',
				panelistId: 'bull',
				round: 1,
				content: ' late chunk'
			}
		]);

		const discussion = blocks[0] as DiscussionBlock;
		expect(discussion.turns[0].content).toBe('Round 1');
		expect(discussion.turns[1].turnId).toBe('turn_bull_2');
		expect(discussion.turns[1].content).toBe('');
	});

	it('ignores duplicate end events so they do not close the wrong active turn', () => {
		const blocks = applyEvents([
			{
				event: 'discussion_turn_start',
				discussionId: 'disc_1',
				turnId: 'turn_bull_1',
				panelistId: 'bull',
				round: 1,
				model: 'gpt-4o'
			},
			{
				event: 'discussion_turn_end',
				discussionId: 'disc_1',
				turnId: 'turn_bull_1',
				panelistId: 'bull',
				round: 1
			},
			{
				event: 'discussion_turn_start',
				discussionId: 'disc_1',
				turnId: 'turn_bear_1',
				panelistId: 'bear',
				round: 1,
				model: 'deepseek'
			},
			{
				event: 'discussion_turn_end',
				discussionId: 'disc_1',
				turnId: 'turn_bull_1',
				panelistId: 'bull',
				round: 1
			}
		]);

		const discussion = blocks[0] as DiscussionBlock;
		expect(discussion.turns[0].completedAt).toBeDefined();
		expect(discussion.turns[1].turnId).toBe('turn_bear_1');
		expect(discussion.turns[1].completedAt).toBeUndefined();
	});
});
