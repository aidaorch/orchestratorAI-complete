export type LLMProvider = 'openai';

export interface WorkflowMetadata {
  workflow_name: string;
  instance_id: string;
  is_template: boolean;
  version: string;
}

export interface InputConfig {
  source: string;
  type: string;
  input_type?: 'prompt' | 'script' | 'prior_output';
  prompt_text?: string;
  script_content?: string;
  prior_step_ids?: number[];
}

export interface WorkflowStep {
  step_id: number;
  agent_type: string;
  agent_ids?: string[];
  action_description: string;
  timing_logic: string;
  // Timing sub-fields
  trigger_condition?: string;
  auto_depends_on?: number[];
  recurring_period?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  recurring_time?: string;
  recurring_stop_condition?: string;
  // Parallel branching
  parallel_group?: string;
  depends_on?: number[];
  input_config: InputConfig;
  output_storage: string;
  // Extras
  inline_comment?: string;
  execution_status?: 'pending' | 'running' | 'done' | 'failed';
}

export interface WorkflowResult {
  workflow_metadata: WorkflowMetadata;
  steps: WorkflowStep[];
}

export interface AgentTypeStat {
  name: string;
  value: number;
}

export interface TimingStat {
  name: string;
  count: number;
}

export interface WorkflowHistory {
  id: string;
  prompt: string;
  workflow: WorkflowResult;
  savedAt: string;
}

export interface LearnedPreference {
  id: string;
  originalPrompt: string;
  agentTypeChanges: Record<string, number>;
  timingPreferences: Record<string, number>;
  inputTypePreferences: Record<string, number>;
  savedAt: string;
}