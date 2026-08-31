"""WSGI entry for Render default start command: gunicorn your_application.wsgi"""

from __future__ import annotations

import sys
from pathlib import Path

# Repo layout: your_application/ and backend/ are siblings at repo root.
_backend = Path(__file__).resolve().parents[1] / "backend"
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from a2wsgi import ASGIMiddleware  # noqa: E402
from app.main import app  # noqa: E402

application = ASGIMiddleware(app)
