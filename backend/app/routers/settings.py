"""Settings router — system key-value configuration."""
import json
from typing import Optional, Union

from fastapi import APIRouter, Depends

from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models.system_setting import SystemSetting
from app.schemas.common import success_response

router = APIRouter()


def _parse_json(val: Optional[str]) -> Union[dict, str, None]:
    if val:
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return val
    return val


@router.get("")
def get_settings(
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    settings = db.query(SystemSetting).all()
    result = {}
    for s in settings:
        result[s.key] = _parse_json(s.value)
    return success_response(result)


@router.put("")
def update_settings(
    body: dict,
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    settings = body.get("settings", {})
    for key, value in settings.items():
        str_val = json.dumps(value) if not isinstance(value, str) else value
        existing = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if existing:
            existing.value = str_val
            existing.updated_by = admin.id
        else:
            db.add(SystemSetting(key=key, value=str_val, updated_by=admin.id))
    db.commit()
    return success_response(None, "Settings updated")
