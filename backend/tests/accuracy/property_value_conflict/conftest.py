from datetime import date

from tests.accuracy.conftest import (
    CLASS_FACULTY_MEMBER,
    CLASS_PERSON,
    PROP_BIRTH_DATE,
    PROP_EMAIL,
    PROP_FIRST_NAME,
    PROP_LAST_NAME,
    SOURCE_ACADEMICS,
    SOURCE_COMPSCI,
    SOURCE_MATHSCI,
    VOC,
)


IDENTITY_RULE = ",".join([PROP_FIRST_NAME, PROP_LAST_NAME, PROP_BIRTH_DATE])

INTRA_TOTAL_PAIRS = 40
CROSS_TOTAL_PAIRS = 80
MYSQL_CROSS_TOTAL_PAIRS = 14

INTRA_CLEAN_GROUPS_BY_PAIR_COUNT = {
    40: [9, 3, 2],
    39: [9, 3],
    38: [9, 2, 2],
    36: [9],
    32: [8, 3, 2],
}


def synthetic_birth_date(year: int, idx: int) -> date:
    """Return a deterministic valid date for generated value-conflict rows."""
    return date(year, 1, ((idx - 1) % 28) + 1)


INTRA_PARAMS = {
    "class_uri": CLASS_PERSON,
    "identity_props": IDENTITY_RULE,
    "target_prop": PROP_EMAIL,
    "sources": SOURCE_ACADEMICS,
}

CROSS_PARAMS = {
    "class_uri": CLASS_PERSON,
    "identity_props": IDENTITY_RULE,
    "target_prop": PROP_EMAIL,
    "sources": ",".join([SOURCE_ACADEMICS, SOURCE_MATHSCI]),
}

MYSQL_CROSS_PARAMS = {
    "class_uri": CLASS_FACULTY_MEMBER,
    "identity_props": IDENTITY_RULE,
    "target_prop": PROP_EMAIL,
    "sources": ",".join([SOURCE_COMPSCI, SOURCE_ACADEMICS]),
}


def set_cross_source_person_pairs(
    mssql_conn,
    pgsql_conn,
    pair_count: int,
    conflict_count: int,
) -> list[tuple[str, str]]:
    """Create deterministic academics-mathsci Person pairs for cross-source value-conflict checks."""
    mssql_cursor = mssql_conn.cursor()
    pg_cursor = pgsql_conn.cursor()
    expected_pairs = []
    if pair_count % 2 != 0:
        raise ValueError("Cross-source Person pair count must be even.")
    group_count = pair_count // 2
    for idx in range(1, group_count + 1):
        left_pid = idx * 2 - 1
        right_pid = idx * 2
        first_name = f"AccuracyCross{idx:03d}"
        last_name = f"Person{idx:03d}"
        birth_date = synthetic_birth_date(1990, idx)
        clean_email = f"accuracy-cross-{idx:03d}@example.edu"
        academics_email = clean_email
        mathsci_left_email = (
            f"accuracy-cross-{idx:03d}-conflict@example.edu"
            if idx <= conflict_count
            else clean_email
        )
        mathsci_right_email = clean_email
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
            (first_name, last_name, birth_date, mathsci_left_email, left_pid),
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
            (first_name, last_name, birth_date, mathsci_right_email, right_pid),
        )
        if idx <= conflict_count:
            expected_pairs.append((
                f"{VOC}academics/teacher/{idx}",
                f"{VOC}mathsci/person/{left_pid}",
            ))
    mssql_conn.commit()
    pgsql_conn.commit()
    return expected_pairs


def set_cross_source_faculty_member_pairs(
    mysql_conn,
    mssql_conn,
    pair_count: int,
    conflict_count: int,
) -> list[tuple[str, str]]:
    """Create deterministic compsci-academics FacultyMember pairs for cross-source value-conflict checks."""
    mysql_cursor = mysql_conn.cursor()
    mssql_cursor = mssql_conn.cursor()
    expected_pairs = []
    for idx in range(1, pair_count + 1):
        first_name = f"AccuracyMysql{idx:03d}"
        last_name = f"Faculty{idx:03d}"
        birth_date = date(1980, 2, idx)
        clean_email = f"accuracy-mysql-{idx:03d}@example.edu"
        compsci_email = clean_email
        academics_email = (
            f"accuracy-mysql-{idx:03d}-conflict@example.edu"
            if idx <= conflict_count
            else clean_email
        )
        mysql_cursor.execute(
            """
            UPDATE academic
            SET first_name = %s,
                last_name = %s,
                birth_date = %s,
                email = %s
            WHERE a_id = %s
            """,
            (first_name, last_name, birth_date, compsci_email, idx),
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
        if idx <= conflict_count:
            expected_pairs.append((
                f"{VOC}compsci/academic/{idx}",
                f"{VOC}academics/teacher/{idx}",
            ))
    mysql_conn.commit()
    mssql_conn.commit()
    return expected_pairs


def set_intra_source_person_pairs(
    conn,
    pair_count: int,
    conflict_count: int,
) -> list[tuple[str, str]]:
    """Create deterministic same-source academics Person pairs for intra-source value-conflict checks."""
    clean_pair_count = pair_count - conflict_count
    clean_group_sizes = INTRA_CLEAN_GROUPS_BY_PAIR_COUNT.get(clean_pair_count)
    if clean_group_sizes is None:
        raise ValueError(f"No clean group layout for {clean_pair_count} non-conflicting pairs.")

    cursor = conn.cursor()
    expected_pairs = []
    next_teacher_id = 1
    for pair_idx in range(1, conflict_count + 1):
        left_id = pair_idx * 2 - 1
        right_id = pair_idx * 2
        first_name = f"AccuracyIntra{pair_idx:03d}"
        last_name = f"Person{pair_idx:03d}"
        birth_date = synthetic_birth_date(1991, pair_idx)
        clean_email = f"accuracy-intra-{pair_idx:03d}@example.edu"
        right_email = f"accuracy-intra-{pair_idx:03d}-conflict@example.edu"
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
        expected_pairs.append((
            f"{VOC}academics/teacher/{left_id}",
            f"{VOC}academics/teacher/{right_id}",
        ))
        next_teacher_id = right_id + 1

    for group_idx, group_size in enumerate(clean_group_sizes, start=1):
        first_name = f"AccuracyIntraClean{group_idx:03d}"
        last_name = f"PersonClean{group_idx:03d}"
        birth_date = synthetic_birth_date(1992, group_idx)
        email = f"accuracy-intra-clean-{group_idx:03d}@example.edu"
        for teacher_id in range(next_teacher_id, next_teacher_id + group_size):
            cursor.execute(
                """
                UPDATE teacher
                SET first_name = %s,
                    last_name = %s,
                    birth_date = %s,
                    email = %s
                WHERE t_id = %s
                """,
                (first_name, last_name, birth_date, email, teacher_id),
            )
        next_teacher_id += group_size

    for teacher_id in range(next_teacher_id, 41):
        cursor.execute(
            """
            UPDATE teacher
            SET first_name = %s,
                last_name = %s,
                birth_date = %s,
                email = %s
            WHERE t_id = %s
            """,
            (
                f"AccuracyIntraUnique{teacher_id:03d}",
                f"PersonUnique{teacher_id:03d}",
                synthetic_birth_date(1993, teacher_id),
                f"accuracy-intra-unique-{teacher_id:03d}@example.edu",
                teacher_id,
            ),
        )
    conn.commit()
    return expected_pairs


def assert_pair_evidence(rows_data: dict, expected_pairs: list[tuple[str, str]]) -> None:
    """Assert that all injected conflict pairs are present in row evidence."""
    returned_pairs = {
        frozenset((row["e1"]["uri"], row["e2"]["uri"]))
        for row in rows_data["pairs"]
    }
    for left_uri, right_uri in expected_pairs:
        assert frozenset((left_uri, right_uri)) in returned_pairs
