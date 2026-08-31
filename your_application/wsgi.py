"""ASGI entry for Render: gunicorn your_application.wsgi (via UvicornWorker)."""

from __future__ import annotations

import sys
from pathlib import Path

_backend = Path(__file__).resolve().parents[1] / "backend"
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from app.main import app as application  # noqa: E402
