import { WorkflowResult, LLMProvider, WorkflowStep } from "../types";
import apiClient from "./apiClient";
import { saveLearnedPreference } from "./dbService";

// ── Workflow Generation ───────────────────────────────────────────────────────
export const generateWorkflow = async (
  useCase: string,
  _provider: LLMProvider = 'openai'
): Promise<WorkflowResult> => {
  try {
    const response = await apiClient.post('/workflow/generate', {
      business_requirement: useCase
    });

    // Backend wraps AI output inside workflow_data
    const raw: any = response.data.workflow_data ?? response.data;

    const result: WorkflowResult = {
      workflow_metadata: raw.workflow_metadata ?? {
        workflow_name: response.data.workflow_name ?? 'Generated Workflow',
        instance_id: response.data.workflow_id ?? `wf_${Date.now()}`,
        is_template: false,
        version: '1.0'
      },
      steps: Array.isArray(raw.steps) ? raw.steps : []
    };

    return result;
  } catch (error: any) {
    console.error("Workflow generation error:", error);
    throw new Error(error.response?.data?.detail || 'Failed to generate workflow');
  }
};

// ── Learning Module ───────────────────────────────────────────────────────────
export const recordWorkflowFeedback = async (
  originalPrompt: string,
  originalWorkflow: WorkflowResult,
  editedWorkflow: WorkflowResult
): Promise<void> => {
  const agentTypeChanges: Record<string, number> = {};
  const timingPreferences: Record<string, number> = {};
  const inputTypePreferences: Record<string, number> = {};

  (editedWorkflow.steps || []).forEach((editedStep, idx) => {
    const originalStep = (originalWorkflow.steps || [])[idx];
    if (originalStep) {
      if (editedStep.agent_type !== originalStep.agent_type) {
        agentTypeChanges[editedStep.agent_type] = (agentTypeChanges[editedStep.agent_type] || 0) + 1;
      }
      timingPreferences[editedStep.timing_logic] = (timingPreferences[editedStep.timing_logic] || 0) + 1;
      if (editedStep.input_config?.input_type) {
        inputTypePreferences[editedStep.input_config.input_type] =
          (inputTypePreferences[editedStep.input_config.input_type] || 0) + 1;
      }
    }
  });

  saveLearnedPreference({ originalPrompt, agentTypeChanges, timingPreferences, inputTypePreferences });
};

// ── Step Chat ─────────────────────────────────────────────────────────────────
export const chatWithStep = async (
  step: WorkflowStep,
  workflowContext: string,
  userMessage: string,
  history: { role: 'user' | 'model'; content: string }[]
): Promise<string> => {
  const response = await apiClient.post('/workflow/chat', {
    step_id: step.step_id,
    agent_type: step.agent_type,
    action_description: step.action_description,
    workflow_name: workflowContext,
    message: userMessage,
    history: history.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content }))
  });
  return response.data.reply ?? response.data.message ?? 'No response from AI.';
};
