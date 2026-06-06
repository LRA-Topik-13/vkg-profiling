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
PK_OFFSET = 1_000_000

POPULATION_TARGETS = [
    {
        "key": "student_unmapped", "db": "compsci", "class_uri": f"{VOC}Student",
        "source": "student", "shadow": "student_unmapped", "id_col": "s_id",
        "columns": ["s_id", "first_name", "last_name", "birth_date", "email"], "filter": None,
        "ddl": ("CREATE TABLE student_unmapped (s_id INT NOT NULL PRIMARY KEY, "
                "first_name VARCHAR(40) NOT NULL, last_name VARCHAR(40) NOT NULL, "
                "birth_date DATE NULL, email VARCHAR(100) NULL)"),
    },
    {
        "key": "person_unmapped", "db": "mathsci", "class_uri": f"{VOC}Student",
        "source": "person", "shadow": "person_unmapped", "id_col": "pid",
        "columns": ["pid", "fname", "lname", "status", "birth_date", "email"],
        "filter": "status IN (1,2,4)",
        "ddl": ("CREATE TABLE person_unmapped (pid INT NOT NULL PRIMARY KEY, "
                "fname VARCHAR(40) NOT NULL, lname VARCHAR(40) NOT NULL, status INT NOT NULL, "
                "birth_date DATE NULL, email VARCHAR(100) NULL)"),
    },
    {
        "key": "teacher_unmapped", "db": "academics", "class_uri": f"{VOC}FacultyMember",
        "source": "teacher", "shadow": "teacher_unmapped", "id_col": "t_id",
        "columns": ["t_id", "first_name", "last_name", "position", "birth_date", "email"], "filter": None,
        "ddl": ("CREATE TABLE teacher_unmapped (t_id INT NOT NULL PRIMARY KEY, "
                "first_name VARCHAR(40) NOT NULL, last_name VARCHAR(40) NOT NULL, position INT NOT NULL, "
                "birth_date DATE NULL, email VARCHAR(100) NULL)"),
    },
    {
        "key": "course_unmapped", "db": "academics", "class_uri": f"{VOC}Course",
        "source": "course", "shadow": "course_unmapped", "id_col": "c_id",
        "columns": ["c_id", "title"], "filter": None,
        "ddl": ("CREATE TABLE course_unmapped (c_id INT NOT NULL PRIMARY KEY, "
                "title VARCHAR(100) NULL)"),
    },
]


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


@pytest.fixture(scope="session", autouse=True)
def shadow_tables(conns):
    for t in POPULATION_TARGETS:
        _execute(conns[t["db"]], f"DROP TABLE IF EXISTS {t['shadow']}")
        _execute(conns[t["db"]], t["ddl"])
    yield
    for t in POPULATION_TARGETS:
        _execute(conns[t["db"]], f"DROP TABLE IF EXISTS {t['shadow']}")


@pytest.fixture(autouse=True)
def reset_to_clean(conns, shadow_tables):
    for t in POPULATION_TARGETS:
        _execute(conns[t["db"]], f"DELETE FROM {t['shadow']}")
    yield
    for t in POPULATION_TARGETS:
        _execute(conns[t["db"]], f"DELETE FROM {t['shadow']}")


@pytest.fixture(scope="session")
def population_baseline(shadow_tables):
    with TestClient(app) as c:
        data = c.get("/completeness/population-summary").json()
    assert data["source_reachable"], f"Teiid unreachable: {data.get('source_error')}"
    base = {}
    for row in data["classes"]:
        base[row["uri"]] = {
            "represented": row["represented"],
            "source_population": row["source_population"],
            "missing": row["missing"],
        }
    return base


def inject_population_defects(conns, target, pct, seed=42):
    conn = conns[target["db"]]
    cols = target["columns"]
    where = f" WHERE {target['filter']}" if target["filter"] else ""
    rows = _fetch(conn, f"SELECT {', '.join(cols)} FROM {target['source']}{where}")
    N = len(rows)
    n = max(1, math.ceil(N * pct / 100)) if pct > 0 else 0
    if n == 0:
        return 0, N
    rng = random.Random(seed)
    chosen = rng.sample(rows, n)
    placeholders = ", ".join(["%s"] * len(cols))
    seq = []
    for r in chosen:
        seq.append(tuple((r[c] + PK_OFFSET) if c == target["id_col"] else r[c] for c in cols))
    _executemany(conn, f"INSERT INTO {target['shadow']} ({', '.join(cols)}) VALUES ({placeholders})", seq)
    return n, N
