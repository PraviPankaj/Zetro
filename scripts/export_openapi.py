import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.main import app  # noqa: E402

spec = app.openapi()
out = ROOT / "packages" / "api-client" / "openapi.json"
out.write_text(json.dumps(spec, indent=2))
print(f"Wrote {out} ({len(spec.get('paths', {}))} paths)")
