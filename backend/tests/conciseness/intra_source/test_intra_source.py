import pytest

from tests.conciseness.intra_source.conftest import ENTITY_CONFIG, SOURCE_ACADEMICS, inject_defects


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("entity", ["TimeSlot", "Place"])
def test_intra_source_conciseness(entity, pct, db_conn, client):
    expected = inject_defects(db_conn, entity, pct)
    cfg = ENTITY_CONFIG[entity]

    resp = client.get(
        "/conciseness/intra-source",
        params={
            "class_uri":      cfg["class_uri"],
            "identity_props": cfg["identity_props"],
            "source_prefix":  SOURCE_ACADEMICS,
        },
    )
    assert resp.status_code == 200, resp.text

    data = resp.json()
    assert data["total_representations"] == expected["total_representations"], \
        f"{entity} {pct}%: total mismatch"
    assert data["unique_instances"]      == expected["unique_instances"], \
        f"{entity} {pct}%: unique mismatch"
    assert data["violating_instances"]   == expected["violating_instances"], \
        f"{entity} {pct}%: violating mismatch"
    assert data["score_f1"]              == expected["score_f1"], \
        f"{entity} {pct}%: f1 mismatch"
    assert data["score_f2"]              == expected["score_f2"], \
        f"{entity} {pct}%: f2 mismatch"
    assert data["passed"]                == expected["passed"], \
        f"{entity} {pct}%: passed mismatch"
