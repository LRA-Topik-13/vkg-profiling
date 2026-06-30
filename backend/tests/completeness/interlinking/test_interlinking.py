import pytest

from tests.completeness.interlinking.conftest import (
    CLASSES, inject_interlinking_defects,
)


def _cid(uri):
    return uri.split("#")[-1]


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("class_uri", CLASSES, ids=[_cid(c) for c in CLASSES])
def test_interlinking(class_uri, pct, conns, client, interlinking_baseline, detection):
    n, _ = inject_interlinking_defects(conns, class_uri, pct, interlinking_baseline)

    resp = client.get("/completeness/interlinking")
    assert resp.status_code == 200, resp.text
    row = {r["uri"]: r for r in resp.json()["classes"]}[class_uri]

    base = interlinking_baseline[class_uri]
    total = base["total"]
    exp_not_linked = base["not_linked"] + n
    exp_linked = total - exp_not_linked

    tag = f"{_cid(class_uri)} {pct}%"
    assert row["total_entities"] == total, f"{tag}: total changed ({row['total_entities']} != {total})"
    assert row["not_linked"] == exp_not_linked, \
        f"{tag}: expected {exp_not_linked} not_linked, got {row['not_linked']}"
    assert row["linked"] == exp_linked, f"{tag}: linked mismatch"
    expected_ratio = round(exp_linked / total * 100, 2) if total else 0.0
    assert row["ratio"] == expected_ratio, f"{tag}: ratio mismatch"

    linked_n = sum(len(v) for v in base["linked_by_source"].values())
    detection("interlinking", pct, n, row["not_linked"] - base["not_linked"], linked_n)
