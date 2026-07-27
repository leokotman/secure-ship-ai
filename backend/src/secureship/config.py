"""Configuration management."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # Anthropic
    anthropic_api_key: str

    # Twilio (2FA)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # Auth0 (Admin)
    auth0_domain: str = ""
    auth0_client_id: str = ""
    auth0_client_secret: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
