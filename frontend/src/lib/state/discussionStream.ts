import type {
	ContentBlock,
	DiscussionBlock,
	DiscussionTurn,
	SSEDiscussionTextDelta,
	SSEDiscussionTurnEnd,
	SSEDiscussionTurnStart
} from '$lib/types/contentBlock';

export type DiscussionStreamingEvent =
	| SSEDiscussionTurnStart
	| SSEDiscussionTextDelta
	| SSEDiscussionTurnEnd;

function isDiscussionBlock(block: ContentBlock): block is DiscussionBlock {
	return block.type === 'discussion';
}

function buildTurnFromStart(event: SSEDiscussionTurnStart, now: number): DiscussionTurn {
	return {
		turnId: event.turnId,
		panelistId: event.panelistId,
		round: event.round,
		content: '',
		model: event.model,
		startedAt: now
	};
}

function applyToDiscussionBlock(
	block: DiscussionBlock,
	event: DiscussionStreamingEvent,
	now: number
): DiscussionBlock {
	if (block.discussionId !== event.discussionId) return block;

	switch (event.event) {
		case 'discussion_turn_start': {
			const existingIndex = block.turns.findIndex((turn) => turn.turnId === event.turnId);
			if (existingIndex !== -1) {
				const existing = block.turns[existingIndex];
				const nextTurn: DiscussionTurn = {
					...existing,
					panelistId: event.panelistId,
					round: event.round,
					model: event.model,
					startedAt: existing.startedAt || now
				};
				if (
					nextTurn.panelistId === existing.panelistId &&
					nextTurn.round === existing.round &&
					nextTurn.model === existing.model &&
					nextTurn.startedAt === existing.startedAt
				) {
					return block;
				}

				return {
					...block,
					turns: block.turns.map((turn, index) => (index === existingIndex ? nextTurn : turn)),
					updatedAt: now
				};
			}

			return {
				...block,
				turns: [...block.turns, buildTurnFromStart(event, now)],
				updatedAt: now
			};
		}

		case 'discussion_text_delta': {
			const existingIndex = block.turns.findIndex((turn) => turn.turnId === event.turnId);
			if (existingIndex === -1) return block;

			const existing = block.turns[existingIndex];
			if (existing.completedAt) return block;

			return {
				...block,
				turns: block.turns.map((turn, index) =>
					index === existingIndex ? { ...turn, content: `${turn.content}${event.content}` } : turn
				),
				updatedAt: now
			};
		}

		case 'discussion_turn_end': {
			const existingIndex = block.turns.findIndex((turn) => turn.turnId === event.turnId);
			if (existingIndex === -1) return block;

			const existing = block.turns[existingIndex];
			if (existing.completedAt) return block;

			return {
				...block,
				turns: block.turns.map((turn, index) =>
					index === existingIndex ? { ...turn, completedAt: now } : turn
				),
				updatedAt: now
			};
		}
	}
}

export function applyDiscussionStreamEvent(
	blocks: ContentBlock[],
	event: DiscussionStreamingEvent,
	now = Date.now()
): ContentBlock[] {
	let changed = false;

	const nextBlocks = blocks.map((block) => {
		if (!isDiscussionBlock(block)) return block;

		const nextBlock = applyToDiscussionBlock(block, event, now);
		if (nextBlock !== block) {
			changed = true;
		}
		return nextBlock;
	});

	return changed ? nextBlocks : blocks;
}
