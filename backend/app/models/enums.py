import enum


class ContentType(str, enum.Enum):
    URL = "url"
    WIFI = "wifi"
    EMAIL = "email"
    PHONE = "phone"
    SMS = "sms"
    GEO = "geo"
    CONTACT = "contact"
    TEXT = "text"


class Verdict(str, enum.Enum):
    UNKNOWN = "unknown"
    SAFE = "safe"
    SUSPICIOUS = "suspicious"
    DANGEROUS = "dangerous"
