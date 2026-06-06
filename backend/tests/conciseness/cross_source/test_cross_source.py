import pytest

from tests.conciseness.cross_source.conftest import (
    ENTITY_CONFIG, ALL_SOURCES, inject_cross_source_defects,
)

_ABBREV = {"FacultyMember": "Faculty", "Course": "Course"}


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("entity", ["FacultyMember", "Course"])
def test_cross_source_conciseness(entity, pct, mysql_conn, pgsql_conn, mssql_conn, entity_totals, client, detection):
    expected  = inject_cross_source_defects(mysql_conn, pgsql_conn, mssql_conn, entity, pct)
    cfg       = ENTITY_CONFIG[entity]
    total     = entity_totals[entity]
    ambiguous = expected["ambiguous_instances"]
    n_defects = len(expected["groups"])
    expected_cn3 = round((1 - ambiguous / total) * 100, 2) if total else 100.0

    resp = client.get(
        "/conciseness/cross-source",
        params={
            "class_uri":      cfg["class_uri"],
            "identity_props": cfg["identity_props"],
            "sources":        ALL_SOURCES,
        },
    )
    assert resp.status_code == 200, resp.text

    data = resp.json()
    assert data["total_entities"]      == total, \
        f"{entity} {pct}%: total_entities mismatch"
    assert data["ambiguous_instances"] == ambiguous, \
        f"{entity} {pct}%: ambiguous_instances mismatch"
    assert data["cn3_score"]           == expected_cn3, \
        f"{entity} {pct}%: cn3_score mismatch"

    # detected groups = ambiguous_instances / 3 (each group spans exactly 3 sources)
    detected = data["ambiguous_instances"] // 3
    detection(f"cross-source/{_ABBREV[entity]}", pct, n_defects, detected, total)
