import pytest

from tests.completeness.interlinking.conftest import inject_interlinking_defects

VOC = "http://example.org/voc#"
CLASSES = [f"{VOC}Student"]


def _cid(uri):
    return uri.split("#")[-1]


def _link_count(detail):
    return sum(g["count"] for g in detail["outgoing"]) + sum(g["count"] for g in detail["incoming"])


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("class_uri", CLASSES, ids=[_cid(c) for c in CLASSES])
def test_interlinking_entity_detail_severed(class_uri, pct, conns, client, interlinking_baseline, detection):
    n, flipped = inject_interlinking_defects(conns, class_uri, pct, interlinking_baseline)
    tag = f"{_cid(class_uri)} {pct}%"

    if not flipped:
        detection("interlinking-entity-detail", pct, 0, 0, 0)
        return

    sample = sorted(flipped)[:3]
    detected = 0
    for uri in sample:
        resp = client.get(
            "/completeness/interlinking/entity-detail",
            params={"entity_uri": uri, "class_uri": class_uri},
        )
        assert resp.status_code == 200, resp.text
        d = resp.json()
        assert d["class_uri"] == class_uri
        if _link_count(d) == 0:
            detected += 1

    assert detected == len(sample), f"{tag}: {len(sample) - detected} severed entities still linked"
    detection("interlinking-entity-detail", pct, len(sample), detected, len(sample))
