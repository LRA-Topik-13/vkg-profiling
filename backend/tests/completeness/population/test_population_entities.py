import pytest

from tests.completeness.population.conftest import POPULATION_TARGETS, inject_population_defects

ALL_CLASSES_URI = "urn:vkg:all-classes"
ENTITIES_TARGETS = [t for t in POPULATION_TARGETS if t["key"] == "student_unmapped"]


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("target", ENTITIES_TARGETS, ids=[t["key"] for t in ENTITIES_TARGETS])
def test_population_entities_excludes_unmapped(target, pct, conns, client, population_baseline, detection):
    n, N = inject_population_defects(conns, target, pct)
    uri = target["class_uri"]
    base = {c["uri"]: c for c in population_baseline["classes"]}[uri]

    resp = client.get(
        "/completeness/population/entities",
        params={"class_uri": uri, "limit": 1, "include_total": True},
    )
    assert resp.status_code == 200, resp.text
    total = resp.json()["pagination"]["total"]

    tag = f"{target['key']} {pct}%"
    assert total == base["represented"], \
        f"{tag}: represented listing changed ({total} != {base['represented']}); unmapped rows leaked"

    detection("population-entities", pct, n, n, N)


def test_population_entities_all_classes(client, population_baseline):
    resp = client.get(
        "/completeness/population/entities",
        params={"class_uri": ALL_CLASSES_URI, "limit": 5, "include_total": True},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    total = data["pagination"]["total"]

    max_single = max(
        c["represented"] for c in population_baseline["classes"] if c["uri"] != ALL_CLASSES_URI
    )
    assert total >= max_single
    assert total > 0
    assert len(data["entities"]) <= 5

    miss = client.get(
        "/completeness/population/entities",
        params={"class_uri": ALL_CLASSES_URI, "q": "zzzznomatch", "include_total": True},
    ).json()
    assert miss["pagination"]["total"] == 0
