import pytest

from tests.completeness.schema.conftest import pick_dropped


@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("kind", ["class", "property"])
def test_schema_items_unmapped(kind, pct, baseline, defected_backend, detection):
    dropped = pick_dropped(kind, pct, baseline)
    client = defected_backend(kind, dropped)

    resp = client.get(
        "/completeness/schema/items",
        params={"kind": kind, "status": "unmapped", "limit": 500},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    item_uris = {i["uri"] for i in data["items"]}

    total_pool = baseline["total_classes"] if kind == "class" else baseline["total_props"]
    base_mapped = len(baseline["mapped_classes"]) if kind == "class" else len(baseline["mapped_props"])
    base_unmapped = total_pool - base_mapped
    exp_unmapped = base_unmapped + len(dropped)

    tag = f"{kind} {pct}%"
    assert data["pagination"]["total"] == exp_unmapped, \
        f"{tag}: expected {exp_unmapped} unmapped, got {data['pagination']['total']}"
    for uri in dropped:
        assert uri in item_uris, f"{tag}: dropped {uri} not listed as unmapped"

    detection(f"schema-items/{kind}", pct, len(dropped),
              data["pagination"]["total"] - base_unmapped, base_mapped)
