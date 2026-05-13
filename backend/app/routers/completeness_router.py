from __future__ import annotations

import asyncio
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

VOC_BASE = "http://example.org/voc#"
FOAF_BASE = "http://xmlns.com/foaf/0.1/"


def _get_property_labels(class_name: str) -> dict[str, str | None]:
    from app.routers.metadata_router import KNOWN_PROPERTIES
    props = KNOWN_PROPERTIES.get(class_name, [])
    return {p["localName"]: p.get("label") for p in props}


def resolve_class_uri(class_name: str) -> str:
    from app.routers.metadata_router import KNOWN_CLASSES

    entry = next((c for c in KNOWN_CLASSES if c["localName"] == class_name), None)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Class '{class_name}' not found")
    return entry["uri"]


def resolve_property_uri(prop: str, class_name: Optional[str] = None) -> str:
    if prop.startswith("http"):
        return prop

    from app.routers.metadata_router import KNOWN_PROPERTIES

    if class_name:
        for entry in KNOWN_PROPERTIES.get(class_name, []):
            if entry["localName"] == prop:
                return entry["uri"]

    for props in KNOWN_PROPERTIES.values():
        for entry in props:
            if entry["localName"] == prop:
                return entry["uri"]

    KNOWN = {
        "firstName":    f"{FOAF_BASE}firstName",
        "lastName":     f"{FOAF_BASE}lastName",
        "teaches":      f"{VOC_BASE}teaches",
        "givesLecture": f"{VOC_BASE}givesLecture",
        "givesLab":     f"{VOC_BASE}givesLab",
        "attends":      f"{VOC_BASE}attends",
        "title":        f"{VOC_BASE}title",
        "isGivenAt":    f"{VOC_BASE}isGivenAt",
    }
    if prop in KNOWN:
        return KNOWN[prop]
    return f"{VOC_BASE}{prop}"


def build_filter_clause(
    filter_property: Optional[str],
    filter_value: Optional[str],
    class_name: Optional[str] = None,
) -> str:
    if not filter_property or not filter_value:
        return ""
    prop_uri = resolve_property_uri(filter_property, class_name)
    if filter_value.startswith("http"):
        value_uri = filter_value
    elif filter_value.startswith(":"):
        value_uri = f"{VOC_BASE}{filter_value[1:]}"
    else:
        value_uri = f"{VOC_BASE}{filter_value}"
    value_str = f"<{value_uri}>"
    return f"?entity <{prop_uri}> {value_str} ."


def build_optional_blocks(prop_uris: list[str]) -> tuple[str, list[str]]:
    blocks = []
    var_names = []
    for i, uri in enumerate(prop_uris):
        val_var = f"prop{i}Val"
        exists_var = f"prop{i}Exists"
        var_names.append(exists_var)
        blocks.append(
            f'  OPTIONAL {{ ?entity <{uri}> ?{val_var} }}\n'
            f'  BIND(IF(BOUND(?{val_var}), "TRUE", "FALSE") AS ?{exists_var})'
        )
    return "\n".join(blocks), var_names


@router.get("/by-entity")
async def completeness_by_entity(
    class_name: str = Query(..., description="Class to measure, e.g. FullProfessor"),
    properties: str = Query(..., description="Comma-separated property localNames, e.g. firstName,lastName,teaches"),
    filter_property: Optional[str] = Query(None, description="Facet property to filter by, e.g. isGivenAt"),
    filter_value:    Optional[str] = Query(None, description="Facet value URI or localName, e.g. http://example.org/voc#uni1/university"),
):
    prop_list = [p.strip() for p in properties.split(",") if p.strip()]
    if not prop_list:
        raise HTTPException(status_code=400, detail="At least one property required")

    prop_uris  = [resolve_property_uri(p, class_name) for p in prop_list]
    class_uri  = resolve_class_uri(class_name)
    filter_clause = build_filter_clause(filter_property, filter_value, class_name)
    optional_blocks, var_names = build_optional_blocks(prop_uris)

    var_list = " ".join(f"?{v}" for v in var_names)

    query = f"""
        {PREFIXES}
        SELECT DISTINCT ?entity {var_list} WHERE {{
          {{
            SELECT DISTINCT ?entity WHERE {{
              ?entity a <{class_uri}> .
              {filter_clause}
            }}
          }}
          {optional_blocks}
        }}
    """

    try:
        raw = await execute_sparql(query)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(e)}")

    bindings = raw.get("results", {}).get("bindings", [])
    total_props = len(prop_list)
    labels = _get_property_labels(class_name)

    entities = []
    for row in bindings:
        entity_uri = row["entity"]["value"]
        scores = {}
        filled = 0
        for i, prop_name in enumerate(prop_list):
            exists = var_names[i] in row and row[var_names[i]]["value"] == "TRUE"
            scores[prop_name] = exists
            if exists:
                filled += 1
        completeness = round((filled / total_props) * 100, 2) if total_props > 0 else 0.0
        entities.append({
            "uri":          entity_uri,
            "scores":       scores,
            "completeness": completeness
        })

    property_info = []
    for p in prop_list:
        info = {"localName": p}
        label = labels.get(p)
        if label:
            info["label"] = label
        property_info.append(info)

    return {
        "class":      class_name,
        "properties": prop_list,
        "property_info": property_info,
        "total":      len(entities),
        "entities":   entities
    }


@router.get("/by-property")
async def completeness_by_property(
    class_name: str = Query(..., description="Class to measure, e.g. FullProfessor"),
    properties: str = Query(..., description="Comma-separated property localNames, e.g. firstName,lastName,teaches"),
    filter_property: Optional[str] = Query(None),
    filter_value:    Optional[str] = Query(None),
):
    prop_list  = [p.strip() for p in properties.split(",") if p.strip()]
    if not prop_list:
        raise HTTPException(status_code=400, detail="At least one property required")

    prop_uris  = [resolve_property_uri(p, class_name) for p in prop_list]
    class_uri  = resolve_class_uri(class_name)
    filter_clause = build_filter_clause(filter_property, filter_value, class_name)

    count_query = f"""
        {PREFIXES}
        SELECT (COUNT(DISTINCT ?entity) AS ?total) WHERE {{
            ?entity a <{class_uri}> .
            {filter_clause}
        }}
    """

    async def count_property(prop_uri: str) -> int:
        q = f"""
            {PREFIXES}
            SELECT (COUNT(DISTINCT ?entity) AS ?filled) WHERE {{
                ?entity a <{class_uri}> .
                {filter_clause}
                ?entity <{prop_uri}> ?val .
            }}
        """
        result = await execute_sparql(q)
        bindings = result.get("results", {}).get("bindings", [])
        if bindings:
            return int(bindings[0]["filled"]["value"])
        return 0

    try:
        total_raw, *filled_counts = await asyncio.gather(
            execute_sparql(count_query),
            *[count_property(uri) for uri in prop_uris],
        )
        total_bindings = total_raw.get("results", {}).get("bindings", [])
        total_entities = int(total_bindings[0]["total"]["value"]) if total_bindings else 0

        labels = _get_property_labels(class_name)
        prop_results = []
        for i, prop_name in enumerate(prop_list):
            filled = filled_counts[i]
            missing = total_entities - filled
            completeness = round((filled / total_entities) * 100, 2) if total_entities > 0 else 0.0
            entry = {
                "property":     prop_name,
                "filled":       filled,
                "missing":      missing,
                "completeness": completeness
            }
            label = labels.get(prop_name)
            if label:
                entry["label"] = label
            prop_results.append(entry)

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(e)}")

    return {
        "class":            class_name,
        "total_entities":   total_entities,
        "properties":       prop_results
    }


@router.get("/matrix")
async def completeness_matrix(
    class_name: str = Query(..., description="Class to measure, e.g. FullProfessor"),
    properties: str = Query(..., description="Comma-separated property localNames"),
    filter_property: Optional[str] = Query(None),
    filter_value:    Optional[str] = Query(None),
):
    entity_result, property_result = await asyncio.gather(
        completeness_by_entity(
            class_name=class_name,
            properties=properties,
            filter_property=filter_property,
            filter_value=filter_value,
        ),
        completeness_by_property(
            class_name=class_name,
            properties=properties,
            filter_property=filter_property,
            filter_value=filter_value,
        ),
    )

    prop_list = entity_result["properties"]
    by_prop   = property_result["properties"]

    overall = (
        round(sum(p["completeness"] for p in by_prop) / len(by_prop), 2)
        if by_prop else 0.0
    )

    return {
        "class":      class_name,
        "properties": prop_list,
        "property_info": entity_result.get("property_info", []),
        "summary": {
            "total_entities":       property_result["total_entities"],
            "by_property":          by_prop,
            "overall_completeness": overall
        },
        "entities": entity_result["entities"]
    }


@router.get("/entity-count")
async def entity_count(
    class_name: Optional[str] = Query(None, description="If given, return only this class. Otherwise all mapped classes."),
):
    from app.routers.metadata_router import KNOWN_CLASSES
    target_classes = [c for c in KNOWN_CLASSES if not class_name or c["localName"] == class_name]
    if not target_classes:
        raise HTTPException(status_code=404, detail=f"Class '{class_name}' not found")

    async def count_class(cls):
        q = f"""
            {PREFIXES}
            SELECT (COUNT(DISTINCT ?entity) AS ?count) WHERE {{
                ?entity a <{cls["uri"]}> .
            }}
        """
        result = await execute_sparql(q)
        bindings = result.get("results", {}).get("bindings", [])
        count = int(bindings[0]["count"]["value"]) if bindings else 0
        return {"class": cls["localName"], "uri": cls["uri"], "count": count}

    try:
        results = list(await asyncio.gather(*[count_class(cls) for cls in target_classes]))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(e)}")

    total = sum(r["count"] for r in results)
    return {"classes": results, "total": total}


@router.get("/interlinking")
async def interlinking_completeness():
    from app.routers.metadata_router import KNOWN_CLASSES, KNOWN_PROPERTIES, ONTOLOGY_PROPERTIES

    NAME_KEYWORDS = ("name", "title", "label", "topic")

    def _find_label_props(cls_name: str) -> list[dict]:
        props = KNOWN_PROPERTIES.get(cls_name, [])
        return [p for p in props
                if p.get("type") == "data"
                and any(kw in p["localName"].lower() for kw in NAME_KEYWORDS)]

    obj_props = [p for p in ONTOLOGY_PROPERTIES if p.get("type") == "object"]
    obj_prop_uris = [p["uri"] for p in obj_props]

    prop_meta = {}
    for p in obj_props:
        prop_meta[p["uri"]] = {
            "localName": p["localName"],
            "label": p.get("label"),
            "domain": p.get("domain"),
            "range": p.get("range"),
        }

    cls_lookup = {}
    for c in KNOWN_CLASSES:
        cls_lookup[c["uri"]] = c.get("label") or c["localName"]

    def _ln(uri: str) -> str:
        return uri.split("#")[-1] if "#" in uri else uri.split("/")[-1]

    if not obj_prop_uris:
        obj_prop_filter = ""
    else:
        values = " ".join(f"<{u}>" for u in obj_prop_uris)
        obj_prop_filter = f"VALUES ?p {{ {values} }}"

    async def _process_class(cls) -> dict:
        cls_uri = cls["uri"]
        cls_name = cls["localName"]

        total_q = f"""
            {PREFIXES}
            SELECT DISTINCT ?e WHERE {{
                ?e a <{cls_uri}> .
            }}
        """

        linked_union_q = f"""
            {PREFIXES}
            SELECT DISTINCT ?e WHERE {{
                ?e a <{cls_uri}> .
                {{
                    {obj_prop_filter}
                    ?e ?p ?other .
                    FILTER(isIRI(?other))
                    FILTER(?p != rdf:type)
                }} UNION {{
                    {obj_prop_filter}
                    ?other ?p ?e .
                    FILTER(?p != rdf:type)
                }}
            }}
        """

        out_detail_q = f"""
            {PREFIXES}
            SELECT ?p (COUNT(DISTINCT ?e) AS ?n) WHERE {{
                ?e a <{cls_uri}> .
                {obj_prop_filter}
                ?e ?p ?other .
                FILTER(isIRI(?other))
                FILTER(?p != rdf:type)
            }}
            GROUP BY ?p
        """

        in_detail_q = f"""
            {PREFIXES}
            SELECT ?p (COUNT(DISTINCT ?e) AS ?n) WHERE {{
                ?e a <{cls_uri}> .
                {obj_prop_filter}
                ?other ?p ?e .
                FILTER(?p != rdf:type)
            }}
            GROUP BY ?p
        """

        try:
            total_res, union_res, out_detail_res, in_detail_res = await asyncio.gather(
                execute_sparql(total_q),
                execute_sparql(linked_union_q),
                execute_sparql(out_detail_q),
                execute_sparql(in_detail_q),
            )

            all_entities = [b["e"]["value"] for b in total_res["results"]["bindings"]]
            linked_entities = {b["e"]["value"] for b in union_res["results"]["bindings"]}
            not_linked_entities = [e for e in all_entities if e not in linked_entities]

            total = len(all_entities)
            linked_any = len(linked_entities)
            not_linked = total - linked_any
            ratio = round((linked_any / total) * 100, 2) if total > 0 else 0.0

            entity_labels: dict[str, str] = {}
            label_props = _find_label_props(cls_name)
            if label_props and all_entities:
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
                        ?e a <{cls_uri}> .
                        {optionals}
                    }}
                    GROUP BY ?e
                """
                label_res = await execute_sparql(label_q)
                for b in label_res.get("results", {}).get("bindings", []):
                    e_uri = b["e"]["value"]
                    parts = []
                    for i in range(len(label_props)):
                        val = b.get(f"val{i}", {}).get("value")
                        if val:
                            parts.append(val)
                    if parts:
                        entity_labels[e_uri] = " ".join(parts)

            def _entity_obj(uri: str) -> dict:
                return {"uri": uri, "label": entity_labels.get(uri)}

            links = []
            outgoing_total = 0
            for b in out_detail_res.get("results", {}).get("bindings", []):
                p_uri = b["p"]["value"]
                count = int(b["n"]["value"])
                outgoing_total += count
                meta = prop_meta.get(p_uri, {})
                target_uri = meta.get("range")
                links.append({
                    "direction": "outgoing",
                    "property": meta.get("localName") or _ln(p_uri),
                    "propertyLabel": meta.get("label"),
                    "targetClass": cls_lookup.get(target_uri) or (_ln(target_uri) if target_uri else None),
                    "count": count,
                })

            incoming_total = 0
            for b in in_detail_res.get("results", {}).get("bindings", []):
                p_uri = b["p"]["value"]
                count = int(b["n"]["value"])
                incoming_total += count
                meta = prop_meta.get(p_uri, {})
                source_uri = meta.get("domain")
                links.append({
                    "direction": "incoming",
                    "property": meta.get("localName") or _ln(p_uri),
                    "propertyLabel": meta.get("label"),
                    "sourceClass": cls_lookup.get(source_uri) or (_ln(source_uri) if source_uri else None),
                    "count": count,
                })

            return {
                "class": cls_name,
                "label": cls.get("label"),
                "total_entities": total,
                "linked": linked_any,
                "not_linked": not_linked,
                "outgoing": outgoing_total,
                "incoming": incoming_total,
                "ratio": ratio,
                "links": links,
                "linked_entities": [_entity_obj(e) for e in sorted(linked_entities)],
                "not_linked_entities": [_entity_obj(e) for e in sorted(not_linked_entities)],
            }
        except Exception:
            return {
                "class": cls_name,
                "label": cls.get("label"),
                "total_entities": 0,
                "linked": 0,
                "not_linked": 0,
                "outgoing": 0,
                "incoming": 0,
                "ratio": 0.0,
                "links": [],
                "linked_entities": [],
                "not_linked_entities": [],
            }

    results = list(await asyncio.gather(*[_process_class(cls) for cls in KNOWN_CLASSES]))

    total_entities = sum(r["total_entities"] for r in results)
    total_linked = sum(r["linked"] for r in results)
    overall_ratio = round((total_linked / total_entities) * 100, 2) if total_entities > 0 else 0.0

    return {
        "classes": results,
        "overall_ratio": overall_ratio,
    }


@router.get("/distinct-properties")
async def distinct_properties(
    class_name: Optional[str] = Query(None, description="If given, count properties for this class only. Otherwise all mapped classes."),
):
    from app.routers.metadata_router import KNOWN_CLASSES
    target_classes = [c for c in KNOWN_CLASSES if not class_name or c["localName"] == class_name]
    if not target_classes:
        raise HTTPException(status_code=404, detail=f"Class '{class_name}' not found")

    async def count_props(cls):
        q = f"""
            {PREFIXES}
            SELECT (COUNT(DISTINCT ?p) AS ?count) WHERE {{
                ?entity a <{cls["uri"]}> .
                ?entity ?p ?o .
            }}
        """
        result = await execute_sparql(q)
        bindings = result.get("results", {}).get("bindings", [])
        count = int(bindings[0]["count"]["value"]) if bindings else 0
        return {"class": cls["localName"], "uri": cls["uri"], "distinct_properties": count}

    try:
        results = list(await asyncio.gather(*[count_props(cls) for cls in target_classes]))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(e)}")

    total = sum(r["distinct_properties"] for r in results)
    return {"classes": results, "total_distinct": total}


@router.get("/undefined-objects")
async def undefined_objects(
    class_name: str = Query(..., description="Class to evaluate, e.g. Course"),
):
    """
    VKG-specific completeness support metric.

    For each object property expected on the selected class, count distinct
    objects that do not have the ontology range type asserted in the VKG.
    """
    from app.routers.metadata_router import KNOWN_PROPERTIES

    class_uri = resolve_class_uri(class_name)
    object_props = [
        p for p in KNOWN_PROPERTIES.get(class_name, [])
        if p.get("type") == "object"
    ]

    async def _count_for_property(prop: dict) -> dict:
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
        if not range_uri:
            return entry

        total_q = f"""
            {PREFIXES}
            SELECT (COUNT(DISTINCT ?obj) AS ?total) WHERE {{
                ?entity a <{class_uri}> .
                ?entity <{prop_uri}> ?obj .
            }}
        """
        undefined_q = f"""
            {PREFIXES}
            SELECT (COUNT(DISTINCT ?obj) AS ?undefined) WHERE {{
                ?entity a <{class_uri}> .
                ?entity <{prop_uri}> ?obj .
                FILTER NOT EXISTS {{ ?obj a <{range_uri}> }}
            }}
        """

        total_raw, undefined_raw = await asyncio.gather(
            execute_sparql(total_q),
            execute_sparql(undefined_q),
        )
        total_bindings = total_raw.get("results", {}).get("bindings", [])
        undefined_bindings = undefined_raw.get("results", {}).get("bindings", [])
        total = int(total_bindings[0]["total"]["value"]) if total_bindings else 0
        undefined = int(undefined_bindings[0]["undefined"]["value"]) if undefined_bindings else 0
        ratio = round((undefined / total) * 100, 2) if total else 0.0

        entry.update({
            "total_objects": total,
            "undefined_objects": undefined,
            "ratio": ratio,
            "status": "warning" if undefined else "ok",
        })
        return entry

    try:
        results = list(await asyncio.gather(*[_count_for_property(p) for p in object_props]))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(e)}")

    total_objects = sum(r["total_objects"] for r in results)
    total_undefined = sum(r["undefined_objects"] for r in results)
    overall_ratio = round((total_undefined / total_objects) * 100, 2) if total_objects else 0.0

    return {
        "class": class_name,
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
        return [{"name": i["localName"], "label": i.get("label")} for i in items]

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

    async def _process_class(cls) -> dict:
        cls_name = cls["localName"]
        cls_uri = cls["uri"]
        props = KNOWN_PROPERTIES.get(cls_name, [])

        try:
            total_raw = await execute_sparql(f"""
                {PREFIXES}
                SELECT (COUNT(DISTINCT ?e) AS ?n) WHERE {{ ?e a <{cls_uri}> . }}
            """)
            total_bindings = total_raw.get("results", {}).get("bindings", [])
            total = int(total_bindings[0]["n"]["value"]) if total_bindings else 0

            if total == 0 or not props:
                return {
                    "class": cls_name,
                    "label": cls.get("label"),
                    "uri": cls_uri,
                    "total_entities": total,
                    "properties_count": len(props),
                    "completeness": 0.0,
                    "by_property": [],
                }

            async def _count_prop(p) -> tuple[str, int]:
                raw = await execute_sparql(f"""
                    {PREFIXES}
                    SELECT (COUNT(DISTINCT ?e) AS ?n) WHERE {{
                        ?e a <{cls_uri}> .
                        ?e <{p["uri"]}> ?v .
                    }}
                """)
                bindings = raw.get("results", {}).get("bindings", [])
                return p["localName"], int(bindings[0]["n"]["value"]) if bindings else 0

            prop_results = await asyncio.gather(*[_count_prop(p) for p in props])

            labels = _get_property_labels(cls_name)
            by_property = []
            for prop_name, filled in prop_results:
                fill_rate = round((filled / total) * 100, 2)
                entry = {
                    "property": prop_name,
                    "filled": filled,
                    "missing": total - filled,
                    "completeness": fill_rate,
                }
                label = labels.get(prop_name)
                if label:
                    entry["label"] = label
                by_property.append(entry)

            overall = round(sum(bp["completeness"] for bp in by_property) / len(by_property), 2)

            return {
                "class": cls_name,
                "label": cls.get("label"),
                "uri": cls_uri,
                "total_entities": total,
                "properties_count": len(props),
                "completeness": overall,
                "by_property": by_property,
            }
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(e)}")

    results = list(await asyncio.gather(*[_process_class(cls) for cls in KNOWN_CLASSES]))

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
