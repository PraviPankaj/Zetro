from functools import lru_cache
import re

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

    # Auth: console = server OTP (dev); firebase = client phone auth + server ID token verify
    auth_provider: str = "console"  # console | firebase
    # Service account JSON string OR path to JSON file (prefer env string on Render)
    firebase_credentials_json: str = ""
    firebase_credentials_path: str = ""

    media_root: str = "./uploads"
    media_url_prefix: str = "/media"
    # Set by Vercel when a Blob store is connected; uploads then go to Blob instead of disk
    blob_read_write_token: str = ""

    # Create tables / run migrations / seed on boot. Disable on Vercel and run
    # `python -m app.db.init` once per schema change instead.
    db_init_on_startup: bool = True
    cors_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://localhost:3002,"
        "https://*.vercel.app"
    )
    frontend_url: str = ""  # e.g. https://zetro.vercel.app — also added to CORS

    encryption_key: str = "zetro-dev-fernet-key-change-in-prod!!"  # 32+ chars padded for Fernet

    platform_default_username: str = "admin"
    platform_default_password: str = "admin"

    chatgpt_api_key: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip() and "*" not in o]
        if self.frontend_url:
            front = self.frontend_url.strip().rstrip("/")
            if front and front not in origins:
                origins.append(front)
        return origins

    @property
    def cors_origin_regex(self) -> str | None:
        patterns: list[str] = []
        for raw in self.cors_origins.split(","):
            origin = raw.strip()
            if "*" in origin:
                patterns.append("^" + re.escape(origin).replace(r"\*", r"[^/]+") + "$")
        return "|".join(patterns) if patterns else None


@lru_cache
def get_settings() -> Settings:
    return Settings()
