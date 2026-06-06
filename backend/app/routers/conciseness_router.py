import asyncio
from collections import defaultdict
from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from app.dependencies import (
    execute_sparql, PREFIXES, local_name, count_binding,
    source_membership_filter, different_source_filter, find_source,
)
from app.routers.metadata_router import KNOWN_SOURCES, KNOWN_PROPERTIES, KNOWN_CLASSES
from app.routers.validation import validate_pagination, get_class

router = APIRouter(prefix="/conciseness", tags=["conciseness"])

DEFAULT_DUPLICATES_LIMIT = 10
GROUP_CONCAT_SEP = "|||"


# ── helpers ───────────────────────────────────────────────────────────────────

def _build_identity_block(
    subject_var: str,
    prop_uris: list[str],
    var_prefix: str,
) -> tuple[str, list[str]]:
    """
    Builds SPARQL triple patterns that bind each identity property to a variable.
    var_prefix avoids name collisions between different subject variables.

    Returns (triple_patterns_str, [var_name, ...])
    """
    patterns  = []
    var_names = []
    for i, uri in enumerate(prop_uris):
        var = f"{var_prefix}_k{i}"
        var_names.append(var)
        patterns.append(f"    {subject_var} <{uri}> ?{var} .")
    return "\n".join(patterns), var_names


def _parse_sources(sources_param: str | None) -> list[str]:
    """Parse and validate the sources query parameter."""
    known_uris = {src["uri"] for src in KNOWN_SOURCES}

    if sources_param:
        source_list = [s.strip() for s in sources_param.split(",") if s.strip()]
    else:
        if len(KNOWN_SOURCES) < 2:
            raise HTTPException(
                status_code=400,
                detail="At least 2 registered data sources are required. "
                       f"Currently registered: {KNOWN_SOURCES}",
            )
        source_list = [src["uri"] for src in KNOWN_SOURCES[:2]]

    if len(source_list) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 sources required for cross-source analysis.",
        )
    if len(source_list) > len(KNOWN_SOURCES):
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {len(KNOWN_SOURCES)} sources allowed "
                   f"(registered after build). Received {len(source_list)}.",
        )

    # Validate uniqueness
    if len(source_list) != len(set(source_list)):
        seen: set[str] = set()
        dupes: set[str] = set()
        for s in source_list:
            if s in seen:
                dupes.add(s)
            seen.add(s)
        raise HTTPException(
            status_code=400,
            detail=f"Duplicate sources are not allowed. Duplicates found: {sorted(dupes)}",
        )

    # Validate all sources are registered
    for s in source_list:
        if s not in known_uris:
            raise HTTPException(
                status_code=400,
                detail=f"Source '{s}' is not a registered data source. "
                       f"Available: {KNOWN_SOURCES}",
            )

    return source_list


def _parse_facets(filter_facets: Optional[str], class_uri: str) -> list[tuple[str, str | None]]:
    """
    Parse the filter_facets query parameter into a list of (predicate_uri, object_uri | None).

    Validates that each predicate exists for the given class and is an object property.

    Supports two formats per entry:
      - "predicate::object" — filter to entities where predicate = specific object
      - "predicate"         — filter to entities that have any value for predicate

    Entries are comma-separated. Both predicate and object must be full URIs.
    Example: "http://example.org/voc#teaches,http://example.org/voc#worksFor::http://example.org/voc#compsci/department/1"
    """
    if not filter_facets:
        return []
    class_props = {p["uri"]: p for p in KNOWN_PROPERTIES.get(class_uri, [])}
    pairs: list[tuple[str, str | None]] = []
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
                    detail=f"Invalid facet '{token}'. Both predicate and object are required when using '::' separator.",
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
        if prop["type"] != "object":
            raise HTTPException(
                status_code=400,
                detail=f"Facet property '{pred}' is a data property. "
                       f"Facet filters must use object properties.",
            )
        pairs.append((pred, obj))
    return pairs


def _build_facet_clauses(subject_var: str, facets: list[tuple[str, str | None]]) -> str:
    """Build SPARQL triple patterns for all facet filters."""
    if not facets:
        return ""
    tag = subject_var.lstrip("?")
    lines = []
    for i, (pred, obj) in enumerate(facets):
        if obj is not None:
            lines.append(f"    {subject_var} <{pred}> <{obj}> .")
        else:
            lines.append(f"    {subject_var} <{pred}> ?_fac_{tag}_{i} .")
    return "\n".join(lines)


def _parse_identity_props(identity_props: str, class_uri: str) -> list[str]:
    prop_uris = [p.strip() for p in identity_props.split(",") if p.strip()]
    if not prop_uris:
        raise HTTPException(status_code=400, detail="At least one identity property required")
    class_props = {p["uri"]: p for p in KNOWN_PROPERTIES.get(class_uri, [])}
    for uri in prop_uris:
        prop = class_props.get(uri)
        if prop is None:
            raise HTTPException(
                status_code=400,
                detail=f"Property '{uri}' is not a known property for class '{class_uri}'.",
            )
        if prop["type"] != "data":
            raise HTTPException(
                status_code=400,
                detail=f"Property '{uri}' is an object property. "
                       f"Identity properties must be data properties.",
            )
    return prop_uris


# ── CN2 — extensional conciseness, intra-source ───────────────────────────────

@router.get("/intra-source")
async def conciseness_intra_source(
    class_uri:      str = Query(..., description="Full URI of class to evaluate, e.g. http://example.org/voc#FullProfessor"),
    identity_props: str = Query(..., description="Comma-separated full property URIs defining identity, e.g. http://xmlns.com/foaf/0.1/firstName,http://xmlns.com/foaf/0.1/lastName"),
    source_prefix:  str = Query(..., description="URI prefix scoping to one source, e.g. http://example.org/voc#compsci/"),
    filter_facets:  Optional[str] = Query(None, description="Comma-separated facet filters. Use 'prop_uri' for existence or 'prop_uri::value_uri' for exact match, e.g. http://example.org/voc#teaches,http://example.org/voc#worksFor::http://example.org/voc#compsci/department/1"),
):
    """
    CN2 — Extensional conciseness, intra-source (scores only).

    Two formulas from the paper:
      F1: unique_instances / total_instance_representations
      F2: 1 - (violating_instances / total)

    A violation = two different URIs within source_prefix that share
    identical values for ALL identity_props.

    Use /conciseness/intra-source/duplicates for paginated duplicate groups.
    """
    get_class(class_uri, code=400)
    prop_uris = _parse_identity_props(identity_props, class_uri)

    id_block, id_vars = _build_identity_block("?e", prop_uris, "k")
    select_keys       = " ".join(f"?{v}" for v in id_vars)
    facets            = _parse_facets(filter_facets, class_uri)
    facet_clause      = _build_facet_clauses("?e", facets)

    # Total instance representations within this source
    total_q = f"""
        {PREFIXES}
        SELECT (COUNT(DISTINCT ?e) AS ?n) WHERE {{
            ?e a <{class_uri}> .
            FILTER(STRSTARTS(STR(?e), "{source_prefix}"))
{facet_clause}
        }}
    """

    # All duplicate groups (no LIMIT) for accurate score computation
    group_q = f"""
        {PREFIXES}
        SELECT {select_keys} (COUNT(DISTINCT ?e) AS ?cnt) WHERE {{
            ?e a <{class_uri}> .
            FILTER(STRSTARTS(STR(?e), "{source_prefix}"))
{facet_clause}
{id_block}
        }}
        GROUP BY {select_keys}
        HAVING (COUNT(DISTINCT ?e) > 1)
    """

    try:
        total_raw, group_raw = await asyncio.gather(
            execute_sparql(total_q),
            execute_sparql(group_q),
        )
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"SPARQL error: {ex}")

    total_representations = count_binding(total_raw, "n")
    group_bindings = group_raw.get("results", {}).get("bindings", [])

    # CN2-F1: unique_instances / total
    extras           = sum(int(row["cnt"]["value"]) - 1 for row in group_bindings)
    unique_instances = total_representations - extras
    cn2_f1 = round(unique_instances / total_representations * 100, 2) if total_representations else 100.0

    # CN2-F2: 1 - violating / total
    # violating = total entities involved in any duplicate group = sum of all counts
    violating_instances = sum(int(row["cnt"]["value"]) for row in group_bindings)
    cn2_f2 = round((1 - violating_instances / total_representations) * 100, 2) if total_representations else 100.0

    return {
        "formula_f1":            "unique_instances / total_representations",
        "formula_f2":            "1 - (violating_instances / total)",
        "source_prefix":         source_prefix,
        "total_representations": total_representations,
        "unique_instances":      unique_instances,
        "violating_instances":   violating_instances,
        "score_f1":              cn2_f1,
        "score_f2":              cn2_f2,
        "passed":                len(group_bindings) == 0,
    }


# ── CN2 — paginated duplicate groups ────────────────────────────────────────

@router.get("/intra-source/duplicates")
async def intra_source_duplicates(
    class_uri:      str = Query(..., description="Full URI of class to evaluate"),
    identity_props: str = Query(..., description="Comma-separated full property URIs defining identity"),
    source_prefix:  str = Query(..., description="URI prefix scoping to one source"),
    filter_facets:  Optional[str] = Query(None, description="Comma-separated facet filters. Use 'prop_uri' for existence or 'prop_uri::value_uri' for exact match"),
    limit:          int = Query(DEFAULT_DUPLICATES_LIMIT, description="Page size (max 500)"),
    offset:         int = Query(0, description="Number of groups to skip"),
    include_total:  bool = Query(True, description="Include total count of duplicate groups"),
):
    """
    Paginated duplicate groups for intra-source conciseness.

    Each row = one identity-value combination that appears on more than one URI
    within the source. Ordered by duplicate count DESC, then identity values.
    """
    limit, offset = validate_pagination(limit, offset)
    get_class(class_uri, code=400)
    prop_uris = _parse_identity_props(identity_props, class_uri)

    id_block, id_vars = _build_identity_block("?e", prop_uris, "k")
    select_keys       = " ".join(f"?{v}" for v in id_vars)
    facets            = _parse_facets(filter_facets, class_uri)
    facet_clause      = _build_facet_clauses("?e", facets)
    var_to_prop       = {id_vars[i]: local_name(prop_uris[i]) for i in range(len(prop_uris))}

    body = f"""\
            ?e a <{class_uri}> .
            FILTER(STRSTARTS(STR(?e), "{source_prefix}"))
{facet_clause}
{id_block}"""

    data_q = f"""
        {PREFIXES}
        SELECT {select_keys} (COUNT(DISTINCT ?e) AS ?cnt)
               (GROUP_CONCAT(STR(?e); separator="{GROUP_CONCAT_SEP}") AS ?entities)
        WHERE {{
{body}
        }}
        GROUP BY {select_keys}
        HAVING (COUNT(DISTINCT ?e) > 1)
        ORDER BY DESC(?cnt) {select_keys}
        LIMIT {limit}
        OFFSET {offset}
    """

    count_q = f"""
        {PREFIXES}
        SELECT (COUNT(*) AS ?total) WHERE {{
            SELECT {select_keys}
            WHERE {{
{body}
            }}
            GROUP BY {select_keys}
            HAVING (COUNT(DISTINCT ?e) > 1)
        }}
    """

    try:
        if include_total:
            data_raw, count_raw = await asyncio.gather(
                execute_sparql(data_q),
                execute_sparql(count_q),
            )
            total = count_binding(count_raw, "total")
        else:
            data_raw = await execute_sparql(data_q)
            total = None
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"SPARQL error: {ex}")

    items = []
    for row in data_raw.get("results", {}).get("bindings", []):
        identity_values = {var_to_prop[v]: row[v]["value"] for v in id_vars if v in row}
        cnt = int(row["cnt"]["value"])
        entities_str = row.get("entities", {}).get("value", "")
        uris = list(dict.fromkeys(u for u in entities_str.split(GROUP_CONCAT_SEP) if u)) if entities_str else []
        items.append({
            "identity_values": identity_values,
            "uris":            uris,
            "count":           cnt,
        })

    return {
        "pagination": {
            "limit":  limit,
            "offset": offset,
            "count":  len(items),
            "total":  total,
        },
        "items": items,
    }


# ── CN2 — intra-source class summary ─────────────────────────────────────────

@router.get("/intra-source/class-summary")
async def intra_source_class_summary(
    source_prefix: str = Query(..., description="URI prefix scoping to one source, e.g. http://example.org/voc#compsci/"),
):
    """
    CN2 class summary — extensional conciseness per mapped class using all
    data properties as identity (strictest / best-case scenario).

    Returns one entry per class with both F1 and F2 scores.
    """

    known_uris = {src["uri"] for src in KNOWN_SOURCES}
    if source_prefix not in known_uris:
        raise HTTPException(
            status_code=400,
            detail=f"source_prefix '{source_prefix}' is not a registered data source. "
                   f"Available: {[s['uri'] for s in KNOWN_SOURCES]}",
        )

    # Build per-class query pairs (total + group) for all classes with data props
    tasks      = []
    class_data = []

    for cls in KNOWN_CLASSES:
        cls_uri    = cls["uri"]
        data_props = [p for p in KNOWN_PROPERTIES.get(cls_uri, []) if p["type"] == "data"]
        class_data.append((cls, data_props))

        if not data_props:
            tasks.append(None)
            tasks.append(None)
            continue

        id_block, id_vars = _build_identity_block("?e", [p["uri"] for p in data_props], "k")
        select_keys       = " ".join(f"?{v}" for v in id_vars)

        total_q = f"""
            {PREFIXES}
            SELECT (COUNT(DISTINCT ?e) AS ?n) WHERE {{
                ?e a <{cls_uri}> .
                FILTER(STRSTARTS(STR(?e), "{source_prefix}"))
            }}
        """

        group_q = f"""
            {PREFIXES}
            SELECT {select_keys} (COUNT(DISTINCT ?e) AS ?cnt) WHERE {{
                ?e a <{cls_uri}> .
                FILTER(STRSTARTS(STR(?e), "{source_prefix}"))
{id_block}
            }}
            GROUP BY {select_keys}
            HAVING (COUNT(DISTINCT ?e) > 1)
        """

        tasks.append(execute_sparql(total_q))
        tasks.append(execute_sparql(group_q))

    try:
        results_raw = await asyncio.gather(*[t for t in tasks if t is not None])
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"SPARQL error: {ex}")

    result_iter = iter(results_raw)
    entries = []

    for cls, data_props in class_data:
        cls_uri = cls["uri"]

        if not data_props:
            entries.append({
                "uri":                   cls_uri,
                "class":                 cls["localName"],
                "label":                 cls.get("label"),
                "source_prefix":         source_prefix,
                "identity_props_count":  0,
                "total_representations": 0,
                "unique_instances":      0,
                "violating_instances":   0,
                "score_f1":              None,
                "score_f2":              None,
                "passed":                None,
            })
            continue

        total_raw = next(result_iter)
        group_raw = next(result_iter)

        total_representations = count_binding(total_raw, "n")
        group_bindings        = group_raw.get("results", {}).get("bindings", [])

        extras           = sum(int(r["cnt"]["value"]) - 1 for r in group_bindings)
        unique_instances = total_representations - extras
        cn2_f1 = round(unique_instances / total_representations * 100, 2) if total_representations else 100.0

        violating_instances = sum(int(r["cnt"]["value"]) for r in group_bindings)
        cn2_f2 = round((1 - violating_instances / total_representations) * 100, 2) if total_representations else 100.0

        entries.append({
            "uri":                   cls_uri,
            "class":                 cls["localName"],
            "label":                 cls.get("label"),
            "source_prefix":         source_prefix,
            "identity_props_count":  len(data_props),
            "total_representations": total_representations,
            "unique_instances":      unique_instances,
            "violating_instances":   violating_instances,
            "score_f1":              cn2_f1,
            "score_f2":              cn2_f2,
            "passed":                len(group_bindings) == 0,
        })

    return {"source_prefix": source_prefix, "classes": entries}


# ── CN3 — cross-source ambiguous instances ────────────────────────────────────

@router.get("/cross-source")
async def conciseness_cross_source(
    class_uri:      str = Query(..., description="Full URI of class to evaluate"),
    identity_props: str = Query(..., description="Comma-separated full property URIs defining identity"),
    sources:        str = Query(None, description="Comma-separated source URI prefixes. Default: first 2 registered sources. Max: all registered sources."),
    filter_facets:  Optional[str] = Query(None, description="Comma-separated facet filters. Use 'prop_uri' for existence or 'prop_uri::value_uri' for exact match, e.g. http://example.org/voc#teaches,http://example.org/voc#worksFor::http://example.org/voc#compsci/department/1"),
):
    """
    CN3 — Ambiguous instance detection across multiple sources (scores only).

    Formula: 1 - (ambiguous_instances / total_in_semantic_metadata_set)

    An ambiguous instance = entity in one source sharing all identity_prop values
    with an entity in a different source, with no owl:sameAs link between them.

    Use /conciseness/cross-source/duplicates for paginated ambiguous groups.
    """
    source_list = _parse_sources(sources)
    get_class(class_uri, code=400)

    prop_uris = _parse_identity_props(identity_props, class_uri)

    # Build identity blocks using shared variables — e1 and e2 bind to the
    # same ?v0, ?v1, … so SPARQL enforces value equality without extra FILTERs
    e1_patterns = []
    e2_patterns = []
    var_names   = []
    for i, uri in enumerate(prop_uris):
        var = f"v{i}"
        var_names.append(var)
        e1_patterns.append(f"    ?e1 <{uri}> ?{var} .")
        e2_patterns.append(f"    ?e2 <{uri}> ?{var} .")
    e1_block   = "\n".join(e1_patterns)
    e2_block   = "\n".join(e2_patterns)

    # Facet filters — applied to ?e (total), ?e1 and ?e2 (match queries)
    facets   = _parse_facets(filter_facets, class_uri)
    facet_e  = _build_facet_clauses("?e", facets)
    facet_e1 = _build_facet_clauses("?e1", facets)
    facet_e2 = _build_facet_clauses("?e2", facets)

    # Source filters
    membership_e1 = source_membership_filter("?e1", source_list)
    membership_e2 = source_membership_filter("?e2", source_list)
    diff_filter   = different_source_filter(source_list)
    membership_all = source_membership_filter("?e", source_list)

    # Denominator: all entities across selected sources
    total_q = f"""
        {PREFIXES}
        SELECT (COUNT(DISTINCT ?e) AS ?n) WHERE {{
            ?e a <{class_uri}> .
            {membership_all}
{facet_e}
        }}
    """

    # Count of distinct entities involved in cross-source ambiguity (symmetric).
    # NOTE: COUNT(DISTINCT ?e1) is mis-translated by Ontop/Teiid and over-counts.
    # Wrapping SELECT DISTINCT in a subquery and using COUNT(*) gives the correct result.
    count_q = f"""
        {PREFIXES}
        SELECT (COUNT(*) AS ?n) WHERE {{
            SELECT DISTINCT ?e1 WHERE {{
                ?e1 a <{class_uri}> .
                ?e2 a <{class_uri}> .
                {membership_e1}
                {membership_e2}
                {diff_filter}
{facet_e1}
{facet_e2}
{e1_block}
{e2_block}
            }}
        }}
    """

    try:
        total_raw, count_raw = await asyncio.gather(
            execute_sparql(total_q),
            execute_sparql(count_q),
        )
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"SPARQL error: {ex}")

    total_n = count_binding(total_raw, "n")
    ambiguous_n = count_binding(count_raw, "n")
    cn3 = round((1 - ambiguous_n / total_n) * 100, 2) if total_n else 100.0

    return {
        "formula":             "1 - (ambiguous_instances / total_in_semantic_metadata_set)",
        "sources":             source_list,
        "total_entities":      total_n,
        "ambiguous_instances": ambiguous_n,
        "cn3_score":           cn3,
        "note": "Ambiguous = same identity values across different sources, no owl:sameAs. "
                "All pairwise source combinations are checked. Partial ambiguity (duplicates "
                "between a subset of sources) is included in the score."
    }


# ── CN3 — paginated ambiguous groups ────────────────────────────────────────

@router.get("/cross-source/duplicates")
async def cross_source_duplicates(
    class_uri:      str = Query(..., description="Full URI of class to evaluate"),
    identity_props: str = Query(..., description="Comma-separated full property URIs defining identity"),
    sources:        str = Query(None, description="Comma-separated source URI prefixes"),
    filter_facets:  Optional[str] = Query(None, description="Comma-separated facet filters. Use 'prop_uri' for existence or 'prop_uri::value_uri' for exact match"),
    limit:          int = Query(DEFAULT_DUPLICATES_LIMIT, description="Page size (max 500)"),
    offset:         int = Query(0, description="Number of groups to skip"),
    include_total:  bool = Query(True, description="Include total count of ambiguous groups"),
):
    """
    Paginated ambiguous groups for cross-source conciseness.

    Each row = one identity-value combination shared by entities in different
    sources. Ordered by entity count DESC, then identity values.
    """
    limit, offset = validate_pagination(limit, offset)
    source_list = _parse_sources(sources)
    get_class(class_uri, code=400)
    prop_uris   = _parse_identity_props(identity_props, class_uri)

    # Ontop does not support FILTER EXISTS, and the flat join with shared
    # identity variables triggers Teiid's dependent NL-join for larger datasets,
    # which generates an unsupported multi-column IN with Array bind params.
    # Workaround: fetch all entities + their identity values with a simple
    # single-entity scan (no join at all), then detect cross-source groups in
    # Python by checking whether each group spans more than one source prefix.
    e_block, id_vars = _build_identity_block("?e", prop_uris, "v")
    prop_names  = [local_name(uri) for uri in prop_uris]

    facets      = _parse_facets(filter_facets, class_uri)
    facet_e     = _build_facet_clauses("?e", facets)
    membership  = source_membership_filter("?e", source_list)

    scan_q = f"""
        {PREFIXES}
        SELECT ?e {" ".join(f"?{v}" for v in id_vars)}
        WHERE {{
            ?e a <{class_uri}> .
            {membership}
{facet_e}
{e_block}
        }}
        ORDER BY {" ".join(f"?{v}" for v in id_vars)} ?e
    """

    try:
        raw = await execute_sparql(scan_q)
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"SPARQL error: {ex}")

    # Group by identity-value tuple; keep only groups that span ≥2 sources.
    groups: dict[tuple, list[str]] = defaultdict(list)
    for row in raw.get("results", {}).get("bindings", []):
        key = tuple(row[v]["value"] if v in row else "" for v in id_vars)
        uri = row["e"]["value"]
        groups[key].append(uri)

    cross_source_groups = []
    for key, uris in groups.items():
        sources_seen = {find_source(u, source_list) for u in uris}
        if len(sources_seen) >= 2:
            identity_values = {prop_names[i]: key[i] for i in range(len(id_vars))}
            entities = sorted(
                [{"source": find_source(u, source_list), "uri": u} for u in uris],
                key=lambda e: (e["source"], e["uri"]),
            )
            cross_source_groups.append({
                "identity_values": identity_values,
                "entities":        entities,
                "count":           len(uris),
            })

    # Sort: most entities first, then by identity values lexically.
    cross_source_groups.sort(
        key=lambda g: (-g["count"], *g["identity_values"].values())
    )

    total = len(cross_source_groups) if include_total else None
    page  = cross_source_groups[offset: offset + limit]

    return {
        "pagination": {
            "limit":  limit,
            "offset": offset,
            "count":  len(page),
            "total":  total,
        },
        "items": page,
    }


# ── CN3 — cross-source class summary ─────────────────────────────────────────

@router.get("/cross-source/class-summary")
async def cross_source_class_summary():
    """
    CN3 class summary — cross-source ambiguity per mapped class using all
    data properties as identity (strictest / best-case scenario) across all
    registered sources (all pairwise combinations).
    """
    source_list = [src["uri"] for src in KNOWN_SOURCES]
    if len(source_list) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 registered data sources are required for cross-source analysis.",
        )

    diff_filter_e1e2 = different_source_filter(source_list)
    tasks      = []
    class_data = []

    for cls in KNOWN_CLASSES:
        cls_uri    = cls["uri"]
        data_props = [p for p in KNOWN_PROPERTIES.get(cls_uri, []) if p["type"] == "data"]
        class_data.append((cls, data_props))

        if not data_props:
            tasks.append(None)
            tasks.append(None)
            continue

        # Use separate per-entity variables + explicit FILTER(=) equality to
        # avoid Ontop/Teiid translating shared variables into a row-value-
        # constructor IN clause, which breaks on MySQL/MSSQL.
        e1_patterns, e2_patterns, eq_filters = [], [], []
        for i, p in enumerate(data_props):
            e1_patterns.append(f"    ?e1 <{p['uri']}> ?e1_v{i} .")
            e2_patterns.append(f"    ?e2 <{p['uri']}> ?e2_v{i} .")
            eq_filters.append(f"    FILTER(?e1_v{i} = ?e2_v{i})")
        e1_block  = "\n".join(e1_patterns)
        e2_block  = "\n".join(e2_patterns)
        eq_block  = "\n".join(eq_filters)

        membership_e1  = source_membership_filter("?e1", source_list)
        membership_e2  = source_membership_filter("?e2", source_list)
        membership_all = source_membership_filter("?e",  source_list)

        total_q = f"""
            {PREFIXES}
            SELECT (COUNT(DISTINCT ?e) AS ?n) WHERE {{
                ?e a <{cls_uri}> .
                {membership_all}
            }}
        """

        count_q = f"""
            {PREFIXES}
            SELECT (COUNT(*) AS ?n) WHERE {{
                SELECT DISTINCT ?e1 WHERE {{
                    ?e1 a <{cls_uri}> .
                    ?e2 a <{cls_uri}> .
                    {membership_e1}
                    {membership_e2}
                    {diff_filter_e1e2}
{e1_block}
{e2_block}
{eq_block}
                }}
            }}
        """

        tasks.append(execute_sparql(total_q))
        tasks.append(execute_sparql(count_q))

    try:
        results_raw = await asyncio.gather(*[t for t in tasks if t is not None])
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"SPARQL error: {ex}")

    result_iter = iter(results_raw)
    entries = []

    for cls, data_props in class_data:
        cls_uri = cls["uri"]

        if not data_props:
            entries.append({
                "uri":                  cls_uri,
                "class":                cls["localName"],
                "label":                cls.get("label"),
                "identity_props_count": 0,
                "total_entities":       0,
                "ambiguous_instances":  0,
                "cn3_score":            None,
            })
            continue

        total_raw = next(result_iter)
        count_raw = next(result_iter)

        total_n     = count_binding(total_raw, "n")
        ambiguous_n = count_binding(count_raw, "n")
        cn3         = round((1 - ambiguous_n / total_n) * 100, 2) if total_n else 100.0

        entries.append({
            "uri":                  cls_uri,
            "class":                cls["localName"],
            "label":                cls.get("label"),
            "identity_props_count": len(data_props),
            "total_entities":       total_n,
            "ambiguous_instances":  ambiguous_n,
            "cn3_score":            cn3,
        })

    return {"sources": source_list, "classes": entries}
