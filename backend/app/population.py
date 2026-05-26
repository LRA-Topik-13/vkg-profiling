from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.config import OBDA_FILE, ONTOLOGY_FILE

RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"


@dataclass(frozen=True)
class Branch:
    table: str
    key: str
    where: str | None


@dataclass
class BaseGroup:
    base: str
    branches: list[Branch] = field(default_factory=list)

    @property
    def tables(self) -> list[str]:
        return sorted({b.table for b in self.branches})


def _load_prefixes(content: str) -> dict[str, str]:
    prefixes: dict[str, str] = {}
    block = re.search(r"\[PrefixDeclaration\](.*?)(?=\[|\Z)", content, re.DOTALL)
    if block:
        for line in block.group(1).strip().splitlines():
            parts = line.strip().split()
            if len(parts) >= 2:
                prefixes[parts[0]] = parts[1]
    return prefixes


def _expand(term: str, prefixes: dict[str, str]) -> str | None:
    if term == "a":
        return RDF_TYPE
    if term.startswith("<") and term.endswith(">"):
        return term[1:-1]
    if ":" in term:
        idx = term.index(":")
        prefix, local = term[: idx + 1], term[idx + 1:]
        if prefix in prefixes:
            return prefixes[prefix] + local
    return None


def _template_base_key(token: str, prefixes: dict[str, str]) -> tuple[str | None, str | None]:
    if "^^" in token:
        return None, None
    cols = re.findall(r"\{([^}]+)\}", token)
    if not cols:
        return None, None
    key = cols[0] if len(cols) == 1 else " || '-' || ".join(cols)
    expanded = _expand(re.sub(r"\{[^}]+\}", "", token), prefixes)
    if expanded is None:
        return None, None
    return expanded, key


def _iter_mapping_blocks(content: str):
    field_name: str | None = None
    target: list[str] = []
    source: list[str] = []

    def flush():
        if target and source:
            return " ".join(target).strip(), " ".join(source).strip()
        return None

    for raw in content.splitlines():
        m = re.match(r"\s*(mappingId|target|source)\s+(.*)$", raw)
        if m:
            kw, rest = m.group(1), m.group(2)
            if kw == "mappingId":
                out = flush()
                if out:
                    yield out
                target, source, field_name = [], [], None
            elif kw == "target":
                target.append(rest)
                field_name = "target"
            elif kw == "source":
                source.append(rest)
                field_name = "source"
            continue
        if raw.strip() in ("]]", "") or raw.lstrip().startswith("["):
            continue
        if field_name == "source":
            source.append(raw.strip())
        elif field_name == "target":
            target.append(raw.strip())

    out = flush()
    if out:
        yield out


def _parse_source_sql(sql: str) -> tuple[str | None, str | None]:
    table_m = re.search(r"\bFROM\s+([A-Za-z_][\w.]*)", sql, re.IGNORECASE)
    where_m = re.search(r"\bWHERE\s+(.+)$", sql, re.IGNORECASE | re.DOTALL)
    table = table_m.group(1) if table_m else None
    where = re.sub(r"\s+", " ", where_m.group(1)).strip() if where_m else None
    return table, where


@dataclass(frozen=True)
class _Mapping:
    table: str
    where: str | None
    subject_base: str
    subject_key: str
    types: tuple[str, ...]
    props: tuple[tuple[str, str | None, str | None], ...]


def _parse_mappings(obda_path: str) -> list[_Mapping]:
    with open(obda_path, encoding="utf-8") as f:
        content = f.read()
    prefixes = _load_prefixes(content)

    mappings: list[_Mapping] = []
    for target, source in _iter_mapping_blocks(content):
        parts = [p.strip() for p in target.rstrip(".").split(";")]
        first = parts[0].split()
        if len(first) < 3:
            continue
        subj_base, subj_key = _template_base_key(first[0], prefixes)
        if subj_base is None or subj_key is None:
            continue

        pairs = [(first[1], first[2])] + [
            (t[0], t[1]) for t in (p.split() for p in parts[1:]) if len(t) >= 2
        ]
        types: list[str] = []
        props: list[tuple[str, str | None, str | None]] = []
        for pred_tok, obj_tok in pairs:
            pred = _expand(pred_tok, prefixes)
            if pred == RDF_TYPE:
                obj = _expand(obj_tok, prefixes)
                if obj:
                    types.append(obj)
            elif pred:
                obj_base, obj_key = _template_base_key(obj_tok, prefixes)
                props.append((pred, obj_base, obj_key))

        if not types and not props:
            continue
        table, where = _parse_source_sql(source)
        if not table:
            continue
        mappings.append(_Mapping(
            table=table, where=where,
            subject_base=subj_base, subject_key=subj_key,
            types=tuple(types), props=tuple(props),
        ))
    return mappings


def _parse_ontology(ttl_path: str):
    from rdflib import Graph, RDF, RDFS, OWL, URIRef

    g = Graph()
    g.parse(ttl_path, format="turtle")

    children: dict[str, set[str]] = {}
    for child, parent in g.subject_objects(RDFS.subClassOf):
        if isinstance(child, URIRef) and isinstance(parent, URIRef):
            children.setdefault(str(parent), set()).add(str(child))

    def descendants(cls: str) -> set[str]:
        result, stack, seen = {cls}, list(children.get(cls, set())), set()
        while stack:
            cur = stack.pop()
            if cur in seen:
                continue
            seen.add(cur)
            result.add(cur)
            stack.extend(children.get(cur, set()))
        return result

    declared = {str(s) for s in g.subjects(RDF.type, OWL.Class) if isinstance(s, URIRef)}
    all_classes = declared | set(children) | {c for cs in children.values() for c in cs}
    desc = {c: descendants(c) for c in all_classes}

    def _follow(prop: str, predicate, seen: frozenset) -> str | None:
        if prop in seen:
            return None
        for o in g.objects(URIRef(prop), predicate):
            if isinstance(o, URIRef):
                return str(o)
        for sp in g.objects(URIRef(prop), RDFS.subPropertyOf):
            if isinstance(sp, URIRef):
                res = _follow(str(sp), predicate, seen | {prop})
                if res:
                    return res
        return None

    props = {str(s) for s in g.subjects(RDFS.label) if isinstance(s, URIRef)}
    props |= {str(s) for s, _ in g.subject_objects(RDFS.domain)}
    props |= {str(s) for s, _ in g.subject_objects(RDFS.range)}
    eff_domain = {p: _follow(p, RDFS.domain, frozenset()) for p in props}
    eff_range = {}
    for p in props:
        r = _follow(p, RDFS.range, frozenset())
        eff_range[p] = r if (r in desc) else None
    return desc, eff_domain, eff_range


def _build_specs(obda_path: str, ttl_path: str) -> dict[str, list[BaseGroup]]:
    mappings = _parse_mappings(obda_path)
    desc, eff_domain, eff_range = _parse_ontology(ttl_path)

    reported = sorted({t for m in mappings for t in m.types})

    specs: dict[str, list[BaseGroup]] = {}
    for cls in reported:
        cls_desc = desc.get(cls, {cls})
        by_base: dict[str, set[Branch]] = {}

        def add(base: str, table: str, key: str, where: str | None):
            by_base.setdefault(base, set()).add(Branch(table=table, key=key, where=where))

        for m in mappings:
            if any(t in cls_desc for t in m.types):
                add(m.subject_base, m.table, m.subject_key, m.where)
            for prop, obj_base, obj_key in m.props:
                dom = eff_domain.get(prop)
                if dom and dom in cls_desc:
                    add(m.subject_base, m.table, m.subject_key, m.where)
                rng = eff_range.get(prop)
                if rng and rng in cls_desc and obj_base and obj_key:
                    add(obj_base, m.table, obj_key, m.where)

        groups: list[BaseGroup] = []
        for base, branches in by_base.items():
            unfiltered = {(b.table, b.key) for b in branches if b.where is None}
            kept = [b for b in branches if b.where is None or (b.table, b.key) not in unfiltered]
            groups.append(BaseGroup(base=base, branches=sorted(kept, key=lambda b: (b.table, b.key, b.where or ""))))
        specs[cls] = sorted(groups, key=lambda gp: gp.base)
    return specs


POPULATION_SPECS: dict[str, list[BaseGroup]] = _build_specs(OBDA_FILE, ONTOLOGY_FILE)
