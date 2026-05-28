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
    """Extract the local name from a URI for display and metadata matching."""
    return uri.split("#")[-1] if "#" in uri else uri.split("/")[-1]


def _bindings(raw: dict) -> list[dict]:
    """Return SPARQL result bindings with a safe empty-list fallback."""
    return raw.get("results", {}).get("bindings", [])


def _first_int(raw: dict, var: str, default: int = 0) -> int:
    """Read the first integer value from a SPARQL aggregate result."""
    rows = _bindings(raw)
    if not rows:
        return default
    return int(rows[0][var]["value"])


def _validate_class_uri(class_uri: str) -> dict:
    """Look up a class by full URI. Returns the class dict. Raises 404 if not found."""
    from app.routers.metadata_router import KNOWN_CLASSES_BY_URI
    entry = KNOWN_CLASSES_BY_URI.get(class_uri)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Class '{class_uri}' not found")
    return entry


def _get_class_props(class_uri: str) -> list:
    """Return the expected property list for a class. Raises 404 if not found."""
    from app.routers.metadata_router import KNOWN_PROPERTIES
    props = KNOWN_PROPERTIES.get(class_uri)
    if props is None:
        raise HTTPException(status_code=404, detail=f"Class '{class_uri}' not found")
    return props


def _resolve_prop_by_uri(
    class_uri: str,
    prop_uri: str,
    expected_type: str | None = None,
) -> dict:
    """Resolve a full property URI within a class and optionally validate its type."""
    props = _get_class_props(class_uri)
    entry = next((p for p in props if p["uri"] == prop_uri), None)
    if entry is None:
        raise HTTPException(
            status_code=404,
            detail=f"Property '{prop_uri}' not found on class '{class_uri}'",
        )
    if expected_type and entry.get("type") != expected_type:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Property '{prop_uri}' on class '{class_uri}' must be a "
                f"{expected_type} property."
            ),
        )
    return entry


def _resolve_any_mapped_prop_uri(prop_uri: str) -> dict:
    """Resolve any mapped property URI across all classes."""
    from app.routers.metadata_router import KNOWN_PROPERTIES

    for props in KNOWN_PROPERTIES.values():
        for p in props:
            if p["uri"] == prop_uri:
                return p
    raise HTTPException(status_code=404, detail=f"Property URI '{prop_uri}' not found")


def _parse_facets(
    filter_facets: Optional[str],
    class_uri: str,
) -> list[tuple[str, str | None]]:
    """Parse optional object-property facets used to narrow the evaluated population."""
    if not filter_facets:
        return []

    class_props = {p["uri"]: p for p in _get_class_props(class_uri)}
    facets: list[tuple[str, str | None]] = []
    for token in filter_facets.split(","):
        token = token.strip()
        if not token:
            continue
        if "::" in token:
            pred, obj = token.split("::", 1)
            pred = pred.strip()
            obj = obj.strip()
            if not pred or not obj:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Invalid facet '{token}'. Both predicate and object "
                        "are required when using '::'."
                    ),
                )
        else:
            pred = token
            obj = None

        prop = class_props.get(pred)
        if prop is None:
            raise HTTPException(
                status_code=400,
                detail=f"Facet property '{pred}' is not a known property for class '{class_uri}'.",
            )
        if prop.get("type") != "object":
            raise HTTPException(
                status_code=400,
                detail="Facet filters must use object properties.",
            )
        facets.append((pred, obj))

    return facets


def _build_facet_clauses(
    subject_var: str,
    facets: list[tuple[str, str | None]],
) -> str:
    """Build SPARQL clauses that apply all facet filters with AND semantics."""
    if not facets:
        return ""

    tag = subject_var.lstrip("?")
    lines = []
    for i, (pred, obj) in enumerate(facets):
        if obj is None:
            lines.append(f"            {subject_var} <{pred}> ?_fac_{tag}_{i} .")
        else:
            lines.append(f"            {subject_var} <{pred}> <{obj}> .")
    return "\n".join(lines)


def _parse_source_list(
    sources_param: str | None,
    min_count: int = 1,
    default_first_two: bool = False,
) -> list[str]:
    """Parse, validate, deduplicate, and canonically order selected source prefixes."""
    from app.routers.metadata_router import KNOWN_SOURCES

    known_source_uris = [
        source["uri"] if isinstance(source, dict) else source
        for source in KNOWN_SOURCES
    ]

    if sources_param:
        raw_sources = [s.strip() for s in sources_param.split(",") if s.strip()]
    else:
        raw_sources = known_source_uris[:2] if default_first_two else list(known_source_uris)

    unique_sources = list(dict.fromkeys(raw_sources))
    unknown = sorted(set(unique_sources) - set(known_source_uris))
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown source prefix(es): {', '.join(unknown)}",
        )
    source_list = [source for source in known_source_uris if source in unique_sources]
    if len(source_list) < min_count:
        raise HTTPException(
            status_code=400,
            detail=f"At least {min_count} source(s) required.",
        )
    return source_list


def _source_membership_filter(var: str, sources: list[str]) -> str:
    """Build a SPARQL filter restricting a variable to selected source URI prefixes."""
    clauses = " || ".join(f'STRSTARTS(STR({var}), "{s}")' for s in sources)
    return f"FILTER({clauses})"


def _sparql_502(exc: Exception) -> HTTPException:
    """Wrap SPARQL failures as API-facing 502 errors."""
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
    facets: list[tuple[str, str | None]],
) -> list[dict]:
    """
    Returns per-entity property-existence data using N+1 INNER JOIN queries
    instead of a single OPTIONAL+BIND query.

    Rationale: Ontop's SQL generation for OPTIONAL+BIND fails when a property
    has multiple OBDA source mappings that span different databases (e.g. attends
    maps to both compsci.course_registration and mathsci.registration). With INNER
    JOIN semantics Ontop can eliminate impossible cross-database joins via
    URI-template matching and Teiid executes each query cleanly.

    Returns a list of {"uri": str, "prop_status": {name: bool}} dicts.
    """
    prop_names = [p["localName"] for p in props]
    facet_clauses = _build_facet_clauses("?entity", facets)

    entity_q = f"""
        {PREFIXES}
        SELECT DISTINCT ?entity WHERE {{
            ?entity a <{class_uri}> .
{facet_clauses}
        }}
    """
    entity_raw = await execute_sparql(entity_q)
    all_uris = sorted(b["entity"]["value"] for b in _bindings(entity_raw))
    if not all_uris:
        return []

    async def fetch_prop_entity_set(p: dict) -> tuple[str, set[str]]:
        """Fetch the set of entities that have one selected property."""
        q = f"""
            {PREFIXES}
            SELECT DISTINCT ?entity WHERE {{
                ?entity a <{class_uri}> .
{facet_clauses}
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
    count = await _count_distinct_property_entities(class_uri, prop_uri)
    if count == 0:
        return 0, [], False

    uris, truncated = await _fetch_property_entity_uris(class_uri, prop_uri, limit)
    return count, uris, truncated


async def _count_distinct_property_entities(class_uri: str, prop_uri: str) -> int:
    """COUNT DISTINCT entities of class_uri having prop_uri."""
    count_q = f"""
        {PREFIXES}
        SELECT (COUNT(DISTINCT ?entity) AS ?count) WHERE {{
            ?entity a <{class_uri}> .
            ?entity <{prop_uri}> ?val .
        }}
    """
    count_res = await execute_sparql(count_q)
    return _first_int(count_res, "count")


async def _fetch_property_entity_uris(
    class_uri: str,
    prop_uri: str,
    limit: int,
) -> tuple[list[str], bool]:
    """Fetch up to limit entity URIs of class_uri having prop_uri."""
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
    return uris[:limit], truncated


# ── SA1: mode implementations ──────────────────────────────────────────────────

async def _sa1_relationship_count(
    class_uri: str,
    class_name: str,
    property_uri: str,
    facets: list[tuple[str, str | None]],
) -> dict:
    """Run SA1 relationship-count outlier profiling with Tukey fences."""
    prop_entry = _resolve_prop_by_uri(class_uri, property_uri, expected_type="object")
    prop_uri = prop_entry["uri"]
    property_name = prop_entry["localName"]
    facet_clauses = _build_facet_clauses("?entity", facets)

    query = f"""
        {PREFIXES}
        SELECT ?entity (COUNT(DISTINCT ?val) AS ?count) WHERE {{
            ?entity a <{class_uri}> .
{facet_clauses}
            OPTIONAL {{ ?entity <{prop_uri}> ?val }}
        }}
        GROUP BY ?entity
    """
    try:
        raw = await execute_sparql(query)
    except Exception as e:
        raise _sparql_502(e)

    bindings = _bindings(raw)
    if not bindings:
        return {
            "uri": class_uri, "class": class_name, "property": property_name, "type": "relationship_count",
            "statistics": {}, "outlier_count": 0, "total": 0, "entities": [],
        }

    rows = [
        {"uri": b["entity"]["value"], "count": int(b["count"]["value"])}
        for b in bindings
    ]
    rows.sort(key=lambda row: row["uri"])
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
        "uri": class_uri,
        "class": class_name,
        "property": property_name,
        "type": "relationship_count",
        "statistics": stats,
        "outlier_count": sum(1 for e in entities if e["is_outlier"]),
        "total": len(entities),
        "entities": entities,
    }


async def _sa1_property_presence_anomaly(
    class_uri: str,
    class_name: str,
    facets: list[tuple[str, str | None]],
) -> dict:
    """Run SA1 property-presence anomaly profiling for all mapped class properties."""
    props = _get_class_props(class_uri)
    if not props:
        return {
            "uri": class_uri, "class": class_name, "type": "property_presence_anomaly", "properties_checked": [],
            "property_stats": [], "outlier_count": 0, "total": 0, "entities": [],
        }

    prop_names = [p["localName"] for p in props]

    try:
        rows = await _fetch_property_presence_rows(class_uri, props, facets)
    except Exception as e:
        raise _sparql_502(e)

    if not rows:
        return {
            "uri": class_uri, "class": class_name, "type": "property_presence_anomaly", "properties_checked": prop_names,
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
    #   fill_rate > 0.5 -> property is usually present, absence is unusual
    #   fill_rate < 0.5 -> property is usually absent, presence is unusual
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
                        f"{name} is absent here, but usually present for {class_name}."
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
                        f"{name} is present here, but usually absent for {class_name}."
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
        "uri":                class_uri,
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
    class_uri: str = Query(..., description="Full class URI, e.g. http://example.org/voc#GraduateStudent"),
    property_uri: Optional[str] = Query(
        None,
        description="Required for type=relationship_count: full URI of the object property to count per entity.",
    ),
    type: str = Query(
        "relationship_count",
        description="'relationship_count' or 'property_presence_anomaly'",
    ),
    filter_facets: Optional[str] = Query(
        None,
        description="Comma-separated object-property facets. Use prop_uri or prop_uri::object_uri.",
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
        - fill_rate > 50%: property is usually present, absence is flagged
          (criterion: missing_common_property).
        - fill_rate < 50%: property is usually absent, presence is flagged
          (criterion: has_rare_property).
        - fill_rate = 50%: no clear majority, no flag.
    """
    class_entry = _validate_class_uri(class_uri)
    class_name = class_entry["localName"]
    facets = _parse_facets(filter_facets, class_uri)

    if type == "relationship_count":
        if not property_uri:
            raise HTTPException(
                status_code=400,
                detail="'property_uri' is required when type=relationship_count"
            )
        return await _sa1_relationship_count(class_uri, class_name, property_uri, facets)

    if type in {"property_presence_anomaly", "completeness"}:
        return await _sa1_property_presence_anomaly(class_uri, class_name, facets)

    raise HTTPException(
        status_code=400,
        detail=(
            f"Unknown type '{type}'. Use 'relationship_count' or "
            "'property_presence_anomaly'."
        ),
    )


# ── SA2: Uniqueness Violation / Value Conflict Detection ─────────────────────


def _sa2_identity_rule(
    class_uri: str,
    identity_props: str,
    target_prop: str,
) -> dict:
    """Build and validate the shared SA2 functional-dependency rule context."""
    prop_uris = list(dict.fromkeys(p.strip() for p in identity_props.split(",") if p.strip()))
    if not prop_uris:
        raise HTTPException(status_code=400, detail="At least one identity property required.")
    if target_prop in prop_uris:
        raise HTTPException(
            status_code=400,
            detail="Target property cannot also be an identity property.",
        )

    target_entry = _resolve_prop_by_uri(class_uri, target_prop, expected_type="data")
    identity_entries = [
        _resolve_prop_by_uri(class_uri, uri, expected_type="data")
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
        "target_prop": target_prop,
        "target_property": target_entry["localName"],
        "identity_prop_uris": prop_uris,
        "identity_props": prop_names,
        "e1_block": "\n".join(e1_patterns),
        "e2_block": "\n".join(e2_patterns),
        "var_names": var_names,
        "id_vars_str": " ".join(f"?{v}" for v in var_names),
    }


def _sa2_pair_rows(ctx: dict, value_bindings: list[dict]) -> list[dict]:
    """Convert raw SA2 SPARQL bindings into display-ready entity-pair rows."""
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


def _sa2_within_context(
    class_uri: str,
    identity_props: str,
    target_prop: str,
    sources: str | None,
    filter_facets: str | None,
) -> dict:
    """Build the context needed for an intra-source SA2 request."""
    class_entry = _validate_class_uri(class_uri)
    source_list = _parse_source_list(sources, min_count=1)
    rule = _sa2_identity_rule(class_uri, identity_props, target_prop)
    facets = _parse_facets(filter_facets, class_uri)
    return {
        **rule,
        "class_name": class_entry["localName"],
        "class_uri": class_uri,
        "sources": source_list,
        "facets": facets,
    }


def _sa2_within_pair_match_body(ctx: dict, source: str) -> str:
    """Build the SPARQL body that matches comparable pairs inside one source."""
    mem_e1 = _source_membership_filter("?e1", [source])
    mem_e2 = _source_membership_filter("?e2", [source])
    facet_e1 = _build_facet_clauses("?e1", ctx["facets"])
    facet_e2 = _build_facet_clauses("?e2", ctx["facets"])
    return f"""
                    ?e1 a <{ctx["class_uri"]}> .
                    ?e2 a <{ctx["class_uri"]}> .
                    {mem_e1}
                    {mem_e2}
                    FILTER(STR(?e1) < STR(?e2))
{facet_e1}
{facet_e2}
{ctx["e1_block"]}
{ctx["e2_block"]}
    """


def _sa2_within_source_count_query(ctx: dict, conflicting: bool) -> str:
    """Build an intra-source SA2 aggregate count query."""
    source_blocks = []
    for source in ctx["sources"]:
        body = _sa2_within_pair_match_body(ctx, source)
        conflict_filter = "FILTER(?v1 != ?v2)" if conflicting else ""
        source_blocks.append(f"""
            {{
                BIND("{source}" AS ?source)
{body}
                ?e1 <{ctx["target_prop"]}> ?v1 .
                ?e2 <{ctx["target_prop"]}> ?v2 .
                {conflict_filter}
            }}
        """)

    union_body = "\nUNION\n".join(source_blocks)
    return f"""
        {PREFIXES}
        SELECT ?source (COUNT(?e1) AS ?n) WHERE {{
            {{
                SELECT DISTINCT ?source ?e1 ?e2 WHERE {{
{union_body}
                }}
            }}
        }}
        GROUP BY ?source
        ORDER BY ?source
    """


async def _sa2_within_summary(ctx: dict) -> dict:
    """Compute the full intra-source SA2 summary and per-source breakdown."""
    grouped_total_q = _sa2_within_source_count_query(ctx, conflicting=False)
    grouped_conflict_q = _sa2_within_source_count_query(ctx, conflicting=True)

    try:
        total_by_source_raw, conflict_by_source_raw = await asyncio.gather(
            execute_sparql(grouped_total_q),
            execute_sparql(grouped_conflict_q),
        )
    except Exception as e:
        raise _sparql_502(e)

    def source_counts(raw: dict) -> dict[str, int]:
        """Convert grouped SPARQL aggregate rows into a source-to-count map."""
        return {b["source"]["value"]: int(b["n"]["value"]) for b in _bindings(raw)}

    totals_by_source = source_counts(total_by_source_raw)
    conflicts_by_source = source_counts(conflict_by_source_raw)
    total_matched = sum(totals_by_source.values())
    conflict_count = sum(conflicts_by_source.values())

    source_summary = []
    for source in ctx["sources"]:
        total_source = totals_by_source.get(source, 0)
        conflict_source = conflicts_by_source.get(source, 0)
        conflict_rate_source = round(conflict_source / total_source * 100, 2) if total_source else None
        score_source = round((1 - conflict_source / total_source) * 100, 2) if total_source else None
        source_summary.append({
            "source": source,
            "source_label": _cs_source_label(source),
            "total_matched": total_source,
            "conflicting_pairs": conflict_source,
            "conflict_rate": conflict_rate_source,
            "sa2_score": score_source,
        })

    conflict_rate = round(conflict_count / total_matched * 100, 2) if total_matched else None
    sa2_score = round((1 - conflict_count / total_matched) * 100, 2) if total_matched else None

    return {
        "uri": ctx["class_uri"],
        "class": ctx["class_name"],
        "target_property": ctx["target_property"],
        "target_prop_uri": ctx["target_prop"],
        "identity_props": ctx["identity_props"],
        "identity_prop_uris": ctx["identity_prop_uris"],
        "sources": ctx["sources"],
        "counting_unit": "same_source_entity_pair",
        "total_matched": total_matched,
        "conflicting_pairs": conflict_count,
        "conflict_rate": conflict_rate,
        "sa2_score": sa2_score,
        "source_summary": source_summary,
    }


async def _sa2_within_rows_offset(ctx: dict, limit: int, offset: int) -> dict:
    """Fetch one offset-paginated page of intra-source SA2 conflict evidence."""
    source_blocks = []
    for source in ctx["sources"]:
        body = _sa2_within_pair_match_body(ctx, source)
        source_blocks.append(f"""
                    {{
{body}
                        ?e1 <{ctx["target_prop"]}> ?page_v1 .
                        ?e2 <{ctx["target_prop"]}> ?page_v2 .
                        FILTER(?page_v1 != ?page_v2)
                    }}
        """)
    union_body = "\nUNION\n".join(source_blocks)

    # Avoid ORDER BY on URI variables here. Ontop/Teiid can fail when sorting
    # RDF resources generated from URI templates, especially on TimeSlot rows.
    query = f"""
        {PREFIXES}
        SELECT DISTINCT {ctx["id_vars_str"]} ?e1 ?e2 ?v1 ?v2 WHERE {{
            {{
                SELECT DISTINCT ?e1 ?e2 WHERE {{
{union_body}
                }}
                LIMIT {limit}
                OFFSET {offset}
            }}
{ctx["e1_block"]}
{ctx["e2_block"]}
            ?e1 <{ctx["target_prop"]}> ?v1 .
            ?e2 <{ctx["target_prop"]}> ?v2 .
            FILTER(?v1 != ?v2)
        }}
    """
    try:
        raw = await execute_sparql(query)
    except Exception as e:
        raise _sparql_502(e)

    rows = _sa2_pair_rows(ctx, _bindings(raw))
    return {
        "limit": limit,
        "offset": offset,
        "returned_count": len(rows),
        "sample_size": len(rows),
        "pairs": rows,
        "sample": rows,
    }


@router.get("/value-conflict/summary")
async def accuracy_value_conflict_summary(
    class_uri: str = Query(..., description="Full class URI, e.g. http://example.org/voc#FullProfessor"),
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
        description="Comma-separated source URI prefixes. Defaults to all registered sources.",
    ),
    filter_facets: Optional[str] = Query(
        None,
        description="Comma-separated object-property facets. Use prop_uri or prop_uri::object_uri.",
    ),
):
    """SA2 intra-source population summary. Does not return table rows."""
    ctx = _sa2_within_context(class_uri, identity_props, target_prop, sources, filter_facets)
    return await _sa2_within_summary(ctx)


@router.get("/value-conflict/rows")
async def accuracy_value_conflict_rows(
    class_uri: str = Query(..., description="Full class URI, e.g. http://example.org/voc#FullProfessor"),
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
        description="Comma-separated source URI prefixes. Defaults to all registered sources.",
    ),
    filter_facets: Optional[str] = Query(
        None,
        description="Comma-separated object-property facets. Use prop_uri or prop_uri::object_uri.",
    ),
    limit: int = Query(50, ge=1, le=500, description="Max conflict pairs returned per page."),
    offset: int = Query(0, ge=0, description="Conflict pair offset for pagination."),
):
    """SA2 intra-source conflict evidence rows only."""
    ctx = _sa2_within_context(class_uri, identity_props, target_prop, sources, filter_facets)
    return await _sa2_within_rows_offset(ctx, limit, offset)


# ── SA2-cross: Cross-Source Uniqueness Violation ─────────────────────────────

def _cs_src_membership(var: str, sources: list[str]) -> str:
    """Build a source-membership filter for cross-source SA2 queries."""
    return _source_membership_filter(var, sources)


def _cs_diff_source(sources: list[str]) -> str:
    """Build a SPARQL filter requiring compared entities to come from different sources."""
    same = " || ".join(
        f'(STRSTARTS(STR(?e1), "{s}") && STRSTARTS(STR(?e2), "{s}"))'
        for s in sources
    )
    return f"FILTER(!({same}))"


def _cs_find_source(uri: str, sources: list[str]) -> str:
    """Return the selected source prefix that contains an entity URI."""
    for s in sources:
        if uri.startswith(s):
            return s
    return "unknown"


def _cs_source_label(source_uri: str) -> str:
    """Convert a source URI prefix into a short display label."""
    return _local_name(source_uri.rstrip("/"))


def _cs_parse_sources(sources_param: str | None) -> list[str]:
    """Parse and validate source prefixes for cross-source SA2."""
    return _parse_source_list(sources_param, min_count=2, default_first_two=True)


def _sa2_cross_context(
    class_uri: str,
    identity_props: str,
    target_prop: str,
    sources: str | None,
    filter_facets: str | None,
) -> dict:
    """Build the context needed for a cross-source SA2 request."""
    source_list = _cs_parse_sources(sources)
    class_entry = _validate_class_uri(class_uri)
    rule = _sa2_identity_rule(class_uri, identity_props, target_prop)
    facets = _parse_facets(filter_facets, class_uri)

    return {
        **rule,
        "class_uri": class_uri,
        "class_name": class_entry["localName"],
        "sources": source_list,
        "facets": facets,
        "source_pairs": [
            (source_list[i], source_list[j])
            for i in range(len(source_list))
            for j in range(i + 1, len(source_list))
        ],
    }


def _sa2_cross_pair_match_body(ctx: dict, sources_for_match: list[str]) -> str:
    """Build the SPARQL body that matches comparable pairs between source pairs."""
    mem_e1 = _cs_src_membership("?e1", sources_for_match)
    mem_e2 = _cs_src_membership("?e2", sources_for_match)
    diff = _cs_diff_source(sources_for_match)
    facet_e1 = _build_facet_clauses("?e1", ctx["facets"])
    facet_e2 = _build_facet_clauses("?e2", ctx["facets"])
    return f"""
                    ?e1 a <{ctx["class_uri"]}> .
                    ?e2 a <{ctx["class_uri"]}> .
                    {mem_e1}
                    {mem_e2}
                    {diff}
                    FILTER(STR(?e1) < STR(?e2))
{facet_e1}
{facet_e2}
{ctx["e1_block"]}
{ctx["e2_block"]}
    """


def _sa2_cross_source_pair_count_query(ctx: dict, conflicting: bool) -> str:
    """Build a cross-source SA2 aggregate count query per source pair."""
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
    """Compute the full cross-source SA2 summary and per-source-pair breakdown."""
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
        """Convert grouped SPARQL aggregate rows into a source-pair-to-count map."""
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
        conflict_rate_pair = round(conflict_pair / total_pair * 100, 2) if total_pair else None
        score_pair = round((1 - conflict_pair / total_pair) * 100, 2) if total_pair else None
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

    conflict_rate = round(conflict_count / total_matched * 100, 2) if total_matched else None
    sa2_score = round((1 - conflict_count / total_matched) * 100, 2) if total_matched else None

    return {
        "uri": ctx["class_uri"],
        "class": ctx["class_name"],
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


async def _sa2_cross_rows_offset(ctx: dict, limit: int, offset: int) -> dict:
    """Fetch one offset-paginated page of cross-source SA2 conflict evidence."""
    pair_match_body = _sa2_cross_pair_match_body(ctx, ctx["sources"])
    # Avoid ORDER BY on URI variables here for the same Ontop/Teiid reason as
    # the intra-source rows endpoint.
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
                LIMIT {limit}
                OFFSET {offset}
            }}
{ctx["e1_block"]}
{ctx["e2_block"]}
            ?e1 <{ctx["target_prop"]}> ?v1 .
            ?e2 <{ctx["target_prop"]}> ?v2 .
            FILTER(?v1 != ?v2)
        }}
    """
    try:
        raw = await execute_sparql(query)
    except Exception as ex:
        raise _sparql_502(ex)

    rows = _sa2_pair_rows(ctx, _bindings(raw))
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
    filter_facets: Optional[str] = Query(
        None,
        description="Comma-separated object-property facets. Use prop_uri or prop_uri::object_uri.",
    ),
):
    """SA2 cross-source population summary. Does not return table rows."""
    ctx = _sa2_cross_context(class_uri, identity_props, target_prop, sources, filter_facets)
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
    filter_facets: Optional[str] = Query(
        None,
        description="Comma-separated object-property facets. Use prop_uri or prop_uri::object_uri.",
    ),
    limit: int = Query(50, ge=1, le=500, description="Max conflict pairs returned per page."),
    offset: int = Query(0, ge=0, description="Conflict pair offset for pagination."),
    sample_limit: Optional[int] = Query(None, ge=1, le=500, description="Deprecated alias for limit."),
):
    """SA2 cross-source conflict evidence rows only."""
    ctx = _sa2_cross_context(class_uri, identity_props, target_prop, sources, filter_facets)
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
        cls_uri
        for cls_uri, props in KNOWN_PROPERTIES.items()
        for p in props
        if p["uri"] == property_uri
    }

    prop_local = prop_entry["localName"]
    ENTITY_LIMIT = 10

    async def evaluate_class(cls: dict) -> dict | None:
        """Evaluate one class for expected or misused uses of the selected property."""
        cls_name = cls["localName"]
        cls_uri = cls["uri"]
        is_expected = cls_uri in expected_for

        count = await _count_distinct_property_entities(cls_uri, property_uri)
        if not is_expected and count == 0:
            return None

        entity_uris: list[str] = []
        entities_truncated = False
        if not is_expected:
            entity_uris, entities_truncated = await _fetch_property_entity_uris(
                cls_uri, property_uri, ENTITY_LIMIT
            )

        return {
            "uri":                cls_uri,
            "class":              cls_name,
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
