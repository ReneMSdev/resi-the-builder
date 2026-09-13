import json
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, Response

from app.models import SavedItem, SaveRequest

router = APIRouter()

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "saved_items"


def _type_display(item_type: str) -> str:
    return "Cover Letter" if item_type == "cover_letter" else "Resume"


def _default_name(item_type: str, data: dict, created_at: str) -> str:
    if item_type == "cover_letter":
        meta = data.get("meta", {}) or {}
        company = (meta.get("company") or "").strip()
        role = (meta.get("role") or "").strip()
        if company and role:
            return f"{company} — {role}"
        if company:
            return company
        if role:
            return role

    created = datetime.fromisoformat(created_at)
    return f"{_type_display(item_type)} — {created.strftime('%Y-%m-%d %H:%M')}"


def _path_for(item_id: str) -> Path:
    return DATA_DIR / f"{item_id}.json"


@router.post("/resumes", response_model=SavedItem)
def create_saved_item(req: SaveRequest):
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    item_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()
    name = req.name.strip() if req.name else ""
    if not name:
        name = _default_name(req.type, req.data, created_at)

    item = SavedItem(
        id=item_id,
        name=name,
        type=req.type,
        created_at=created_at,
        data=req.data,
    )

    with open(_path_for(item_id), "w") as f:
        json.dump(item.model_dump(), f, indent=2)

    return item


@router.get("/resumes")
def list_saved_items():
    if not DATA_DIR.exists():
        return []

    summaries = []
    for path in DATA_DIR.glob("*.json"):
        with open(path, "r") as f:
            data = json.load(f)
        summaries.append({
            "id": data["id"],
            "name": data["name"],
            "type": data["type"],
            "created_at": data["created_at"],
        })
    summaries.sort(key=lambda s: s["created_at"], reverse=True)
    return summaries


@router.get("/resumes/{item_id}", response_model=SavedItem)
def get_saved_item(item_id: str):
    path = _path_for(item_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Saved item not found")
    with open(path, "r") as f:
        data = json.load(f)
    return data


@router.delete("/resumes/{item_id}", status_code=204)
def delete_saved_item(item_id: str):
    path = _path_for(item_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Saved item not found")
    path.unlink()
    return Response(status_code=204)
