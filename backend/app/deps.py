"""Dependency injection for FastAPI routes."""
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
):
    """Resolve the current user from JWT token.

    Placeholder for R2 — actual JWT decoding will be implemented there.
    """
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # placeholder — R2 will implement JWT parsing
    raise HTTPException(status_code=501, detail="Auth not implemented yet")


async def require_admin(user=Depends(get_current_user)):
    """Require admin role."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
