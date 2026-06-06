import pytest

from tests.conciseness.intra_source.conftest import ENTITY_CONFIG, SOURCE_ACADEMICS, inject_defects


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("entity", ["TimeSlot", "Place"])
def test_intra_source_class_summary(entity, pct, db_conn, client):
    expected = inject_defects(db_conn, entity, pct)
    cfg = ENTITY_CONFIG[entity]

    resp = client.get(
        "/conciseness/intra-source/class-summary",
        params={"source_prefix": SOURCE_ACADEMICS},
    )
    assert resp.status_code == 200, resp.text

    data = resp.json()
    entry = next((c for c in data["classes"] if c["uri"] == cfg["class_uri"]), None)
    assert entry is not None, \
        f"{entity} {pct}%: class {cfg['class_uri']} not found in summary response"

    assert entry["total_representations"] == expected["total_representations"], \
        f"{entity} {pct}%: total_representations mismatch"
    assert entry["unique_instances"]      == expected["unique_instances"], \
        f"{entity} {pct}%: unique_instances mismatch"
    assert entry["violating_instances"]   == expected["violating_instances"], \
        f"{entity} {pct}%: violating_instances mismatch"
    assert entry["score_f1"]              == expected["score_f1"], \
        f"{entity} {pct}%: score_f1 mismatch"
    assert entry["score_f2"]              == expected["score_f2"], \
        f"{entity} {pct}%: score_f2 mismatch"
    assert entry["passed"]                == expected["passed"], \
        f"{entity} {pct}%: passed mismatch"
