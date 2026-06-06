import pytest

from tests.conciseness.intra_source.conftest import ENTITY_CONFIG, SOURCE_ACADEMICS, inject_defects


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("entity", ["TimeSlot", "Place"])
def test_intra_source_duplicates(entity, pct, db_conn, client, detection):
    expected = inject_defects(db_conn, entity, pct)
    cfg = ENTITY_CONFIG[entity]
    N         = expected["total_representations"]
    n_defects = len(expected["groups"])

    resp = client.get(
        "/conciseness/intra-source/duplicates",
        params={
            "class_uri":      cfg["class_uri"],
            "identity_props": cfg["identity_props"],
            "source_prefix":  SOURCE_ACADEMICS,
        },
    )
    assert resp.status_code == 200, resp.text

    data       = resp.json()
    pagination = data["pagination"]
    items      = data["items"]

    # ── Pagination ────────────────────────────────────────────────────────────
    assert pagination["total"] == n_defects, \
        f"{entity} {pct}%: expected {n_defects} duplicate groups, got {pagination['total']}"
    assert pagination["count"] == len(items), \
        f"{entity} {pct}%: pagination.count != len(items)"

    if n_defects == 0:
        assert items == [], f"{entity} {pct}%: expected no items for 0 defects"
        detection(f"intra-source/dups/{entity}", pct, 0, 0, N)
        return

    # ── Per-group shape ───────────────────────────────────────────────────────
    expected_keys = set(cfg["prop_local_names"])
    for i, item in enumerate(items):
        assert item["count"] == 2, \
            f"{entity} {pct}%: group {i} count should be 2, got {item['count']}"
        assert set(item["identity_values"].keys()) == expected_keys, \
            f"{entity} {pct}%: group {i} identity_values keys mismatch"
        assert len(item["uris"]) == 2, \
            f"{entity} {pct}%: group {i} should have 2 URIs, got {len(item['uris'])}"

    # ── URI coverage ──────────────────────────────────────────────────────────
    all_returned_uri_pairs = [frozenset(item["uris"]) for item in items]
    uri_tmpl = cfg["uri_template"]

    for group in expected["groups"]:
        expected_pair = frozenset([
            uri_tmpl.format(id=group["template_id"]),
            uri_tmpl.format(id=group["target_id"]),
        ])
        assert expected_pair in all_returned_uri_pairs, (
            f"{entity} {pct}%: injected pair "
            f"{group['template_id']}↔{group['target_id']} not found in response"
        )

    # ── No URI appears in more than one group ─────────────────────────────────
    all_uris = [uri for item in items for uri in item["uris"]]
    assert len(all_uris) == len(set(all_uris)), \
        f"{entity} {pct}%: same URI appears in multiple groups"

    detection(f"intra-source/dups/{entity}", pct, n_defects, pagination["total"], N)
