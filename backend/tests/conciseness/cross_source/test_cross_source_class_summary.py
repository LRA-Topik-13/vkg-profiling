import pytest

from tests.conciseness.cross_source.conftest import (
    ENTITY_CONFIG, inject_cross_source_defects,
)


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("entity", ["FacultyMember", "Course"])
def test_cross_source_class_summary(entity, pct, mysql_conn, pgsql_conn, mssql_conn, entity_totals, client):
    cfg       = ENTITY_CONFIG[entity]
    total     = entity_totals[entity]
    expected  = inject_cross_source_defects(mysql_conn, pgsql_conn, mssql_conn, entity, pct, total)
    ambiguous = expected["ambiguous_instances"]
    expected_cn3 = round((1 - ambiguous / total) * 100, 2) if total else 100.0

    resp = client.get("/conciseness/cross-source/class-summary")
    assert resp.status_code == 200, resp.text

    data = resp.json()
    entry = next((c for c in data["classes"] if c["uri"] == cfg["class_uri"]), None)
    assert entry is not None, \
        f"{entity} {pct}%: class {cfg['class_uri']} not found in summary response"

    assert entry["total_entities"]      == total, \
        f"{entity} {pct}%: total_entities mismatch"
    assert entry["ambiguous_instances"] == ambiguous, \
        f"{entity} {pct}%: ambiguous_instances mismatch"
    assert entry["cn3_score"]           == expected_cn3, \
        f"{entity} {pct}%: cn3_score mismatch"
