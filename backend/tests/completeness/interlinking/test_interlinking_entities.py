import pytest

from tests.completeness.interlinking.conftest import inject_interlinking_defects

VOC = "http://example.org/voc#"
ENTITIES_CLASSES = [f"{VOC}Student"]


def _cid(uri):
    return uri.split("#")[-1]


def _all_not_linked(client, class_uri):
    uris, offset, total = set(), 0, 0
    while True:
        resp = client.get(
            "/completeness/interlinking/entities",
            params={"class_uri": class_uri, "status": "not_linked", "limit": 500, "offset": offset},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        total = data["pagination"]["total"]
        uris.update(e["uri"] for e in data["entities"])
        if len(data["entities"]) < 500:
            break
        offset += 500
    return uris, total


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("class_uri", ENTITIES_CLASSES, ids=[_cid(c) for c in ENTITIES_CLASSES])
def test_interlinking_entities(class_uri, pct, conns, client, interlinking_baseline, detection):
    n, flipped = inject_interlinking_defects(conns, class_uri, pct, interlinking_baseline)
    base = interlinking_baseline[class_uri]
    tag = f"{_cid(class_uri)} {pct}%"

    linked = client.get(
        "/completeness/interlinking/entities",
        params={"class_uri": class_uri, "status": "linked", "limit": 1},
    )
    assert linked.status_code == 200, linked.text
    linked_total = linked.json()["pagination"]["total"]
    nl_uris, nl_total = _all_not_linked(client, class_uri)

    assert linked_total + nl_total == base["total"], f"{tag}: linked+not_linked != total"
    assert nl_total == base["not_linked"] + n, \
        f"{tag}: expected {base['not_linked'] + n} not_linked, got {nl_total}"
    for uri in flipped:
        assert uri in nl_uris, f"{tag}: severed {uri} not in not_linked list"

    detection("interlinking-entities", pct, n, nl_total - base["not_linked"], base["linked"])
