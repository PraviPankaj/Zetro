from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import api_router
from app.core.config import get_settings
from app.db.init import init_database
from app.services import media_storage

settings = get_settings()


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="1.0.0", debug=settings.debug)
    cors_kwargs = {
        "allow_origins": settings.cors_origin_list,
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    if settings.cors_origin_regex:
        cors_kwargs["allow_origin_regex"] = settings.cors_origin_regex
    app.add_middleware(CORSMiddleware, **cors_kwargs)
    app.include_router(api_router, prefix=settings.api_prefix)
    if not media_storage.use_blob():
        Path(settings.media_root).mkdir(parents=True, exist_ok=True)
        app.mount(settings.media_url_prefix, StaticFiles(directory=settings.media_root), name="media")

    @app.get("/")
    @app.head("/")
    def root():
        return {"status": "ok", "app": settings.app_name}

    @app.get("/health")
    def health():
        return {"status": "ok", "app": settings.app_name}

    return app


app = create_app()


@app.on_event("startup")
def on_startup():
    if settings.db_init_on_startup:
        init_database()
