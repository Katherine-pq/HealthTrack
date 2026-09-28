from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, UniqueConstraint, CheckConstraint
from app.database import Base

class Device(Base):
    __tablename__ = "devices"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String(80), nullable=False)
    brand = Column(String(80), nullable=False)
    model = Column(String(80), nullable=False)
    source = Column(String(20), nullable=False, default="simulated")
    created_at = Column(DateTime(timezone=True), nullable=False)
    last_synced_at = Column(DateTime(timezone=True))

class DailyMetric(Base):
    __tablename__ = "daily_metrics"
    __table_args__ = (
        UniqueConstraint("device_id", "date", name="uq_device_date"),
        CheckConstraint("steps >= 0 AND calories >= 0 AND heart_rate > 0 AND sleep_minutes >= 0 AND sleep_minutes <= 1440", name="ck_metrics_values"),
    )
    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    date = Column(Date, nullable=False)
    steps = Column(Integer, nullable=False)
    calories = Column(Integer, nullable=False)
    heart_rate = Column(Integer, nullable=False)
    sleep_minutes = Column(Integer, nullable=False)
    source = Column(String(20), nullable=False, default="simulated")
    synced_at = Column(DateTime(timezone=True), nullable=False)
