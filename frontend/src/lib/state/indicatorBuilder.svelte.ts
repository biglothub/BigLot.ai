/**
 * Indicator Builder State Management
 * Manages the lifecycle of indicator generation via Manus AI
 */
import type {
    IndicatorGenerationStatus,
    IndicatorGenerationProgress,
    IndicatorActivityLog,
    CustomIndicator,
    IndicatorConfig,
    ManusAgentProfile
} from '$lib/types/indicator';
import { supabase } from '$lib/supabase';

class IndicatorBuilderState {
    // Generation state
    progress = $state<IndicatorGenerationProgress>({ status: 'idle' });

    // Saved indicators
    indicators = $state<CustomIndicator[]>([]);
    activeIndicator = $state<CustomIndicator | null>(null);

    // UI state
    isBuilderOpen = $state(false);
    selectedProfile = $state<ManusAgentProfile>('manus-1.6');

    // Reference tracking
    referenceUsed = $state<string | null>(null);

    // Polling interval
    private pollInterval: ReturnType<typeof setInterval> | null = null;

    /**
     * Generate a new indicator from a prompt
     */
    async generateFromPrompt(prompt: string, existingTaskId?: string) {
        this.progress = {
            status: 'submitting',
            activityLog: [this.createSystemLog('Submitting task to BigLot AI...')]
        };

        try {
            const res = await fetch('/api/manus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    agentProfile: this.selectedProfile,
                    existingTaskId
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to submit');
            }

            const data = await res.json();

            // Track reference used for UI display
            this.referenceUsed = data.referenceUsed ?? null;

            const refLog = this.referenceUsed
                ? this.createSystemLog(`📚 Using reference base: ${this.referenceUsed}`)
                : this.createSystemLog('🔍 No library match — AI searching TradingView community for best approach');

            this.progress = {
                status: 'generating',
                taskId: data.taskId,
                taskUrl: data.taskUrl,
                currentStep: 'BigLot AI is writing your indicator...',
                activityLog: [
                    ...(this.progress.activityLog ?? []),
                    this.createSystemLog('Task accepted by AI agent'),
                    refLog
                ]
            };

            // Start polling for completion
            this.startPolling(data.taskId);

        } catch (err: any) {
            this.progress = {
                status: 'error',
                error: err.message || 'Something went wrong',
                activityLog: [
                    ...(this.progress.activityLog ?? []),
                    this.createSystemLog(err.message || 'Something went wrong')
                ]
            };
        }
    }

    /**
     * Poll Manus task status until completion
     */
    private startPolling(taskId: string) {
        this.stopPolling();

        this.pollInterval = setInterval(async () => {
            try {
                // Check webhook events for progress updates
                const webhookRes = await fetch(`/api/manus/webhook?taskId=${taskId}`);
                if (webhookRes.ok) {
                    const webhookData = await webhookRes.json();
                    if (webhookData.latestStep || webhookData.activityLog) {
                        this.progress = {
                            ...this.progress,
                            currentStep: webhookData.latestStep ?? this.progress.currentStep,
                            activityLog: webhookData.activityLog ?? this.progress.activityLog
                        };
                    }
                }

                // Check main task status
                const res = await fetch(`/api/manus?taskId=${taskId}`);
                if (!res.ok) return;

                const data = await res.json();

                if (data.status === 'completed') {
                    this.stopPolling();

                    if (data.code) {
                        this.progress = {
                            status: 'ready',
                            taskId,
                            generatedCode: data.code,
                            generatedPreviewCode: data.previewCode,
                            generatedConfig: data.config,
                            currentStep: 'Indicator ready!',
                            activityLog: [
                                ...(this.progress.activityLog ?? []),
                                this.createSystemLog('Indicator generated successfully')
                            ]
                        };
                    } else {
                        // Code was in text output but couldn't be parsed — show raw
                        this.progress = {
                            status: 'ready',
                            taskId,
                            generatedCode: data.textOutput || '// No code generated',
                            currentStep: 'Check the generated code below',
                            activityLog: [
                                ...(this.progress.activityLog ?? []),
                                this.createSystemLog('Task completed without parsable code')
                            ]
                        };
                    }
                    return;
                }

                if (data.status === 'failed') {
                    this.stopPolling();
                    this.progress = {
                        status: 'error',
                        taskId,
                        error: data.error || 'Task failed',
                        activityLog: [
                            ...(this.progress.activityLog ?? []),
                            this.createSystemLog(data.error || 'Task failed')
                        ]
                    };
                    return;
                }

            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 5000); // Poll every 5 seconds
    }

    private stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    private createSystemLog(message: string): IndicatorActivityLog {
        return {
            id: `system-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'system',
            message,
            receivedAt: Date.now()
        };
    }

    /**
     * Save a generated indicator to Supabase
     */
    async saveIndicator(name: string, description: string, code: string, config: IndicatorConfig, manusTaskId: string) {
        const indicator: Partial<CustomIndicator> = {
            name,
            description,
            code,
            config,
            manus_task_id: manusTaskId,
            version: 1,
            is_active: false
        };

        const { data, error } = await supabase
            .from('custom_indicators')
            .insert(indicator)
            .select()
            .single();

        if (error) {
            console.error('Error saving indicator:', error);
            throw error;
        }

        if (data) {
            this.indicators = [data as CustomIndicator, ...this.indicators];
        }

        return data;
    }

    /**
     * Load all saved indicators
     */
    // DB State
    dbError: 'missing_table' | null = $state(null);

    /**
     * Load all saved indicators
     */
    async loadIndicators() {
        const { data, error } = await supabase
            .from('custom_indicators')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Load Error:', error);
            // Check for missing table error (Postgres code 42P01)
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                this.dbError = 'missing_table';
            }
        }

        if (!error && data) {
            this.indicators = data as CustomIndicator[];
            this.dbError = null;
        }
    }

    /**
     * Delete a saved indicator
     */
    async deleteIndicator(id: string) {
        const { error } = await supabase
            .from('custom_indicators')
            .delete()
            .eq('id', id);

        if (!error) {
            this.indicators = this.indicators.filter(i => i.id !== id);
            if (this.activeIndicator?.id === id) {
                this.activeIndicator = null;
            }
        }
    }

    /**
     * Activate an indicator
     */
    setActiveIndicator(indicator: CustomIndicator | null) {
        this.activeIndicator = indicator;
    }

    /**
     * Reset the builder state
     */
    reset() {
        this.stopPolling();
        this.progress = { status: 'idle' };
        this.referenceUsed = null;
    }

    /**
     * Open/close the builder panel
     */
    toggleBuilder() {
        this.isBuilderOpen = !this.isBuilderOpen;
        if (this.isBuilderOpen) {
            this.loadIndicators();
        }
    }
}

export const indicatorBuilder = new IndicatorBuilderState();
