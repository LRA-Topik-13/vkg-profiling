import pytest

from tests.accuracy.conftest import (
    CLASS_PERSON,
    DEFECT_PCTS,
    PROP_BIRTH_DATE,
    PROP_EMAIL,
    PROP_FIRST_NAME,
    PROP_LAST_NAME,
    SOURCE_ACADEMICS,
    SOURCE_MATHSCI,
    defect_count,
    set_cross_source_person_pairs,
    set_intra_source_person_pairs,
)


IDENTITY_RULE = ",".join([PROP_FIRST_NAME, PROP_LAST_NAME, PROP_BIRTH_DATE])


def _assert_pair_evidence(rows_data: dict, expected_pairs: list[tuple[str, str]]) -> None:
    returned_pairs = {
        frozenset((row["e1"]["uri"], row["e2"]["uri"]))
        for row in rows_data["pairs"]
    }
    for left_uri, right_uri in expected_pairs:
        assert frozenset((left_uri, right_uri)) in returned_pairs


@pytest.mark.parametrize("pct", DEFECT_PCTS)
def test_cross_source_person_identity_email_conflict(pct, mssql_conn, pgsql_conn, client):
    total_pairs = 40
    n_defects = defect_count(total_pairs, pct)
    expected_pairs = set_cross_source_person_pairs(
        mssql_conn,
        pgsql_conn,
        pair_count=total_pairs,
        conflict_count=n_defects,
    )

    params = {
        "class_uri": CLASS_PERSON,
        "identity_props": IDENTITY_RULE,
        "target_prop": PROP_EMAIL,
        "sources": ",".join([SOURCE_ACADEMICS, SOURCE_MATHSCI]),
    }
    response = client.get("/accuracy/value-conflict/cross-source/summary", params=params)
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["total_matched"] == total_pairs
    assert data["conflicting_pairs"] == n_defects
    assert data["sa2_cross_score"] == round((1 - n_defects / total_pairs) * 100, 2)
    assert data["source_pair_summary"][0]["total_matched"] == total_pairs
    assert data["source_pair_summary"][0]["conflicting_pairs"] == n_defects

    if expected_pairs:
        rows_response = client.get(
            "/accuracy/value-conflict/cross-source/rows",
            params={**params, "limit": 100, "offset": 0},
        )
        assert rows_response.status_code == 200, rows_response.text
        rows_data = rows_response.json()
        assert rows_data["returned_count"] == n_defects
        _assert_pair_evidence(rows_data, expected_pairs)


@pytest.mark.parametrize("pct", DEFECT_PCTS)
def test_intra_source_person_identity_email_conflict(pct, mssql_conn, client):
    total_pairs = 20
    n_defects = defect_count(total_pairs, pct)
    expected_pairs = set_intra_source_person_pairs(
        mssql_conn,
        pair_count=total_pairs,
        conflict_count=n_defects,
    )

    params = {
        "class_uri": CLASS_PERSON,
        "identity_props": IDENTITY_RULE,
        "target_prop": PROP_EMAIL,
        "sources": SOURCE_ACADEMICS,
    }
    response = client.get("/accuracy/value-conflict/summary", params=params)
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["total_matched"] == total_pairs
    assert data["conflicting_pairs"] == n_defects
    assert data["sa2_score"] == round((1 - n_defects / total_pairs) * 100, 2)
    assert data["source_summary"][0]["total_matched"] == total_pairs
    assert data["source_summary"][0]["conflicting_pairs"] == n_defects

    if expected_pairs:
        rows_response = client.get(
            "/accuracy/value-conflict/rows",
            params={**params, "limit": 100, "offset": 0},
        )
        assert rows_response.status_code == 200, rows_response.text
        rows_data = rows_response.json()
        assert rows_data["returned_count"] == n_defects
        _assert_pair_evidence(rows_data, expected_pairs)

