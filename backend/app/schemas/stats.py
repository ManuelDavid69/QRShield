from datetime import date

from pydantic import BaseModel

from app.models.enums import ScanCategory, Verdict


class VerdictCount(BaseModel):
    verdict: Verdict
    count: int


class CategoryCount(BaseModel):
    category: ScanCategory
    count: int


class WeekCount(BaseModel):
    week_start: date
    count: int


class PlaceCount(BaseModel):
    latitude: float
    longitude: float
    count: int


class DomainCount(BaseModel):
    domain: str
    count: int


class UserStats(BaseModel):
    total_scans: int
    flagged_scans: int
    flagged_percent: float
    verdicts: list[VerdictCount]
    categories: list[CategoryCount]
    weekly: list[WeekCount]
    places: list[PlaceCount]
    top_domains: list[DomainCount]
