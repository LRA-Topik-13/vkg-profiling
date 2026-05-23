from __future__ import annotations

import asyncio
import re
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.dependencies import execute_sparql

router = APIRouter(prefix="/completeness", tags=["completeness"])

PREFIXES = """
    PREFIX : <http://example.org/voc#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
"""

MAX_PAGE_LIMIT = 500
DEFAULT_PAGE_LIMIT = 100
_HTTP_URI_RE = re.compile(r"^https?://[^\s<>{}|^`\"]+$")


def _validate_http_uri(uri: str, label: str = "URI") -> str:
    if not _HTTP_URI_RE.match(uri):
        raise HTTPException(status_code=400, detail=f"Invalid {label}: '{uri}'")
    return uri


def _validate_pagination(limit: int, offset: int) -> tuple[int, int]:
    if limit < 1 or limit > MAX_PAGE_LIMIT:
        raise HTTPException(status_code=400, detail=f"limit must be between 1 and {MAX_PAGE_LIMIT}")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be greater than or equal to 0")
    return limit, offset


def _count_binding(raw: dict, var_name: str, default: int = 0) -> int:
    bindings = raw.get("results", {}).get("bindings", [])
    if not bindings:
        return default
    value = bindings[0].get(var_name, {}).get("value")
    return int(value) if value is not None else default


def _all_known_property_uris() -> set[str]:
    from app.routers.metadata_router import KNOWN_PROPERTIES, ONTOLOGY_PROPERTIES

    uris = {p["uri"] for props in KNOWN_PROPERTIES.values() for p in props}
    uris.update(p["uri"] for p in ONTOLOGY_PROPERTIES)
    return uris


def _property_values(prop_uris: list[str]) -> str:
    return " ".join(f"<{u}>" for u in prop_uris)


def _class_union(
    classes: list[dict],
    body_template: str,
    class_var: str = "class",
) -> str:
    branches = []
    for cls in classes:
        body = (
            body_template
            .replace("{class_uri}", cls["uri"])
            .replace("{class_var}", class_var)
        )
        branches.append(f"{{\n  BIND(<{cls['uri']}> AS ?{class_var})\n  {body}\n}}")
    return "\nUNION\n".join(branches)


def _property_count_union(
    class_uri: str,
    prop_uris: list[str],
    entity_var: str = "entity",
    value_var: str = "val",
    prop_var: str = "prop",
    filter_clause: str = "",
) -> str:
    branches = []
    for prop_uri in prop_uris:
        branches.append(
            "{\n"
            f"  ?{entity_var} a <{class_uri}> .\n"
            f"  {filter_clause}\n"
            f"  ?{entity_var} <{prop_uri}> ?{value_var} .\n"
            f"  BIND(<{prop_uri}> AS ?{prop_var})\n"
            "}"
        )
    return "\nUNION\n".join(branches)


def _entity_label_config(class_uri: str) -> list[dict]:
    from app.routers.metadata_router import KNOWN_PROPERTIES

    name_keywords = ("name", "title", "label", "topic")
    return [
        p for p in KNOWN_PROPERTIES.get(class_uri, [])
        if p.get("type") == "data"
        and any(kw in p["localName"].lower() for kw in name_keywords)
    ]


async def _labels_for_entities(class_uri: str, entity_uris: list[str]) -> dict[str, str]:
    label_props = _entity_label_config(class_uri)
    if not label_props or not entity_uris:
        return {}

    values = " ".join(f"<{_validate_http_uri(uri, 'entity URI')}>" for uri in entity_uris)
    optionals = "\n".join(
        f"OPTIONAL {{ ?e <{p['uri']}> ?v{i} }}"
        for i, p in enumerate(label_props)
    )
    vars_select = " ".join(
        f"(SAMPLE(?v{i}) AS ?val{i})"
        for i in range(len(label_props))
    )
    label_q = f"""
        {PREFIXES}
        SELECT ?e {vars_select} WHERE {{
            VALUES ?e {{ {values} }}
            ?e a <{class_uri}> .
            {optionals}
        }}
        GROUP BY ?e
    """
    label_res = await execute_sparql(label_q)
    labels: dict[str, str] = {}
    for b in label_res.get("results", {}).get("bindings", []):
        e_uri = b["e"]["value"]
        parts = []
        for i in range(len(label_props)):
            val = b.get(f"val{i}", {}).get("value")
            if val:
                parts.append(val)
        if parts:
            labels[e_uri] = " ".join(parts)
    return labels


def _interlinking_metadata() -> tuple[list[dict], list[str], dict[str, dict], dict[str, str]]:
    from app.routers.metadata_router import KNOWN_CLASSES, ONTOLOGY_PROPERTIES

    obj_props = [p for p in ONTOLOGY_PROPERTIES if p.get("type") == "object"]
    obj_prop_uris = [p["uri"] for p in obj_props]
    prop_meta = {
        p["uri"]: {
            "localName": p["localName"],
            "label": p.get("label"),
            "domain": p.get("domain"),
            "range": p.get("range"),
        }
        for p in obj_props
    }
    cls_lookup = {
        c["uri"]: c.get("label") or c["localName"]
        for c in KNOWN_CLASSES
    }
    return obj_props, obj_prop_uris, prop_meta, cls_lookup


def _ln(uri: str) -> str:
    return uri.split("#")[-1] if "#" in uri else uri.split("/")[-1]


def _object_prop_values(obj_prop_uris: list[str]) -> str:
    if not obj_prop_uris:
        return ""
    return f"VALUES ?p {{ {_property_values(obj_prop_uris)} }}"


def _linked_body(obj_prop_uris: list[str]) -> str:
    values = _object_prop_values(obj_prop_uris)
    if not values:
        return "FILTER(false)"
    return f"""
        {{
            {{
                {values}
                ?e ?p ?other .
                FILTER(isIRI(?other))
                FILTER(?p != rdf:type)
            }} UNION {{
                {values}
                ?other ?p ?e .
                FILTER(?p != rdf:type)
            }}
        }}
    """


def _not_linked_filters(obj_prop_uris: list[str]) -> str:
    values = _object_prop_values(obj_prop_uris)
    if not values:
        return ""
    return f"""
        FILTER NOT EXISTS {{
            {values}
            ?e ?p ?other .
            FILTER(isIRI(?other))
            FILTER(?p != rdf:type)
        }}
        FILTER NOT EXISTS {{
            {values}
            ?other ?p ?e .
            FILTER(?p != rdf:type)
        }}
    """


def _get_property_labels(class_uri: str) -> dict[str, str | None]:
    """Returns {property_uri: label} for all properties of the given class."""
    from app.routers.metadata_router import KNOWN_PROPERTIES
    props = KNOWN_PROPERTIES.get(class_uri, [])
    return {p["uri"]: p.get("label") for p in props}


def validate_class_uri(class_uri: str) -> dict:
    from app.routers.metadata_router import KNOWN_CLASSES_BY_URI

    _validate_http_uri(class_uri, "class URI")
    entry = KNOWN_CLASSES_BY_URI.get(class_uri)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Class '{class_uri}' not found")
    return entry


def parse_property_uris(properties: str) -> list[str]:
    uris = [p.strip() for p in properties.split(",") if p.strip()]
    if not uris:
        raise HTTPException(status_code=400, detail="At least one property required")
    known = _all_known_property_uris()
    for uri in uris:
        _validate_http_uri(uri, "property URI")
        if uri not in known:
            raise HTTPException(status_code=404, detail=f"Property '{uri}' not found")
    return uris


def _property_meta_for_uris(class_uri: str, prop_uris: list[str]) -> list[dict]:
    from app.routers.metadata_router import KNOWN_PROPERTIES

    by_uri = {p["uri"]: p for p in KNOWN_PROPERTIES.get(class_uri, [])}
    info: list[dict] = []
    for uri in prop_uris:
        entry = by_uri.get(uri)
        if entry is None:
            for props in KNOWN_PROPERTIES.values():
                entry = next((p for p in props if p["uri"] == uri), None)
                if entry:
                    break
        item: dict = {"uri": uri}
        if entry:
            item["localName"] = entry["localName"]
            if entry.get("label"):
                item["label"] = entry["label"]
        info.append(item)
    return info


def parse_facets(filter_facets: Optional[str]) -> list[tuple[str, str]]:
    if not filter_facets:
        return []
    pairs: list[tuple[str, str]] = []
    for token in filter_facets.split(","):
        token = token.strip()
        if not token:
            continue
        if "::" not in token:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid facet format '{token}'. Expected 'predicateUri::objectUri'",
            )
        pred, obj = token.split("::", 1)
        pred = pred.strip()
        obj = obj.strip()
        if not pred or not obj:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid facet '{token}'. Both predicate and object are required.",
            )
        _validate_http_uri(pred, "facet predicate URI")
        _validate_http_uri(obj, "facet object URI")
        prop_type = _property_type(pred)
        if prop_type is None:
            raise HTTPException(status_code=404, detail=f"Facet property '{pred}' not found")
        if prop_type != "object":
            raise HTTPException(
                status_code=400,
                detail=f"Facet predicate '{pred}' is a data property; only object properties are allowed as facets",
            )
        pairs.append((pred, obj))
    return pairs


def _property_type(uri: str) -> Optional[str]:
    from app.routers.metadata_router import KNOWN_PROPERTIES

    for props in KNOWN_PROPERTIES.values():
        for entry in props:
            if entry["uri"] == uri:
                return entry.get("type")
    return None


def build_facet_clauses(facets: list[tuple[str, str]], subject_var: str = "entity") -> str:
    if not facets:
        return ""
    return "\n".join(
        f"?{subject_var} <{pred}> <{obj}> ."
        for pred, obj in facets
    )


def build_exists_bindings(prop_uris: list[str]) -> tuple[str, list[str], list[str]]:
    optional_blocks: list[str] = []
    select_exprs: list[str] = []
    var_names: list[str] = []
    for i, uri in enumerate(prop_uris):
        val_var = f"prop{i}Val"
        exists_var = f"prop{i}Exists"
        var_names.append(exists_var)
        optional_blocks.append(f"  OPTIONAL {{ ?entity <{uri}> ?{val_var} }}")
        select_exprs.append(
            f'(IF(COUNT(DISTINCT ?{val_var}) > 0, "TRUE", "FALSE") AS ?{exists_var})'
        )
    return "\n".join(optional_blocks), select_exprs, var_names


@router.get("/by-entity")
async def completeness_by_entity(
    class_uri: str = Query(..., description="Full class URI, e.g. http://example.org/voc#FullProfessor"),
    properties: str = Query(..., description="Comma-separated property URIs, e.g. http://xmlns.com/foaf/0.1/firstName,http://example.org/voc#teaches"),
    filter_facets: Optional[str] = Query(None, description="Comma-separated facet filters as predicateUri::objectUri pairs"),
    limit: int = DEFAULT_PAGE_LIMIT,
    offset: int = 0,
    include_total: bool = True,
):
    limit, offset = _validate_pagination(limit, offset)
    class_entry = validate_class_uri(class_uri)
    prop_uris = parse_property_uris(properties)
    facets = parse_facets(filter_facets)
    facet_clauses = build_facet_clauses(facets)
    optional_block, select_exprs, var_names = build_exists_bindings(prop_uris)

    var_list = " ".join(select_exprs)

    query = f"""
        {PREFIXES}
        SELECT ?entity {var_list} WHERE {{
          ?entity a <{class_uri}> .
          {facet_clauses}
          {optional_block}
        }}
        GROUP BY ?entity
        ORDER BY ?entity
        LIMIT {limit}
        OFFSET {offset}
    """

    count_query = f"""
        {PREFIXES}
        SELECT (COUNT(DISTINCT ?entity) AS ?total) WHERE {{
            ?entity a <{class_uri}> .
            {facet_clauses}
        }}
    """

    try:
        if include_total:
            raw, total_raw = await asyncio.gather(
                execute_sparql(query),
                execute_sparql(count_query),
            )
            total_entities = _count_binding(total_raw, "total")
        else:
            raw = await execute_sparql(query)
            total_entities = None
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(e)}")

    bindings = raw.get("results", {}).get("bindings", [])
    total_props = len(prop_uris)
    property_info = _property_meta_for_uris(class_uri, prop_uris)

    entities = []
    for row in bindings:
        entity_uri = row["entity"]["value"]
        scores: dict[str, bool] = {}
        filled = 0
        for i, prop_uri in enumerate(prop_uris):
            exists = var_names[i] in row and row[var_names[i]]["value"] == "TRUE"
            scores[prop_uri] = exists
            if exists:
                filled += 1
        completeness = round((filled / total_props) * 100, 2) if total_props > 0 else 0.0
        entities.append({
            "uri":          entity_uri,
            "scores":       scores,
            "completeness": completeness,
        })

    return {
        "uri":        class_uri,
        "class":      class_entry["localName"],
        "properties": prop_uris,
        "property_info": property_info,
        "total":      total_entities if total_entities is not None else len(entities),
        "pagination": {
            "limit": limit,
            "offset": offset,
            "count": len(entities),
            "total": total_entities,
        },
        "entities":   entities,
    }


@router.get("/by-property")
async def completeness_by_property(
    class_uri: str = Query(..., description="Full class URI"),
    properties: str = Query(..., description="Comma-separated property URIs"),
    filter_facets: Optional[str] = Query(None, description="Comma-separated facet filters as predicateUri::objectUri pairs"),
):
    class_entry = validate_class_uri(class_uri)
    prop_uris = parse_property_uris(properties)
    facets = parse_facets(filter_facets)
    facet_clauses = build_facet_clauses(facets)

    count_query = f"""
        {PREFIXES}
        SELECT (COUNT(DISTINCT ?entity) AS ?total) WHERE {{
            ?entity a <{class_uri}> .
            {facet_clauses}
        }}
    """

    prop_union = _property_count_union(class_uri, prop_uris, filter_clause=facet_clauses)
    filled_query = f"""
        {PREFIXES}
        SELECT ?prop (COUNT(DISTINCT ?entity) AS ?filled) WHERE {{
            {prop_union}
        }}
        GROUP BY ?prop
    """

    try:
        total_raw, filled_raw = await asyncio.gather(
            execute_sparql(count_query),
            execute_sparql(filled_query),
        )
        total_entities = _count_binding(total_raw, "total")
        filled_by_uri = {uri: 0 for uri in prop_uris}
        filled_bindings = filled_raw.get("results", {}).get("bindings", [])
        if len(prop_uris) == 1 and filled_bindings and "prop" not in filled_bindings[0]:
            filled_by_uri[prop_uris[0]] = int(filled_bindings[0]["filled"]["value"])
        else:
            for row in filled_bindings:
                prop_uri = row.get("prop", {}).get("value")
                if prop_uri in filled_by_uri:
                    filled_by_uri[prop_uri] = int(row["filled"]["value"])

        property_info = _property_meta_for_uris(class_uri, prop_uris)
        info_by_uri = {p["uri"]: p for p in property_info}
        prop_results = []
        for prop_uri in prop_uris:
            filled = filled_by_uri[prop_uri]
            missing = total_entities - filled
            completeness = round((filled / total_entities) * 100, 2) if total_entities > 0 else 0.0
            entry = {
                "property":     prop_uri,
                "filled":       filled,
                "missing":      missing,
                "completeness": completeness,
            }
            label = info_by_uri.get(prop_uri, {}).get("label")
            if label:
                entry["label"] = label
            prop_results.append(entry)

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(e)}")

    return {
        "uri":            class_uri,
        "class":          class_entry["localName"],
        "total_entities": total_entities,
        "properties":     prop_results,
    }


@router.get("/matrix")
async def completeness_matrix(
    class_uri: str = Query(..., description="Full class URI"),
    properties: str = Query(..., description="Comma-separated property URIs"),
    filter_facets: Optional[str] = Query(None, description="Comma-separated facet filters as predicateUri::objectUri pairs"),
    limit: int = DEFAULT_PAGE_LIMIT,
    offset: int = 0,
    include_total: bool = True,
):
    limit, offset = _validate_pagination(limit, offset)
    entity_result, property_result = await asyncio.gather(
        completeness_by_entity(
            class_uri=class_uri,
            properties=properties,
            filter_facets=filter_facets,
            limit=limit,
            offset=offset,
            include_total=include_total,
        ),
        completeness_by_property(
            class_uri=class_uri,
            properties=properties,
            filter_facets=filter_facets,
        ),
    )

    prop_list = entity_result["properties"]
    by_prop   = property_result["properties"]

    overall = (
        round(sum(p["completeness"] for p in by_prop) / len(by_prop), 2)
        if by_prop else 0.0
    )

    return {
        "uri":        class_uri,
        "class":      entity_result["class"],
        "properties": prop_list,
        "property_info": entity_result.get("property_info", []),
        "summary": {
            "total_entities":       property_result["total_entities"],
            "by_property":          by_prop,
            "overall_completeness": overall,
        },
        "pagination": entity_result.get("pagination"),
        "entities": entity_result["entities"],
    }


@router.get("/entity-count")
async def entity_count(
    class_uri: Optional[str] = Query(None, description="Full class URI. If given, return only this class. Otherwise all mapped classes."),
):
    from app.routers.metadata_router import KNOWN_CLASSES
    target_classes = [c for c in KNOWN_CLASSES if not class_uri or c["uri"] == class_uri]
    if not target_classes:
        raise HTTPException(status_code=404, detail=f"Class '{class_uri}' not found")

    try:
        q = f"""
            {PREFIXES}
            SELECT ?class (COUNT(DISTINCT ?entity) AS ?count) WHERE {{
                {_class_union(target_classes, "?entity a <{class_uri}> .")}
            }}
            GROUP BY ?class
        """
        raw = await execute_sparql(q)
        counts = {cls["uri"]: 0 for cls in target_classes}
        bindings = raw.get("results", {}).get("bindings", [])
        if len(target_classes) == 1 and bindings and "class" not in bindings[0]:
            counts[target_classes[0]["uri"]] = int(bindings[0]["count"]["value"])
        else:
            for row in bindings:
                cls_uri = row.get("class", {}).get("value")
                if cls_uri in counts:
                    counts[cls_uri] = int(row["count"]["value"])
        results = [
            {"uri": cls["uri"], "class": cls["localName"], "count": counts[cls["uri"]]}
            for cls in target_classes
        ]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(e)}")

    total = sum(r["count"] for r in results)
    return {"classes": results, "total": total}


@router.get("/interlinking")
async def interlinking_completeness():
    from app.routers.metadata_router import KNOWN_CLASSES

    _, obj_prop_uris, prop_meta, cls_lookup = _interlinking_metadata()
    linked_body = _linked_body(obj_prop_uris)
    values = _object_prop_values(obj_prop_uris)

    total_q = f"""
        {PREFIXES}
        SELECT ?class (COUNT(DISTINCT ?e) AS ?n) WHERE {{
            {_class_union(KNOWN_CLASSES, "?e a <{class_uri}> .")}
        }}
        GROUP BY ?class
    """

    try:
        if obj_prop_uris:
            linked_q = f"""
                {PREFIXES}
                SELECT ?class (COUNT(DISTINCT ?e) AS ?n) WHERE {{
                    {_class_union(KNOWN_CLASSES, "?e a <{class_uri}> . " + linked_body)}
                }}
                GROUP BY ?class
            """

            outgoing_q = f"""
                {PREFIXES}
                SELECT ?class ?p (COUNT(DISTINCT ?e) AS ?n) WHERE {{
                    {_class_union(KNOWN_CLASSES, "?e a <{class_uri}> . " + values + " ?e ?p ?other . FILTER(isIRI(?other)) FILTER(?p != rdf:type)")}
                }}
                GROUP BY ?class ?p
            """

            incoming_q = f"""
                {PREFIXES}
                SELECT ?class ?p (COUNT(DISTINCT ?e) AS ?n) WHERE {{
                    {_class_union(KNOWN_CLASSES, "?e a <{class_uri}> . " + values + " ?other ?p ?e . FILTER(?p != rdf:type)")}
                }}
                GROUP BY ?class ?p
            """

            total_res, linked_res, out_detail_res, in_detail_res = await asyncio.gather(
                execute_sparql(total_q),
                execute_sparql(linked_q),
                execute_sparql(outgoing_q),
                execute_sparql(incoming_q),
            )
        else:
            total_res = await execute_sparql(total_q)
            linked_res = out_detail_res = in_detail_res = {"results": {"bindings": []}}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(e)}")

    totals = {cls["uri"]: 0 for cls in KNOWN_CLASSES}
    linked_counts = {cls["uri"]: 0 for cls in KNOWN_CLASSES}
    for row in total_res.get("results", {}).get("bindings", []):
        cls_uri = row.get("class", {}).get("value")
        if cls_uri in totals:
            totals[cls_uri] = int(row["n"]["value"])
    for row in linked_res.get("results", {}).get("bindings", []):
        cls_uri = row.get("class", {}).get("value")
        if cls_uri in linked_counts:
            linked_counts[cls_uri] = int(row["n"]["value"])

    link_details = {cls["uri"]: [] for cls in KNOWN_CLASSES}
    outgoing_totals = {cls["uri"]: 0 for cls in KNOWN_CLASSES}
    incoming_totals = {cls["uri"]: 0 for cls in KNOWN_CLASSES}

    for b in out_detail_res.get("results", {}).get("bindings", []):
        cls_uri = b.get("class", {}).get("value")
        p_uri = b.get("p", {}).get("value")
        if cls_uri not in link_details or not p_uri:
            continue
        count = int(b["n"]["value"])
        outgoing_totals[cls_uri] += count
        meta = prop_meta.get(p_uri, {})
        target_uri = meta.get("range")
        link_details[cls_uri].append({
            "direction": "outgoing",
            "property": meta.get("localName") or _ln(p_uri),
            "propertyLabel": meta.get("label"),
            "targetClass": cls_lookup.get(target_uri) or (_ln(target_uri) if target_uri else None),
            "count": count,
        })

    for b in in_detail_res.get("results", {}).get("bindings", []):
        cls_uri = b.get("class", {}).get("value")
        p_uri = b.get("p", {}).get("value")
        if cls_uri not in link_details or not p_uri:
            continue
        count = int(b["n"]["value"])
        incoming_totals[cls_uri] += count
        meta = prop_meta.get(p_uri, {})
        source_uri = meta.get("domain")
        link_details[cls_uri].append({
            "direction": "incoming",
            "property": meta.get("localName") or _ln(p_uri),
            "propertyLabel": meta.get("label"),
            "sourceClass": cls_lookup.get(source_uri) or (_ln(source_uri) if source_uri else None),
            "count": count,
        })

    results = []
    for cls in KNOWN_CLASSES:
        cls_uri = cls["uri"]
        total = totals[cls_uri]
        linked_any = linked_counts[cls_uri]
        not_linked = max(total - linked_any, 0)
        ratio = round((linked_any / total) * 100, 2) if total > 0 else 0.0
        results.append({
            "uri": cls_uri,
            "class": cls["localName"],
            "label": cls.get("label"),
            "total_entities": total,
            "linked": linked_any,
            "not_linked": not_linked,
            "outgoing": outgoing_totals[cls_uri],
            "incoming": incoming_totals[cls_uri],
            "ratio": ratio,
            "links": link_details[cls_uri],
            "linked_entities": [],
            "not_linked_entities": [],
            "entity_drilldown": f"/completeness/interlinking/entities?class_uri={cls_uri}",
        })

    total_entities = sum(r["total_entities"] for r in results)
    total_linked = sum(r["linked"] for r in results)
    overall_ratio = round((total_linked / total_entities) * 100, 2) if total_entities > 0 else 0.0

    return {
        "classes": results,
        "overall_ratio": overall_ratio,
    }


@router.get("/interlinking/entities")
async def interlinking_entities(
    class_uri: str = Query(..., description="Full class URI, e.g. http://example.org/voc#Course"),
    status: str = Query("linked", description="linked or not_linked"),
    limit: int = DEFAULT_PAGE_LIMIT,
    offset: int = 0,
    include_total: bool = True,
):
    limit, offset = _validate_pagination(limit, offset)
    if status not in {"linked", "not_linked"}:
        raise HTTPException(status_code=400, detail="status must be 'linked' or 'not_linked'")

    class_entry = validate_class_uri(class_uri)
    _, obj_prop_uris, _, _ = _interlinking_metadata()
    if status == "linked":
        status_body = _linked_body(obj_prop_uris)
    else:
        status_body = _not_linked_filters(obj_prop_uris)

    page_q = f"""
        {PREFIXES}
        SELECT DISTINCT ?e WHERE {{
            ?e a <{class_uri}> .
            {status_body}
        }}
        ORDER BY ?e
        LIMIT {limit}
        OFFSET {offset}
    """
    count_q = f"""
        {PREFIXES}
        SELECT (COUNT(DISTINCT ?e) AS ?total) WHERE {{
            ?e a <{class_uri}> .
            {status_body}
        }}
    """

    try:
        if include_total:
            page_raw, total_raw = await asyncio.gather(
                execute_sparql(page_q),
                execute_sparql(count_q),
            )
            total = _count_binding(total_raw, "total")
        else:
            page_raw = await execute_sparql(page_q)
            total = None
        entity_uris = [
            b["e"]["value"]
            for b in page_raw.get("results", {}).get("bindings", [])
        ]
        labels = await _labels_for_entities(class_uri, entity_uris)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(e)}")

    return {
        "uri": class_uri,
        "class": class_entry["localName"],
        "status": status,
        "entities": [
            {"uri": uri, "label": labels.get(uri)}
            for uri in entity_uris
        ],
        "pagination": {
            "limit": limit,
            "offset": offset,
            "count": len(entity_uris),
            "total": total,
        },
    }


@router.get("/distinct-properties")
async def distinct_properties(
    class_uri: Optional[str] = Query(None, description="Full class URI. If given, count properties for this class only. Otherwise all mapped classes."),
):
    from app.routers.metadata_router import KNOWN_CLASSES
    target_classes = [c for c in KNOWN_CLASSES if not class_uri or c["uri"] == class_uri]
    if not target_classes:
        raise HTTPException(status_code=404, detail=f"Class '{class_uri}' not found")

    try:
        q = f"""
            {PREFIXES}
            SELECT ?class (COUNT(DISTINCT ?p) AS ?count) WHERE {{
                {_class_union(target_classes, "?entity a <{class_uri}> . ?entity ?p ?o .")}
            }}
            GROUP BY ?class
        """
        raw = await execute_sparql(q)
        counts = {cls["uri"]: 0 for cls in target_classes}
        bindings = raw.get("results", {}).get("bindings", [])
        if len(target_classes) == 1 and bindings and "class" not in bindings[0]:
            counts[target_classes[0]["uri"]] = int(bindings[0]["count"]["value"])
        else:
            for row in bindings:
                cls_uri = row.get("class", {}).get("value")
                if cls_uri in counts:
                    counts[cls_uri] = int(row["count"]["value"])
        results = [
            {
                "uri": cls["uri"],
                "class": cls["localName"],
                "distinct_properties": counts[cls["uri"]],
            }
            for cls in target_classes
        ]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(e)}")

    total = sum(r["distinct_properties"] for r in results)
    return {"classes": results, "total_distinct": total}


@router.get("/undefined-objects")
async def undefined_objects(
    class_uri: str = Query(..., description="Full class URI, e.g. http://example.org/voc#Course"),
):
    """
    VKG-specific completeness support metric.

    For each object property expected on the selected class, count distinct
    objects that do not have the ontology range type asserted in the VKG.
    """
    from app.routers.metadata_router import KNOWN_PROPERTIES

    class_entry = validate_class_uri(class_uri)
    object_props = [
        p for p in KNOWN_PROPERTIES.get(class_uri, [])
        if p.get("type") == "object"
    ]

    entries = []
    ranged_props = []
    for prop in object_props:
        prop_uri = prop["uri"]
        range_uri = prop.get("range")
        entry = {
            "property": prop["localName"],
            "property_uri": prop_uri,
            "range": range_uri,
            "rangeClass": prop.get("rangeClass"),
            "total_objects": 0,
            "undefined_objects": 0,
            "ratio": 0.0,
            "status": "not_applicable" if not range_uri else "ok",
        }
        entries.append(entry)
        if range_uri:
            ranged_props.append(prop)

    def _total_branch(prop: dict) -> str:
        return (
            "{\n"
            f"  ?entity a <{class_uri}> .\n"
            f"  ?entity <{prop['uri']}> ?obj .\n"
            f"  BIND(<{prop['uri']}> AS ?prop)\n"
            "}"
        )

    def _undefined_branch(prop: dict) -> str:
        return (
            "{\n"
            f"  ?entity a <{class_uri}> .\n"
            f"  ?entity <{prop['uri']}> ?obj .\n"
            f"  FILTER NOT EXISTS {{ ?obj a <{prop['range']}> }}\n"
            f"  BIND(<{prop['uri']}> AS ?prop)\n"
            "}"
        )

    try:
        totals = {p["uri"]: 0 for p in ranged_props}
        undefined_counts = {p["uri"]: 0 for p in ranged_props}
        if ranged_props:
            total_q = f"""
                {PREFIXES}
                SELECT ?prop (COUNT(DISTINCT ?obj) AS ?total) WHERE {{
                    {" UNION ".join(_total_branch(p) for p in ranged_props)}
                }}
                GROUP BY ?prop
            """
            undefined_q = f"""
                {PREFIXES}
                SELECT ?prop (COUNT(DISTINCT ?obj) AS ?undefined) WHERE {{
                    {" UNION ".join(_undefined_branch(p) for p in ranged_props)}
                }}
                GROUP BY ?prop
            """
            total_raw, undefined_raw = await asyncio.gather(
                execute_sparql(total_q),
                execute_sparql(undefined_q),
            )
            total_bindings = total_raw.get("results", {}).get("bindings", [])
            undefined_bindings = undefined_raw.get("results", {}).get("bindings", [])
            if total_bindings and "prop" not in total_bindings[0]:
                totals[ranged_props[0]["uri"]] = int(total_bindings[0]["total"]["value"])
            else:
                for row in total_bindings:
                    prop_uri = row.get("prop", {}).get("value")
                    if prop_uri in totals:
                        totals[prop_uri] = int(row["total"]["value"])
            if undefined_bindings and "prop" not in undefined_bindings[0]:
                undefined_counts[ranged_props[0]["uri"]] = int(undefined_bindings[0]["undefined"]["value"])
            else:
                for row in undefined_bindings:
                    prop_uri = row.get("prop", {}).get("value")
                    if prop_uri in undefined_counts:
                        undefined_counts[prop_uri] = int(row["undefined"]["value"])

        results = []
        for entry in entries:
            prop_uri = entry["property_uri"]
            if prop_uri in totals:
                total = totals[prop_uri]
                undefined = undefined_counts[prop_uri]
                ratio = round((undefined / total) * 100, 2) if total else 0.0
                entry.update({
                    "total_objects": total,
                    "undefined_objects": undefined,
                    "ratio": ratio,
                    "status": "warning" if undefined else "ok",
                })
            results.append(entry)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(e)}")

    total_objects = sum(r["total_objects"] for r in results)
    total_undefined = sum(r["undefined_objects"] for r in results)
    overall_ratio = round((total_undefined / total_objects) * 100, 2) if total_objects else 0.0

    return {
        "uri": class_uri,
        "class": class_entry["localName"],
        "properties": results,
        "summary": {
            "total_objects": total_objects,
            "undefined_objects": total_undefined,
            "overall_ratio": overall_ratio,
        },
    }


@router.get("/mapping-coverage")
def mapping_coverage():
    from app.routers.metadata_router import ONTOLOGY_CLASSES, ONTOLOGY_PROPERTIES

    mapped_classes   = [c for c in ONTOLOGY_CLASSES    if c["mapped"]]
    unmapped_classes = [c for c in ONTOLOGY_CLASSES    if not c["mapped"]]
    mapped_props     = [p for p in ONTOLOGY_PROPERTIES if p["mapped"]]
    unmapped_props   = [p for p in ONTOLOGY_PROPERTIES if not p["mapped"]]

    total_classes = len(ONTOLOGY_CLASSES)
    total_props   = len(ONTOLOGY_PROPERTIES)

    class_coverage = round(len(mapped_classes) / total_classes * 100, 2) if total_classes else 0.0
    prop_coverage  = round(len(mapped_props)   / total_props   * 100, 2) if total_props   else 0.0
    overall_coverage = round((len(mapped_classes) + len(mapped_props)) / (total_classes + total_props) * 100, 2)

    def _name_with_label(items):
        return [{"uri": i["uri"], "name": i["localName"], "label": i.get("label")} for i in items]

    return {
        "classes": {
            "total":          total_classes,
            "mapped":         len(mapped_classes),
            "unmapped":       len(unmapped_classes),
            "coverage":       class_coverage,
            "mapped_list":    _name_with_label(mapped_classes),
            "unmapped_list":  _name_with_label(unmapped_classes),
        },
        "properties": {
            "total":          total_props,
            "mapped":         len(mapped_props),
            "unmapped":       len(unmapped_props),
            "coverage":       prop_coverage,
            "mapped_list":    _name_with_label(mapped_props),
            "unmapped_list":  _name_with_label(unmapped_props),
        },
        "overall_coverage": overall_coverage,
    }


@router.get("/class-summary")
async def class_summary():
    from app.routers.metadata_router import KNOWN_CLASSES, KNOWN_PROPERTIES

    prop_pairs = [
        (cls, prop)
        for cls in KNOWN_CLASSES
        for prop in KNOWN_PROPERTIES.get(cls["uri"], [])
    ]

    total_q = f"""
        {PREFIXES}
        SELECT ?class (COUNT(DISTINCT ?e) AS ?n) WHERE {{
            {_class_union(KNOWN_CLASSES, "?e a <{class_uri}> .")}
        }}
        GROUP BY ?class
    """

    def _prop_branch(cls: dict, prop: dict) -> str:
        return (
            "{\n"
            f"  ?e a <{cls['uri']}> .\n"
            f"  ?e <{prop['uri']}> ?v .\n"
            f"  BIND(<{cls['uri']}> AS ?class)\n"
            f"  BIND(<{prop['uri']}> AS ?prop)\n"
            "}"
        )

    filled_q = None
    if prop_pairs:
        filled_q = f"""
            {PREFIXES}
            SELECT ?class ?prop (COUNT(DISTINCT ?e) AS ?n) WHERE {{
                {" UNION ".join(_prop_branch(cls, prop) for cls, prop in prop_pairs)}
            }}
            GROUP BY ?class ?prop
        """

    try:
        if filled_q:
            total_raw, filled_raw = await asyncio.gather(
                execute_sparql(total_q),
                execute_sparql(filled_q),
            )
        else:
            total_raw = await execute_sparql(total_q)
            filled_raw = {"results": {"bindings": []}}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(e)}")

    totals = {cls["uri"]: 0 for cls in KNOWN_CLASSES}
    total_bindings = total_raw.get("results", {}).get("bindings", [])
    if len(KNOWN_CLASSES) == 1 and total_bindings and "class" not in total_bindings[0]:
        totals[KNOWN_CLASSES[0]["uri"]] = int(total_bindings[0]["n"]["value"])
    else:
        for row in total_bindings:
            cls_uri = row.get("class", {}).get("value")
            if cls_uri in totals:
                totals[cls_uri] = int(row["n"]["value"])

    filled_counts = {(cls["uri"], prop["uri"]): 0 for cls, prop in prop_pairs}
    for row in filled_raw.get("results", {}).get("bindings", []):
        cls_uri = row.get("class", {}).get("value")
        prop_uri = row.get("prop", {}).get("value")
        key = (cls_uri, prop_uri)
        if key in filled_counts:
            filled_counts[key] = int(row["n"]["value"])

    results = []
    for cls in KNOWN_CLASSES:
        cls_name = cls["localName"]
        cls_uri = cls["uri"]
        props = KNOWN_PROPERTIES.get(cls_uri, [])
        total = totals[cls_uri]

        if total == 0 or not props:
            results.append({
                "uri": cls_uri,
                "class": cls_name,
                "label": cls.get("label"),
                "total_entities": total,
                "properties_count": len(props),
                "completeness": 0.0,
                "by_property": [],
            })
            continue

        labels = _get_property_labels(cls_uri)
        by_property = []
        for prop in props:
            filled = filled_counts.get((cls_uri, prop["uri"]), 0)
            fill_rate = round((filled / total) * 100, 2)
            entry = {
                "uri": prop["uri"],
                "property": prop["localName"],
                "filled": filled,
                "missing": total - filled,
                "completeness": fill_rate,
            }
            label = labels.get(prop["uri"])
            if label:
                entry["label"] = label
            by_property.append(entry)

        overall = round(sum(bp["completeness"] for bp in by_property) / len(by_property), 2)
        results.append({
            "uri": cls_uri,
            "class": cls_name,
            "label": cls.get("label"),
            "total_entities": total,
            "properties_count": len(props),
            "completeness": overall,
            "by_property": by_property,
        })

    total_entities = sum(r["total_entities"] for r in results)
    classes_with_data = [r for r in results if r["total_entities"] > 0]
    overall = (
        round(sum(r["completeness"] for r in classes_with_data) / len(classes_with_data), 2)
        if classes_with_data else 0.0
    )

    return {
        "classes": results,
        "total_entities": total_entities,
        "overall_completeness": overall,
    }
