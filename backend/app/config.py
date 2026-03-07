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

    GEMINI_API_KEY: str
    GEMINI_MODEL: str = "gemini-2.0-flash-exp"
    GEMINI_FALLBACK_MODEL: str = "gemini-2.0-flash-lite"

    DATABASE_URL: str = "sqlite+aiosqlite:///./data/meetingmind.db"

    # Rate limiting — stay comfortably under 15 RPM
    MAX_RPM: int = 14

    # Audio buffering
    AUDIO_CHUNK_SECONDS: int = 12

    # File uploads
    MAX_FILE_SIZE_MB: int = 10

    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://frontend:3000"]


settings = Settings()  # type: ignore[call-arg]
