import math
import random

import pymysql
import psycopg2
import psycopg2.extras
import pymssql
import pytest
from fastapi.testclient import TestClient

from app.main import app

MYSQL_COMPSCI = dict(host="127.0.0.1", port=3308, user="compsci", password="compscipwd", database="compsci")
PGSQL_MATHSCI = dict(host="localhost", port=5434, user="mathsci", password="mathscipwd", dbname="mathsci")
MSSQL_ACADEMICS = dict(server="localhost", port=1434, user="academics", password="academicspwd", database="academics")

VOC = "http://example.org/voc#"

CLASSES = [f"{VOC}Place", f"{VOC}Student", f"{VOC}FacultyMember"]

URI_BASE = {
    f"{VOC}Place": {"academics": f"{VOC}academics/place/"},
    f"{VOC}TimeSlot": {"academics": f"{VOC}academics/timeslot/"},
    f"{VOC}Student": {"compsci": f"{VOC}compsci/student/", "mathsci": f"{VOC}mathsci/person/"},
    f"{VOC}FacultyMember": {
        "compsci": f"{VOC}compsci/academic/",
        "academics": f"{VOC}academics/teacher/",
        "mathsci": f"{VOC}mathsci/person/",
    },
}

LINKED_SQL = {
    f"{VOC}Place": {"academics": "SELECT DISTINCT place_id AS id FROM schedule"},
    f"{VOC}TimeSlot": {"academics": "SELECT DISTINCT ts_id AS id FROM schedule"},
    f"{VOC}Student": {
        "compsci": "SELECT DISTINCT s_id AS id FROM course_registration",
        "mathsci": (
            "SELECT DISTINCT p.pid AS id FROM person p WHERE p.status IN (1,2,4) AND ("
            "p.pid IN (SELECT pid FROM registration) OR "
            "p.pid IN (SELECT pid_student FROM supervision))"
        ),
    },
    f"{VOC}FacultyMember": {
        "compsci": "SELECT DISTINCT a_id AS id FROM teaching",
        "academics": "SELECT DISTINCT t_id AS id FROM teaching",
        "mathsci": (
            "SELECT DISTINCT p.pid AS id FROM person p WHERE p.status IN (7,8,9) AND ("
            "p.pid IN (SELECT lecturer FROM course WHERE lecturer IS NOT NULL) OR "
            "p.pid IN (SELECT lab_teacher FROM course WHERE lab_teacher IS NOT NULL) OR "
            "p.pid IN (SELECT pid_supervisor FROM supervision) OR "
            "p.pid IN (SELECT pid FROM registration))"
        ),
    },
}

SEVER_OPS = {
    f"{VOC}Place": {
        "academics": [("academics", "DELETE FROM schedule WHERE place_id = %s")],
    },
    f"{VOC}TimeSlot": {
        "academics": [("academics", "DELETE FROM schedule WHERE ts_id = %s")],
    },
    f"{VOC}Student": {
        "compsci": [("compsci", "DELETE FROM course_registration WHERE s_id = %s")],
        "mathsci": [("mathsci", "DELETE FROM registration WHERE pid = %s"),
                    ("mathsci", "DELETE FROM supervision WHERE pid_student = %s")],
    },
    f"{VOC}FacultyMember": {
        "compsci": [("compsci", "DELETE FROM teaching WHERE a_id = %s")],
        "academics": [("academics", "DELETE FROM teaching WHERE t_id = %s")],
        "mathsci": [("mathsci", "UPDATE course SET lecturer = NULL WHERE lecturer = %s"),
                    ("mathsci", "UPDATE course SET lab_teacher = NULL WHERE lab_teacher = %s"),
                    ("mathsci", "DELETE FROM supervision WHERE pid_supervisor = %s"),
                    ("mathsci", "DELETE FROM registration WHERE pid = %s")],
    },
}

JOIN_TABLES = [
    ("academics", "schedule", ["c_id", "place_id", "ts_id"]),
    ("compsci", "course_registration", ["c_id", "s_id"]),
    ("compsci", "teaching", ["c_id", "a_id"]),
    ("academics", "teaching", ["c_id", "t_id"]),
    ("mathsci", "registration", ["pid", "cid"]),
    ("mathsci", "supervision", ["pid_student", "pid_supervisor"]),
]
FK_TABLE = ("mathsci", "course", "cid", ["lecturer", "lab_teacher"])


def _fetch(conn, sql, params=None):
    if isinstance(conn, pymysql.connections.Connection):
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(sql, params or ())
            return cur.fetchall()
    if isinstance(conn, psycopg2.extensions.connection):
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or ())
            return [dict(r) for r in cur.fetchall()]
    cur = conn.cursor(as_dict=True)
    cur.execute(sql, params or ())
    return cur.fetchall()


def _execute(conn, sql, params=None):
    if isinstance(conn, psycopg2.extensions.connection):
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
    else:
        cur = conn.cursor()
        cur.execute(sql, params or ())
    conn.commit()


def _executemany(conn, sql, seq):
    if not seq:
        return
    if isinstance(conn, psycopg2.extensions.connection):
        with conn.cursor() as cur:
            cur.executemany(sql, seq)
    else:
        cur = conn.cursor()
        cur.executemany(sql, seq)
    conn.commit()


@pytest.fixture(scope="session")
def conns():
    mysql = pymysql.connect(**MYSQL_COMPSCI)
    pg = psycopg2.connect(**PGSQL_MATHSCI)
    pg.autocommit = False
    mssql = pymssql.connect(**MSSQL_ACADEMICS)
    pool = {"compsci": mysql, "mathsci": pg, "academics": mssql}
    yield pool
    mysql.close(); pg.close(); mssql.close()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def clean_snapshots(conns):
    snaps = {"join": {}, "fk": None}
    for db, table, cols in JOIN_TABLES:
        snaps["join"][(db, table)] = (cols, _fetch(conns[db], f"SELECT {', '.join(cols)} FROM {table}"))
    db, table, id_col, fk_cols = FK_TABLE
    snaps["fk"] = _fetch(conns[db], f"SELECT {id_col}, {', '.join(fk_cols)} FROM {table}")
    return snaps


def _restore(conns, snapshots):
    for db, table, cols in JOIN_TABLES:
        cols_saved, rows = snapshots["join"][(db, table)]
        _execute(conns[db], f"DELETE FROM {table}")
        placeholders = ", ".join(["%s"] * len(cols_saved))
        seq = [tuple(r[c] for c in cols_saved) for r in rows]
        _executemany(conns[db], f"INSERT INTO {table} ({', '.join(cols_saved)}) VALUES ({placeholders})", seq)
    db, table, id_col, fk_cols = FK_TABLE
    set_clause = ", ".join(f"{c} = %s" for c in fk_cols)
    seq = [tuple(r[c] for c in fk_cols) + (r[id_col],) for r in snapshots["fk"]]
    _executemany(conns[db], f"UPDATE {table} SET {set_clause} WHERE {id_col} = %s", seq)


@pytest.fixture(autouse=True)
def reset_to_clean(conns, clean_snapshots):
    _restore(conns, clean_snapshots)
    yield
    _restore(conns, clean_snapshots)


@pytest.fixture(scope="session")
def interlinking_baseline(clean_snapshots, conns):
    base = {}
    with TestClient(app) as c:
        summary = c.get("/completeness/interlinking").json()
    by_uri = {row["uri"]: row for row in summary["classes"]}
    for class_uri in CLASSES:
        row = by_uri[class_uri]
        linked_by_source: dict[str, list] = {}
        for src, sql in LINKED_SQL[class_uri].items():
            base_uri = URI_BASE[class_uri][src]
            ids = [r["id"] for r in _fetch(conns[src], sql)]
            linked_by_source[src] = [(f"{base_uri}{i}", i) for i in ids]
        base[class_uri] = {
            "total": row["total_entities"],
            "linked": row["linked"],
            "not_linked": row["not_linked"],
            "linked_by_source": linked_by_source,
        }
    return base


def inject_interlinking_defects(conns, class_uri, pct, baseline, seed=42):
    flipped: set[str] = set()
    linked_by_source = baseline[class_uri]["linked_by_source"]
    for src, ops in SEVER_OPS[class_uri].items():
        pool = linked_by_source.get(src, [])
        N = len(pool)
        n = max(1, math.ceil(N * pct / 100)) if pct > 0 else 0
        if n == 0:
            continue
        rng = random.Random(seed)
        for uri, _id in rng.sample(pool, n):
            for db, sql in ops:
                _execute(conns[db], sql, (_id,))
            flipped.add(uri)
    return len(flipped), flipped
