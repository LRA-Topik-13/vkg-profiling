import pytest

from tests.accuracy.conftest import DEFECT_PCTS, defect_count
from tests.accuracy.property_value_conflict.conftest import (
    CROSS_PARAMS,
    CROSS_TOTAL_PAIRS,
    MYSQL_CROSS_PARAMS,
    MYSQL_CROSS_TOTAL_PAIRS,
    assert_pair_evidence,
    set_cross_source_faculty_member_pairs,
    set_cross_source_person_pairs,
)


@pytest.mark.parametrize("pct", DEFECT_PCTS)
def test_cross_source_person_identity_email_rows(pct, mssql_conn, pgsql_conn, client):
    n_defects = defect_count(CROSS_TOTAL_PAIRS, pct)
    expected_pairs = set_cross_source_person_pairs(
        mssql_conn,
        pgsql_conn,
        pair_count=CROSS_TOTAL_PAIRS,
        conflict_count=n_defects,
    )

    response = client.get(
        "/accuracy/value-conflict/cross-source/rows",
        params={**CROSS_PARAMS, "limit": 100, "offset": 0},
    )
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["returned_count"] == n_defects
    assert len(data["pairs"]) == n_defects
    assert_pair_evidence(data, expected_pairs)


@pytest.mark.parametrize("pct", DEFECT_PCTS)
def test_cross_source_faculty_member_mysql_identity_email_rows(pct, mysql_conn, mssql_conn, client):
    n_defects = defect_count(MYSQL_CROSS_TOTAL_PAIRS, pct)
    expected_pairs = set_cross_source_faculty_member_pairs(
        mysql_conn,
        mssql_conn,
        pair_count=MYSQL_CROSS_TOTAL_PAIRS,
        conflict_count=n_defects,
    )

    response = client.get(
        "/accuracy/value-conflict/cross-source/rows",
        params={**MYSQL_CROSS_PARAMS, "limit": 100, "offset": 0},
    )
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["returned_count"] == n_defects
    assert len(data["pairs"]) == n_defects
    assert_pair_evidence(data, expected_pairs)
