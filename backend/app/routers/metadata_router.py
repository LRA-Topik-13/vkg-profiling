from __future__ import annotations

import re
from fastapi import APIRouter, Query, HTTPException
from app.config import ONTOLOGY_FILE, OBDA_FILE
from app.dependencies import execute_sparql

router = APIRouter(prefix="/metadata", tags=["metadata"])

PREFIXES = """
    PREFIX : <http://example.org/voc#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
"""


def _parse_obda(obda_path: str) -> dict[str, set[str]]:
    """
    Parse an Ontop OBDA mapping file and return {class_uri: set(property_uris)}.

    Mappings are grouped by subject template base (the template URI with column
    variables stripped, e.g. "…voc#uni1/academic/" for {a_id} templates).
    All entries sharing the same base pool their class assertions and property
    assertions, so subclass mappings like uni1-fullProfessor automatically
    inherit the properties from uni1-academic.
    """
    RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"

    with open(obda_path, encoding="utf-8") as f:
        content = f.read()

    prefixes: dict[str, str] = {}
    prefix_block = re.search(r"\[PrefixDeclaration\](.*?)(?=\[|\Z)", content, re.DOTALL)
    if prefix_block:
        for line in prefix_block.group(1).strip().splitlines():
            parts = line.strip().split()
            if len(parts) >= 2:
                prefixes[parts[0]] = parts[1]

    def _expand(term: str) -> str | None:
        term = re.sub(r"\{[^}]+\}", "", term).strip()
        term = re.sub(r"\^\^.*$",   "", term).strip()
        if not term:
            return None
        if term == "a":
            return RDF_TYPE
        if term.startswith("<") and term.endswith(">"):
            return term[1:-1]
        if ":" in term:
            idx = term.index(":")
            prefix, local = term[: idx + 1], term[idx + 1 :]
            if prefix in prefixes:
                return prefixes[prefix] + local
        return None

    def _subject_base(subject_term: str) -> str | None:
        # Handle blank node templates like _:uni1student{s_id}
        raw = re.sub(r"\{[^}]+\}", "", subject_term).strip()
        if raw.startswith("_:"):
            return raw  # e.g. "_:uni1student"
        expanded = _expand(subject_term)
        if expanded is None:
            return None
        return re.sub(r"\{[^}]+\}", "", expanded)

    tmpl_classes: dict[str, set[str]] = {}
    tmpl_props:   dict[str, set[str]] = {}

    for m in re.finditer(r"^target\s+(.+)$", content, re.MULTILINE):
        target = m.group(1).strip().rstrip(".")
        parts = [p.strip() for p in target.split(";")]

        first_tokens = parts[0].split()
        if len(first_tokens) < 3:
            continue

        base = _subject_base(first_tokens[0])
        if base is None:
            continue

        tmpl_classes.setdefault(base, set())
        tmpl_props.setdefault(base, set())

        def _record(pred_tok: str, obj_tok: str | None) -> None:
            pred = _expand(pred_tok)
            obj  = _expand(obj_tok) if obj_tok else None
            if pred == RDF_TYPE and obj:
                tmpl_classes[base].add(obj)
            elif pred and pred != RDF_TYPE:
                tmpl_props[base].add(pred)

        _record(first_tokens[1], first_tokens[2] if len(first_tokens) > 2 else None)

        for part in parts[1:]:
            tokens = part.split()
            if tokens:
                _record(tokens[0], tokens[1] if len(tokens) > 1 else None)

    class_prop_map: dict[str, set[str]] = {}
    for base, classes in tmpl_classes.items():
        props = tmpl_props.get(base, set())
        for cls_uri in classes:
            class_prop_map.setdefault(cls_uri, set()).update(props)

    return class_prop_map


def _parse_ontology(ttl_path: str) -> dict:
    """
    Parse the OWL ontology (.ttl) with rdflib.
    Returns all_class_uris and prop_lookup {uri: {localName, type, domain, range}}.
    """
    from rdflib import Graph, RDF, RDFS, OWL, URIRef

    g = Graph()
    g.parse(ttl_path, format="turtle")

    def _ln(uri: str) -> str:
        return uri.split("#")[-1] if "#" in uri else uri.split("/")[-1]

    all_class_uris = {
        str(s) for s in g.subjects(RDF.type, OWL.Class) if isinstance(s, URIRef)
    }

    # Parse rdfs:label for classes
    class_labels: dict[str, str] = {}
    for cls_uri in all_class_uris:
        label = next(
            (str(o) for o in g.objects(URIRef(cls_uri), RDFS.label)), None
        )
        if label:
            class_labels[cls_uri] = label

    prop_lookup: dict[str, dict] = {}
    for prop_rdf_type, type_str in [
        (OWL.ObjectProperty,   "object"),
        (OWL.DatatypeProperty, "data"),
    ]:
        for s in g.subjects(RDF.type, prop_rdf_type):
            if not isinstance(s, URIRef):
                continue
            uri = str(s)
            domain = next(
                (str(o) for o in g.objects(s, RDFS.domain) if isinstance(o, URIRef)), None
            )
            rng = next(
                (str(o) for o in g.objects(s, RDFS.range) if isinstance(o, URIRef)), None
            )
            label = next(
                (str(o) for o in g.objects(s, RDFS.label)), None
            )
            prop_lookup[uri] = {
                "localName": _ln(uri),
                "uri":       uri,
                "type":      type_str,
                "domain":    domain,
                "range":     rng,
                "label":     label,
            }

    return {"all_class_uris": all_class_uris, "prop_lookup": prop_lookup, "class_labels": class_labels}


def _build_metadata(ttl_path: str, obda_path: str):
    """
    Combines ontology + OBDA info to produce the four metadata structures:
    KNOWN_CLASSES, KNOWN_PROPERTIES, ONTOLOGY_CLASSES, ONTOLOGY_PROPERTIES.

    KNOWN_PROPERTIES uses ONTOLOGY DOMAIN CONSTRAINTS (not OBDA URI-template
    grouping) to decide which properties are expected for each class:

      A property P is expected for class C if C ⊆ effective_domain(P), where
      effective_domain follows the rdfs:subPropertyOf chain when no direct
      rdfs:domain is declared.

    Why this matters:
    - :givesLecture / :givesLab have no explicit domain but are subProperties of
      :teaches whose domain is :Teacher.  Under OBDA template grouping these
      properties were incorrectly listed as expected on non-Teacher classes such
      as :GraduateStudent (because the lecturer / lab_teacher mapping shares the
      same uni2/person/ URI template base).  The domain-constraint approach
      correctly excludes them.
    - Ontop performs sub-property inference: querying ?entity :teaches ?val also
      returns entities with :givesLecture (a sub-property).  So AssistantProfessor
      entities that have givesLecture are also found by teaches queries.  By
      including :teaches as expected for AssistantProfessor (via the class
      hierarchy AssistantProfessor ⊑ Professor ⊑ Teacher), SA4 no longer flags
      this as a misuse.
    """
    from rdflib import Graph, RDF, RDFS, OWL, URIRef

    def _ln(uri: str) -> str:
        return uri.split("#")[-1] if "#" in uri else uri.split("/")[-1]

    onto           = _parse_ontology(ttl_path)
    all_class_uris = onto["all_class_uris"]
    prop_lookup    = onto["prop_lookup"]
    class_labels   = onto["class_labels"]

    class_prop_map    = _parse_obda(obda_path)
    mapped_class_uris = set(class_prop_map.keys())
    mapped_prop_uris  = {uri for uris in class_prop_map.values() for uri in uris}

    # Parse the ontology graph for hierarchy + sub-property domain resolution
    g = Graph()
    g.parse(ttl_path, format="turtle")

    # ── Class ancestry (iterative to avoid recursion-limit issues) ────────────
    _anc_cache: dict[str, set[str]] = {}

    def _ancestors(cls_uri: str) -> set[str]:
        if cls_uri in _anc_cache:
            return _anc_cache[cls_uri]
        result: set[str] = set()
        stack  = [cls_uri]
        seen:  set[str] = set()
        while stack:
            cur = stack.pop()
            if cur in seen:
                continue
            seen.add(cur)
            result.add(cur)
            for parent in g.objects(URIRef(cur), RDFS.subClassOf):
                if isinstance(parent, URIRef):
                    stack.append(str(parent))
        _anc_cache[cls_uri] = result
        return result

    # ── Effective domain (follows rdfs:subPropertyOf chain) ───────────────────
    _dom_cache: dict[str, str | None] = {}

    def _effective_domain(prop_uri: str, _seen: frozenset = frozenset()) -> str | None:
        if prop_uri in _dom_cache:
            return _dom_cache[prop_uri]
        if prop_uri in _seen:
            return None
        _seen = _seen | {prop_uri}
        for d in g.objects(URIRef(prop_uri), RDFS.domain):
            if isinstance(d, URIRef):
                _dom_cache[prop_uri] = str(d)
                return str(d)
        for sp in g.objects(URIRef(prop_uri), RDFS.subPropertyOf):
            if isinstance(sp, URIRef):
                res = _effective_domain(str(sp), _seen)
                if res is not None:
                    _dom_cache[prop_uri] = res
                    return res
        _dom_cache[prop_uri] = None
        return None

    # ── Standard metadata structures ──────────────────────────────────────────
    ontology_classes = sorted(
        [{"localName": _ln(uri), "uri": uri, "mapped": uri in mapped_class_uris,
          "label": class_labels.get(uri)}
         for uri in all_class_uris],
        key=lambda x: x["uri"],
    )

    ontology_properties = sorted(
        [
            {
                "localName": d["localName"],
                "uri": uri,
                "type": d["type"],
                "domain": d.get("domain"),
                "range": d.get("range"),
                "mapped": uri in mapped_prop_uris,
                "label": d.get("label"),
            }
            for uri, d in prop_lookup.items()
        ],
        key=lambda x: x["uri"],
    )

    known_classes = sorted(
        [{"localName": _ln(uri), "uri": uri, "label": class_labels.get(uri)}
         for uri in mapped_class_uris],
        key=lambda x: x["uri"],
    )

    # ── KNOWN_PROPERTIES via ontology domain constraints (hybrid) ────────────
    # For each OBDA-mapped class C, expected properties = all OBDA-mapped
    # properties P where:
    #   • P has an effective domain D  →  include iff C ⊆ D
    #   • P has NO effective domain    →  fall back to OBDA URI-template grouping
    #                                     (include iff P was explicitly assigned to
    #                                     C's template group by the OBDA parser)
    #
    # The fallback is needed for domain-less properties like :title (Course only)
    # that would otherwise be listed as expected for every class.
    known_properties: dict[str, list] = {}
    for cls_uri in mapped_class_uris:
        cls_name = _ln(cls_uri)
        cls_anc  = _ancestors(cls_uri)   # includes cls_uri itself
        # Props the OBDA explicitly assigned to this class's URI-template group
        obda_cls_props = class_prop_map.get(cls_uri, set())

        props: list[dict] = []
        for prop_uri in sorted(mapped_prop_uris):
            eff_dom = _effective_domain(prop_uri)
            if eff_dom is not None:
                include = eff_dom in cls_anc          # domain constraint
            else:
                include = prop_uri in obda_cls_props  # OBDA grouping fallback
            if not include:
                continue
            d = prop_lookup.get(prop_uri)
            if d is None:
                entry: dict = {"localName": _ln(prop_uri), "uri": prop_uri, "type": "unknown"}
            else:
                entry = {
                    "localName": d["localName"],
                    "uri": prop_uri,
                    "type": d["type"],
                    "domain": d.get("domain"),
                    "range": d.get("range"),
                    "label": d.get("label"),
                }
                if d["type"] == "object" and d["range"]:
                    entry["rangeClass"] = _ln(d["range"])
            props.append(entry)

        known_properties[cls_uri] = props

    return known_classes, known_properties, ontology_classes, ontology_properties


def _extract_source_prefixes(obda_path: str) -> list[str]:
    """
    Extract unique source URI prefixes from OBDA mapping file.

    Looks at subject templates in target lines and extracts the common
    prefix up to the first path segment after the namespace fragment.
    E.g. "http://example.org/voc#uni1/academic/{a_id}" → "http://example.org/voc#uni1/"
    """
    with open(obda_path, encoding="utf-8") as f:
        content = f.read()

    prefixes: dict[str, str] = {}
    prefix_block = re.search(r"\[PrefixDeclaration\](.*?)(?=\[|\Z)", content, re.DOTALL)
    if prefix_block:
        for line in prefix_block.group(1).strip().splitlines():
            parts = line.strip().split()
            if len(parts) >= 2:
                prefixes[parts[0]] = parts[1]

    source_prefixes: set[str] = set()
    for m in re.finditer(r"^target\s+(.+)$", content, re.MULTILINE):
        subject = m.group(1).strip().split()[0]
        # Skip blank-node templates
        if subject.startswith("_:"):
            continue
        # Expand prefixed name
        expanded = None
        if subject.startswith("<") and subject.endswith(">"):
            expanded = subject[1:-1]
        elif ":" in subject:
            idx = subject.index(":")
            prefix, local = subject[: idx + 1], subject[idx + 1 :]
            if prefix in prefixes:
                expanded = prefixes[prefix] + local
        if expanded:
            expanded = re.sub(r"\{[^}]+\}", "", expanded)
            match = re.match(r"(https?://[^#]+#[^/]+/)", expanded)
            if match:
                source_prefixes.add(match.group(1))

    return sorted(source_prefixes)


KNOWN_CLASSES, KNOWN_PROPERTIES, ONTOLOGY_CLASSES, ONTOLOGY_PROPERTIES = (
    _build_metadata(ONTOLOGY_FILE, OBDA_FILE)
)
KNOWN_SOURCES = _extract_source_prefixes(OBDA_FILE)

# O(1) class lookup by URI — replaces linear scans of KNOWN_CLASSES list
KNOWN_CLASSES_BY_URI: dict[str, dict] = {c["uri"]: c for c in KNOWN_CLASSES}


@router.get("/mapped-classes")
def get_mapped_classes():
    return {"classes": KNOWN_CLASSES}


@router.get("/mapped-properties")
def get_mapped_properties(class_uri: str = Query(None, description="Full URI of class, e.g. http://xmlns.com/foaf/0.1/Person")):
    if class_uri:
        props = KNOWN_PROPERTIES.get(class_uri)
        if props is None:
            raise HTTPException(status_code=404, detail=f"Class '{class_uri}' not found")
        cls = KNOWN_CLASSES_BY_URI.get(class_uri, {})
        return {"uri": class_uri, "class": cls.get("localName", ""), "properties": props}

    seen = set()
    all_props = []
    for props in KNOWN_PROPERTIES.values():
        for p in props:
            if p["uri"] not in seen:
                seen.add(p["uri"])
                all_props.append(p)
    return {"properties": all_props}


@router.get("/facets")
async def get_facet_values(
    class_uri:    str = Query(..., description="Full URI of class"),
    property_uri: str = Query(..., description="Full URI of object property"),
):
    class_props = KNOWN_PROPERTIES.get(class_uri)
    if class_props is None:
        raise HTTPException(status_code=404, detail=f"Class '{class_uri}' not found")

    prop_entry = next((p for p in class_props if p["uri"] == property_uri), None)
    if prop_entry is None:
        raise HTTPException(status_code=404, detail=f"Property '{property_uri}' not found on class '{class_uri}'")
    if prop_entry["type"] != "object":
        raise HTTPException(status_code=400, detail=f"Property '{property_uri}' is a data property")

    cls = KNOWN_CLASSES_BY_URI.get(class_uri, {})

    query = f"""
        {PREFIXES}
        SELECT DISTINCT ?value WHERE {{
            ?entity a <{class_uri}> .
            ?entity <{property_uri}> ?value .
        }}
        ORDER BY ?value
    """
    try:
        raw = await execute_sparql(query)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SPARQL endpoint error: {str(e)}")

    bindings = raw.get("results", {}).get("bindings", [])
    return {
        "uri": class_uri,
        "class": cls.get("localName", ""),
        "property_uri": property_uri,
        "property": prop_entry.get("localName", ""),
        "values": [b["value"]["value"] for b in bindings],
    }


@router.get("/all-properties")
def get_all_properties():
    """Returns every unique OBDA-mapped property across all classes, deduplicated and sorted."""
    seen: dict[str, dict] = {}
    for props in KNOWN_PROPERTIES.values():
        for p in props:
            if p["uri"] not in seen:
                seen[p["uri"]] = p
    return {"properties": sorted(seen.values(), key=lambda p: p["localName"])}


@router.get("/schema-classes")
def get_schema_classes():
    return {"classes": ONTOLOGY_CLASSES}


@router.get("/schema-properties")
def get_schema_properties():
    return {"properties": ONTOLOGY_PROPERTIES}


@router.get("/sources")
def get_sources():
    """Returns all registered data source URI prefixes discovered from the OBDA mapping."""
    return {"sources": KNOWN_SOURCES}


@router.get("/source")
def get_metadata_source():
    return {"source": "ontology", "ontology_file": ONTOLOGY_FILE, "obda_file": OBDA_FILE}
