import pytest

from tests.accuracy.conftest import (
    CLASS_FULL_PROFESSOR,
    DEFECT_PCTS,
    PROP_TEACHES,
    academics_full_professor_ids,
    add_extra_teaches_relationships,
    defect_count,
)


@pytest.mark.parametrize("pct", DEFECT_PCTS)
def test_relationship_count_full_professor_teaches(pct, mssql_conn, client):
    total_full_professors = 38
    n_defects = defect_count(total_full_professors, pct)
    selected_ids = academics_full_professor_ids(mssql_conn)[:n_defects]
    add_extra_teaches_relationships(mssql_conn, selected_ids)

    response = client.get(
        "/accuracy/outliers",
        params={
            "class_uri": CLASS_FULL_PROFESSOR,
            "property_uri": PROP_TEACHES,
        },
    )
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["type"] == "relationship_count"
    assert data["total"] == total_full_professors
    assert data["outlier_count"] == n_defects
    assert data["statistics"]["upper_fence"] == 1.0

    entities = {row["uri"]: row for row in data["entities"]}
    for teacher_id in selected_ids:
        uri = f"http://example.org/voc#academics/teacher/{teacher_id}"
        assert uri in entities
        assert entities[uri]["count"] == 4
        assert entities[uri]["is_outlier"] is True

