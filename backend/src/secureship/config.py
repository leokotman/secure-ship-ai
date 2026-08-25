"""Configuration management."""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",  # silently ignore unknown env vars (e.g. legacy ANTHROPIC_API_KEY)
    )

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # CORS — comma-separated origins (no wildcards in production)
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # Rate limiting (/chat)
    chat_rate_limit_per_minute: int = 30

    # Database
    database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/secureship"
    )

    @field_validator("database_url", mode="after")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        # Convert psycopg2 (sync driver) to asyncpg (async driver) for SQLAlchemy
        return v.replace("postgresql+psycopg2", "postgresql+asyncpg")

    # Ollama
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "qwen3:8b"
    ollama_timeout_seconds: float = 60.0
    ollama_stream_timeout_seconds: float = 120.0
    ollama_max_retries: int = 3

    # Twilio (2FA)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    # Security: keep OTP values out of shared logs unless explicitly enabled
    sms_log_verification_code: bool = False
    twilio_max_retries: int = 3

    # Auth0 (Admin)
    auth0_domain: str = ""
    auth0_client_id: str = ""
    auth0_client_secret: str = ""
    auth0_audience: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
