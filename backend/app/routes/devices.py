from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import hashlib
import random
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.auth import current_user, check_origin
from app.database import get_db
from app.models.device import Device, DailyMetric

router = APIRouter(prefix="/api", tags=["Dispositivo simulado"])

class DeviceInput(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    brand: str = Field(min_length=2, max_length=80)
    model: str = Field(min_length=2, max_length=80)

    @field_validator("name", "brand", "model")
    @classmethod
    def clean(cls, value):
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Completa nombre, marca y modelo con al menos dos caracteres")
        return value

def device_json(device):
    if not device:
        return None
    return {key: getattr(device, key) for key in ["id", "name", "brand", "model", "source", "created_at", "last_synced_at"]}

def metric_json(metric):
    return {key: getattr(metric, key) for key in ["date", "steps", "calories", "heart_rate", "sleep_minutes", "source", "synced_at"]}

@router.get("/device")
def get_device(response: Response, user=Depends(current_user), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return device_json(db.query(Device).filter_by(user_id=user.id).first())

@router.post("/device", status_code=201, dependencies=[Depends(check_origin)])
def register_device(data: DeviceInput, user=Depends(current_user), db: Session = Depends(get_db)):
    device = Device(user_id=user.id, **data.model_dump(), source="simulated", created_at=datetime.now(timezone.utc))
    db.add(device)
    try:
        db.commit()
        db.refresh(device)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya tienes un dispositivo registrado. Este release admite uno por cuenta.")
    return device_json(device)

@router.post("/device/sync", dependencies=[Depends(check_origin)])
def sync_device(user=Depends(current_user), db: Session = Depends(get_db)):
    # Bloqueo por dispositivo: dos clics concurrentes no duplican registros.
    device = db.query(Device).filter_by(user_id=user.id).with_for_update().first()
    if not device:
        raise HTTPException(409, "Registra primero tu dispositivo simulado")
    now = datetime.now(timezone.utc)
    today = now.astimezone(ZoneInfo("America/Lima")).date()
    created = 0
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        metric = db.query(DailyMetric).filter_by(device_id=device.id, date=day).first()
        if metric is None:
            # Valores reproducibles: volver a sincronizar el mismo día no cambia las métricas.
            seed = int(hashlib.sha256(f"{device.id}:{day}".encode()).hexdigest(), 16)
            rng = random.Random(seed)
            metric = DailyMetric(device_id=device.id, date=day, steps=rng.randint(2500, 12000), calories=rng.randint(150, 650), heart_rate=rng.randint(60, 90), sleep_minutes=rng.randint(330, 540), source="simulated", synced_at=now)
            db.add(metric)
            created += 1
    device.last_synced_at = now
    db.commit()
    return {"created": created, "last_synced_at": now, "source": "simulated", "message": f"Sincronización completada: {created} registros nuevos. Los días existentes se conservan."}

@router.get("/dashboard")
def dashboard(response: Response, user=Depends(current_user), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    device = db.query(Device).filter_by(user_id=user.id).first()
    rows = [] if not device else db.query(DailyMetric).filter_by(device_id=device.id).order_by(DailyMetric.date.desc()).limit(7).all()
    return {"device": device_json(device), "latest": metric_json(rows[0]) if rows else None, "metrics": [metric_json(row) for row in reversed(rows)], "source": "simulated"}
