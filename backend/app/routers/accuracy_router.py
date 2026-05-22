from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import asyncio
import statistics

from app.dependencies import execute_sparql

PREFIXES = """
    PREFIX : <http://example.org/voc#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
"""

router = APIRouter(prefix="/accuracy", tags=["accuracy"])


# ── Shared helpers ────────────────────────────────────────────────────────────

def _local_name(uri: str) -> str:
    return uri.split("#")[-1] if "#" in uri else uri.split("/")[-1]


def _bindings(raw: dict) -> list[dict]:
    return raw.get("results", {}).get("bindings", [])


def _first_int(raw: dict, var: str, default: int = 0) -> int:
    rows = _bindings(raw)
    if not rows:
        return default
    return int(rows[0][var]["value"])


def _get_class_uri(class_name: str) -> str:
    """Look up the full URI for a class by localName. Raises 404 if not found."""
    from app.routers.metadata_router import KNOWN_CLASSES
    entry = next((c for c in KNOWN_CLASSES if c["localName"] == class_name), None)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Class '{class_name}' not found")
    return entry["uri"]


def _get_class_name_by_uri(class_uri: str) -> str:
    from app.routers.metadata_router import KNOWN_CLASSES
    entry = next((c for c in KNOWN_CLASSES if c["uri"] == class_uri), None)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Class URI '{class_uri}' not found")
    return entry["localName"]


def _get_class_props(class_name: str) -> list:
    """Return the expected property list for a class. Raises 404 if not found."""
    from app.routers.metadata_router import KNOWN_PROPERTIES
    props = KNOWN_PROPERTIES.get(class_name)
    if props is None:
        raise HTTPException(status_code=404, detail=f"Class '{class_name}' not found")
    return props


def _resolve_prop_entry(
    class_name: str,
    prop_name: str,
    expected_type: str | None = None,
) -> dict:
    """Look up the full URI of a property within a class. Raises 404 if not found."""
    props = _get_class_props(class_name)
    entry = next((p for p in props if p["localName"] == prop_name), None)
    if entry is None:
        raise HTTPException(
            status_code=404,
            detail=f"Property '{prop_name}' not found on class '{class_name}'"
        )
    if expected_type and entry.get("type") != expected_type:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Property '{prop_name}' on class '{class_name}' must be a "
                f"{expected_type} property."
            ),
        )
    return entry


def _resolve_prop_uri(
    class_name: str,
    prop_name: str,
    expected_type: str | None = None,
) -> str:
    entry = _resolve_prop_entry(class_name, prop_name, expected_type)
    return entry["uri"]


def _resolve_class_prop_by_uri(
    class_name: str,
    prop_uri: str,
    expected_type: str | None = None,
) -> dict:
    props = _get_class_props(class_name)
    entry = next((p for p in props if p["uri"] == prop_uri), None)
    if entry is None:
        raise HTTPException(
            status_code=404,
            detail=f"Property URI '{prop_uri}' not found on class '{class_name}'",
        )
    if expected_type and entry.get("type") != expected_type:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Property URI '{prop_uri}' on class '{class_name}' must be a "
                f"{expected_type} property."
            ),
        )
    return entry


def _resolve_any_mapped_prop_uri(prop_uri: str) -> dict:
    from app.routers.metadata_router import KNOWN_PROPERTIES

    for props in KNOWN_PROPERTIES.values():
        for p in props:
            if p["uri"] == prop_uri:
                return p
    raise HTTPException(status_code=404, detail=f"Property URI '{prop_uri}' not found")


def _parse_source_list(
    sources_param: str | None,
    min_count: int = 1,
    default_first_two: bool = False,
) -> list[str]:
    from app.routers.metadata_router import KNOWN_SOURCES

    if sources_param:
        raw_sources = [s.strip() for s in sources_param.split(",") if s.strip()]
    else:
        raw_sources = KNOWN_SOURCES[:2] if default_first_two else list(KNOWN_SOURCES)

    source_list = list(dict.fromkeys(raw_sources))
    unknown = sorted(set(source_list) - set(KNOWN_SOURCES))
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown source prefix(es): {', '.join(unknown)}",
        )
    if len(source_list) < min_count:
        raise HTTPException(
            status_code=400,
            detail=f"At least {min_count} source(s) required.",
        )
    return source_list


def _source_membership_filter(var: str, sources: list[str]) -> str:
    clauses = " || ".join(f'STRSTARTS(STR({var}), "{s}")' for s in sources)
    return f"FILTER({clauses})"


def _sparql_502(exc: Exception) -> HTTPException:
    return HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(exc)}")


def _compute_tukey(values: list[float]) -> dict:
    """
    Compute Tukey's fence bounds using the IQR method.

    Lower fence = max(0, Q1 - 1.5 * IQR), floored at 0 (counts are non-negative)
    Upper fence = Q3 + 1.5 * IQR

    Returns insufficient_data=True when the sample is too small (< 4).
    """
    if len(values) < 4:
        mn = min(values) if values else 0.0
        mx = max(values) if values else 0.0
        return {
            "q1": mn, "q3": mx, "iqr": round(mx - mn, 4),
            "lower_fence": mn, "upper_fence": mx,
            "insufficient_data": True,
        }
    sorted_v = sorted(values)
    n = len(sorted_v)
    mid = n // 2
    q1 = statistics.median(sorted_v[:mid])
    q3 = statistics.median(sorted_v[mid + (n % 2):])
    iqr = q3 - q1
    return {
        "q1": round(q1, 4),
        "q3": round(q3, 4),
        "iqr": round(iqr, 4),
        "lower_fence": round(max(0.0, q1 - 1.5 * iqr), 4),
        "upper_fence": round(q3 + 1.5 * iqr, 4),
        "insufficient_data": False,
    }


async def _fetch_property_presence_rows(
    class_uri: str,
    props: list[dict],
) -> list[dict]:
    """
    Returns per-entity property-existence data using N+1 INNER JOIN queries
    instead of a single OPTIONAL+BIND query.

    Rationale: Ontop's SQL generation for OPTIONAL+BIND fails when a property
    has multiple OBDA source mappings that span different databases (e.g. attends
    maps to both uni1.course_registration and uni2.registration). With INNER
    JOIN semantics Ontop can eliminate impossible cross-database joins via
    URI-template matching and Teiid executes each query cleanly.

    Returns a list of {"uri": str, "prop_status": {name: bool}} dicts.
    """
    prop_names = [p["localName"] for p in props]

    entity_q = f"""
        {PREFIXES}
        SELECT DISTINCT ?entity WHERE {{
            ?entity a <{class_uri}> .
        }}
        ORDER BY ?entity
    """
    entity_raw = await execute_sparql(entity_q)
    all_uris = [b["entity"]["value"] for b in _bindings(entity_raw)]
    if not all_uris:
        return []

    async def fetch_prop_entity_set(p: dict) -> tuple[str, set[str]]:
        q = f"""
            {PREFIXES}
            SELECT DISTINCT ?entity WHERE {{
                ?entity a <{class_uri}> .
                ?entity <{p["uri"]}> ?val .
            }}
        """
        raw = await execute_sparql(q)
        has_set = {b["entity"]["value"] for b in _bindings(raw)}
        return p["localName"], has_set

    prop_results = await asyncio.gather(*(fetch_prop_entity_set(p) for p in props))
    prop_entity_sets = dict(prop_results)

    return [
        {
            "uri": uri,
            "prop_status": {
                name: (uri in prop_entity_sets[name])
                for name in prop_names
            },
        }
        for uri in all_uris
    ]


async def _two_step_count_uris(
    class_uri: str,
    prop_uri: str,
    limit: int,
) -> tuple[int, list[str], bool]:
    """
    COUNT DISTINCT entities of class_uri having prop_uri (authoritative step),
    then fetch up to `limit` entity URIs.

    Returns (count, entity_uris, entities_truncated).
    COUNT step: no error handling, failures propagate to the caller.
    URI step: failures also propagate so SA4 does not silently report zero.
    """
    count_q = f"""
        {PREFIXES}
        SELECT (COUNT(DISTINCT ?entity) AS ?count) WHERE {{
            ?entity a <{class_uri}> .
            ?entity <{prop_uri}> ?val .
        }}
    """
    count_res = await execute_sparql(count_q)
    count = _first_int(count_res, "count")

    if count == 0:
        return 0, [], False

    uri_q = f"""
        {PREFIXES}
        SELECT DISTINCT ?entity WHERE {{
            ?entity a <{class_uri}> .
            ?entity <{prop_uri}> ?val .
        }}
        LIMIT {limit + 1}
    """
    uri_res = await execute_sparql(uri_q)
    uris = [b["entity"]["value"] for b in _bindings(uri_res)]
    truncated = len(uris) > limit
    return count, uris[:limit], truncated


# ── SA1: mode implementations ──────────────────────────────────────────────────

async def _sa1_relationship_count(
    class_name: str, class_uri: str, property_name: str
) -> dict:
    prop_uri = _resolve_prop_uri(class_name, property_name, expected_type="object")

    query = f"""
        {PREFIXES}
        SELECT ?entity (COUNT(DISTINCT ?val) AS ?count) WHERE {{
            ?entity a <{class_uri}> .
            OPTIONAL {{ ?entity <{prop_uri}> ?val }}
        }}
        GROUP BY ?entity
        ORDER BY ?entity
    """
    try:
        raw = await execute_sparql(query)
    except Exception as e:
        raise _sparql_502(e)

    bindings = _bindings(raw)
    if not bindings:
        return {
            "class": class_name, "property": property_name, "type": "relationship_count",
            "statistics": {}, "outlier_count": 0, "total": 0, "entities": [],
        }

    rows = [
        {"uri": b["entity"]["value"], "count": int(b["count"]["value"])}
        for b in bindings
    ]
    stats = _compute_tukey([r["count"] for r in rows])

    entities = []
    for r in rows:
        violations = []
        if r["count"] < stats["lower_fence"]:
            violations.append({
                "criterion": "tukey_lower_bound",
                "message": (
                    f"{property_name} count is {r['count']}, expected at least "
                    f"{stats['lower_fence']}."
                ),
            })
        elif r["count"] > stats["upper_fence"]:
            violations.append({
                "criterion": "tukey_upper_bound",
                "message": (
                    f"{property_name} count is {r['count']}, expected at most "
                    f"{stats['upper_fence']}."
                ),
            })
        is_outlier = bool(violations)
        entities.append({
            "uri": r["uri"],
            "count": r["count"],
            "is_outlier": is_outlier,
            "status": "warning" if is_outlier else "ok",
            "violations": violations,
        })

    return {
        "class": class_name,
        "property": property_name,
        "type": "relationship_count",
        "statistics": stats,
        "outlier_count": sum(1 for e in entities if e["is_outlier"]),
        "total": len(entities),
        "entities": entities,
    }


async def _sa1_property_presence_anomaly(class_name: str, class_uri: str) -> dict:
    props = _get_class_props(class_name)
    if not props:
        return {
            "class": class_name, "type": "property_presence_anomaly", "properties_checked": [],
            "property_stats": [], "outlier_count": 0, "total": 0, "entities": [],
        }

    prop_names = [p["localName"] for p in props]

    try:
        rows = await _fetch_property_presence_rows(class_uri, props)
    except Exception as e:
        raise _sparql_502(e)

    if not rows:
        return {
            "class": class_name, "type": "property_presence_anomaly", "properties_checked": prop_names,
            "property_stats": [], "outlier_count": 0, "total": 0, "entities": [],
        }

    total = len(rows)
    fill_counts = {
        name: sum(1 for r in rows if r["prop_status"].get(name, False))
        for name in prop_names
    }
    property_stats = [
        {
            "property":    name,
            "fill_count":  fill_counts[name],
            "fill_rate":   round(fill_counts[name] / total, 4) if total else 0.0,
            "threshold":   0.5,
            "is_majority": (fill_counts[name] / total > 0.5) if total else False,
        }
        for name in prop_names
    ]

    # Bidirectional majority rule:
    #   fill_rate > 0.5 -> property is common, entity lacking it is unusual
    #   fill_rate < 0.5 -> property is rare, entity having it is unusual
    #   fill_rate = 0.5 -> no clear majority, no flag
    entities = []
    for r in rows:
        outlier_props = []
        violations = []
        for name in prop_names:
            fill_rate = fill_counts[name] / total if total else 0.0
            has_value = r["prop_status"].get(name, False)
            if fill_rate > 0.5 and not has_value:
                outlier_props.append({
                    "property":    name,
                    "fill_rate":   round(fill_rate, 4),
                    "fill_pct":    round(fill_rate * 100, 1),
                    "has_value":   False,
                    "is_majority": True,
                })
                violations.append({
                    "criterion": "missing_common_property",
                    "message": (
                        f"Missing {name}, present in {round(fill_rate * 100, 1)}% "
                        f"of {class_name}."
                    ),
                })
            elif fill_rate < 0.5 and has_value:
                outlier_props.append({
                    "property":    name,
                    "fill_rate":   round(fill_rate, 4),
                    "fill_pct":    round(fill_rate * 100, 1),
                    "has_value":   True,
                    "is_majority": False,
                })
                violations.append({
                    "criterion": "has_rare_property",
                    "message": (
                        f"Has {name}, present in {round(fill_rate * 100, 1)}% "
                        f"of {class_name}."
                    ),
                })
        is_outlier = bool(violations)
        filled = sum(1 for v in r["prop_status"].values() if v)
        entities.append({
            "uri":                r["uri"],
            "filled_count":       filled,
            "total_props":        len(props),
            "prop_status":        r["prop_status"],
            "outlier_properties": outlier_props,
            "is_outlier":         is_outlier,
            "status":             "warning" if is_outlier else "ok",
            "violations":         violations,
        })

    return {
        "class":              class_name,
        "type":               "property_presence_anomaly",
        "properties_checked": prop_names,
        "property_stats":     property_stats,
        "outlier_count":      sum(1 for e in entities if e["is_outlier"]),
        "total":              total,
        "entities":           entities,
    }


# ── SA1: Outlier Profiling ────────────────────────────────────────────────────

@router.get("/outliers")
async def accuracy_outliers(
    class_name: str = Query(..., description="Class to profile, e.g. GraduateStudent"),
    property: Optional[str] = Query(
        None,
        description="Required for type=relationship_count: the object property to count per entity.",
    ),
    type: str = Query(
        "relationship_count",
        description="'relationship_count' or 'property_presence_anomaly'",
    ),
):
    """
    SA1: Outlier Profiling.

    Two modes:

    relationship_count counts how many values each entity has for a given
      object property. Flags entities outside Tukey's fences (Q1±1.5×IQR,
      lower bound floored at 0). Criteria: tukey_lower_bound, tukey_upper_bound.

    property_presence_anomaly checks each expected property of the class and
      calculates the fill rate. Bidirectional majority rule:
        - fill_rate > 50%: property is common, entity lacking it is flagged
          (criterion: missing_common_property).
        - fill_rate < 50%: property is rare, entity having it is flagged
          (criterion: has_rare_property).
        - fill_rate = 50%: no clear majority, no flag.
    """
    class_uri = _get_class_uri(class_name)

    if type == "relationship_count":
        if not property:
            raise HTTPException(
                status_code=400,
                detail="'property' is required when type=relationship_count"
            )
        return await _sa1_relationship_count(class_name, class_uri, property)

    if type in {"property_presence_anomaly", "completeness"}:
        return await _sa1_property_presence_anomaly(class_name, class_uri)

    raise HTTPException(
        status_code=400,
        detail=(
            f"Unknown type '{type}'. Use 'relationship_count' or "
            "'property_presence_anomaly'."
        ),
    )


# ── SA2: Uniqueness Violation / Value Conflict Detection ─────────────────────


def _sa2_within_context(
    class_name: str,
    property: str,
    sources: str | None,
) -> dict:
    class_uri = _get_class_uri(class_name)
    prop_uri = _resolve_prop_uri(class_name, property, expected_type="data")
    source_list = _parse_source_list(sources, min_count=1)
    membership = _source_membership_filter("?entity", source_list)
    return {
        "class_name": class_name,
        "class_uri": class_uri,
        "property": property,
        "prop_uri": prop_uri,
        "sources": source_list,
        "membership": membership,
    }


async def _sa2_within_summary(ctx: dict) -> dict:
    summary_q = f"""
        {PREFIXES}
        SELECT ?entity (COUNT(DISTINCT ?val) AS ?value_count) WHERE {{
            ?entity a <{ctx["class_uri"]}> .
            {ctx["membership"]}
            OPTIONAL {{ ?entity <{ctx["prop_uri"]}> ?val }}
        }}
        GROUP BY ?entity
        ORDER BY ?entity
    """
    try:
        summary_raw = await execute_sparql(summary_q)
    except Exception as e:
        raise _sparql_502(e)

    summary_rows = [
        {
            "uri": b["entity"]["value"],
            "value_count": int(b["value_count"]["value"]),
        }
        for b in _bindings(summary_raw)
    ]

    total = len(summary_rows)
    conflict_count = sum(1 for r in summary_rows if r["value_count"] > 1)
    no_value_count = sum(1 for r in summary_rows if r["value_count"] == 0)
    clean_count = sum(1 for r in summary_rows if r["value_count"] == 1)
    conflict_rate = round(conflict_count / total * 100, 2) if total else 0.0
    sa2_score = round((1 - conflict_count / total) * 100, 2) if total else 100.0

    return {
        "class": ctx["class_name"],
        "property": ctx["property"],
        "sources": ctx["sources"],
        "counting_unit": "entity",
        "total": total,
        "conflict_count": conflict_count,
        "no_value_count": no_value_count,
        "clean_count": clean_count,
        "conflict_rate": conflict_rate,
        "sa2_score": sa2_score,
    }


def _sa2_within_entity_rows(ctx: dict, value_bindings: list[dict]) -> list[dict]:
    conflict_values: dict[str, set[str]] = {}
    for b in value_bindings:
        conflict_values.setdefault(b["entity"]["value"], set()).add(b["val"]["value"])

    conflict_entities = []
    for uri in sorted(conflict_values):
        values = sorted(conflict_values[uri])
        conflict_entities.append({
            "uri": uri,
            "property": ctx["property"],
            "values": values,
            "value_count": len(values),
            "is_conflict": True,
            "status": "error",
            "violations": [{
                "criterion": "multiple_values",
                "message": (
                    f"{ctx['property']} has {len(values)} distinct values: "
                    f"{', '.join(str(v) for v in values)}."
                ),
            }],
        })
    return conflict_entities


async def _sa2_within_rows_offset(ctx: dict, limit: int, offset: int) -> dict:
    query = f"""
        {PREFIXES}
        SELECT DISTINCT ?entity ?val WHERE {{
            {{
                SELECT DISTINCT ?entity WHERE {{
                    {{
                        SELECT ?entity (COUNT(DISTINCT ?v) AS ?n) WHERE {{
                            ?entity a <{ctx["class_uri"]}> .
                            {ctx["membership"]}
                            ?entity <{ctx["prop_uri"]}> ?v .
                        }}
                        GROUP BY ?entity
                        HAVING (?n > 1)
                    }}
                }}
                ORDER BY ?entity
                LIMIT {limit}
                OFFSET {offset}
            }}
            ?entity <{ctx["prop_uri"]}> ?val .
        }}
        ORDER BY ?entity ?val
    """
    try:
        raw = await execute_sparql(query)
    except Exception as e:
        raise _sparql_502(e)

    rows = _sa2_within_entity_rows(ctx, _bindings(raw))
    return {
        "limit": limit,
        "offset": offset,
        "returned_count": len(rows),
        "entities": rows,
    }


@router.get("/value-conflict/summary")
async def accuracy_value_conflict_summary(
    class_name: str = Query(..., description="Class to check, e.g. FullProfessor"),
    property: str = Query(..., description="Data property to check for multiple values per entity."),
    sources: Optional[str] = Query(
        None,
        description="Comma-separated source URI prefixes. Defaults to all registered sources.",
    ),
):
    """SA2 within-source population summary. Does not return table rows."""
    ctx = _sa2_within_context(class_name, property, sources)
    return await _sa2_within_summary(ctx)


@router.get("/value-conflict/rows")
async def accuracy_value_conflict_rows(
    class_name: str = Query(..., description="Class to check, e.g. FullProfessor"),
    property: str = Query(..., description="Data property to check for multiple values per entity."),
    sources: Optional[str] = Query(
        None,
        description="Comma-separated source URI prefixes. Defaults to all registered sources.",
    ),
    limit: int = Query(50, ge=1, le=500, description="Max conflict entities returned per page."),
    offset: int = Query(0, ge=0, description="Conflict entity offset for pagination."),
):
    """SA2 within-source conflict evidence rows only."""
    ctx = _sa2_within_context(class_name, property, sources)
    return await _sa2_within_rows_offset(ctx, limit, offset)


# ── SA2-cross: Cross-Source Uniqueness Violation ─────────────────────────────

def _cs_src_membership(var: str, sources: list[str]) -> str:
    return _source_membership_filter(var, sources)


def _cs_diff_source(sources: list[str]) -> str:
    same = " || ".join(
        f'(STRSTARTS(STR(?e1), "{s}") && STRSTARTS(STR(?e2), "{s}"))'
        for s in sources
    )
    return f"FILTER(!({same}))"


def _cs_find_source(uri: str, sources: list[str]) -> str:
    for s in sources:
        if uri.startswith(s):
            return s
    return "unknown"


def _cs_source_label(source_uri: str) -> str:
    return _local_name(source_uri.rstrip("/"))


def _cs_parse_sources(sources_param: str | None) -> list[str]:
    return _parse_source_list(sources_param, min_count=2, default_first_two=True)


def _sa2_cross_context(
    class_uri: str,
    identity_props: str,
    target_prop: str,
    sources: str | None,
) -> dict:
    source_list = _cs_parse_sources(sources)
    class_name = _get_class_name_by_uri(class_uri)

    prop_uris = list(dict.fromkeys(p.strip() for p in identity_props.split(",") if p.strip()))
    if not prop_uris:
        raise HTTPException(status_code=400, detail="At least one identity property required")
    if target_prop in prop_uris:
        raise HTTPException(
            status_code=400,
            detail="Target property cannot also be an identity property.",
        )

    target_entry = _resolve_class_prop_by_uri(class_name, target_prop, expected_type="data")
    identity_entries = [
        _resolve_class_prop_by_uri(class_name, uri, expected_type="data")
        for uri in prop_uris
    ]

    e1_patterns, e2_patterns = [], []
    var_names, prop_names = [], []
    for i, entry in enumerate(identity_entries):
        uri = entry["uri"]
        var = f"k{i}"
        var_names.append(var)
        prop_names.append(entry["localName"])
        e1_patterns.append(f"    ?e1 <{uri}> ?{var} .")
        e2_patterns.append(f"    ?e2 <{uri}> ?{var} .")

    return {
        "class_uri": class_uri,
        "class_name": class_name,
        "target_prop": target_prop,
        "target_property": target_entry["localName"],
        "identity_prop_uris": prop_uris,
        "identity_props": prop_names,
        "sources": source_list,
        "source_pairs": [
            (source_list[i], source_list[j])
            for i in range(len(source_list))
            for j in range(i + 1, len(source_list))
        ],
        "e1_block": "\n".join(e1_patterns),
        "e2_block": "\n".join(e2_patterns),
        "var_names": var_names,
        "id_vars_str": " ".join(f"?{v}" for v in var_names),
    }


def _sa2_cross_pair_match_body(ctx: dict, sources_for_match: list[str]) -> str:
    mem_e1 = _cs_src_membership("?e1", sources_for_match)
    mem_e2 = _cs_src_membership("?e2", sources_for_match)
    diff = _cs_diff_source(sources_for_match)
    return f"""
                    ?e1 a <{ctx["class_uri"]}> .
                    ?e2 a <{ctx["class_uri"]}> .
                    {mem_e1}
                    {mem_e2}
                    {diff}
                    FILTER(STR(?e1) < STR(?e2))
{ctx["e1_block"]}
{ctx["e2_block"]}
    """


def _sa2_cross_source_pair_count_query(ctx: dict, conflicting: bool) -> str:
    pair_blocks = []
    for left, right in ctx["source_pairs"]:
        body = _sa2_cross_pair_match_body(ctx, [left, right])
        conflict_filter = "FILTER(?v1 != ?v2)" if conflicting else ""
        pair_blocks.append(f"""
            {{
                BIND("{left}" AS ?source_a)
                BIND("{right}" AS ?source_b)
{body}
                ?e1 <{ctx["target_prop"]}> ?v1 .
                ?e2 <{ctx["target_prop"]}> ?v2 .
                {conflict_filter}
            }}
        """)

    union_body = "\nUNION\n".join(pair_blocks)
    return f"""
        {PREFIXES}
        SELECT ?source_a ?source_b (COUNT(?e1) AS ?n) WHERE {{
            {{
                SELECT DISTINCT ?source_a ?source_b ?e1 ?e2 WHERE {{
{union_body}
                }}
            }}
        }}
        GROUP BY ?source_a ?source_b
        ORDER BY ?source_a ?source_b
    """


async def _sa2_cross_summary(ctx: dict) -> dict:
    grouped_total_q = _sa2_cross_source_pair_count_query(ctx, conflicting=False)
    grouped_conflict_q = _sa2_cross_source_pair_count_query(ctx, conflicting=True)

    try:
        total_by_pair_raw, conflict_by_pair_raw = await asyncio.gather(
            execute_sparql(grouped_total_q),
            execute_sparql(grouped_conflict_q),
        )
    except Exception as ex:
        raise _sparql_502(ex)

    def pair_counts(raw: dict) -> dict[tuple[str, str], int]:
        counts: dict[tuple[str, str], int] = {}
        for b in _bindings(raw):
            counts[(b["source_a"]["value"], b["source_b"]["value"])] = int(b["n"]["value"])
        return counts

    totals_by_pair = pair_counts(total_by_pair_raw)
    conflicts_by_pair = pair_counts(conflict_by_pair_raw)
    total_matched = sum(totals_by_pair.values())
    conflict_count = sum(conflicts_by_pair.values())

    source_pair_summary = []
    for left, right in ctx["source_pairs"]:
        total_pair = totals_by_pair.get((left, right), 0)
        conflict_pair = conflicts_by_pair.get((left, right), 0)
        conflict_rate_pair = round(conflict_pair / total_pair * 100, 2) if total_pair else 0.0
        score_pair = round((1 - conflict_pair / total_pair) * 100, 2) if total_pair else 100.0
        source_pair_summary.append({
            "source_a": left,
            "source_b": right,
            "source_a_label": _cs_source_label(left),
            "source_b_label": _cs_source_label(right),
            "total_matched": total_pair,
            "conflicting_pairs": conflict_pair,
            "conflict_rate": conflict_rate_pair,
            "sa2_cross_score": score_pair,
        })

    conflict_rate = round(conflict_count / total_matched * 100, 2) if total_matched else 0.0
    sa2_score = round((1 - conflict_count / total_matched) * 100, 2) if total_matched else 100.0

    return {
        "class_uri": ctx["class_uri"],
        "target_property": ctx["target_property"],
        "target_prop_uri": ctx["target_prop"],
        "identity_props": ctx["identity_props"],
        "identity_prop_uris": ctx["identity_prop_uris"],
        "sources": ctx["sources"],
        "counting_unit": "undirected_entity_pair",
        "total_matched": total_matched,
        "conflicting_pairs": conflict_count,
        "conflict_rate": conflict_rate,
        "sa2_cross_score": sa2_score,
        "source_pair_summary": source_pair_summary,
    }


def _sa2_cross_pair_rows(ctx: dict, value_bindings: list[dict]) -> list[dict]:
    pairs_by_key: dict[tuple[str, str], dict] = {}
    for row in value_bindings:
        e1_uri = row["e1"]["value"]
        e2_uri = row["e2"]["value"]
        key = (e1_uri, e2_uri)
        pair = pairs_by_key.setdefault(key, {
            "identity_values": {name: set() for name in ctx["identity_props"]},
            "e1": {
                "uri": e1_uri,
                "source": _cs_find_source(e1_uri, ctx["sources"]),
                "values": set(),
            },
            "e2": {
                "uri": e2_uri,
                "source": _cs_find_source(e2_uri, ctx["sources"]),
                "values": set(),
            },
        })
        for i, var in enumerate(ctx["var_names"]):
            if var in row:
                pair["identity_values"][ctx["identity_props"][i]].add(row[var]["value"])
        pair["e1"]["values"].add(row.get("v1", {}).get("value", ""))
        pair["e2"]["values"].add(row.get("v2", {}).get("value", ""))

    pairs = []
    for key in sorted(pairs_by_key):
        pair = pairs_by_key[key]
        e1_values = sorted(v for v in pair["e1"]["values"] if v != "")
        e2_values = sorted(v for v in pair["e2"]["values"] if v != "")
        pairs.append({
            "identity_values": {
                name: ", ".join(sorted(values))
                for name, values in pair["identity_values"].items()
            },
            "e1": {
                "uri": pair["e1"]["uri"],
                "source": pair["e1"]["source"],
                "values": e1_values,
                "value": ", ".join(e1_values),
            },
            "e2": {
                "uri": pair["e2"]["uri"],
                "source": pair["e2"]["source"],
                "values": e2_values,
                "value": ", ".join(e2_values),
            },
        })
    return pairs


async def _sa2_cross_rows_offset(ctx: dict, limit: int, offset: int) -> dict:
    pair_match_body = _sa2_cross_pair_match_body(ctx, ctx["sources"])
    query = f"""
        {PREFIXES}
        SELECT DISTINCT {ctx["id_vars_str"]} ?e1 ?e2 ?v1 ?v2 WHERE {{
            {{
                SELECT DISTINCT ?e1 ?e2 WHERE {{
{pair_match_body}
                    ?e1 <{ctx["target_prop"]}> ?page_v1 .
                    ?e2 <{ctx["target_prop"]}> ?page_v2 .
                    FILTER(?page_v1 != ?page_v2)
                }}
                ORDER BY ?e1 ?e2
                LIMIT {limit}
                OFFSET {offset}
            }}
{ctx["e1_block"]}
{ctx["e2_block"]}
            ?e1 <{ctx["target_prop"]}> ?v1 .
            ?e2 <{ctx["target_prop"]}> ?v2 .
            FILTER(?v1 != ?v2)
        }}
        ORDER BY ?e1 ?e2 ?v1 ?v2
    """
    try:
        raw = await execute_sparql(query)
    except Exception as ex:
        raise _sparql_502(ex)

    rows = _sa2_cross_pair_rows(ctx, _bindings(raw))
    return {
        "limit": limit,
        "offset": offset,
        "returned_count": len(rows),
        "sample_size": len(rows),
        "pairs": rows,
        "sample": rows,
    }


@router.get("/value-conflict/cross-source/summary")
async def accuracy_value_conflict_cross_source_summary(
    class_uri: str = Query(..., description="Full URI of the class to evaluate"),
    identity_props: str = Query(
        ...,
        description="Comma-separated full property URIs for identity matching.",
    ),
    target_prop: str = Query(
        ...,
        description="Full URI of the single-valued property to check for conflicts.",
    ),
    sources: Optional[str] = Query(
        None,
        description="Comma-separated source URI prefixes. Defaults to the first 2 registered sources.",
    ),
):
    """SA2 cross-source population summary. Does not return table rows."""
    ctx = _sa2_cross_context(class_uri, identity_props, target_prop, sources)
    return await _sa2_cross_summary(ctx)


@router.get("/value-conflict/cross-source/rows")
async def accuracy_value_conflict_cross_source_rows(
    class_uri: str = Query(..., description="Full URI of the class to evaluate"),
    identity_props: str = Query(
        ...,
        description="Comma-separated full property URIs for identity matching.",
    ),
    target_prop: str = Query(
        ...,
        description="Full URI of the single-valued property to check for conflicts.",
    ),
    sources: Optional[str] = Query(
        None,
        description="Comma-separated source URI prefixes. Defaults to the first 2 registered sources.",
    ),
    limit: int = Query(50, ge=1, le=500, description="Max conflict pairs returned per page."),
    offset: int = Query(0, ge=0, description="Conflict pair offset for pagination."),
    sample_limit: Optional[int] = Query(None, ge=1, le=500, description="Deprecated alias for limit."),
):
    """SA2 cross-source conflict evidence rows only."""
    ctx = _sa2_cross_context(class_uri, identity_props, target_prop, sources)
    effective_limit = sample_limit if sample_limit is not None else limit
    return await _sa2_cross_rows_offset(ctx, effective_limit, offset)


# ── SA4: Property Misuse Detection, per-property view ─────────────────────────

@router.get("/property-misuse/by-property")
async def accuracy_property_misuse_by_property(
    property_uri: str = Query(
        ...,
        description="Full property URI, e.g. http://example.org/voc#givesLab.",
    ),
):
    """
    SA4: Property Misuse Detection, per-property view.

    For a given property, iterates over every known class and reports:
      • Classes where the property IS expected (per ontology domain constraints):
        always included, even when count = 0.
      • Classes where the property is NOT expected:
        only included when count > 0 (these are the misuse findings).

    Avoids the Ontop TBox-inference artifact of the per-class view and directly
    answers "where is this property being misused?".
    """
    from app.routers.metadata_router import KNOWN_CLASSES, KNOWN_PROPERTIES

    prop_entry = _resolve_any_mapped_prop_uri(property_uri)
    expected_for: set[str] = {
        cls_name
        for cls_name, props in KNOWN_PROPERTIES.items()
        for p in props
        if p["uri"] == property_uri
    }

    prop_local = prop_entry["localName"]
    ENTITY_LIMIT = 20

    async def evaluate_class(cls: dict) -> dict | None:
        cls_name = cls["localName"]
        cls_uri = cls["uri"]
        is_expected = cls_name in expected_for

        count, entity_uris, entities_truncated = await _two_step_count_uris(
            cls_uri, property_uri, ENTITY_LIMIT
        )

        if not is_expected and count == 0:
            return None

        return {
            "class":              cls_name,
            "class_uri":          cls_uri,
            "expected":           is_expected,
            "count":              count,
            "entity_uris":        entity_uris,
            "entities_truncated": entities_truncated,
        }

    try:
        evaluated = await asyncio.gather(*(evaluate_class(cls) for cls in KNOWN_CLASSES))
    except Exception as e:
        raise _sparql_502(e)

    class_results = [r for r in evaluated if r is not None]
    class_results.sort(key=lambda r: (0 if not r["expected"] else 1, -r["count"], r["class"]))
    total_expected_count = sum(r["count"] for r in class_results if r["expected"])
    total_misuse_count = sum(r["count"] for r in class_results if not r["expected"])
    total_property_uses = total_expected_count + total_misuse_count
    sa4_score = (
        round(total_expected_count / total_property_uses * 100, 2)
        if total_property_uses
        else 100.0
    )

    return {
        "property":             prop_local,
        "uri":                  property_uri,
        "expected_for_classes": sorted(expected_for),
        "total_expected_count": total_expected_count,
        "total_misuse_count":   total_misuse_count,
        "total_property_uses":  total_property_uses,
        "sa4_score":            sa4_score,
        "classes":              class_results,
    }
