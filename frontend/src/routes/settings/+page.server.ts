import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import {
	getModelConfig,
	isAIModel,
	resolveDefaultAIModel,
	type AIModel
} from '$lib/server/aiProvider.server';
import { resolveDiscussionModels } from '$lib/server/discussionLoop.server';

function resolveConfiguredModel(primaryEnvValue: string | undefined, fallback: AIModel): AIModel {
	return isAIModel(primaryEnvValue) ? primaryEnvValue : fallback;
}

export const load: PageServerLoad = async () => {
	const sharedFallback = resolveDefaultAIModel();
	const normalModel = resolveConfiguredModel(env.NORMAL_AI_MODEL, sharedFallback);
	const agentModel = resolveConfiguredModel(env.AGENT_AI_MODEL, sharedFallback);
	const researchModel = resolveConfiguredModel(env.RESEARCH_AI_MODEL, sharedFallback);
	const discussionPanelists = resolveDiscussionModels();

	return {
		modelRuntime: {
			sharedFallback: {
				model: sharedFallback,
				provider: getModelConfig(sharedFallback).provider,
				envKeys: ['AI_MODEL']
			},
			normal: {
				model: normalModel,
				provider: getModelConfig(normalModel).provider,
				envKeys: ['NORMAL_AI_MODEL', 'AI_MODEL']
			},
			agent: {
				model: agentModel,
				provider: getModelConfig(agentModel).provider,
				envKeys: ['AGENT_AI_MODEL', 'AI_MODEL']
			},
			research: {
				model: researchModel,
				provider: getModelConfig(researchModel).provider,
				envKeys: ['RESEARCH_AI_MODEL', 'AI_MODEL']
			},
			discussion: {
				envKeys: [
					'DISCUSSION_BULL_MODEL',
					'DISCUSSION_BEAR_MODEL',
					'DISCUSSION_MODERATOR_MODEL'
				],
				panelists: discussionPanelists.map((panelist) => ({
					id: panelist.id,
					model: panelist.model,
					provider: getModelConfig(panelist.model).provider,
					temperature: panelist.temperature
				}))
			}
		}
	};
};
