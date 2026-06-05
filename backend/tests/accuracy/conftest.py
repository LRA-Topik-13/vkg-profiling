import os

import psycopg2
import psycopg2.extras
import pymssql
import pytest
from fastapi.testclient import TestClient

from app.main import app


VOC = "http://example.org/voc#"
FOAF = "http://xmlns.com/foaf/0.1/"
SCHEMA = "http://schema.org/"

SOURCE_ACADEMICS = f"{VOC}academics/"
SOURCE_MATHSCI = f"{VOC}mathsci/"

CLASS_FULL_PROFESSOR = f"{VOC}FullProfessor"
CLASS_PERSON = f"{FOAF}Person"

PROP_TEACHES = f"{VOC}teaches"
PROP_IS_SUPERVISED_BY = f"{VOC}isSupervisedBy"
PROP_FIRST_NAME = f"{FOAF}firstName"
PROP_LAST_NAME = f"{FOAF}lastName"
PROP_BIRTH_DATE = f"{SCHEMA}birthDate"
PROP_EMAIL = f"{SCHEMA}email"

DEFECT_PCTS = [0, 2, 5, 10, 20]


MSSQL = dict(
    server=os.getenv("ACCURACY_MSSQL_HOST", "localhost"),
    port=int(os.getenv("ACCURACY_MSSQL_PORT", "1434")),
    user=os.getenv("ACCURACY_MSSQL_USER", "academics"),
    password=os.getenv("ACCURACY_MSSQL_PASSWORD", "academicspwd"),
    database=os.getenv("ACCURACY_MSSQL_DATABASE", "academics"),
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


@pytest.fixture(scope="session")
def client():
    """FastAPI test client for backend/API correctness checks."""
    with TestClient(app) as c:
        yield c


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


def _pgsql_rows(conn, query: str) -> list[dict]:
    """Fetch PostgreSQL rows as dictionaries."""
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(query)
    return [dict(row) for row in cursor.fetchall()]


@pytest.fixture(scope="session")
def clean_snapshots(mssql_conn, pgsql_conn):
    """Capture the clean source rows touched by Accuracy correctness tests."""
    return {
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
def reset_sources(mssql_conn, pgsql_conn, clean_snapshots):
    """Restore source rows before and after every Accuracy correctness test."""
    restore_mssql(mssql_conn, clean_snapshots)
    restore_pgsql(pgsql_conn, clean_snapshots)
    yield
    restore_mssql(mssql_conn, clean_snapshots)
    restore_pgsql(pgsql_conn, clean_snapshots)
