import pytest

from tests.completeness.property.conftest import inject_property_defects

VOC = "http://example.org/voc#"
SCHEMA = "http://schema.org/"
CASES = [(f"{VOC}Student", f"{SCHEMA}email")]


def _case_id(case):
    cls, prop = case
    return f"{cls.split('#')[-1]}.{prop.split('#')[-1].split('/')[-1]}"


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("class_uri,prop_uri", CASES, ids=[_case_id(c) for c in CASES])
def test_property_detail(class_uri, prop_uri, pct, conns, client, detection):
    n, base_n, _ = inject_property_defects(conns, class_uri, prop_uri, pct)

    resp = client.get("/completeness/property")
    assert resp.status_code == 200, resp.text
    cls_entry = {c["uri"]: c for c in resp.json()["classes"]}[class_uri]
    by_uri = {p["uri"]: p for p in cls_entry["by_property"]}
    assert prop_uri in by_uri, f"{prop_uri} missing from /property response"
    entry = by_uri[prop_uri]

    total = cls_entry["total_entities"]
    tag = f"{_case_id((class_uri, prop_uri))} {pct}%"
    assert entry["missing"] == n, f"{tag}: expected {n} missing, got {entry['missing']}"
    assert entry["filled"] == total - n, f"{tag}: filled mismatch"
    expected = round((total - n) / total * 100, 2) if total else 0.0
    assert entry["completeness"] == expected, f"{tag}: completeness mismatch"

    detection("property-detail", pct, n, entry["missing"], base_n)
