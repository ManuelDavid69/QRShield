from datetime import date

from pydantic import BaseModel

from app.models.enums import ThreatType


class ZoneOut(BaseModel):
    latitude: float
    longitude: float
    reports: int
    dangerous: int


class ZoneList(BaseModel):
    zones: list[ZoneOut]
    period_days: int


class ThreatCount(BaseModel):
    threat: ThreatType
    count: int


class WeekReports(BaseModel):
    week_start: date
    count: int


class DomainReports(BaseModel):
    domain: str
    reports: int


class CommunityStats(BaseModel):
    period_days: int
    total_reports: int
    dangerous_reports: int
    zones: int
    threats: list[ThreatCount]
    weekly: list[WeekReports]
    top_domains: list[DomainReports]
    top_zones: list[ZoneOut]
