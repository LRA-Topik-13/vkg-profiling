import pytest

from tests.completeness.interlinking.conftest import inject_interlinking_defects

VOC = "http://example.org/voc#"
SINGLE_LINK_CLASSES = [f"{VOC}Place"]


def _cid(uri):
    return uri.split("#")[-1]


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("class_uri", SINGLE_LINK_CLASSES, ids=[_cid(c) for c in SINGLE_LINK_CLASSES])
def test_interlinking_class_breakdown(class_uri, pct, conns, client, interlinking_baseline, detection):
    n, _ = inject_interlinking_defects(conns, class_uri, pct, interlinking_baseline)

    resp = client.get("/completeness/interlinking/class", params={"class_uri": class_uri})
    assert resp.status_code == 200, resp.text
    links = resp.json()["links"]
    assert links, "expected a link breakdown"

    base = interlinking_baseline[class_uri]
    exp = base["linked"] - n
    tag = f"{_cid(class_uri)} {pct}%"
    for l in links:
        assert l["direction"] in ("outgoing", "incoming")
        assert l["count"] == exp, f"{tag}: {l['property']} expected {exp}, got {l['count']}"

    detection("interlinking-class", pct, n, base["linked"] - links[0]["count"], base["linked"])
