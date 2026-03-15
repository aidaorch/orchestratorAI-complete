"""AI service for workflow generation"""
from openai import AsyncOpenAI
from typing import Dict, Any, List
from ..config import settings
from ..core.exceptions import AIServiceException
import logging

logger = logging.getLogger(__name__)

# System instruction for workflow generation
SYSTEM_INSTRUCTION = """You are a Senior AI Solutions Architect & Workflow Orchestrator. 
      
Goal: Architect a highly technical, realistic, and executable business workflow based on the user's Business Use Case.

Operational Protocol:
1.  **Realism is paramount.** Do not use generic descriptions like "Analyze data." Instead, use specific technical actions like "Ingest CSV data via Pandas, clean null values, and run sentiment analysis using NLTK."
2.  **Specific Agent Roles:** Assign agents that fit the task precisely.
    *   *Scraper*: Uses tools like Puppeteer/Selenium.
    *   *CRM*: Interacts with Salesforce/HubSpot schemas.
    *   *Content*: Uses LLMs for generation (GPT-4/Claude).
    *   *Analytics*: Uses SQL/Python/Tableau logic.
3.  **Data Harmony:** Ensure step inputs and outputs are technically compatible.
    *   *Input Source*: If Step 1 outputs a JSON object, Step 2 must accept that JSON.
    *   *Output Storage*: Use realistic storage paths (e.g., `s3://bucket/data.json`, `postgres.users_table`, `redis:cache:key`).
4.  **Logic:**
    *   *PM_Input*: The initial raw requirement from the user.
    *   *Agent_ID_{N}*: Refers to the specific output from a previous agent.
5.  **Parallel Steps & Branching (CRITICAL):** Do not generate purely sequential lists (1 -> 2 -> 3). Architect complex DAGs (Directed Acyclic Graphs). 
    *   *Branching*: A single step can have multiple downstream steps depending on it.
    *   *Merging*: A step can depend on multiple prior steps (e.g., Step 3 depends on [1, 2]).
    *   *Parallelism*: Group concurrent steps using the same 'parallel_group' value (e.g. "research_phase"). 
    *   *Multiple Dependencies*: Always list all preceding steps in 'depends_on'. If Step 5 needs data from Step 2 and Step 4, use '[2, 4]'.

6.  **CRITICAL - depends_on RULES:**
    *   Step 1 (the first step) MUST have "depends_on": []
    *   ALL other steps MUST have "depends_on": [array of step IDs] with at least one dependency
    *   NEVER use "depends_on": [] for any step except Step 1
    *   If a step follows sequentially, use "depends_on": [previous_step_id]
    *   For parallel branches that merge, use "depends_on": [step_id_1, step_id_2, ...]
    *   The depends_on array creates the visual flow - every step must connect to the graph

Generate the JSON response strictly following the provided schema."""


class AIService:
    """Service for AI-powered workflow generation"""
    
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    
    async def generate_workflow(
        self,
        business_requirement: str,
        learning_context: str = ""
    ) -> Dict[str, Any]:
        """Generate workflow using OpenAI"""
        try:
            system_content = SYSTEM_INSTRUCTION
            if learning_context:
                system_content += f"\n\n--- LEARNED USER PREFERENCES ---\n{learning_context}"
            
            completion = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_content},
                    {
                        "role": "user",
                        "content": f"""Business Use Case: "{business_requirement}"

Generate a comprehensive, production-ready workflow of EXACTLY 8 to 12 steps following this JSON schema:

{{
  "workflow_metadata": {{
    "workflow_name": "string (Professional, technical name)",
    "instance_id": "string (e.g., instance_v1.0.0)",
    "is_template": "boolean",
    "version": "string (e.g., v1.0.0)"
  }},
  "steps": [
    {{
      "step_id": "integer",
      "agent_type": "string (one of: Content, Design, Scheduler, Heatmaps, Bounce, Subject Line Checker, Scraper, CRM, Outreach, Analytics)",
      "action_description": "string (detailed technical description)",
      "timing_logic": "string (Manual/Auto/Trigger/Recurring)",
      "parallel_group": "string or null (steps with same group run concurrently)",
      "depends_on": "array of integers (step_id list). CRITICAL: Step 1 must use [], ALL other steps must have at least one dependency. Use multiple IDs for merging branches (e.g., [2, 3]).",
      "input_config": {{
        "source": "string (e.g., PM_Input or Agent_ID_1_JSON_Output)",
        "type": "string (e.g., JSON, CSV, PNG, Raw Text)",
        "input_type": "prompt | script | prior_output",
        "prior_step_ids": "array of integers (MUST match depends_on if input_type is prior_output)"
      }},
      "output_storage": "string (realistic storage destination)"
    }}
  ]
}}

CRITICAL VALIDATION RULES:
- Step 1 MUST have "depends_on": []
- Steps 2-N MUST have "depends_on": [at least one step_id]
- NEVER use empty depends_on array except for Step 1
- Create branches and parallel paths where appropriate"""
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            
            response_text = completion.choices[0].message.content
            if not response_text:
                raise AIServiceException("No response from OpenAI")
            
            import json
            workflow_data = json.loads(response_text)
            
            logger.info(f"Generated workflow with {len(workflow_data.get('steps', []))} steps")
            return workflow_data
            
        except Exception as e:
            logger.error(f"AI service error: {str(e)}")
            raise AIServiceException(f"Failed to generate workflow: {str(e)}")


    async def chat_with_step(
        self,
        step_id: int,
        agent_type: str,
        action_description: str,
        workflow_name: str,
        message: str,
        history: List[Dict[str, Any]] = []
    ) -> str:
        """Chat with AI about a specific workflow step"""
        try:
            system_prompt = (
                f"You are an expert AI workflow assistant helping with the workflow '{workflow_name}'. "
                f"The user is asking about Step {step_id}: a '{agent_type}' agent that performs: '{action_description}'. "
                "Provide concise, technical, and actionable advice. "
                "You can help generate prompts, debug logic, suggest tools, or explain the step."
            )

            messages = [{"role": "system", "content": system_prompt}]
            for h in history[-10:]:  # Keep last 10 messages for context
                messages.append({"role": h["role"], "content": h["content"]})
            messages.append({"role": "user", "content": message})

            completion = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=0.4,
                max_tokens=600,
            )

            return completion.choices[0].message.content or "No response generated."

        except Exception as e:
            logger.error(f"Chat error: {str(e)}")
            raise AIServiceException(f"Chat failed: {str(e)}")
