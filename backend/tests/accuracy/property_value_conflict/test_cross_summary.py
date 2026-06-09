import pytest

from tests.accuracy.conftest import DEFECT_PCTS, defect_count
from tests.accuracy.property_value_conflict.conftest import (
    CROSS_PARAMS,
    CROSS_TOTAL_PAIRS,
    MYSQL_CROSS_PARAMS,
    MYSQL_CROSS_TOTAL_PAIRS,
    set_cross_source_faculty_member_pairs,
    set_cross_source_person_pairs,
)


@pytest.mark.parametrize("pct", DEFECT_PCTS)
def test_cross_source_person_identity_email_summary(pct, mssql_conn, pgsql_conn, client, detection):
    n_defects = defect_count(CROSS_TOTAL_PAIRS, pct)
    set_cross_source_person_pairs(
        mssql_conn,
        pgsql_conn,
        pair_count=CROSS_TOTAL_PAIRS,
        conflict_count=n_defects,
    )

    response = client.get("/accuracy/value-conflict/cross-source/summary", params=CROSS_PARAMS)
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["total_matched"] == CROSS_TOTAL_PAIRS
    assert data["conflicting_pairs"] == n_defects
    assert data["property_value_conflict_score"] == round((1 - n_defects / CROSS_TOTAL_PAIRS) * 100, 2)
    assert data["source_pair_summary"][0]["total_matched"] == CROSS_TOTAL_PAIRS
    assert data["source_pair_summary"][0]["conflicting_pairs"] == n_defects
    detection("pvc-cross-person-sum", pct, n_defects, data["conflicting_pairs"], CROSS_TOTAL_PAIRS)


@pytest.mark.parametrize("pct", DEFECT_PCTS)
def test_cross_source_faculty_member_mysql_identity_email_summary(pct, mysql_conn, mssql_conn, client, detection):
    n_defects = defect_count(MYSQL_CROSS_TOTAL_PAIRS, pct)
    set_cross_source_faculty_member_pairs(
        mysql_conn,
        mssql_conn,
        pair_count=MYSQL_CROSS_TOTAL_PAIRS,
        conflict_count=n_defects,
    )

    response = client.get("/accuracy/value-conflict/cross-source/summary", params=MYSQL_CROSS_PARAMS)
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["total_matched"] == MYSQL_CROSS_TOTAL_PAIRS
    assert data["conflicting_pairs"] == n_defects
    assert data["property_value_conflict_score"] == round((1 - n_defects / MYSQL_CROSS_TOTAL_PAIRS) * 100, 2)
    assert data["source_pair_summary"][0]["total_matched"] == MYSQL_CROSS_TOTAL_PAIRS
    assert data["source_pair_summary"][0]["conflicting_pairs"] == n_defects
    detection("pvc-cross-mysql-sum", pct, n_defects, data["conflicting_pairs"], MYSQL_CROSS_TOTAL_PAIRS)
