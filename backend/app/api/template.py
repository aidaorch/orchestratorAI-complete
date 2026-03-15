"""Template API routes"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from ..database import get_db
from ..models.user import User
from ..models.template import Template, TemplateVersion
from ..schemas.template import TemplateSaveRequest, TemplateResponse, TemplateListResponse, TemplateListItem
from ..api.deps import get_current_user
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/save", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def save_template(
    request: TemplateSaveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save a workflow as template"""
    # Check if template with same name exists
    existing = db.query(Template).filter(
        Template.user_id == current_user.user_id,
        Template.name == request.name
    ).first()
    
    if existing:
        # Create version of old state
        version = TemplateVersion(
            template_id=existing.template_id,
            version_number=existing.version_number,
            workflow_data=existing.workflow_data,
            change_note=request.change_note,
            created_by=current_user.user_id
        )
        db.add(version)
        
        # Update template
        existing.workflow_data = request.workflow_data
        existing.description = request.description or existing.description
        existing.tags = request.tags if request.tags else existing.tags
        existing.version_number += 1
        
        db.commit()
        db.refresh(existing)
        
        return TemplateResponse(
            template_id=str(existing.template_id),
            name=existing.name,
            description=existing.description,
            workflow_data=existing.workflow_data,
            tags=existing.tags,
            version_number=existing.version_number,
            created_at=existing.created_at,
            updated_at=existing.updated_at
        )
    
    # Create new template
    template = Template(
        user_id=current_user.user_id,
        name=request.name,
        description=request.description,
        workflow_data=request.workflow_data,
        tags=request.tags or []
    )
    
    db.add(template)
    db.commit()
    db.refresh(template)
    
    return TemplateResponse(
        template_id=str(template.template_id),
        name=template.name,
        description=template.description,
        workflow_data=template.workflow_data,
        tags=template.tags,
        version_number=template.version_number,
        created_at=template.created_at,
        updated_at=template.updated_at
    )


@router.get("/list", response_model=TemplateListResponse)
async def list_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List user's templates"""
    templates = db.query(Template).filter(
        Template.user_id == current_user.user_id
    ).order_by(Template.updated_at.desc()).all()
    
    return TemplateListResponse(
        templates=[
            TemplateListItem(
                template_id=str(t.template_id),
                name=t.name,
                description=t.description,
                tags=t.tags,
                version_number=t.version_number,
                step_count=len(t.workflow_data.get('steps', [])) if t.workflow_data else 0,
                created_at=t.created_at
            )
            for t in templates
        ]
    )


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific template"""
    template = db.query(Template).filter(
        Template.template_id == template_id,
        Template.user_id == current_user.user_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    return TemplateResponse(
        template_id=str(template.template_id),
        name=template.name,
        description=template.description,
        workflow_data=template.workflow_data,
        tags=template.tags,
        version_number=template.version_number,
        created_at=template.created_at,
        updated_at=template.updated_at
    )


@router.delete("/{template_id}")
async def delete_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a template"""
    template = db.query(Template).filter(
        Template.template_id == template_id,
        Template.user_id == current_user.user_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    db.delete(template)
    db.commit()
    
    return {"message": "Template deleted successfully"}


@router.post("/{template_id}/clone", response_model=TemplateResponse)
async def clone_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clone a template"""
    original = db.query(Template).filter(
        Template.template_id == template_id,
        Template.user_id == current_user.user_id
    ).first()
    
    if not original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    cloned = Template(
        user_id=current_user.user_id,
        name=f"{original.name} (Copy)",
        description=original.description,
        workflow_data=original.workflow_data,
        tags=original.tags
    )
    
    db.add(cloned)
    db.commit()
    db.refresh(cloned)
    
    return TemplateResponse(
        template_id=str(cloned.template_id),
        name=cloned.name,
        description=cloned.description,
        workflow_data=cloned.workflow_data,
        tags=cloned.tags,
        version_number=cloned.version_number,
        created_at=cloned.created_at,
        updated_at=cloned.updated_at
    )
