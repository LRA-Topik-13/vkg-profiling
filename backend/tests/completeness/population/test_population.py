import pytest

from tests.completeness.population.conftest import (
    POPULATION_TARGETS, inject_population_defects,
)


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("target", POPULATION_TARGETS, ids=[t["key"] for t in POPULATION_TARGETS])
def test_population_summary(target, pct, conns, client, population_baseline, detection):
    n, N = inject_population_defects(conns, target, pct)

    resp = client.get("/completeness/population")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["source_reachable"], f"Teiid unreachable: {data.get('source_error')}"

    cls = {c["uri"]: c for c in data["classes"]}[target["class_uri"]]
    base = population_baseline[target["class_uri"]]
    rep = base["represented"]
    exp_source = base["source_population"] + n

    tag = f"{target['key']} {pct}%"
    assert cls["represented"] == rep, f"{tag}: represented changed"
    assert cls["source_population"] == exp_source, \
        f"{tag}: expected source {exp_source}, got {cls['source_population']}"
    assert cls["missing"] == base["missing"] + n, \
        f"{tag}: expected missing {base['missing'] + n}, got {cls['missing']}"
    expected_completeness = round(rep / exp_source * 100, 2) if exp_source else 100.0
    assert cls["completeness"] == expected_completeness, f"{tag}: completeness mismatch"

    detection("population", pct, n, cls["missing"] - base["missing"], N)
