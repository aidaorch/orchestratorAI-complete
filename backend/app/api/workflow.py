"""Workflow API routes"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel
from ..database import get_db
from ..models.user import User
from ..models.workflow import Workflow, WorkflowStep
from ..schemas.workflow import (
    WorkflowGenerateRequest,
    WorkflowResponse,
    WorkflowListResponse,
    WorkflowListItem,
    WorkflowUpdateRequest
)
from ..api.deps import get_current_user
from ..services.ai_service import AIService
from ..services.audit_service import log_action
from ..core.exceptions import WorkflowNotFoundException
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class ChatMessage(BaseModel):
    role: str
    content: str


class StepChatRequest(BaseModel):
    step_id: int
    agent_type: str
    action_description: str
    workflow_name: str
    message: str
    history: Optional[List[ChatMessage]] = []


@router.post("/generate", response_model=WorkflowResponse)
async def generate_workflow(
    request: WorkflowGenerateRequest,
    http_request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a new workflow using AI"""
    try:
        # Initialize AI service
        ai_service = AIService()
        
        # Generate workflow
        workflow_data = await ai_service.generate_workflow(
            business_requirement=request.business_requirement,
            learning_context=""  # TODO: Build from user preferences
        )
        
        # Create workflow record
        workflow = Workflow(
            user_id=current_user.user_id,
            workflow_name=workflow_data.get("workflow_metadata", {}).get("workflow_name", "Untitled Workflow"),
            workflow_data=workflow_data,
            original_prompt=request.business_requirement,
            step_count=len(workflow_data.get("steps", []))
        )
        
        db.add(workflow)
        db.commit()
        db.refresh(workflow)
        
        # Create workflow steps (normalized)
        for step_data in workflow_data.get("steps", []):
            step = WorkflowStep(
                workflow_id=workflow.workflow_id,
                step_number=step_data.get("step_id"),
                agent_type=step_data.get("agent_type"),
                action_description=step_data.get("action_description"),
                timing_logic=step_data.get("timing_logic"),
                input_config=step_data.get("input_config"),
                output_storage=step_data.get("output_storage"),
                depends_on=step_data.get("depends_on", []),
                parallel_group=step_data.get("parallel_group")
            )
            db.add(step)
        
        db.commit()
        
        logger.info(f"Generated workflow {workflow.workflow_id} for user {current_user.username}")
        
        log_action(db, action="WORKFLOW_CREATE", user_id=current_user.user_id,
                   username=current_user.username, resource_type="workflow",
                   resource_id=str(workflow.workflow_id),
                   ip_address=http_request.client.host if http_request.client else None,
                   user_agent=http_request.headers.get("user-agent"))

        return WorkflowResponse(
            workflow_id=str(workflow.workflow_id),
            workflow_name=workflow.workflow_name,
            workflow_data=workflow.workflow_data,
            original_prompt=workflow.original_prompt,
            step_count=workflow.step_count,
            created_at=workflow.created_at,
            updated_at=workflow.updated_at
        )
        
    except Exception as e:
        logger.error(f"Error generating workflow: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate workflow: {str(e)}"
        )


@router.get("/list", response_model=WorkflowListResponse)
async def list_workflows(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List user's workflows"""
    offset = (page - 1) * limit
    
    query = db.query(Workflow).filter(
        Workflow.user_id == current_user.user_id,
        Workflow.is_template == False
    )
    
    total = query.count()
    workflows = query.order_by(Workflow.created_at.desc()).offset(offset).limit(limit).all()
    
    return WorkflowListResponse(
        workflows=[
            WorkflowListItem(
                workflow_id=str(w.workflow_id),
                workflow_name=w.workflow_name,
                step_count=w.step_count,
                created_at=w.created_at,
                updated_at=w.updated_at
            )
            for w in workflows
        ],
        total=total,
        page=page,
        pages=(total + limit - 1) // limit
    )


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific workflow"""
    workflow = db.query(Workflow).filter(
        Workflow.workflow_id == workflow_id,
        Workflow.user_id == current_user.user_id
    ).first()
    
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found"
        )
    
    return WorkflowResponse(
        workflow_id=str(workflow.workflow_id),
        workflow_name=workflow.workflow_name,
        workflow_data=workflow.workflow_data,
        original_prompt=workflow.original_prompt,
        step_count=workflow.step_count,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at
    )


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: UUID,
    request: WorkflowUpdateRequest,
    http_request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a workflow"""
    workflow = db.query(Workflow).filter(
        Workflow.workflow_id == workflow_id,
        Workflow.user_id == current_user.user_id
    ).first()
    
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found"
        )
    
    # Update workflow
    workflow.workflow_data = request.workflow_data
    workflow.step_count = len(request.workflow_data.get("steps", []))
    
    # Update steps atomically — delete old, insert new, rollback on failure
    try:
        db.query(WorkflowStep).filter(WorkflowStep.workflow_id == workflow_id).delete()
        
        for step_data in request.workflow_data.get("steps", []):
            step = WorkflowStep(
                workflow_id=workflow.workflow_id,
                step_number=step_data.get("step_id"),
                agent_type=step_data.get("agent_type"),
                action_description=step_data.get("action_description"),
                timing_logic=step_data.get("timing_logic"),
                input_config=step_data.get("input_config"),
                output_storage=step_data.get("output_storage"),
                depends_on=step_data.get("depends_on", []),
                parallel_group=step_data.get("parallel_group")
            )
            db.add(step)
        
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating workflow steps: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update workflow steps: {str(e)}"
        )
    
    db.refresh(workflow)
    
    log_action(db, action="WORKFLOW_UPDATE", user_id=current_user.user_id,
               username=current_user.username, resource_type="workflow",
               resource_id=str(workflow_id),
               ip_address=http_request.client.host if http_request.client else None,
               user_agent=http_request.headers.get("user-agent"))

    return WorkflowResponse(
        workflow_id=str(workflow.workflow_id),
        workflow_name=workflow.workflow_name,
        workflow_data=workflow.workflow_data,
        original_prompt=workflow.original_prompt,
        step_count=workflow.step_count,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at
    )


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: UUID,
    http_request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a workflow"""
    workflow = db.query(Workflow).filter(
        Workflow.workflow_id == workflow_id,
        Workflow.user_id == current_user.user_id
    ).first()
    
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found"
        )
    
    db.delete(workflow)
    db.commit()
    
    log_action(db, action="WORKFLOW_DELETE", user_id=current_user.user_id,
               username=current_user.username, resource_type="workflow",
               resource_id=str(workflow_id),
               ip_address=http_request.client.host if http_request.client else None,
               user_agent=http_request.headers.get("user-agent"))

    return {"message": "Workflow deleted successfully"}


@router.post("/chat")
async def chat_with_step(
    request: StepChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Chat with AI about a specific workflow step"""
    try:
        ai_service = AIService()
        reply = await ai_service.chat_with_step(
            step_id=request.step_id,
            agent_type=request.agent_type,
            action_description=request.action_description,
            workflow_name=request.workflow_name,
            message=request.message,
            history=[{"role": m.role, "content": m.content} for m in (request.history or [])]
        )
        return {"reply": reply}
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat failed: {str(e)}"
        )
