import uuid
from datetime import datetime

from geoalchemy2.shape import to_shape
from pydantic import BaseModel, Field, model_validator

from app.models.enums import ContentType, Verdict
from app.models.scan import Scan


class ScanCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4096)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def _check_coords(self) -> "ScanCreate":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude et longitude vont ensemble")
        return self


class ScanOut(BaseModel):
    id: uuid.UUID
    content: str
    content_type: ContentType
    url: str | None
    verdict: Verdict
    latitude: float | None
    longitude: float | None
    scanned_at: datetime


class ScanList(BaseModel):
    items: list[ScanOut]
    total: int


def scan_to_out(scan: Scan) -> ScanOut:
    # Construit à la main : la géographie et le verdict calculé ne sont pas des attributs directs
    latitude: float | None = None
    longitude: float | None = None
    if scan.location is not None:
        point = to_shape(scan.location)
        # Convention : y = latitude, x = longitude
        latitude = point.y
        longitude = point.x

    return ScanOut(
        id=scan.id,
        content=scan.content,
        content_type=scan.content_type,
        url=scan.url,
        verdict=scan.verdict,
        latitude=latitude,
        longitude=longitude,
        scanned_at=scan.scanned_at,
    )
