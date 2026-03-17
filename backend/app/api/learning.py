"""Learning preferences API routes"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..models.learning import LearnedPreference
from ..schemas.learning import LearnedPreferenceCreate, LearnedPreferenceResponse
from ..api.deps import get_current_user

router = APIRouter()


@router.post("/preferences", response_model=LearnedPreferenceResponse, status_code=201)
async def save_preference(
    data: LearnedPreferenceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pref = LearnedPreference(
        user_id=current_user.user_id,
        original_prompt=data.original_prompt,
        agent_type_changes=data.agent_type_changes,
        timing_preferences=data.timing_preferences,
        input_type_preferences=data.input_type_preferences,
    )
    db.add(pref)
    db.commit()
    db.refresh(pref)
    return LearnedPreferenceResponse.from_orm_obj(pref)


@router.get("/preferences", response_model=list[LearnedPreferenceResponse])
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prefs = (
        db.query(LearnedPreference)
        .filter(LearnedPreference.user_id == current_user.user_id)
        .order_by(LearnedPreference.created_at.desc())
        .limit(50)
        .all()
    )
    return [LearnedPreferenceResponse.from_orm_obj(p) for p in prefs]
