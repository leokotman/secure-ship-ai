"""Configuration management."""

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

    # Database
    database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/secureship"
    )

    # Ollama
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "qwen3:8b"

    # Twilio (2FA)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    # Security: keep OTP values out of shared logs unless explicitly enabled
    sms_log_verification_code: bool = False

    # Auth0 (Admin)
    auth0_domain: str = ""
    auth0_client_id: str = ""
    auth0_client_secret: str = ""
    auth0_audience: str = ""


settings = Settings()
