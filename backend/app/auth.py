from datetime import datetime, timezone
import hashlib
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.account import User, LoginSession

def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()

def current_user(request: Request, db: Session = Depends(get_db)):
    session = db.get(LoginSession, digest(request.cookies.get("healthtrack_session", "")))
    if not session or session.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(401, "Inicia sesión para continuar")
    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(401, "La sesión ya no está disponible")
    return user

def check_origin(request: Request):
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") != str(request.base_url).rstrip("/"):
        raise HTTPException(403, "Origen no permitido")

