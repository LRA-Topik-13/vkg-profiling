import pytest

from tests.accuracy.conftest import DEFECT_PCTS, defect_count
from tests.accuracy.property_value_conflict.conftest import (
    INTRA_PARAMS,
    INTRA_TOTAL_PAIRS,
    set_intra_source_person_pairs,
)


@pytest.mark.parametrize("pct", DEFECT_PCTS)
def test_intra_source_person_identity_email_summary(pct, mssql_conn, client):
    n_defects = defect_count(INTRA_TOTAL_PAIRS, pct)
    set_intra_source_person_pairs(
        mssql_conn,
        pair_count=INTRA_TOTAL_PAIRS,
        conflict_count=n_defects,
    )

    response = client.get("/accuracy/value-conflict/summary", params=INTRA_PARAMS)
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["total_matched"] == INTRA_TOTAL_PAIRS
    assert data["conflicting_pairs"] == n_defects
    assert data["sa2_score"] == round((1 - n_defects / INTRA_TOTAL_PAIRS) * 100, 2)
    assert data["source_summary"][0]["total_matched"] == INTRA_TOTAL_PAIRS
    assert data["source_summary"][0]["conflicting_pairs"] == n_defects
