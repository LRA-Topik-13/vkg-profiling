import pytest

from tests.completeness.schema.conftest import pick_dropped


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("kind", ["class", "property"])
def test_mapping_coverage(kind, pct, baseline, defected_backend, detection):
    dropped = pick_dropped(kind, pct, baseline)
    client = defected_backend(kind, dropped)

    resp = client.get("/completeness/mapping-coverage")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    total_classes = baseline["total_classes"]
    total_props = baseline["total_props"]
    base_mapped_classes = len(baseline["mapped_classes"])
    base_mapped_props = len(baseline["mapped_props"])

    if kind == "class":
        exp_mapped_classes = base_mapped_classes - len(dropped)
        exp_mapped_props = base_mapped_props
        block = data["classes"]
        base_unmapped = total_classes - base_mapped_classes
    else:
        exp_mapped_classes = base_mapped_classes
        exp_mapped_props = base_mapped_props - len(dropped)
        block = data["properties"]
        base_unmapped = total_props - base_mapped_props

    assert data["classes"]["total"] == total_classes, f"{kind} {pct}%: class total"
    assert data["classes"]["mapped"] == exp_mapped_classes, \
        f"{kind} {pct}%: expected {exp_mapped_classes} mapped classes, got {data['classes']['mapped']}"
    assert data["classes"]["unmapped"] == total_classes - exp_mapped_classes, \
        f"{kind} {pct}%: class unmapped count"
    assert data["classes"]["coverage"] == round(exp_mapped_classes / total_classes * 100, 2)

    assert data["properties"]["total"] == total_props, f"{kind} {pct}%: prop total"
    assert data["properties"]["mapped"] == exp_mapped_props, \
        f"{kind} {pct}%: expected {exp_mapped_props} mapped props, got {data['properties']['mapped']}"
    assert data["properties"]["unmapped"] == total_props - exp_mapped_props, \
        f"{kind} {pct}%: prop unmapped count"
    assert data["properties"]["coverage"] == round(exp_mapped_props / total_props * 100, 2)

    exp_overall = round(
        (exp_mapped_classes + exp_mapped_props) / (total_classes + total_props) * 100, 2
    )
    assert data["overall_coverage"] == exp_overall, f"{kind} {pct}%: overall coverage"

    pool_total = base_mapped_classes if kind == "class" else base_mapped_props
    detection(f"schema/{kind}", pct, len(dropped), block["unmapped"] - base_unmapped, pool_total)
