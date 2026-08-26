from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    cors_origins: str = "http://localhost:5173"
    google_safe_browsing_api_key: str = ""
    virustotal_api_key: str = ""
    # interroge rdap.org pour connaître l'âge du domaine (pas besoin de clé)
    domain_age_check: bool = True
    # une analyse plus vieille que ça est refaite au prochain scan de la même URL
    analysis_ttl_hours: int = 24
    # le worker réanalyse par petits lots pour rester dans le quota de VirusTotal
    reclassification_interval_minutes: int = 60
    reclassification_batch: int = 20
    app_name: str = "QRShield API"

    # 32 caractères minimum, sinon une clé HS256 se bruteforce trop facilement
    jwt_secret_key: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    # Clé des empreintes de signalement : sans elle, impossible de les relier à un compte
    community_secret: str = Field(min_length=32)
    # Court : le jeton d'accès n'est pas révocable, contrairement au refresh token
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
