import asyncio
from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from app.dependencies import execute_sparql
from app.routers.metadata_router import KNOWN_SOURCES, KNOWN_PROPERTIES, KNOWN_CLASSES_BY_URI

router = APIRouter(prefix="/conciseness", tags=["conciseness"])

PREFIXES = """
    PREFIX : <http://example.org/voc#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
"""

MAX_PAGE_LIMIT = 500
DEFAULT_DUPLICATES_LIMIT = 10
GROUP_CONCAT_SEP = "|||"


# ── helpers ───────────────────────────────────────────────────────────────────

def _prop_local_name(uri: str) -> str:
    """Extract the local name from a property URI (e.g. '.../firstName' → 'firstName')."""
    return uri.split("#")[-1] if "#" in uri else uri.split("/")[-1]


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


def _source_membership_filter(var: str, sources: list[str]) -> str:
    """FILTER ensuring var belongs to one of the given sources."""
    clauses = " || ".join(f'STRSTARTS(STR({var}), "{s}")' for s in sources)
    return f"FILTER({clauses})"


def _different_source_filter(sources: list[str]) -> str:
    """FILTER ensuring ?e1 and ?e2 are from different sources."""
    same = " || ".join(
        f'(STRSTARTS(STR(?e1), "{s}") && STRSTARTS(STR(?e2), "{s}"))'
        for s in sources
    )
    return f"FILTER(!({same}))"


def _different_source_filter_vars(var1: str, var2: str, sources: list[str]) -> str:
    """FILTER ensuring two arbitrary variables are from different sources."""
    same = " || ".join(
        f'(STRSTARTS(STR({var1}), "{s}") && STRSTARTS(STR({var2}), "{s}"))'
        for s in sources
    )
    return f"FILTER(!({same}))"


def _find_source(uri: str, sources: list[str]) -> str:
    """Determine which source prefix a URI belongs to."""
    for s in sources:
        if uri.startswith(s):
            return s
    return "unknown"


def _parse_sources(sources_param: str | None) -> list[str]:
    """Parse and validate the sources query parameter."""
    if sources_param:
        source_list = [s.strip() for s in sources_param.split(",") if s.strip()]
    else:
        if len(KNOWN_SOURCES) < 2:
            raise HTTPException(
                status_code=400,
                detail="At least 2 registered data sources are required. "
                       f"Currently registered: {KNOWN_SOURCES}",
            )
        source_list = KNOWN_SOURCES[:2]

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
        if s not in KNOWN_SOURCES:
            raise HTTPException(
                status_code=400,
                detail=f"Source '{s}' is not a registered data source. "
                       f"Available: {KNOWN_SOURCES}",
            )

    return source_list


def _validate_class_uri(class_uri: str) -> None:
    """Validate class_uri exists in known classes."""
    if class_uri not in KNOWN_CLASSES_BY_URI:
        raise HTTPException(
            status_code=400,
            detail=f"Class '{class_uri}' is not a known mapped class.",
        )


def _parse_facets(filter_facets: Optional[str], class_uri: str) -> list[tuple[str, str | None]]:
    """
    Parse the filter_facets query parameter into a list of (predicate_uri, object_uri | None).

    Validates that each predicate exists for the given class and is an object property.

    Supports two formats per entry:
      - "predicate::object" — filter to entities where predicate = specific object
      - "predicate"         — filter to entities that have any value for predicate

    Entries are comma-separated. Both predicate and object must be full URIs.
    Example: "http://example.org/voc#teaches,http://example.org/voc#worksFor::http://example.org/voc#uni1/department/1"
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
    return int(bindings[0].get(var_name, {}).get("value", str(default)))


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
    source_prefix:  str = Query(..., description="URI prefix scoping to one source, e.g. http://example.org/voc#uni1/"),
    filter_facets:  Optional[str] = Query(None, description="Comma-separated facet filters. Use 'prop_uri' for existence or 'prop_uri::value_uri' for exact match, e.g. http://example.org/voc#teaches,http://example.org/voc#worksFor::http://example.org/voc#uni1/department/1"),
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
    _validate_class_uri(class_uri)
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

    total_representations = _count_binding(total_raw, "n")
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
    limit, offset = _validate_pagination(limit, offset)
    _validate_class_uri(class_uri)
    prop_uris = _parse_identity_props(identity_props, class_uri)

    id_block, id_vars = _build_identity_block("?e", prop_uris, "k")
    select_keys       = " ".join(f"?{v}" for v in id_vars)
    facets            = _parse_facets(filter_facets, class_uri)
    facet_clause      = _build_facet_clauses("?e", facets)
    var_to_prop       = {id_vars[i]: _prop_local_name(prop_uris[i]) for i in range(len(prop_uris))}

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
            total = _count_binding(count_raw, "total")
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


# ── CN3 — cross-source ambiguous instances ────────────────────────────────────

@router.get("/cross-source")
async def conciseness_cross_source(
    class_uri:      str = Query(..., description="Full URI of class to evaluate"),
    identity_props: str = Query(..., description="Comma-separated full property URIs defining identity"),
    sources:        str = Query(None, description="Comma-separated source URI prefixes. Default: first 2 registered sources. Max: all registered sources."),
    filter_facets:  Optional[str] = Query(None, description="Comma-separated facet filters. Use 'prop_uri' for existence or 'prop_uri::value_uri' for exact match, e.g. http://example.org/voc#teaches,http://example.org/voc#worksFor::http://example.org/voc#uni1/department/1"),
):
    """
    CN3 — Ambiguous instance detection across multiple sources (scores only).

    Formula: 1 - (ambiguous_instances / total_in_semantic_metadata_set)

    An ambiguous instance = entity in one source sharing all identity_prop values
    with an entity in a different source, with no owl:sameAs link between them.

    Use /conciseness/cross-source/duplicates for paginated ambiguous groups.
    """
    source_list = _parse_sources(sources)
    _validate_class_uri(class_uri)

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
    membership_e1 = _source_membership_filter("?e1", source_list)
    membership_e2 = _source_membership_filter("?e2", source_list)
    diff_filter   = _different_source_filter(source_list)
    membership_all = _source_membership_filter("?e", source_list)

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

    total_n = _count_binding(total_raw, "n")
    ambiguous_n = _count_binding(count_raw, "n")
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
    limit, offset = _validate_pagination(limit, offset)
    source_list = _parse_sources(sources)
    _validate_class_uri(class_uri)
    prop_uris   = _parse_identity_props(identity_props, class_uri)

    # Use a join-based approach: ?e and ?other share identity variables,
    # so SPARQL enforces value equality. The different-source filter ensures
    # cross-source matches. GROUP BY on identity vars + GROUP_CONCAT on ?e
    # collects all matching entities (symmetric join captures both sides).
    e_block, id_vars = _build_identity_block("?e", prop_uris, "v")
    other_block = "\n".join(
        f"    ?other <{prop_uris[i]}> ?{id_vars[i]} ."
        for i in range(len(prop_uris))
    )
    select_vars = " ".join(f"?{v}" for v in id_vars)
    prop_names  = [_prop_local_name(uri) for uri in prop_uris]

    facets        = _parse_facets(filter_facets, class_uri)
    facet_e       = _build_facet_clauses("?e", facets)
    facet_other   = _build_facet_clauses("?other", facets)
    membership_e  = _source_membership_filter("?e", source_list)
    membership_o  = _source_membership_filter("?other", source_list)
    diff_filter   = _different_source_filter_vars("?e", "?other", source_list)

    body = f"""\
            ?e a <{class_uri}> .
            ?other a <{class_uri}> .
            {membership_e}
            {membership_o}
            {diff_filter}
            FILTER(?e != ?other)
{facet_e}
{facet_other}
{e_block}
{other_block}"""

    data_q = f"""
        {PREFIXES}
        SELECT {select_vars} (COUNT(DISTINCT ?e) AS ?cnt)
               (GROUP_CONCAT(STR(?e); separator="{GROUP_CONCAT_SEP}") AS ?entities)
        WHERE {{
{body}
        }}
        GROUP BY {select_vars}
        ORDER BY DESC(?cnt) {select_vars}
        LIMIT {limit}
        OFFSET {offset}
    """

    count_q = f"""
        {PREFIXES}
        SELECT (COUNT(*) AS ?total) WHERE {{
            SELECT {select_vars}
            WHERE {{
{body}
            }}
            GROUP BY {select_vars}
        }}
    """

    try:
        if include_total:
            data_raw, count_raw = await asyncio.gather(
                execute_sparql(data_q),
                execute_sparql(count_q),
            )
            total = _count_binding(count_raw, "total")
        else:
            data_raw = await execute_sparql(data_q)
            total = None
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"SPARQL error: {ex}")

    items = []
    for row in data_raw.get("results", {}).get("bindings", []):
        identity_values = {
            prop_names[i]: row[id_vars[i]]["value"]
            for i in range(len(id_vars))
            if id_vars[i] in row
        }
        cnt = int(row["cnt"]["value"])
        entities_str = row.get("entities", {}).get("value", "")
        uris = list(dict.fromkeys(u for u in entities_str.split(GROUP_CONCAT_SEP) if u)) if entities_str else []
        entities = sorted(
            [{"source": _find_source(uri, source_list), "uri": uri} for uri in uris],
            key=lambda e: (e["source"], e["uri"]),
        )
        items.append({
            "identity_values": identity_values,
            "entities":        entities,
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
