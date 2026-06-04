import pytest

from tests.accuracy.conftest import (
    DEFECT_PCTS,
    PROP_IS_SUPERVISED_BY,
    PROP_TEACHES,
    defect_count,
    set_academics_teaches_misuse,
    set_mathsci_supervision_misuse,
)


def _misuse_entity_uris(data: dict) -> set[str]:
    return {
        uri
        for row in data["classes"]
        if not row["expected"]
        for uri in row["entity_uris"]
    }


def _assert_sampled_misuse_evidence(data: dict, expected_entities: list[str]) -> None:
    """Assert that limited misuse evidence rows come from injected entities."""
    evidence = _misuse_entity_uris(data)
    expected_set = set(expected_entities)
    assert evidence
    assert evidence.issubset(expected_set)


@pytest.mark.parametrize("pct", DEFECT_PCTS)
def test_property_misuse_teaches_from_academics_mapping(pct, mssql_conn, client):
    total_property_uses = 130
    n_defects = defect_count(total_property_uses, pct)
    expected_entities = set_academics_teaches_misuse(mssql_conn, n_defects)

    response = client.get(
        "/accuracy/property-misuse/by-property",
        params={"property_uri": PROP_TEACHES},
    )
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["total_property_uses"] == total_property_uses
    assert data["total_misuse_count"] == n_defects
    assert data["total_expected_count"] == total_property_uses - n_defects
    assert data["sa4_score"] == round((total_property_uses - n_defects) / total_property_uses * 100, 2)

    if expected_entities:
        _assert_sampled_misuse_evidence(data, expected_entities)


@pytest.mark.parametrize("pct", DEFECT_PCTS)
def test_property_misuse_is_supervised_by_from_mathsci_mapping(pct, pgsql_conn, client):
    total_property_uses = 120
    n_defects = defect_count(total_property_uses, pct)
    expected_entities = set_mathsci_supervision_misuse(pgsql_conn, n_defects)

    response = client.get(
        "/accuracy/property-misuse/by-property",
        params={"property_uri": PROP_IS_SUPERVISED_BY},
    )
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["total_property_uses"] == total_property_uses
    assert data["total_misuse_count"] == n_defects
    assert data["total_expected_count"] == total_property_uses - n_defects
    assert data["sa4_score"] == round((total_property_uses - n_defects) / total_property_uses * 100, 2)

    if expected_entities:
        _assert_sampled_misuse_evidence(data, expected_entities)
