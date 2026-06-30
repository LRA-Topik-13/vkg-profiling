import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Point the app at the clean stack when running tests locally.
# Override by setting ONTOP_ENDPOINT in the environment before running pytest.
os.environ.setdefault("ONTOP_ENDPOINT", "http://localhost:8089/sparql")
os.environ.setdefault("TEIID_HOST", "localhost")
os.environ.setdefault("TEIID_PORT", "35532")
_OBDA_DIR = BACKEND_ROOT.parent / "vkg" / "obda"
os.environ.setdefault("OBDA_FILE", str(_OBDA_DIR / "university.clean.obda"))
os.environ.setdefault("ONTOLOGY_FILE", str(_OBDA_DIR / "university.ttl"))
