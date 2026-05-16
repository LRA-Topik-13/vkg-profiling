import pytest
from fastapi import HTTPException
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


def test_filter_clause_accepts_prefixed_facet_values():
    clause = completeness_router.build_filter_clause(
        "isGivenAt",
        ":uni3/university",
        "Course",
    )

    assert "<http://example.org/voc#isGivenAt>" in clause
    assert "<http://example.org/voc#uni3/university>" in clause


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
async def test_property_completeness_groups_property_counts(monkeypatch):
    queries = []

    async def fake_execute_sparql(query: str):
        queries.append(query)
        if "COUNT(DISTINCT ?entity) AS ?total" in query:
            return {"results": {"bindings": [_binding("total", "10")]}}
        assert "GROUP BY ?prop" in query
        assert "foaf/0.1/firstName" in query
        assert "foaf/0.1/lastName" in query
        return {
            "results": {
                "bindings": [
                    {
                        "prop": {"type": "uri", "value": "http://xmlns.com/foaf/0.1/firstName"},
                        "filled": {"type": "literal", "value": "7"},
                    },
                    {
                        "prop": {"type": "uri", "value": "http://xmlns.com/foaf/0.1/lastName"},
                        "filled": {"type": "literal", "value": "5"},
                    },
                ]
            }
        }

    monkeypatch.setattr(completeness_router, "execute_sparql", fake_execute_sparql)

    data = await completeness_router.completeness_by_property(
        class_name="FullProfessor",
        properties="firstName,lastName",
        filter_property=None,
        filter_value=None,
    )

    assert len(queries) == 2
    assert data["properties"][0]["filled"] == 7
    assert data["properties"][1]["filled"] == 5


@pytest.mark.asyncio
async def test_entity_completeness_is_paginated(monkeypatch):
    queries = []

    async def fake_execute_sparql(query: str):
        queries.append(query)
        if "COUNT(DISTINCT ?entity) AS ?total" in query:
            return {"results": {"bindings": [_binding("total", "12")]}}
        assert "LIMIT 1" in query
        assert "OFFSET 5" in query
        assert "EXISTS" in query
        return {
            "results": {
                "bindings": [
                    {
                        "entity": {"type": "uri", "value": "http://example.org/voc#uni1/academic/1"},
                        "prop0Exists": {"type": "literal", "value": "TRUE"},
                    }
                ]
            }
        }

    monkeypatch.setattr(completeness_router, "execute_sparql", fake_execute_sparql)

    data = await completeness_router.completeness_by_entity(
        class_name="FullProfessor",
        properties="firstName",
        filter_property=None,
        filter_value=None,
        limit=1,
        offset=5,
    )

    assert len(queries) == 2
    assert data["total"] == 12
    assert data["pagination"] == {"limit": 1, "offset": 5, "count": 1, "total": 12}
    assert data["entities"][0]["scores"] == {"firstName": True}


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


@pytest.mark.asyncio
async def test_interlinking_endpoint_surfaces_sparql_errors(monkeypatch):
    async def fake_execute_sparql(query: str):
        raise RuntimeError("boom")

    monkeypatch.setattr(completeness_router, "execute_sparql", fake_execute_sparql)

    with pytest.raises(HTTPException) as exc:
        await completeness_router.interlinking_completeness()

    assert exc.value.status_code == 502


@pytest.mark.asyncio
async def test_interlinking_entities_drilldown_is_paginated(monkeypatch):
    queries = []

    async def fake_execute_sparql(query: str):
        queries.append(query)
        if "COUNT(DISTINCT ?e) AS ?total" in query:
            return {"results": {"bindings": [_binding("total", "3")]}}
        if "SAMPLE" in query:
            return {
                "results": {
                    "bindings": [
                        {
                            "e": {"type": "uri", "value": "http://example.org/voc#uni1/course/1234"},
                            "val0": {"type": "literal", "value": "Linear Algebra"},
                        }
                    ]
                }
            }
        assert "LIMIT 1" in query
        assert "OFFSET 1" in query
        return {
            "results": {
                "bindings": [
                    {"e": {"type": "uri", "value": "http://example.org/voc#uni1/course/1234"}}
                ]
            }
        }

    monkeypatch.setattr(completeness_router, "execute_sparql", fake_execute_sparql)

    data = await completeness_router.interlinking_entities(
        class_name="Course",
        status="linked",
        limit=1,
        offset=1,
    )

    assert len(queries) == 3
    assert data["pagination"] == {"limit": 1, "offset": 1, "count": 1, "total": 3}
    assert data["entities"] == [
        {"uri": "http://example.org/voc#uni1/course/1234", "label": "Linear Algebra"}
    ]


def test_invalid_property_name_is_rejected():
    with pytest.raises(HTTPException) as exc:
        completeness_router.resolve_property_uri("firstName> ?x ?y", "FullProfessor")

    assert exc.value.status_code == 400
