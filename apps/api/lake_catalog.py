"""
Lake Catalog — Canonical registry of Tamil Nadu reservoirs.
============================================================
Single source of truth for lake metadata used across ingestion,
analytics, and API layers. Extensible: add new lakes by appending
to LAKES list (no code changes elsewhere required).
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional


@dataclass(frozen=True)
class Lake:
    """Immutable lake descriptor."""

    reservoir_id: str
    name: str
    lat: float
    lng: float
    max_capacity_mcm: float  # Million Cubic Meters
    full_level_m: float
    catchment_area_sqkm: float
    year_built: int
    description: str
    aliases: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return asdict(self)


# ─────────────────────────────────────────────────────────
# 6 Target Tamil Nadu Lakes
# ─────────────────────────────────────────────────────────
LAKES: List[Lake] = [
    Lake(
        reservoir_id="res-chembarambakkam",
        name="Chembarambakkam Lake",
        lat=13.0089,
        lng=80.0573,
        max_capacity_mcm=103.0,
        full_level_m=25.9,
        catchment_area_sqkm=358.0,
        year_built=1900,
        description="A major reservoir in Kanchipuram district, serving as a primary water source for Chennai.",
        aliases=["chembarambakkam", "chembar"],
    ),
    Lake(
        reservoir_id="res-cholavaram",
        name="Cholavaram Lake",
        lat=13.2272,
        lng=80.1510,
        max_capacity_mcm=30.0,
        full_level_m=18.5,
        catchment_area_sqkm=72.0,
        year_built=1877,
        description="One of the oldest reservoirs supplying Chennai, located in Thiruvallur district.",
        aliases=["cholavaram"],
    ),
    Lake(
        reservoir_id="res-veeranam",
        name="Veeranam Lake",
        lat=11.3367,
        lng=79.5373,
        max_capacity_mcm=41.0,
        full_level_m=14.5,
        catchment_area_sqkm=443.0,
        year_built=990,
        description="Located in Cuddalore district, vital for Chennai water supply and local irrigation.",
        aliases=["veeranam"],
    ),
    Lake(
        reservoir_id="res-poondi",
        name="Poondi Reservoir",
        lat=13.1917,
        lng=79.8596,
        max_capacity_mcm=91.0,
        full_level_m=42.0,
        catchment_area_sqkm=1950.0,
        year_built=1944,
        description="Also known as Sathyamoorthy Sagar, stores Krishna river water for Chennai.",
        aliases=["poondi", "sathyamoorthy sagar"],
    ),
    Lake(
        reservoir_id="res-redhills",
        name="Red Hills (Puzhal Lake)",
        lat=13.1588,
        lng=80.1722,
        max_capacity_mcm=93.0,
        full_level_m=15.2,
        catchment_area_sqkm=63.0,
        year_built=1876,
        description="A rain-fed reservoir in Thiruvallur district, critical for Chennai city drinking water.",
        aliases=["redhills", "puzhal", "red hills"],
    ),
    Lake(
        reservoir_id="res-kaveripakkam",
        name="Kaveripakkam Lake",
        lat=12.9427,
        lng=79.4476,
        max_capacity_mcm=42.0,
        full_level_m=12.8,
        catchment_area_sqkm=120.0,
        year_built=900,
        description="An ancient irrigation tank in Ranipet district, one of the largest in Tamil Nadu.",
        aliases=["kaveripakkam", "kaveri pakkam"],
    ),
]

# ─────────────────────────────────────────────────────────
# Lookup helpers
# ─────────────────────────────────────────────────────────
_BY_ID: Dict[str, Lake] = {lake.reservoir_id: lake for lake in LAKES}


def get_lake(reservoir_id: str) -> Optional[Lake]:
    """Return a Lake by its canonical ID, or None."""
    return _BY_ID.get(reservoir_id)


def get_all_lakes() -> List[Lake]:
    """Return all registered lakes."""
    return list(LAKES)


def get_lake_ids() -> List[str]:
    """Return all registered reservoir IDs."""
    return [lake.reservoir_id for lake in LAKES]


def add_lake(lake: Lake) -> None:
    """Register a new lake at runtime (persists only for server lifetime)."""
    if lake.reservoir_id in _BY_ID:
        raise ValueError(f"Duplicate reservoir_id: {lake.reservoir_id}")
    LAKES.append(lake)
    _BY_ID[lake.reservoir_id] = lake


# ─────────────────────────────────────────────────────────
# Season definitions
# ─────────────────────────────────────────────────────────
SEASONS = {
    "Summer": {"months": [3, 4, 5], "label": "Summer (Mar–May)"},
    "Monsoon": {"months": [6, 7, 8, 9], "label": "Monsoon (Jun–Sep)"},
    "Post-Monsoon": {"months": [10, 11], "label": "Post-Monsoon (Oct–Nov)"},
    "Winter": {"months": [12, 1, 2], "label": "Winter (Dec–Feb)"},
}

SEASON_NAMES = list(SEASONS.keys())


def season_from_month(month: int) -> str:
    """Map a calendar month (1-12) to a season name."""
    for name, info in SEASONS.items():
        if month in info["months"]:
            return name
    return "Unknown"
