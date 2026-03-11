export type CustomBot = {
	id: string;
	biglot_user_id: string;
	name: string;
	description: string;
	avatar: string;
	system_prompt: string;
	tools: string[];
	default_model: string | null;
	conversation_starters: string[];
	is_active: boolean;
	created_at: string;
	updated_at: string;
};

export type CustomBotCreateInput = {
	name: string;
	description?: string;
	avatar?: string;
	systemPrompt: string;
	tools?: string[];
	defaultModel?: string | null;
	conversationStarters?: string[];
};

export type CustomBotUpdateInput = Partial<CustomBotCreateInput>;
