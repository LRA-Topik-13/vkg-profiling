import pytest

from tests.conciseness.cross_source.conftest import (
    ENTITY_CONFIG, ALL_SOURCES,
    SOURCE_COMPSCI, SOURCE_MATHSCI, SOURCE_ACADEMICS,
    inject_cross_source_defects,
)


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("entity", ["FacultyMember", "Course"])
def test_cross_source_duplicates(entity, pct, mysql_conn, pgsql_conn, mssql_conn, entity_totals, client):
    expected  = inject_cross_source_defects(mysql_conn, pgsql_conn, mssql_conn, entity, pct)
    cfg       = ENTITY_CONFIG[entity]
    n_defects = len(expected["groups"])

    resp = client.get(
        "/conciseness/cross-source/duplicates",
        params={
            "class_uri":      cfg["class_uri"],
            "identity_props": cfg["identity_props"],
            "sources":        ALL_SOURCES,
        },
    )
    assert resp.status_code == 200, resp.text

    data       = resp.json()
    pagination = data["pagination"]
    items      = data["items"]

    # ── Pagination ────────────────────────────────────────────────────────────
    assert pagination["total"] == n_defects, \
        f"{entity} {pct}%: expected {n_defects} ambiguous groups, got {pagination['total']}"
    assert pagination["count"] == len(items), \
        f"{entity} {pct}%: pagination.count != len(items)"

    if n_defects == 0:
        assert items == [], f"{entity} {pct}%: expected no items for 0 defects"
        return

    # ── Per-group shape ───────────────────────────────────────────────────────
    expected_keys = set(cfg["prop_local_names"])
    for i, item in enumerate(items):
        assert item["count"] == 3, \
            f"{entity} {pct}%: group {i} should have 3 entities (one per source), got {item['count']}"
        assert set(item["identity_values"].keys()) == expected_keys, \
            f"{entity} {pct}%: group {i} identity_values keys mismatch"
        assert len(item["entities"]) == 3, \
            f"{entity} {pct}%: group {i} should have 3 entity entries"

        # Each group must span all 3 sources
        sources_in_group = {e["source"] for e in item["entities"]}
        assert sources_in_group == {SOURCE_COMPSCI, SOURCE_MATHSCI, SOURCE_ACADEMICS}, \
            f"{entity} {pct}%: group {i} does not span all 3 sources: {sources_in_group}"

    # ── URI coverage ──────────────────────────────────────────────────────────
    # Every injected group's receiver URIs must appear in the response.
    all_response_uris = {e["uri"] for item in items for e in item["entities"]}

    for group in expected["groups"]:
        for src_name, rcv_cfg in cfg["receivers"].items():
            row_id       = group[f"{src_name}_id"]
            expected_uri = rcv_cfg["uri_template"].format(id=row_id)
            assert expected_uri in all_response_uris, \
                f"{entity} {pct}%: expected URI {expected_uri} not found in response"

    # ── No entity appears in more than one group ──────────────────────────────
    all_uris = [e["uri"] for item in items for e in item["entities"]]
    assert len(all_uris) == len(set(all_uris)), \
        f"{entity} {pct}%: same URI appears in multiple groups"
