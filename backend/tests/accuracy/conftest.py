import os

import psycopg2
import psycopg2.extras
import pymysql
import pymssql
import pytest
from fastapi.testclient import TestClient

from app.main import app


VOC = "http://example.org/voc#"
FOAF = "http://xmlns.com/foaf/0.1/"
SCHEMA = "http://schema.org/"

SOURCE_ACADEMICS = f"{VOC}academics/"
SOURCE_COMPSCI = f"{VOC}compsci/"
SOURCE_MATHSCI = f"{VOC}mathsci/"

CLASS_FULL_PROFESSOR = f"{VOC}FullProfessor"
CLASS_FACULTY_MEMBER = f"{VOC}FacultyMember"
CLASS_PERSON = f"{FOAF}Person"

PROP_TEACHES = f"{VOC}teaches"
PROP_IS_SUPERVISED_BY = f"{VOC}isSupervisedBy"
PROP_FIRST_NAME = f"{FOAF}firstName"
PROP_LAST_NAME = f"{FOAF}lastName"
PROP_BIRTH_DATE = f"{SCHEMA}birthDate"
PROP_EMAIL = f"{SCHEMA}email"

DEFECT_PCTS = [0, 2, 5, 10, 20]

_RECORDS = []


MSSQL = dict(
    server=os.getenv("ACCURACY_MSSQL_HOST", "localhost"),
    port=int(os.getenv("ACCURACY_MSSQL_PORT", "1434")),
    user=os.getenv("ACCURACY_MSSQL_USER", "academics"),
    password=os.getenv("ACCURACY_MSSQL_PASSWORD", "academicspwd"),
    database=os.getenv("ACCURACY_MSSQL_DATABASE", "academics"),
)

MYSQL = dict(
    host=os.getenv("ACCURACY_MYSQL_HOST", "localhost"),
    port=int(os.getenv("ACCURACY_MYSQL_PORT", "3308")),
    user=os.getenv("ACCURACY_MYSQL_USER", "compsci"),
    password=os.getenv("ACCURACY_MYSQL_PASSWORD", "compscipwd"),
    database=os.getenv("ACCURACY_MYSQL_DATABASE", "compsci"),
)

PGSQL = dict(
    host=os.getenv("ACCURACY_PGSQL_HOST", "localhost"),
    port=int(os.getenv("ACCURACY_PGSQL_PORT", "5434")),
    user=os.getenv("ACCURACY_PGSQL_USER", "mathsci"),
    password=os.getenv("ACCURACY_PGSQL_PASSWORD", "mathscipwd"),
    dbname=os.getenv("ACCURACY_PGSQL_DATABASE", "mathsci"),
)


def defect_count(total: int, pct: float) -> int:
    """Return the deterministic number of source defects for a percentage."""
    return max(1, round(total * pct / 100)) if pct > 0 else 0


def accuracy_score(clean_count: int, total: int) -> float:
    """Return the percentage score used by Accuracy summary endpoints."""
    return round(clean_count / total * 100, 2) if total else 100.0


def _record(metric, pct, injected, detected, total=0):
    """Record injected-vs-detected counts for terminal evaluation metrics."""
    tp = min(injected, detected)
    fp = max(detected - injected, 0)
    fn = max(injected - detected, 0)
    _RECORDS.append({
        "metric": metric, "pct": pct, "total": total,
        "injected": injected, "detected": detected,
        "tp": tp, "fp": fp, "fn": fn,
    })


@pytest.fixture
def detection():
    """Return a recorder for Accuracy defect detection metrics."""
    return _record


def _safe_div(num, den):
    """Divide while treating empty detection populations as perfect by convention."""
    return 1.0 if den == 0 else num / den


def pytest_terminal_summary(terminalreporter, exitstatus, config):
    """Print aggregated Accuracy precision, recall, and F1 after pytest finishes."""
    if not _RECORDS:
        return

    agg = {}
    for r in _RECORDS:
        key = (r["metric"], r["pct"])
        a = agg.setdefault(key, {"total": 0, "injected": 0, "detected": 0, "tp": 0, "fp": 0, "fn": 0})
        for f in ("total", "injected", "detected", "tp", "fp", "fn"):
            a[f] += r[f]

    w = terminalreporter.write_line
    width = 100
    w("")
    w("=" * width)
    w("ACCURACY DEFECT DETECTION METRICS")
    w("=" * width)
    header = (f"{'metric':<22}{'pct':>5}{'N':>7}{'inj':>7}{'eff%':>8}"
              f"{'det':>7}{'TP':>6}{'FP':>6}{'FN':>6}{'prec':>8}{'recall':>8}{'f1':>8}")
    w(header)
    w("-" * width)

    totals = {"total": 0, "injected": 0, "tp": 0, "fp": 0, "fn": 0}
    for (metric, pct) in sorted(agg.keys()):
        a = agg[(metric, pct)]
        prec = _safe_div(a["tp"], a["tp"] + a["fp"])
        rec = _safe_div(a["tp"], a["tp"] + a["fn"])
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
        eff = (a["injected"] / a["total"] * 100) if a["total"] else 0.0
        w(f"{metric:<22}{pct:>4}%{a['total']:>7}{a['injected']:>7}{eff:>7.1f}%"
          f"{a['detected']:>7}{a['tp']:>6}{a['fp']:>6}{a['fn']:>6}{prec:>8.3f}{rec:>8.3f}{f1:>8.3f}")
        for f in ("total", "injected", "tp", "fp", "fn"):
            totals[f] += a[f]

    w("-" * width)
    prec = _safe_div(totals["tp"], totals["tp"] + totals["fp"])
    rec = _safe_div(totals["tp"], totals["tp"] + totals["fn"])
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    eff = (totals["injected"] / totals["total"] * 100) if totals["total"] else 0.0
    w(f"{'OVERALL':<22}{'':>5}{totals['total']:>7}{totals['injected']:>7}{eff:>7.1f}%"
      f"{'':>7}{totals['tp']:>6}{totals['fp']:>6}{totals['fn']:>6}{prec:>8.3f}{rec:>8.3f}{f1:>8.3f}")
    w("=" * width)


@pytest.fixture(scope="session")
def client():
    """FastAPI test client for backend/API correctness checks."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def mysql_conn():
    """Connection to the clean MySQL source database."""
    conn = pymysql.connect(**MYSQL)
    yield conn
    conn.close()


@pytest.fixture(scope="session")
def mssql_conn():
    """Connection to the clean MSSQL source database."""
    conn = pymssql.connect(**MSSQL)
    yield conn
    conn.close()


@pytest.fixture(scope="session")
def pgsql_conn():
    """Connection to the clean PostgreSQL source database."""
    conn = psycopg2.connect(**PGSQL)
    yield conn
    conn.close()


def _mssql_rows(conn, query: str) -> list[dict]:
    """Fetch MSSQL rows as dictionaries."""
    cursor = conn.cursor(as_dict=True)
    cursor.execute(query)
    return cursor.fetchall()


def _mysql_rows(conn, query: str) -> list[dict]:
    """Fetch MySQL rows as dictionaries."""
    with conn.cursor(pymysql.cursors.DictCursor) as cursor:
        cursor.execute(query)
        return cursor.fetchall()


def _pgsql_rows(conn, query: str) -> list[dict]:
    """Fetch PostgreSQL rows as dictionaries."""
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(query)
    return [dict(row) for row in cursor.fetchall()]


@pytest.fixture(scope="session")
def clean_snapshots(mysql_conn, mssql_conn, pgsql_conn):
    """Capture the clean source rows touched by Accuracy correctness tests."""
    return {
        "mysql_academic": _mysql_rows(
            mysql_conn,
            "SELECT a_id, first_name, last_name, position, birth_date, email "
            "FROM academic ORDER BY a_id",
        ),
        "mssql_teacher": _mssql_rows(
            mssql_conn,
            "SELECT t_id, first_name, last_name, position, birth_date, email "
            "FROM teacher ORDER BY t_id",
        ),
        "mssql_teaching": _mssql_rows(
            mssql_conn,
            "SELECT c_id, t_id FROM teaching ORDER BY t_id, c_id",
        ),
        "pgsql_person": _pgsql_rows(
            pgsql_conn,
            "SELECT pid, fname, lname, status, birth_date, email "
            "FROM person ORDER BY pid",
        ),
        "pgsql_supervision": _pgsql_rows(
            pgsql_conn,
            "SELECT pid_student, pid_supervisor "
            "FROM supervision ORDER BY pid_student, pid_supervisor",
        ),
    }


def restore_mysql(conn, snapshots: dict) -> None:
    """Restore MySQL rows touched by Accuracy tests."""
    with conn.cursor() as cursor:
        for row in snapshots["mysql_academic"]:
            cursor.execute(
                """
                UPDATE academic
                SET first_name = %s,
                    last_name = %s,
                    position = %s,
                    birth_date = %s,
                    email = %s
                WHERE a_id = %s
                """,
                (
                    row["first_name"],
                    row["last_name"],
                    row["position"],
                    row["birth_date"],
                    row["email"],
                    row["a_id"],
                ),
            )
    conn.commit()


def restore_mssql(conn, snapshots: dict) -> None:
    """Restore MSSQL rows touched by Accuracy tests."""
    cursor = conn.cursor()
    cursor.execute("DELETE FROM teaching")
    for row in snapshots["mssql_teacher"]:
        cursor.execute(
            """
            UPDATE teacher
            SET first_name = %s,
                last_name = %s,
                position = %s,
                birth_date = %s,
                email = %s
            WHERE t_id = %s
            """,
            (
                row["first_name"],
                row["last_name"],
                row["position"],
                row["birth_date"],
                row["email"],
                row["t_id"],
            ),
        )
    for row in snapshots["mssql_teaching"]:
        cursor.execute(
            "INSERT INTO teaching (c_id, t_id) VALUES (%s, %s)",
            (row["c_id"], row["t_id"]),
        )
    conn.commit()


def restore_pgsql(conn, snapshots: dict) -> None:
    """Restore PostgreSQL rows touched by Accuracy tests."""
    cursor = conn.cursor()
    cursor.execute("DELETE FROM supervision")
    for row in snapshots["pgsql_person"]:
        cursor.execute(
            """
            UPDATE person
            SET fname = %s,
                lname = %s,
                status = %s,
                birth_date = %s,
                email = %s
            WHERE pid = %s
            """,
            (
                row["fname"],
                row["lname"],
                row["status"],
                row["birth_date"],
                row["email"],
                row["pid"],
            ),
        )
    for row in snapshots["pgsql_supervision"]:
        cursor.execute(
            "INSERT INTO supervision (pid_student, pid_supervisor) VALUES (%s, %s)",
            (row["pid_student"], row["pid_supervisor"]),
        )
    conn.commit()


@pytest.fixture(autouse=True)
def reset_sources(mysql_conn, mssql_conn, pgsql_conn, clean_snapshots):
    """Restore source rows before and after every Accuracy correctness test."""
    restore_mysql(mysql_conn, clean_snapshots)
    restore_mssql(mssql_conn, clean_snapshots)
    restore_pgsql(pgsql_conn, clean_snapshots)
    yield
    restore_mysql(mysql_conn, clean_snapshots)
    restore_mssql(mssql_conn, clean_snapshots)
    restore_pgsql(pgsql_conn, clean_snapshots)
