# Zetro backend
PYTHONPATH=.
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
