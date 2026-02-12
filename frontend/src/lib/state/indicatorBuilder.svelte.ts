/**
 * Indicator Builder State Management
 * Manages the lifecycle of indicator generation via OpenAI GPT
 */
import type {
    IndicatorGenerationProgress,
    IndicatorActivityLog,
    CustomIndicator,
    IndicatorConfig,
    GPTModelOption
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
    selectedModel = $state<GPTModelOption>('gpt-4o');

    // Reference tracking
    referenceUsed = $state<string | null>(null);

    /**
     * Generate a new indicator from a prompt
     * Uses OpenAI GPT — synchronous, no polling needed
     */
    async generateFromPrompt(prompt: string) {
        this.progress = {
            status: 'submitting',
            activityLog: [this.createSystemLog('🚀 Submitting to BigLot.ai...')]
        };

        try {
            // Update status to generating
            this.progress = {
                status: 'generating',
                currentStep: 'BigLot.ai is writing your indicator...',
                activityLog: [
                    ...(this.progress.activityLog ?? []),
                    this.createSystemLog(`⚙️ Configuring indicator engine...`)
                ]
            };

            const res = await fetch('/api/engine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    model: this.selectedModel
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to generate');
            }

            const data = await res.json();

            // Track reference used for UI display
            this.referenceUsed = data.referenceUsed ?? null;

            // Hide reference and AI details
            const refLog = this.createSystemLog('🔍 BigLot.ai expert analysis complete');

            if (data.code) {
                this.progress = {
                    status: 'ready',
                    generatedCode: data.code,
                    generatedPreviewCode: data.previewCode,
                    generatedConfig: data.config,
                    currentStep: 'Indicator ready!',
                    activityLog: [
                        ...(this.progress.activityLog ?? []),
                        refLog,
                        this.createSystemLog(`✅ Indicator generated successfully`)
                    ]
                };
            } else {
                // Code couldn't be parsed — show raw output
                this.progress = {
                    status: 'ready',
                    generatedCode: data.textOutput || '// No code generated',
                    currentStep: 'Check the generated code below',
                    activityLog: [
                        ...(this.progress.activityLog ?? []),
                        refLog,
                        this.createSystemLog('⚠️ Completed but code block not detected — showing raw output')
                    ]
                };
            }

        } catch (err: any) {
            this.progress = {
                status: 'error',
                error: err.message || 'Something went wrong',
                activityLog: [
                    ...(this.progress.activityLog ?? []),
                    this.createSystemLog(`❌ ${err.message || 'Something went wrong'}`)
                ]
            };
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
    async saveIndicator(name: string, description: string, code: string, config: IndicatorConfig, taskId: string) {
        const indicator: Partial<CustomIndicator> = {
            name,
            description,
            code,
            config,
            generation_id: taskId,
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
