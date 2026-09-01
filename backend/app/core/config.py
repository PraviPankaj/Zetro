from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Zetro"
    environment: str = "development"
    debug: bool = True
    api_prefix: str = "/api/v1"

    # SQLite by default for local dev without Docker; use Postgres via DATABASE_URL
    database_url: str = "sqlite:///./zetro.db"

    redis_url: str = "redis://localhost:6379/0"
    use_memory_otp: bool = False  # auto-fallback if Redis unavailable

    jwt_secret: str = "change-me-zetro-dev-secret-key-32chars"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    otp_ttl_seconds: int = 300
    otp_length: int = 6
    otp_rate_limit_per_hour: int = 10
    registration_token_expire_minutes: int = 15

    # SMS OTP — console (dev), fast2sms (cheapest), or msg91 (DLT-friendly)
    sms_provider: str = "console"
    fast2sms_api_key: str = ""
    fast2sms_route: str = "otp"  # otp | dlt
    fast2sms_sender_id: str = ""
    fast2sms_dlt_template_id: str = ""
    msg91_auth_key: str = ""
    msg91_otp_template_id: str = ""

    demo_bypass_enabled: bool = True  # one-click login for demo shop when SMS is off
    demo_shop_slug: str = "abc"
    demo_shop_phone: str = "9999999999"

    media_root: str = "./uploads"
    media_url_prefix: str = "/media"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://localhost:3002"
    frontend_url: str = ""  # e.g. https://zetro-web.onrender.com — redirects / to /abc

    encryption_key: str = "zetro-dev-fernet-key-change-in-prod!!"  # 32+ chars padded for Fernet

    platform_default_username: str = "admin"
    platform_default_password: str = "admin"

    chatgpt_api_key: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
