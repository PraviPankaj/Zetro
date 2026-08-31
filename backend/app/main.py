from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import api_router
from app.core.config import get_settings
from app.db.seed import seed_database
from app.db.session import SessionLocal, engine
from app.models import Base

settings = get_settings()


def create_app() -> FastAPI:
    Path(settings.media_root).mkdir(parents=True, exist_ok=True)

    app = FastAPI(title=settings.app_name, version="1.0.0", debug=settings.debug)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_prefix)
    app.mount(settings.media_url_prefix, StaticFiles(directory=settings.media_root), name="media")

    @app.get("/")
    @app.head("/")
    def root():
        frontend = (settings.frontend_url or "").rstrip("/")
        if frontend:
            from fastapi.responses import RedirectResponse

            return RedirectResponse(url=f"{frontend}/abc", status_code=307)
        return {
            "status": "ok",
            "app": settings.app_name,
            "message": "Zetro API is running. Deploy the web app and set FRONTEND_URL to open the ABC shop.",
            "health": "/health",
            "demo_shop_api": "/api/v1/shops/abc/info",
        }

    @app.get("/health")
    def health():
        return {"status": "ok", "app": settings.app_name}

    return app


app = create_app()


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    from app.db.migrate import run_migrations

    run_migrations(engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
