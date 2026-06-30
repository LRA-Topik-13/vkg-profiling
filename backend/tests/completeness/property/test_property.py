import pytest

from tests.completeness.property.conftest import PROPERTY_TARGETS, inject_property_defects

CASES = [(c, p) for c, props in PROPERTY_TARGETS.items() for p in props]


def _case_id(case):
    cls, prop = case
    return f"{cls.split('#')[-1]}.{prop.split('#')[-1].split('/')[-1]}"


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("class_uri,prop_uri", CASES, ids=[_case_id(c) for c in CASES])
def test_by_property(class_uri, prop_uri, pct, conns, client, detection):
    n, base_n, _ = inject_property_defects(conns, class_uri, prop_uri, pct)

    resp = client.get(
        "/completeness/property/class-matrix",
        params={"class_uri": class_uri, "properties": prop_uri},
    )
    assert resp.status_code == 200, resp.text
    summary = resp.json()["summary"]

    total = summary["total_entities"]
    by_uri = {p["property"]: p for p in summary["by_property"]}
    assert prop_uri in by_uri, f"{prop_uri} missing from response"
    entry = by_uri[prop_uri]

    tag = f"{class_uri.split('#')[-1]}.{prop_uri.split('#')[-1]} {pct}%"
    assert entry["missing"] == n, f"{tag}: expected {n} missing, got {entry['missing']}"
    assert entry["filled"] == total - n, f"{tag}: filled mismatch"
    expected_completeness = round((total - n) / total * 100, 2) if total else 0.0
    assert entry["completeness"] == expected_completeness, f"{tag}: completeness mismatch"

    detection("property", pct, n, entry["missing"], base_n)
