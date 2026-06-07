import pytest

from tests.accuracy.conftest import DEFECT_PCTS, defect_count
from tests.accuracy.property_misuse.conftest import assert_sampled_misuse_evidence


@pytest.mark.parametrize("pct", DEFECT_PCTS)
def test_property_misuse_by_property(pct, property_misuse_scenario, request, client):
    total_property_uses = property_misuse_scenario["total_property_uses"]
    n_defects = defect_count(total_property_uses, pct)
    conn = request.getfixturevalue(property_misuse_scenario["connection_fixture"])
    expected_entities = property_misuse_scenario["injector"](conn, n_defects)

    response = client.get(
        "/accuracy/property-misuse/by-property",
        params={"property_uri": property_misuse_scenario["property_uri"]},
    )
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["total_property_uses"] == total_property_uses
    assert data["total_misuse_count"] == n_defects
    assert data["total_expected_count"] == total_property_uses - n_defects
    assert data["property_misuse_score"] == round((total_property_uses - n_defects) / total_property_uses * 100, 2)

    if expected_entities:
        assert_sampled_misuse_evidence(data, expected_entities)
