import pytest

from tests.completeness.interlinking.conftest import inject_interlinking_defects

VOC = "http://example.org/voc#"
PROFILE_CLASSES = [
    f"{VOC}Student",        # outgoing-only
    f"{VOC}FacultyMember",  # incoming + outgoing
    f"{VOC}Place",          # incoming-only
]


def _link_count(detail):
    return sum(g["count"] for g in detail["outgoing"]) + sum(g["count"] for g in detail["incoming"])


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
def test_interlinking_entity_detail_severed(pct, conns, client, interlinking_baseline, detection):
    sample = []
    for class_uri in PROFILE_CLASSES:
        _, flipped = inject_interlinking_defects(conns, class_uri, pct, interlinking_baseline)
        if flipped:
            sample.append((class_uri, sorted(flipped)[0]))

    if not sample:
        detection("interlinking-entity-detail*", pct, 0, 0, 0)
        return

    detected = 0
    for class_uri, uri in sample:
        resp = client.get(
            "/completeness/interlinking/entity-detail",
            params={"entity_uri": uri, "class_uri": class_uri},
        )
        assert resp.status_code == 200, resp.text
        d = resp.json()
        assert d["class_uri"] == class_uri
        if _link_count(d) == 0:
            detected += 1

    assert detected == len(sample), f"{pct}%: {len(sample) - detected} severed entities still linked"
    detection("interlinking-entity-detail*", pct, len(sample), detected, len(sample))
