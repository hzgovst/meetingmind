from __future__ import annotations

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Option A: Free tier (google-generativeai)
    GEMINI_API_KEY: str = ""

    # Option B: Paid tier (Vertex AI) — recommended
    GCP_PROJECT_ID: str = ""
    GCP_LOCATION: str = "us-central1"

    GEMINI_MODEL: str = "gemini-2.0-flash"
    GEMINI_FALLBACK_MODEL: str = "gemini-2.0-flash-lite"

    DATABASE_URL: str = "sqlite+aiosqlite:///./data/meetingmind.db"
    MAX_RPM: int = 30
    AUDIO_CHUNK_SECONDS: int = 6
    MAX_FILE_SIZE_MB: int = 10
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://frontend:3000"]


settings = Settings()  # type: ignore[call-arg]
