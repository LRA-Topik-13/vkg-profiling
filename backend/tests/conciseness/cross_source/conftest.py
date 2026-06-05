import random

import pymysql
import psycopg2
import psycopg2.extras
import pymssql
import pytest
from fastapi.testclient import TestClient

from app.main import app

# ── Connections ───────────────────────────────────────────────────────────────
MYSQL_COMPSCI = dict(
    host="127.0.0.1", port=3308,
    user="compsci", password="compscipwd", database="compsci",
)
PGSQL_MATHSCI = dict(
    host="localhost", port=5434,
    user="mathsci", password="mathscipwd", dbname="mathsci",
)
MSSQL_ACADEMICS = dict(
    server="localhost", port=1434,
    user="academics", password="academicspwd", database="academics",
)

# ── Ontology constants ────────────────────────────────────────────────────────
VOC           = "http://example.org/voc#"
FOAF          = "http://xmlns.com/foaf/0.1/"
SCHEMA        = "http://schema.org/"
SOURCE_COMPSCI   = f"{VOC}compsci/"
SOURCE_MATHSCI   = f"{VOC}mathsci/"
SOURCE_ACADEMICS = f"{VOC}academics/"
ALL_SOURCES = f"{SOURCE_COMPSCI},{SOURCE_MATHSCI},{SOURCE_ACADEMICS}"

# ── Per-entity config ─────────────────────────────────────────────────────────
#
# donor:    source used as template supplier (never modified)
# receivers: sources whose rows get updated to match donor templates
#
# Each receiver entry:
#   table, id_col, identity_cols  — DB-side columns (in same order as identity_props)
#   filter                        — optional WHERE clause fragment for scoping
#   uri_template                  — f-string for entity URI given {id}
#
ENTITY_CONFIG = {
    "FacultyMember": {
        "class_uri":        f"{VOC}FacultyMember",
        "identity_props":   f"{FOAF}firstName,{FOAF}lastName,{SCHEMA}birthDate,{SCHEMA}email",
        "prop_local_names": ["firstName", "lastName", "birthDate", "email"],
        "donor": {
            "table":         "academic",
            "id_col":        "a_id",
            "identity_cols": ["first_name", "last_name", "birth_date", "email"],
            "filter":        None,
        },
        "receivers": {
            "academics": {
                "table":         "teacher",
                "id_col":        "t_id",
                "identity_cols": ["first_name", "last_name", "birth_date", "email"],
                "filter":        None,
                "uri_template":  f"{VOC}academics/teacher/{{id}}",
            },
            "mathsci": {
                "table":         "person",
                "id_col":        "pid",
                "identity_cols": ["fname", "lname", "birth_date", "email"],
                "filter":        "status IN (7, 8, 9)",
                "uri_template":  f"{VOC}mathsci/person/{{id}}",
            },
        },
    },
    "Course": {
        "class_uri":        f"{VOC}Course",
        "identity_props":   f"{VOC}title",
        "prop_local_names": ["title"],
        "donor": {
            "table":         "course",
            "id_col":        "c_id",
            "identity_cols": ["title"],
            "filter":        None,
        },
        "receivers": {
            "academics": {
                "table":         "course",
                "id_col":        "c_id",
                "identity_cols": ["title"],
                "filter":        None,
                "uri_template":  f"{VOC}academics/course/{{id}}",
            },
            "mathsci": {
                "table":         "course",
                "id_col":        "cid",
                "identity_cols": ["topic"],
                "filter":        None,
                "uri_template":  f"{VOC}mathsci/course/{{id}}",
            },
        },
    },
}


# ── Shared helpers ────────────────────────────────────────────────────────────

def _fetch_rows(conn, table, id_col, identity_cols, filter_clause=None):
    """Fetch all rows ordered by id_col; return list of dicts."""
    where = f"WHERE {filter_clause}" if filter_clause else ""
    sql = f"SELECT {id_col}, {', '.join(identity_cols)} FROM {table} {where} ORDER BY {id_col}"
    if isinstance(conn, pymysql.connections.Connection):
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(sql)
            return cur.fetchall()
    elif isinstance(conn, psycopg2.extensions.connection):
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql)
            return [dict(r) for r in cur.fetchall()]
    else:  # pymssql
        cur = conn.cursor(as_dict=True)
        cur.execute(sql)
        return cur.fetchall()


def inject_cross_source_defects(
    mysql_conn, pgsql_conn, mssql_conn,
    entity: str, pct: float, seed: int = 42,
) -> dict:
    """
    Injects `pct`% cross-source duplicates by updating identity columns in the
    receiver sources (academics, mathsci) to match sampled donor rows (compsci).

    Each injected defect creates one group of 3 ambiguous entities:
      1 from compsci (unchanged donor)  +  1 from academics  +  1 from mathsci

    Returns ground-truth values for API assertions plus a `groups` list:
      groups[i] = {"donor_id": int, "academics_id": int, "mathsci_id": int}
    """
    cfg     = ENTITY_CONFIG[entity]
    donor   = cfg["donor"]
    rcv     = cfg["receivers"]

    db_map = {"academics": mssql_conn, "mathsci": pgsql_conn}

    # ── Read all rows from each source ────────────────────────────────────────
    donor_rows = _fetch_rows(
        mysql_conn, donor["table"], donor["id_col"], donor["identity_cols"], donor["filter"]
    )
    receiver_rows = {
        src: _fetch_rows(db_map[src], rcv[src]["table"], rcv[src]["id_col"],
                         rcv[src]["identity_cols"], rcv[src]["filter"])
        for src in rcv
    }

    N = len(donor_rows)
    n_defects = max(1, round(N * pct / 100)) if pct > 0 else 0

    groups = []

    if n_defects > 0:
        random.seed(seed)
        templates  = random.sample(donor_rows, n_defects)

        # For each receiver, pick targets that don't already match any template
        picked_targets = {}
        for src_name, rows in receiver_rows.items():
            src_cfg      = rcv[src_name]
            id_col       = src_cfg["id_col"]
            identity_cols = src_cfg["identity_cols"]
            tmpl_values  = {
                tuple(str(t[c]) for c in donor["identity_cols"])
                for t in templates
            }
            available = [
                r for r in rows
                if tuple(str(r[c]) for c in identity_cols) not in tmpl_values
            ]
            random.seed(seed)   # same seed → same target order per source
            picked_targets[src_name] = random.sample(available, n_defects)

        # ── Apply UPDATEs ─────────────────────────────────────────────────────
        for i, tmpl in enumerate(templates):
            group = {"donor_id": tmpl[donor["id_col"]]}

            for src_name, targets in picked_targets.items():
                src_cfg       = rcv[src_name]
                tgt           = targets[i]
                id_col        = src_cfg["id_col"]
                identity_cols = src_cfg["identity_cols"]
                conn          = db_map[src_name]

                set_clause = ", ".join(f"{col} = %s" for col in identity_cols)
                # Map donor col → receiver col by position
                values = tuple(tmpl[dc] for dc in donor["identity_cols"]) + (tgt[id_col],)

                if isinstance(conn, psycopg2.extensions.connection):
                    with conn.cursor() as cur:
                        cur.execute(
                            f"UPDATE {src_cfg['table']} SET {set_clause} WHERE {id_col} = %s",
                            values,
                        )
                    conn.commit()
                else:  # pymssql
                    cur = conn.cursor()
                    cur.execute(
                        f"UPDATE {src_cfg['table']} SET {set_clause} WHERE {id_col} = %s",
                        values,
                    )
                    conn.commit()

                group[f"{src_name}_id"] = tgt[id_col]

            groups.append(group)

    ambiguous = n_defects * 3   # donor + academics target + mathsci target per group
    return {
        "ambiguous_instances": ambiguous,
        "passed":              n_defects == 0,
        "groups":              groups,
    }


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def entity_totals():
    """
    Fetches the real total_entities per entity from the API at session start
    (with 0 defects injected). Used to compute expected cn3_score dynamically
    rather than relying on hardcoded counts that depend on OBDA/subclass reasoning.
    """
    totals = {}
    with TestClient(app) as c:
        for entity, cfg in ENTITY_CONFIG.items():
            resp = c.get(
                "/conciseness/cross-source",
                params={
                    "class_uri":      cfg["class_uri"],
                    "identity_props": cfg["identity_props"],
                    "sources":        ALL_SOURCES,
                },
            )
            assert resp.status_code == 200, f"Failed to fetch baseline for {entity}: {resp.text}"
            data = resp.json()
            assert data["ambiguous_instances"] == 0, (
                f"[entity_totals] Pre-existing cross-source duplicates detected for {entity}: "
                f"{data['ambiguous_instances']} ambiguous. DB may be dirty from a previous run."
            )
            totals[entity] = data["total_entities"]
    return totals


@pytest.fixture(scope="session")
def mysql_conn():
    conn = pymysql.connect(**MYSQL_COMPSCI)
    yield conn
    conn.close()


@pytest.fixture(scope="session")
def pgsql_conn():
    conn = psycopg2.connect(**PGSQL_MATHSCI)
    conn.autocommit = False
    yield conn
    conn.close()


@pytest.fixture(scope="session")
def mssql_conn():
    conn = pymssql.connect(**MSSQL_ACADEMICS)
    yield conn
    conn.close()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def clean_snapshots_cross(pgsql_conn, mssql_conn):
    """
    Reads the clean state of all receiver tables once at session start.
    Fails fast if pre-existing cross-source duplicates are detected (dirty DB).
    """
    snapshots = {}
    for entity, cfg in ENTITY_CONFIG.items():
        snapshots[entity] = {}
        db_map = {"academics": mssql_conn, "mathsci": pgsql_conn}
        for src_name, rcv_cfg in cfg["receivers"].items():
            rows = _fetch_rows(
                db_map[src_name],
                rcv_cfg["table"], rcv_cfg["id_col"],
                rcv_cfg["identity_cols"], rcv_cfg["filter"],
            )
            snapshots[entity][src_name] = rows

            # Validate no pre-existing duplicates with donor
            # (a quick uniqueness check within the receiver itself)
            seen: dict = {}
            for row in rows:
                key = tuple(str(row[c]) for c in rcv_cfg["identity_cols"])
                if key in seen:
                    raise RuntimeError(
                        f"[clean_snapshots_cross] Pre-existing duplicate detected in "
                        f"{src_name}.{rcv_cfg['table']} for {entity}: {key}. "
                        f"DB was left dirty by a previous test run. "
                        f"Run: docker compose -f docker-compose.clean.yml restart && "
                        f"restore the affected tables."
                    )
                seen[key] = row[rcv_cfg["id_col"]]

    return snapshots


def _restore_receiver_tables(pgsql_conn, mssql_conn, snapshots):
    db_map = {"academics": mssql_conn, "mathsci": pgsql_conn}
    for entity, cfg in ENTITY_CONFIG.items():
        for src_name, rcv_cfg in cfg["receivers"].items():
            conn          = db_map[src_name]
            id_col        = rcv_cfg["id_col"]
            identity_cols = rcv_cfg["identity_cols"]
            set_clause    = ", ".join(f"{col} = %s" for col in identity_cols)
            rows          = snapshots[entity][src_name]

            if isinstance(conn, psycopg2.extensions.connection):
                with conn.cursor() as cur:
                    for row in rows:
                        values = tuple(row[c] for c in identity_cols) + (row[id_col],)
                        cur.execute(
                            f"UPDATE {rcv_cfg['table']} SET {set_clause} WHERE {id_col} = %s",
                            values,
                        )
                conn.commit()
            else:  # pymssql
                cur = conn.cursor()
                for row in rows:
                    values = tuple(row[c] for c in identity_cols) + (row[id_col],)
                    cur.execute(
                        f"UPDATE {rcv_cfg['table']} SET {set_clause} WHERE {id_col} = %s",
                        values,
                    )
                conn.commit()


@pytest.fixture(autouse=True)
def reset_to_clean_cross(pgsql_conn, mssql_conn, clean_snapshots_cross):
    """
    Restores receiver identity columns before AND after every test.
    Prevents dirty state from leaking between tests or across sessions.
    """
    _restore_receiver_tables(pgsql_conn, mssql_conn, clean_snapshots_cross)
    yield
    _restore_receiver_tables(pgsql_conn, mssql_conn, clean_snapshots_cross)
