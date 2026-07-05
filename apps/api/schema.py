"""
PostgreSQL + PostGIS schema — SQLAlchemy ORM models.
=====================================================
Tables: lakes, bathymetry, seasonal_water_spread, seasonal_volume,
        satellite_metadata, feedback, alerts.

Usage:
  from .schema import engine, SessionLocal, init_db
  init_db()  # creates all tables
"""

from __future__ import annotations

import os
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

try:
    from geoalchemy2 import Geometry  # type: ignore
except ImportError:
    Geometry = None  # degrade gracefully when PostGIS unavailable


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./hydroai.db",
)

# Allow SQLite fallback for dev / CI environments without Postgres.
_is_sqlite = DATABASE_URL.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ─────────────────────────────────────────────────────────
# Helper: use Geometry when PostGIS is available, Text otherwise
# ─────────────────────────────────────────────────────────
def _geom_col(geom_type: str, srid: int = 4326, nullable: bool = True):
    if Geometry is not None and not _is_sqlite:
        return Column(Geometry(geometry_type=geom_type, srid=srid), nullable=nullable)
    return Column(Text, nullable=nullable)


# ─────────────────────────────────────────────────────────
# 1. Lakes
# ─────────────────────────────────────────────────────────
class LakeRow(Base):
    __tablename__ = "lakes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reservoir_id = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    max_capacity_mcm = Column(Float)
    full_level_m = Column(Float)
    catchment_area_sqkm = Column(Float)
    year_built = Column(Integer)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    bathymetry = relationship("BathymetryRow", back_populates="lake", uselist=False)
    water_spread = relationship("SeasonalWaterSpreadRow", back_populates="lake")
    volumes = relationship("SeasonalVolumeRow", back_populates="lake")
    satellite_meta = relationship("SatelliteMetadataRow", back_populates="lake")


# ─────────────────────────────────────────────────────────
# 2. Bathymetry
# ─────────────────────────────────────────────────────────
class BathymetryRow(Base):
    __tablename__ = "bathymetry"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lake_id = Column(Integer, ForeignKey("lakes.id", ondelete="CASCADE"), nullable=False, index=True)
    boundary_source = Column(String(100))  # gdb | synthetic | osm | manual
    boundary_confidence = Column(Float)
    dem_raster_path = Column(String(500))
    dem_source = Column(String(100))
    dem_resolution_m = Column(Float)
    dem_last_updated = Column(DateTime)
    contour_interval_m = Column(Float)
    ingest_strategy = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lake = relationship("LakeRow", back_populates="bathymetry")


# ─────────────────────────────────────────────────────────
# 3. Seasonal Water Spread
# ─────────────────────────────────────────────────────────
class SeasonalWaterSpreadRow(Base):
    __tablename__ = "seasonal_water_spread"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lake_id = Column(Integer, ForeignKey("lakes.id", ondelete="CASCADE"), nullable=False)
    observation_date = Column(DateTime, nullable=False)
    season = Column(String(50), nullable=False)
    surface_area_sqkm = Column(Float)
    rainfall_mm = Column(Float)
    mndwi_mean = Column(Float)
    ndwi_mean = Column(Float)
    water_level_m = Column(Float)
    fill_percentage = Column(Float)
    anomaly_score = Column(Float)
    flood_probability = Column(Float)
    drought_probability = Column(Float)
    alert_status = Column(String(50))
    satellite_pass = Column(String(100))
    mask_source = Column(String(50))
    water_index_method = Column(String(20))  # NDWI | MNDWI
    created_at = Column(DateTime, default=datetime.utcnow)

    lake = relationship("LakeRow", back_populates="water_spread")

    __table_args__ = (
        Index("idx_ws_lake_date", "lake_id", "observation_date"),
        Index("idx_ws_season", "season"),
    )


# ─────────────────────────────────────────────────────────
# 4. Seasonal Volume
# ─────────────────────────────────────────────────────────
class SeasonalVolumeRow(Base):
    __tablename__ = "seasonal_volume"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lake_id = Column(Integer, ForeignKey("lakes.id", ondelete="CASCADE"), nullable=False)
    observation_date = Column(DateTime, nullable=False)
    season = Column(String(50), nullable=False)
    water_spread_area_km2 = Column(Float)
    storage_volume_m3 = Column(Float)
    storage_volume_mcm = Column(Float)
    volume_provenance = Column(String(100))
    confidence_level = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    lake = relationship("LakeRow", back_populates="volumes")

    __table_args__ = (
        Index("idx_vol_lake_date", "lake_id", "observation_date"),
    )


# ─────────────────────────────────────────────────────────
# 5. Satellite Metadata
# ─────────────────────────────────────────────────────────
class SatelliteMetadataRow(Base):
    __tablename__ = "satellite_metadata"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lake_id = Column(Integer, ForeignKey("lakes.id", ondelete="CASCADE"), nullable=False)
    observation_date = Column(DateTime, nullable=False)
    satellite_source = Column(String(100))
    scene_id = Column(String(255), unique=True, nullable=True)
    cloud_cover_pct = Column(Float)
    data_quality_score = Column(Float)
    stac_url = Column(Text)
    processing_status = Column(String(50), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    lake = relationship("LakeRow", back_populates="satellite_meta")

    __table_args__ = (
        Index("idx_sat_lake_date", "lake_id", "observation_date"),
        Index("idx_sat_status", "processing_status"),
    )


# ─────────────────────────────────────────────────────────
# 6. Feedback
# ─────────────────────────────────────────────────────────
class FeedbackRow(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lake_id = Column(Integer, ForeignKey("lakes.id", ondelete="SET NULL"), nullable=True)
    observation_date = Column(DateTime)
    original_area_sqkm = Column(Float)
    corrected_area_sqkm = Column(Float)
    original_risk = Column(String(50))
    corrected_risk = Column(String(50))
    is_correct = Column(Boolean, default=False)
    user_comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────────────────
# 7. Alerts
# ─────────────────────────────────────────────────────────
class AlertRow(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lake_id = Column(Integer, ForeignKey("lakes.id", ondelete="CASCADE"), nullable=True)
    alert_type = Column(String(50))
    severity = Column(String(50))
    message = Column(Text)
    triggered_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(String(255))
    acknowledged_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────────────────
# Init & seed
# ─────────────────────────────────────────────────────────
def init_db():
    """Create all tables. Safe to call repeatedly (uses CREATE IF NOT EXISTS)."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency-injectable session generator for FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_lakes():
    """
    Populate the lakes table from the canonical catalog if empty.
    Idempotent — skips if any lake rows already exist.
    """
    from .lake_catalog import get_all_lakes

    db = SessionLocal()
    try:
        if db.query(LakeRow).first() is not None:
            return
        for lake in get_all_lakes():
            db.add(
                LakeRow(
                    reservoir_id=lake.reservoir_id,
                    name=lake.name,
                    lat=lake.lat,
                    lng=lake.lng,
                    max_capacity_mcm=lake.max_capacity_mcm,
                    full_level_m=lake.full_level_m,
                    catchment_area_sqkm=lake.catchment_area_sqkm,
                    year_built=lake.year_built,
                    description=lake.description,
                )
            )
        db.commit()
    finally:
        db.close()
