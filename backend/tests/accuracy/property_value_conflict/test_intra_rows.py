import pytest

from tests.accuracy.conftest import DEFECT_PCTS, defect_count
from tests.accuracy.property_value_conflict.conftest import (
    INTRA_PARAMS,
    INTRA_TOTAL_PAIRS,
    assert_pair_evidence,
    set_intra_source_person_pairs,
)


@pytest.mark.parametrize("pct", DEFECT_PCTS)
def test_intra_source_person_identity_email_rows(pct, mssql_conn, client):
    n_defects = defect_count(INTRA_TOTAL_PAIRS, pct)
    expected_pairs = set_intra_source_person_pairs(
        mssql_conn,
        pair_count=INTRA_TOTAL_PAIRS,
        conflict_count=n_defects,
    )

    response = client.get(
        "/accuracy/value-conflict/rows",
        params={**INTRA_PARAMS, "limit": 100, "offset": 0},
    )
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["returned_count"] == n_defects
    assert len(data["pairs"]) == n_defects
    assert_pair_evidence(data, expected_pairs)
