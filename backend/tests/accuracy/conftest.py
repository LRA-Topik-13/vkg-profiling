import os
from datetime import date

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


def academics_full_professor_ids(conn) -> list[int]:
    """Return academics teachers that are Full Professors and teach at least once."""
    cursor = conn.cursor(as_dict=True)
    cursor.execute(
        """
        SELECT DISTINCT t.t_id
        FROM teacher t
        JOIN teaching tg ON tg.t_id = t.t_id
        WHERE t.position = 1
        ORDER BY t.t_id
        """
    )
    return [row["t_id"] for row in cursor.fetchall()]


def add_extra_teaches_relationships(conn, teacher_ids: list[int], extras_per_teacher: int = 3) -> None:
    """Add distinct extra Teaches relationships for selected academics teachers."""
    cursor = conn.cursor(as_dict=True)
    update_cursor = conn.cursor()
    for teacher_id in teacher_ids:
        cursor.execute("SELECT c_id FROM teaching WHERE t_id = %s", (teacher_id,))
        existing = {row["c_id"] for row in cursor.fetchall()}
        extra_courses = [course_id for course_id in range(1, 41) if course_id not in existing]
        if len(extra_courses) < extras_per_teacher:
            raise RuntimeError(f"Not enough unused courses for teacher {teacher_id}.")
        for course_id in extra_courses[:extras_per_teacher]:
            update_cursor.execute(
                "INSERT INTO teaching (c_id, t_id) VALUES (%s, %s)",
                (course_id, teacher_id),
            )
    conn.commit()


def set_cross_source_person_pairs(
    mssql_conn,
    pgsql_conn,
    pair_count: int,
    conflict_count: int,
) -> list[tuple[str, str]]:
    """Create deterministic academics-mathsci Person pairs for cross-source SA2."""
    mssql_cursor = mssql_conn.cursor()
    pg_cursor = pgsql_conn.cursor()
    expected_pairs = []
    for idx in range(1, pair_count + 1):
        first_name = f"AccuracyCross{idx:03d}"
        last_name = f"Person{idx:03d}"
        birth_date = date(1990, 1, idx if idx <= 28 else idx - 28)
        clean_email = f"accuracy-cross-{idx:03d}@example.edu"
        academics_email = clean_email
        mathsci_email = (
            f"accuracy-cross-{idx:03d}-conflict@example.edu"
            if idx <= conflict_count
            else clean_email
        )
        mssql_cursor.execute(
            """
            UPDATE teacher
            SET first_name = %s,
                last_name = %s,
                birth_date = %s,
                email = %s
            WHERE t_id = %s
            """,
            (first_name, last_name, birth_date, academics_email, idx),
        )
        pg_cursor.execute(
            """
            UPDATE person
            SET fname = %s,
                lname = %s,
                birth_date = %s,
                email = %s
            WHERE pid = %s
            """,
            (first_name, last_name, birth_date, mathsci_email, idx),
        )
        if idx <= conflict_count:
            expected_pairs.append((
                f"{VOC}academics/teacher/{idx}",
                f"{VOC}mathsci/person/{idx}",
            ))
    mssql_conn.commit()
    pgsql_conn.commit()
    return expected_pairs


def set_intra_source_person_pairs(
    conn,
    pair_count: int,
    conflict_count: int,
) -> list[tuple[str, str]]:
    """Create deterministic same-source academics Person pairs for intra-source SA2."""
    cursor = conn.cursor()
    expected_pairs = []
    for pair_idx in range(1, pair_count + 1):
        left_id = pair_idx * 2 - 1
        right_id = pair_idx * 2
        first_name = f"AccuracyIntra{pair_idx:03d}"
        last_name = f"Person{pair_idx:03d}"
        birth_date = date(1991, 1, pair_idx if pair_idx <= 28 else pair_idx - 28)
        clean_email = f"accuracy-intra-{pair_idx:03d}@example.edu"
        right_email = (
            f"accuracy-intra-{pair_idx:03d}-conflict@example.edu"
            if pair_idx <= conflict_count
            else clean_email
        )
        cursor.execute(
            """
            UPDATE teacher
            SET first_name = %s,
                last_name = %s,
                birth_date = %s,
                email = %s
            WHERE t_id = %s
            """,
            (first_name, last_name, birth_date, clean_email, left_id),
        )
        cursor.execute(
            """
            UPDATE teacher
            SET first_name = %s,
                last_name = %s,
                birth_date = %s,
                email = %s
            WHERE t_id = %s
            """,
            (first_name, last_name, birth_date, right_email, right_id),
        )
        if pair_idx <= conflict_count:
            expected_pairs.append((
                f"{VOC}academics/teacher/{left_id}",
                f"{VOC}academics/teacher/{right_id}",
            ))
    conn.commit()
    return expected_pairs


def set_academics_teaches_misuse(conn, misuse_count: int) -> list[str]:
    """Make selected academics teachers use Teaches without an assigned Teacher class."""
    cursor = conn.cursor(as_dict=True)
    cursor.execute(
        """
        SELECT DISTINCT t.t_id
        FROM teacher t
        JOIN teaching tg ON tg.t_id = t.t_id
        WHERE t.position IN (1, 2, 3, 8)
        ORDER BY t.t_id
        """
    )
    teacher_ids = [row["t_id"] for row in cursor.fetchall()]
    if len(teacher_ids) < misuse_count:
        raise RuntimeError("Not enough academics teachers for Teaches misuse injection.")

    update_cursor = conn.cursor()
    for teacher_id in teacher_ids[:misuse_count]:
        update_cursor.execute("UPDATE teacher SET position = 9 WHERE t_id = %s", (teacher_id,))
    conn.commit()
    return [f"{VOC}academics/teacher/{teacher_id}" for teacher_id in teacher_ids[:misuse_count]]


def set_mathsci_supervision_misuse(conn, misuse_count: int) -> list[str]:
    """Make selected supervision subjects non-graduate students for SA4 misuse."""
    if misuse_count == 0:
        return []

    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(
        """
        SELECT pid_student, MIN(pid_supervisor) AS pid_supervisor
        FROM supervision
        GROUP BY pid_student
        HAVING COUNT(*) = 1
        ORDER BY pid_student
        """
    )
    candidate_rows = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT DISTINCT pid_student FROM supervision ORDER BY pid_student")
    current_subjects = {row["pid_student"] for row in cursor.fetchall()}

    cursor.execute(
        """
        SELECT pid
        FROM person
        WHERE status NOT IN (2, 4)
        ORDER BY pid
        """
    )
    replacement_ids = [
        row["pid"]
        for row in cursor.fetchall()
        if row["pid"] not in current_subjects
    ]

    if len(candidate_rows) < misuse_count or len(replacement_ids) < misuse_count:
        raise RuntimeError("Not enough PostgreSQL rows for Is Supervised By misuse injection.")

    update_cursor = conn.cursor()
    expected_entities = []
    for row, replacement_id in zip(candidate_rows[:misuse_count], replacement_ids[:misuse_count]):
        update_cursor.execute(
            """
            UPDATE supervision
            SET pid_student = %s
            WHERE pid_student = %s AND pid_supervisor = %s
            """,
            (replacement_id, row["pid_student"], row["pid_supervisor"]),
        )
        expected_entities.append(f"{VOC}mathsci/person/{replacement_id}")
    conn.commit()
    return expected_entities
