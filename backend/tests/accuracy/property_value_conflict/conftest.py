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

INTRA_TOTAL_PAIRS = 20
CROSS_TOTAL_PAIRS = 40
MYSQL_CROSS_TOTAL_PAIRS = 14

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


def assert_pair_evidence(rows_data: dict, expected_pairs: list[tuple[str, str]]) -> None:
    """Assert that all injected conflict pairs are present in row evidence."""
    returned_pairs = {
        frozenset((row["e1"]["uri"], row["e2"]["uri"]))
        for row in rows_data["pairs"]
    }
    for left_uri, right_uri in expected_pairs:
        assert frozenset((left_uri, right_uri)) in returned_pairs
