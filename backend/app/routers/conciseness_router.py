from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from app.dependencies import execute_sparql
from app.routers.metadata_router import KNOWN_SOURCES

router = APIRouter(prefix="/conciseness", tags=["conciseness"])

PREFIXES = """
    PREFIX : <http://example.org/voc#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
"""

SAMPLE_LIMIT = 20


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


VOC_BASE = "http://example.org/voc#"


def _resolve_uri(value: str) -> str:
    """Resolve a URI that may be shorthand (e.g. ':teaches') to a full URI."""
    if value.startswith("http"):
        return value
    if value.startswith(":"):
        return f"{VOC_BASE}{value[1:]}"
    return f"{VOC_BASE}{value}"


def _parse_facets(filter_facets: Optional[str]) -> list[tuple[str, str]]:
    """
    Parse the filter_facets query parameter into a list of (predicate_uri, object_uri) pairs.

    Format: comma-separated "predicate::object" pairs.
    Example: ":teaches::http://example.org/voc#uni1/course/1,:worksFor:::uni1/department/1"
    """
    if not filter_facets:
        return []
    pairs = []
    for token in filter_facets.split(","):
        token = token.strip()
        if not token:
            continue
        if "::" not in token:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid facet format '{token}'. Expected 'predicate::object', "
                       f"e.g. ':teaches::http://example.org/voc#uni1/course/1'",
            )
        pred, obj = token.split("::", 1)
        pred = pred.strip()
        obj = obj.strip()
        if not pred or not obj:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid facet '{token}'. Both predicate and object are required.",
            )
        pairs.append((_resolve_uri(pred), _resolve_uri(obj)))
    return pairs


def _build_facet_clauses(subject_var: str, facets: list[tuple[str, str]]) -> str:
    """Build SPARQL triple patterns for all facet filters."""
    if not facets:
        return ""
    return "\n".join(
        f"    {subject_var} <{pred}> <{obj}> ."
        for pred, obj in facets
    )


# ── CN2 — extensional conciseness, intra-source ───────────────────────────────

@router.get("/intra-source")
async def conciseness_intra_source(
    class_uri:      str = Query(..., description="Full URI of class to evaluate, e.g. http://example.org/voc#FullProfessor"),
    identity_props: str = Query(..., description="Comma-separated full property URIs defining identity, e.g. http://xmlns.com/foaf/0.1/firstName,http://xmlns.com/foaf/0.1/lastName"),
    source_prefix:  str = Query(..., description="URI prefix scoping to one source, e.g. http://example.org/voc#uni1/"),
    filter_facets:  Optional[str] = Query(None, description="Comma-separated facet filters as predicate::object pairs, e.g. :teaches::http://example.org/voc#uni1/course/1,:worksFor:::uni1/department/1"),
    sample_limit:   int = Query(SAMPLE_LIMIT),
):
    """
    CN2 — Extensional conciseness, intra-source.

    Two formulas from the paper:
      F1: unique_instances / total_instance_representations
      F2: 1 - (violating_instances / total)

    A violation = two different URIs within source_prefix that share
    identical values for ALL identity_props.

    identity_props are fully caller-supplied — use /metadata/properties
    to discover available properties for a class, then pass their URIs here.
    This keeps the route decoupled from any hardcoded schema knowledge.
    """
    prop_uris = [p.strip() for p in identity_props.split(",") if p.strip()]
    if not prop_uris:
        raise HTTPException(status_code=400, detail="At least one identity property required")

    id_block, id_vars = _build_identity_block("?e", prop_uris, "k")
    select_keys       = " ".join(f"?{v}" for v in id_vars)
    facets            = _parse_facets(filter_facets)
    facet_clause      = _build_facet_clauses("?e", facets)

    # Map variable names to human-readable property names
    var_to_prop = {id_vars[i]: _prop_local_name(prop_uris[i]) for i in range(len(prop_uris))}

    # Total instance representations within this source
    total_q = f"""
        {PREFIXES}
        SELECT (COUNT(DISTINCT ?e) AS ?n) WHERE {{
            ?e a <{class_uri}> .
            FILTER(STRSTARTS(STR(?e), "{source_prefix}"))
{facet_clause}
        }}
    """

    # Identity key combinations that appear on more than one URI → duplicates
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
        LIMIT {sample_limit}
    """

    try:
        total_raw = await execute_sparql(total_q)
        group_raw = await execute_sparql(group_q)
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"SPARQL error: {ex}")

    total_representations = int(
        (total_raw.get("results", {}).get("bindings") or [{"n": {"value": "0"}}])[0]["n"]["value"]
    )
    group_bindings = group_raw.get("results", {}).get("bindings", [])

    # For each duplicate group, fetch the actual URIs involved
    duplicate_groups      = []
    all_violating_uris    = set()   # deduplicated across groups

    for row in group_bindings:
        # Use property local names instead of internal variable names
        key_values     = {var_to_prop[v]: row[v]["value"] for v in id_vars if v in row}
        key_values_raw = {v: row[v]["value"] for v in id_vars if v in row}
        dup_count  = int(row["cnt"]["value"])

        filter_triples = "\n".join(
            f'    ?e <{prop_uris[i]}> "{key_values_raw[id_vars[i]]}" .'
            for i in range(len(prop_uris))
            if id_vars[i] in key_values_raw
        )
        uri_q = f"""
            {PREFIXES}
            SELECT DISTINCT ?e WHERE {{
                ?e a <{class_uri}> .
                FILTER(STRSTARTS(STR(?e), "{source_prefix}"))
{facet_clause}
{filter_triples}
            }}
        """
        try:
            uri_raw = await execute_sparql(uri_q)
            uris    = [b["e"]["value"] for b in uri_raw.get("results", {}).get("bindings", [])]
        except Exception:
            uris = []

        all_violating_uris.update(uris)

        duplicate_groups.append({
            "identity_values": key_values,
            "uris":            uris,
            "count":           dup_count,
        })

    # CN2-F1: unique_instances / total
    # Each duplicate group collapses to 1 representative; the rest are extras.
    # "unique_instances" = number of distinct real-world identities.
    extras           = sum(g["count"] - 1 for g in duplicate_groups)
    unique_instances = total_representations - extras
    cn2_f1 = round(unique_instances / total_representations * 100, 2) if total_representations else 100.0

    # CN2-F2: 1 - violating / total
    # "violating" = distinct entities involved in ANY duplicate group.
    # Uses a set to safely deduplicate across groups.
    total_violating_uris = len(all_violating_uris)
    cn2_f2 = round((1 - total_violating_uris / total_representations) * 100, 2) if total_representations else 100.0

    return {
        "formula_f1":            "unique_instances / total_representations",
        "formula_f2":            "1 - (violating_instances / total)",
        "source_prefix":         source_prefix,
        "total_representations": total_representations,
        "unique_instances":      unique_instances,
        "violating_instances":   total_violating_uris,
        "duplicate_groups":      duplicate_groups,
        "score_f1":              cn2_f1,
        "score_f2":              cn2_f2,
        "passed":                len(duplicate_groups) == 0,
    }


# ── CN3 — cross-source ambiguous instances ────────────────────────────────────

@router.get("/cross-source")
async def conciseness_cross_source(
    class_uri:      str = Query(..., description="Full URI of class to evaluate"),
    identity_props: str = Query(..., description="Comma-separated full property URIs defining identity"),
    sources:        str = Query(None, description="Comma-separated source URI prefixes. Default: first 2 registered sources. Max: all registered sources."),
    filter_facets:  Optional[str] = Query(None, description="Comma-separated facet filters as predicate::object pairs, e.g. :teaches::http://example.org/voc#uni1/course/1,:worksFor:::uni1/department/1"),
    sample_limit:   int = Query(SAMPLE_LIMIT),
):
    """
    CN3 — Ambiguous instance detection across multiple sources.

    Formula: 1 - (ambiguous_instances / total_in_semantic_metadata_set)

    An ambiguous instance = entity in one source sharing all identity_prop values
    with an entity in a different source, with no owl:sameAs link between them.

    Supports 2+ data sources (default: first 2 registered sources, max: all
    registered sources). All pairwise source combinations are checked — even
    partial ambiguity (e.g., duplicates between only 2 out of 3 sources)
    contributes to the score.

    The semantic metadata set = all entities of this class across selected sources.

    Note on scoring with multiple sources:
      - All entities involved in ANY cross-source match are counted as ambiguous,
        regardless of which pair they appear in.
      - Each entity is counted at most once (via DISTINCT), even if it matches
        entities in multiple other sources.
      - This is a symmetric count: if entity A in uni1 matches entity B in uni2,
        BOTH A and B are counted as ambiguous.
    """
    source_list = _parse_sources(sources)

    prop_uris = [p.strip() for p in identity_props.split(",") if p.strip()]
    if not prop_uris:
        raise HTTPException(status_code=400, detail="At least one identity property required")

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
    select_vars = " ".join(f"?{v}" for v in var_names)

    # Property name mapping for human-readable response
    prop_names = [_prop_local_name(uri) for uri in prop_uris]

    # Facet filters — applied to ?e (total), ?e1 and ?e2 (match queries)
    facets   = _parse_facets(filter_facets)
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

    # Count of distinct entities involved in cross-source ambiguity (symmetric)
    count_q = f"""
        {PREFIXES}
        SELECT (COUNT(DISTINCT ?e1) AS ?n) WHERE {{
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
    """

    # Sample of ambiguous pairs (STR ordering avoids showing each pair twice)
    pairs_q = f"""
        {PREFIXES}
        SELECT DISTINCT {select_vars} ?e1 ?e2 WHERE {{
            ?e1 a <{class_uri}> .
            ?e2 a <{class_uri}> .
            {membership_e1}
            {membership_e2}
            {diff_filter}
            FILTER(STR(?e1) < STR(?e2))
{facet_e1}
{facet_e2}
{e1_block}
{e2_block}
        }}
        LIMIT {sample_limit}
    """

    try:
        total_raw = await execute_sparql(total_q)
        count_raw = await execute_sparql(count_q)
        pairs_raw = await execute_sparql(pairs_q)
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"SPARQL error: {ex}")

    total_n = int(
        (total_raw.get("results", {}).get("bindings") or [{"n": {"value": "0"}}])[0]["n"]["value"]
    )
    ambiguous_n = int(
        (count_raw.get("results", {}).get("bindings") or [{"n": {"value": "0"}}])[0]["n"]["value"]
    )
    cn3 = round((1 - ambiguous_n / total_n) * 100, 2) if total_n else 100.0

    # Group sample results by identity values for a cleaner response
    groups: dict[tuple, dict] = {}
    for row in pairs_raw.get("results", {}).get("bindings", []):
        key = tuple(row[v]["value"] for v in var_names if v in row)
        if key not in groups:
            identity = {
                prop_names[i]: row[var_names[i]]["value"]
                for i in range(len(var_names))
                if var_names[i] in row
            }
            groups[key] = {"identity_values": identity, "entity_uris": set()}
        groups[key]["entity_uris"].add(row["e1"]["value"])
        groups[key]["entity_uris"].add(row["e2"]["value"])

    ambiguous_groups = []
    for group in groups.values():
        entities = []
        for uri in sorted(group["entity_uris"]):
            entities.append({
                "source": _find_source(uri, source_list),
                "uri":    uri,
            })
        ambiguous_groups.append({
            "identity_values": group["identity_values"],
            "entities":        entities,
        })

    return {
        "formula":             "1 - (ambiguous_instances / total_in_semantic_metadata_set)",
        "sources":             source_list,
        "total_entities":      total_n,
        "ambiguous_instances": ambiguous_n,
        "cn3_score":           cn3,
        "sample_size":         len(ambiguous_groups),
        "ambiguous_groups":    ambiguous_groups,
        "note": "Ambiguous = same identity values across different sources, no owl:sameAs. "
                "All pairwise source combinations are checked. Partial ambiguity (duplicates "
                "between a subset of sources) is included in the score."
    }

