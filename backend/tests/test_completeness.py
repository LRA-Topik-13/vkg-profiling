import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import completeness_router


def _binding(name: str, value: str):
    return {name: {"type": "literal", "value": value}}


def test_blank_nodes_route_is_not_registered():
    routes = {route.path for route in app.routes}
    assert "/completeness/blank-nodes" not in routes

    response = TestClient(app).get("/completeness/blank-nodes")
    assert response.status_code == 404


def test_mapping_coverage_uses_ontology_and_obda_metadata():
    data = completeness_router.mapping_coverage()

    assert data["classes"]["total"] > 0
    assert data["properties"]["total"] > 0
    assert data["classes"]["mapped"] > 0
    assert data["properties"]["mapped"] > 0
    assert 0 <= data["overall_coverage"] <= 100


@pytest.mark.asyncio
async def test_property_completeness_uses_metadata_property_uri(monkeypatch):
    async def fake_execute_sparql(query: str):
        if "foaf/0.1/firstName" in query:
            return {"results": {"bindings": [_binding("filled", "3")]}}
        return {"results": {"bindings": [_binding("total", "4")]}}

    monkeypatch.setattr(completeness_router, "execute_sparql", fake_execute_sparql)

    data = await completeness_router.completeness_by_property(
        class_name="FullProfessor",
        properties="firstName",
        filter_property=None,
        filter_value=None,
    )

    assert data["total_entities"] == 4
    assert data["properties"][0]["filled"] == 3
    assert data["properties"][0]["missing"] == 1
    assert data["properties"][0]["completeness"] == 75.0


@pytest.mark.asyncio
async def test_entity_count_for_selected_class(monkeypatch):
    async def fake_execute_sparql(query: str):
        assert "http://example.org/voc#Course" in query
        return {"results": {"bindings": [_binding("count", "16")]}}

    monkeypatch.setattr(completeness_router, "execute_sparql", fake_execute_sparql)

    data = await completeness_router.entity_count(class_name="Course")

    assert data["total"] == 16
    assert data["classes"] == [
        {"class": "Course", "uri": "http://example.org/voc#Course", "count": 16}
    ]


@pytest.mark.asyncio
async def test_undefined_objects_reports_range_gaps(monkeypatch):
    async def fake_execute_sparql(query: str):
        alias = "undefined" if "AS ?undefined" in query else "total"
        if "http://example.org/voc#isGivenAt" in query:
            value = "2"
        else:
            value = "0"
        return {"results": {"bindings": [_binding(alias, value)]}}

    monkeypatch.setattr(completeness_router, "execute_sparql", fake_execute_sparql)

    data = await completeness_router.undefined_objects(class_name="Course")
    is_given_at = next(p for p in data["properties"] if p["property"] == "isGivenAt")

    assert is_given_at["range"] == "http://example.org/voc#EducationalInstitution"
    assert is_given_at["total_objects"] == 2
    assert is_given_at["undefined_objects"] == 2
    assert is_given_at["ratio"] == 100.0
    assert data["summary"]["overall_ratio"] == 100.0


@pytest.mark.asyncio
async def test_interlinking_endpoint_handles_empty_results(monkeypatch):
    async def fake_execute_sparql(query: str):
        return {"results": {"bindings": []}}

    monkeypatch.setattr(completeness_router, "execute_sparql", fake_execute_sparql)

    data = await completeness_router.interlinking_completeness()

    assert "classes" in data
    assert data["overall_ratio"] == 0.0
