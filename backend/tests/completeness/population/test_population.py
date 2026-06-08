import pytest

from tests.completeness.population.conftest import (
    POPULATION_TARGETS, UNFOLDABLE_TARGET, inject_population_defects,
)

ALL_CLASSES_URI = "urn:vkg:all-classes"


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("target", POPULATION_TARGETS, ids=[t["key"] for t in POPULATION_TARGETS])
def test_population_summary(target, pct, conns, client, population_baseline, detection):
    n, N = inject_population_defects(conns, target, pct)

    resp = client.get("/completeness/population")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["source_reachable"], f"Teiid unreachable: {data.get('source_error')}"

    uri = target["class_uri"]
    cls = {c["uri"]: c for c in data["classes"]}[uri]
    base = {c["uri"]: c for c in population_baseline["classes"]}[uri]
    tag = f"{target['key']} {pct}%"

    assert cls["represented"] == base["represented"], f"{tag}: represented changed"
    assert cls["source_population"] == base["source_population"] + n, \
        f"{tag}: expected source {base['source_population'] + n}, got {cls['source_population']}"
    assert cls["missing"] == (base["missing"] or 0) + n, \
        f"{tag}: expected missing {(base['missing'] or 0) + n}, got {cls['missing']}"
    expected_completeness = (
        round(cls["represented"] / cls["source_population"] * 100, 2)
        if cls["source_population"] else 100.0
    )
    assert cls["completeness"] == expected_completeness, f"{tag}: completeness mismatch"

    detection("population", pct, n, cls["missing"] - (base["missing"] or 0), N)


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
def test_population_unfoldable(pct, conns, client, population_baseline, detection):
    n, N = inject_population_defects(conns, UNFOLDABLE_TARGET, pct)

    resp = client.get("/completeness/population")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["source_reachable"], f"Teiid unreachable: {data.get('source_error')}"

    tag = f"alumni {pct}%"
    base = {c["uri"]: c for c in population_baseline["classes"]}
    for c in data["classes"]:
        if c["uri"] == ALL_CLASSES_URI or c["uri"] not in base:
            continue
        if c["source_population"] is not None:
            assert c["source_population"] == base[c["uri"]]["source_population"], \
                f"{tag}: class {c['class']} source changed (should not fold)"

    assert data["total_represented"] == population_baseline["total_represented"], \
        f"{tag}: represented changed"
    assert data["total_source_population"] == population_baseline["total_source_population"] + n, \
        f"{tag}: expected total source +{n}"

    detection("population/unfoldable", pct, n,
              data["total_source_population"] - population_baseline["total_source_population"], N)
