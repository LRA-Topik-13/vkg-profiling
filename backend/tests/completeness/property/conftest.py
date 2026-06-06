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
SCHEMA = "http://schema.org/"

EMAIL = f"{SCHEMA}email"


def _src(db, table, id_col, column, uri_base, filt=None):
    return {"db": db, "table": table, "id_col": id_col, "column": column,
            "uri_base": uri_base, "filter": filt}

PROPERTY_TARGETS = {
    f"{VOC}Student": {
        EMAIL: [
            _src("compsci", "student", "s_id", "email", f"{VOC}compsci/student/"),
            _src("mathsci", "person", "pid", "email", f"{VOC}mathsci/person/", "status IN (1,2,4)"),
        ],
    },
    f"{VOC}FacultyMember": {
        EMAIL: [
            _src("compsci", "academic", "a_id", "email", f"{VOC}compsci/academic/"),
            _src("academics", "teacher", "t_id", "email", f"{VOC}academics/teacher/"),
            _src("mathsci", "person", "pid", "email", f"{VOC}mathsci/person/", "status IN (7,8,9)"),
        ],
    },
    f"{VOC}Course": {
        f"{VOC}title": [
            _src("compsci", "course", "c_id", "title", f"{VOC}compsci/course/"),
            _src("academics", "course", "c_id", "title", f"{VOC}academics/course/"),
            _src("mathsci", "course", "cid", "topic", f"{VOC}mathsci/course/"),
        ],
    },
    f"{VOC}Place": {
        f"{VOC}roomCode": [_src("academics", "place", "place_id", "room_code", f"{VOC}academics/place/")],
    },
    f"{VOC}TimeSlot": {
        f"{VOC}day": [_src("academics", "time_slot", "ts_id", "day", f"{VOC}academics/timeslot/")],
    },
}

RESTORE_SPEC = {
    ("compsci", "student"): ("s_id", ["email"]),
    ("compsci", "academic"): ("a_id", ["email"]),
    ("compsci", "course"): ("c_id", ["title"]),
    ("academics", "teacher"): ("t_id", ["email"]),
    ("academics", "course"): ("c_id", ["title"]),
    ("academics", "place"): ("place_id", ["room_code"]),
    ("academics", "time_slot"): ("ts_id", ["day"]),
    ("mathsci", "person"): ("pid", ["email"]),
    ("mathsci", "course"): ("cid", ["topic"]),
}


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
    snaps = {}
    for (db, table), (id_col, cols) in RESTORE_SPEC.items():
        rows = _fetch(conns[db], f"SELECT {id_col}, {', '.join(cols)} FROM {table}")
        snaps[(db, table)] = (id_col, cols, rows)
    return snaps


def _restore(conns, snapshots):
    for (db, table), (id_col, cols, rows) in snapshots.items():
        set_clause = ", ".join(f"{c} = %s" for c in cols)
        seq = [tuple(r[c] for c in cols) + (r[id_col],) for r in rows]
        _executemany(conns[db], f"UPDATE {table} SET {set_clause} WHERE {id_col} = %s", seq)


@pytest.fixture(autouse=True)
def reset_to_clean(conns, clean_snapshots):
    _restore(conns, clean_snapshots)
    yield
    _restore(conns, clean_snapshots)


def inject_property_defects(conns, class_uri, prop_uri, pct, seed=42):
    missing_uris: set[str] = set()
    n_total = 0
    base_total = 0
    for src in PROPERTY_TARGETS[class_uri][prop_uri]:
        conn = conns[src["db"]]
        where = f" WHERE {src['filter']}" if src["filter"] else ""
        rows = _fetch(conn, f"SELECT {src['id_col']} AS id FROM {src['table']}{where}")
        N = len(rows)
        base_total += N
        n = max(1, math.ceil(N * pct / 100)) if pct > 0 else 0
        if n == 0:
            continue
        rng = random.Random(seed)
        chosen = rng.sample(rows, n)
        ids = [r["id"] for r in chosen]
        placeholders = ", ".join(["%s"] * len(ids))
        _execute(
            conn,
            f"UPDATE {src['table']} SET {src['column']} = NULL "
            f"WHERE {src['id_col']} IN ({placeholders})",
            tuple(ids),
        )
        for i in ids:
            missing_uris.add(f"{src['uri_base']}{i}")
            n_total += 1
    return n_total, base_total, missing_uris
