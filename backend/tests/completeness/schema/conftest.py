import math
import random
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import PROJECT_ROOT
from app.main import app
from app.routers import metadata_router

BASE_OBDA = str(PROJECT_ROOT / "vkg" / "obda" / "university.clean.obda")
TTL_FILE = metadata_router.ONTOLOGY_FILE

RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"


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
    term = re.sub(r"\{[^}]+\}", "", term).strip()
    term = re.sub(r"\^\^.*$", "", term).strip()
    if not term:
        return None
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


def _target_pairs(body: str):
    body = body.strip().rstrip(".").strip()
    parts = [p.strip() for p in body.split(";")]
    first = parts[0].split(None, 2)
    if not first:
        return None, []
    subject = first[0]
    pairs = []
    if len(first) >= 3:
        pairs.append((first[1], first[2]))
    for p in parts[1:]:
        toks = p.split(None, 1)
        if len(toks) >= 2:
            pairs.append((toks[0], toks[1]))
    return subject, pairs


def make_defected_obda(kind: str, dropped_uris: set[str], out_path: Path) -> None:
    content = Path(BASE_OBDA).read_text(encoding="utf-8")
    prefixes = _load_prefixes(content)

    def rewrite(match: re.Match) -> str:
        body = match.group(1)
        subject, pairs = _target_pairs(body)
        if subject is None:
            return match.group(0)
        kept = []
        for pred_tok, obj_tok in pairs:
            pred = _expand(pred_tok, prefixes)
            obj = _expand(obj_tok, prefixes)
            if kind == "class" and pred == RDF_TYPE and obj in dropped_uris:
                continue
            if kind == "property" and pred != RDF_TYPE and pred in dropped_uris:
                continue
            kept.append((pred_tok, obj_tok))
        if not kept:
            return f"target\t\t{subject} ."
        rebuilt = subject + " " + " ; ".join(f"{p} {o}" for p, o in kept) + " ."
        return f"target\t\t{rebuilt}"

    new_content = re.sub(r"^target\s+(.+)$", rewrite, content, flags=re.MULTILINE)
    out_path.write_text(new_content, encoding="utf-8")


def _coverage_structs(obda_path: str):
    _, _, ontology_classes, ontology_properties = metadata_router._build_metadata(
        TTL_FILE, obda_path
    )
    return ontology_classes, ontology_properties


@pytest.fixture(scope="session")
def baseline():
    oc, op = _coverage_structs(BASE_OBDA)
    mapped_classes = sorted(c["uri"] for c in oc if c["mapped"])
    mapped_props = sorted(p["uri"] for p in op if p["mapped"])
    assert mapped_classes, "no mapped classes in baseline OBDA"
    assert mapped_props, "no mapped properties in baseline OBDA"
    return {
        "total_classes": len(oc),
        "total_props": len(op),
        "mapped_classes": mapped_classes,
        "mapped_props": mapped_props,
    }


def pick_dropped(kind: str, pct: float, baseline: dict, seed: int = 42) -> set[str]:
    pool = baseline["mapped_classes"] if kind == "class" else baseline["mapped_props"]
    n = max(1, math.ceil(len(pool) * pct / 100)) if pct > 0 else 0
    if n == 0:
        return set()
    rng = random.Random(seed)
    return set(rng.sample(pool, n))


@pytest.fixture
def defected_backend(tmp_path):
    saved = (metadata_router.ONTOLOGY_CLASSES, metadata_router.ONTOLOGY_PROPERTIES)

    def _apply(kind: str, dropped_uris: set[str]) -> TestClient:
        out = tmp_path / "university.defected.obda"
        make_defected_obda(kind, dropped_uris, out)
        oc, op = _coverage_structs(str(out))
        metadata_router.ONTOLOGY_CLASSES = oc
        metadata_router.ONTOLOGY_PROPERTIES = op
        return TestClient(app)

    yield _apply

    metadata_router.ONTOLOGY_CLASSES, metadata_router.ONTOLOGY_PROPERTIES = saved
