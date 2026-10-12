from datetime import datetime, timedelta, timezone
import secrets
from pathlib import Path
import bcrypt
from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import delete, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.account import User, LoginSession
from app.auth import current_user, check_origin, digest
from app.config import settings
from app.rate_limit import limit_login, limit_registration
from app.routes.devices import router as devices_router

app = FastAPI(
    title="HealthTrack API",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return value.lower()

    @field_validator("password")
    @classmethod
    def password_bytes(cls, value):
        if len(value.encode()) > 72:
            raise ValueError("La contraseña supera el tamaño permitido")
        return value

class Registration(Credentials):
    name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Ingresa tu nombre completo")
        return value

def public_user(user):
    return {"id": user.id, "name": user.name, "email": user.email}

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def ready(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ready"}


@app.post(
    "/api/auth/register",
    status_code=201,
    dependencies=[Depends(check_origin), Depends(limit_registration)],
)
def register(data: Registration, db: Session = Depends(get_db)):
    user = User(name=data.name, email=str(data.email), password_hash=bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode())
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe una cuenta con este correo")
    return public_user(user)

@app.post(
    "/api/auth/login",
    dependencies=[Depends(check_origin), Depends(limit_login)],
)
def login(data: Credentials, request: Request, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == str(data.email)).first()
    if not user or not bcrypt.checkpw(data.password.encode(), user.password_hash.encode()):
        raise HTTPException(401, "Correo o contraseña incorrectos")
    db.execute(delete(LoginSession).where(LoginSession.token_hash == digest(request.cookies.get("healthtrack_session", ""))))
    db.execute(delete(LoginSession).where(LoginSession.expires_at < datetime.now(timezone.utc)))
    token = secrets.token_urlsafe(32)
    db.add(LoginSession(token_hash=digest(token), user_id=user.id, expires_at=datetime.now(timezone.utc) + timedelta(hours=8)))
    db.commit()
    response.set_cookie(
        "healthtrack_session",
        token,
        httponly=True,
        samesite="lax",
        secure=settings.is_production or request.url.scheme == "https",
        max_age=28800,
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return public_user(user)

@app.get("/api/auth/me")
def me(response: Response, user=Depends(current_user)):
    response.headers["Cache-Control"] = "no-store"
    return public_user(user)

@app.post("/api/auth/logout", status_code=204, dependencies=[Depends(check_origin)])
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    db.execute(delete(LoginSession).where(LoginSession.token_hash == digest(request.cookies.get("healthtrack_session", ""))))
    db.commit()
    response.delete_cookie("healthtrack_session", path="/")

app.include_router(devices_router)

static = Path(__file__).resolve().parent.parent / "static"
if static.exists():
    app.mount("/assets", StaticFiles(directory=static / "assets"), name="assets")

    @app.get("/{route:path}")
    def frontend(route: str):
        if route.startswith("api/"):
            raise HTTPException(404)
        return FileResponse(static / "index.html")
