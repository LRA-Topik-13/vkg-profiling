import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ONTOLOGY_FILE = PROJECT_ROOT / "vkg" / "obda" / "university.ttl"
DEFAULT_OBDA_FILE = PROJECT_ROOT / "vkg" / "obda" / "university.obda"

# Ontop SPARQL endpoint. In Docker this usually points to ontop-teiid.
ONTOP_ENDPOINT = os.getenv("ONTOP_ENDPOINT", "http://localhost:8080/sparql")
SPARQL_TIMEOUT = float(os.getenv("SPARQL_TIMEOUT", "30"))
SPARQL_MAX_CONCURRENCY = int(os.getenv("SPARQL_MAX_CONCURRENCY", "8"))
SPARQL_MAX_CONNECTIONS = int(os.getenv("SPARQL_MAX_CONNECTIONS", "20"))
SPARQL_MAX_KEEPALIVE_CONNECTIONS = int(os.getenv("SPARQL_MAX_KEEPALIVE_CONNECTIONS", "10"))

# Ontology and OBDA files used to derive VKG metadata at startup.
ONTOLOGY_FILE = os.getenv("ONTOLOGY_FILE", str(DEFAULT_ONTOLOGY_FILE))
OBDA_FILE = os.getenv("OBDA_FILE", str(DEFAULT_OBDA_FILE))
