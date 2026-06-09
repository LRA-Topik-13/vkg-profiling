import psycopg2.extras
import pytest

from tests.accuracy.conftest import PROP_IS_SUPERVISED_BY, PROP_TEACHES, VOC


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
    """Make selected supervision subjects non-graduate students for property misuse."""
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


def misuse_entity_uris(data: dict) -> set[str]:
    """Return sampled misuse entity URIs from a Property Misuse response."""
    return {
        uri
        for row in data["classes"]
        if not row["expected"]
        for uri in row["entity_uris"]
    }


def assert_sampled_misuse_evidence(data: dict, expected_entities: list[str]) -> None:
    """Assert that limited misuse evidence rows come from injected entities."""
    evidence = misuse_entity_uris(data)
    expected_set = set(expected_entities)
    assert evidence
    assert evidence.issubset(expected_set)


@pytest.fixture(params=[
    {
        "id": "teaches_academics",
        "property_uri": PROP_TEACHES,
        "total_property_uses": 130,
        "injector": set_academics_teaches_misuse,
        "connection_fixture": "mssql_conn",
    },
    {
        "id": "is_supervised_by_mathsci",
        "property_uri": PROP_IS_SUPERVISED_BY,
        "total_property_uses": 120,
        "injector": set_mathsci_supervision_misuse,
        "connection_fixture": "pgsql_conn",
    },
], ids=lambda scenario: scenario["id"])
def property_misuse_scenario(request):
    """Return one Property Misuse endpoint scenario."""
    return request.param
