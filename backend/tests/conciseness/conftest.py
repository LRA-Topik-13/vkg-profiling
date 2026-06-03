import pytest
import pymssql
from fastapi.testclient import TestClient

from app.main import app

# ── Connection ────────────────────────────────────────────────────────────────
MSSQL = dict(
    server="localhost",
    port=1434,
    user="academics",
    password="academicspwd",
    database="academics",
)

# ── Ontology constants ────────────────────────────────────────────────────────
VOC = "http://example.org/voc#"
SOURCE_ACADEMICS = f"{VOC}academics/"

# ── Per-entity config ─────────────────────────────────────────────────────────
# identity_cols: DB column names used as identity (must match OBDA mapping)
# identity_props: comma-separated ontology property URIs in the same order
ENTITY_CONFIG = {
    "TimeSlot": {
        "class_uri":      f"{VOC}TimeSlot",
        "identity_props": f"{VOC}day,{VOC}startTime,{VOC}endTime",
        "table":          "time_slot",
        "id_col":         "ts_id",
        "identity_cols":  ["day", "start_time", "end_time"],
    },
    "Place": {
        "class_uri":      f"{VOC}Place",
        "identity_props": f"{VOC}building,{VOC}roomCode",
        "table":          "place",
        "id_col":         "place_id",
        "identity_cols":  ["building", "room_code"],
    },
}


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def db_conn():
    conn = pymssql.connect(**MSSQL)
    yield conn
    conn.close()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def clean_snapshots(db_conn):
    """
    Reads the clean state of each table once at session start.
    The DB must be in a clean (0% defect) state when the test session begins.
    Run against a freshly started docker-compose.clean.yml.

    Fails fast if pre-existing duplicates are detected — this means the DB was
    left dirty by a previously aborted test session. Restore it manually before
    re-running (e.g. restart the container from a clean volume, or run the
    corrective UPDATEs directly).
    """
    snapshots = {}
    for entity, cfg in ENTITY_CONFIG.items():
        cursor = db_conn.cursor(as_dict=True)
        cursor.execute(
            f"SELECT * FROM {cfg['table']} ORDER BY {cfg['id_col']}"
        )
        rows = cursor.fetchall()
        snapshots[entity] = rows

        # Validate no pre-existing duplicates
        identity_cols = cfg["identity_cols"]
        seen: dict = {}
        for row in rows:
            key = tuple(row[col] for col in identity_cols)
            if key in seen:
                raise RuntimeError(
                    f"[clean_snapshots] Pre-existing duplicate detected in "
                    f"{cfg['table']} for identity {dict(zip(identity_cols, key))}. "
                    f"The DB was left dirty by a previous test run. Restore it "
                    f"before running tests."
                )
            seen[key] = row[cfg["id_col"]]

    return snapshots


@pytest.fixture(autouse=True)
def reset_to_clean(db_conn, clean_snapshots):
    """
    Restores identity columns to their clean values before every test.
    Uses UPDATE only — no DELETE/INSERT — to avoid FK constraint issues
    with the schedule table that references time_slot and place.
    """
    cursor = db_conn.cursor()
    for entity, cfg in ENTITY_CONFIG.items():
        id_col = cfg["id_col"]
        identity_cols = cfg["identity_cols"]
        set_clause = ", ".join(f"{col} = %s" for col in identity_cols)
        for row in clean_snapshots[entity]:
            values = tuple(row[col] for col in identity_cols) + (row[id_col],)
            cursor.execute(
                f"UPDATE {cfg['table']} SET {set_clause} WHERE {id_col} = %s",
                values,
            )
    db_conn.commit()
    yield
