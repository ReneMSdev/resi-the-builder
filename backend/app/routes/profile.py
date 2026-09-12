import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

from app.models import Profile

router = APIRouter()

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "profile.json"


@router.get("/profile", response_model=Profile)
def get_profile():
    if not DATA_PATH.exists():
        raise HTTPException(status_code=404, detail="profile.json not found")
    with open(DATA_PATH, "r") as f:
        data = json.load(f)
    return data


@router.put("/profile", response_model=Profile)
def update_profile(profile: Profile):
    with open(DATA_PATH, "w") as f:
        json.dump(profile.model_dump(), f, indent=2)
    return profile
