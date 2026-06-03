import random

import pytest

from tests.conciseness.conftest import ENTITY_CONFIG, SOURCE_ACADEMICS


def _inject_defects(conn, entity: str, pct: float, seed: int = 42) -> dict:
    """
    Randomly makes `pct`% of rows duplicates of other rows by updating their
    identity columns to match a sampled template row.

    Returns the ground-truth expected API response values.
    """
    cfg = ENTITY_CONFIG[entity]
    table = cfg["table"]
    id_col = cfg["id_col"]
    identity_cols = cfg["identity_cols"]

    cursor = conn.cursor(as_dict=True)
    cursor.execute(f"SELECT * FROM {table} ORDER BY {id_col}")
    rows = cursor.fetchall()
    N = len(rows)

    n_defects = max(1, round(N * pct / 100)) if pct > 0 else 0

    if n_defects > 0:
        random.seed(seed)
        templates = random.sample(rows, n_defects)
        template_ids = {t[id_col] for t in templates}
        remaining = [r for r in rows if r[id_col] not in template_ids]
        targets = random.sample(remaining, n_defects)

        update_cursor = conn.cursor()
        set_clause = ", ".join(f"{col} = %s" for col in identity_cols)
        for tmpl, tgt in zip(templates, targets):
            values = tuple(tmpl[col] for col in identity_cols) + (tgt[id_col],)
            update_cursor.execute(
                f"UPDATE {table} SET {set_clause} WHERE {id_col} = %s",
                values,
            )
        conn.commit()

    # Expected values
    # Each injected defect creates one duplicate pair (cnt=2 group):
    #   extras          = n_defects * (2 - 1) = n_defects
    #   unique_instances = N - n_defects
    #   violating        = n_defects * 2  (both sides of each pair)
    unique = N - n_defects
    violating = n_defects * 2
    return {
        "total_representations": N,
        "unique_instances":      unique,
        "violating_instances":   violating,
        "score_f1":              round(unique / N * 100, 2),
        "score_f2":              round((1 - violating / N) * 100, 2),
        "passed":                n_defects == 0,
    }


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("pct", [0, 2, 5, 10, 20])
@pytest.mark.parametrize("entity", ["TimeSlot", "Place"])
def test_intra_source_conciseness(entity, pct, db_conn, client):
    expected = _inject_defects(db_conn, entity, pct)
    cfg = ENTITY_CONFIG[entity]

    resp = client.get(
        "/conciseness/intra-source",
        params={
            "class_uri":      cfg["class_uri"],
            "identity_props": cfg["identity_props"],
            "source_prefix":  SOURCE_ACADEMICS,
        },
    )
    assert resp.status_code == 200, resp.text

    data = resp.json()
    assert data["total_representations"] == expected["total_representations"], \
        f"{entity} {pct}%: total mismatch"
    assert data["unique_instances"]      == expected["unique_instances"], \
        f"{entity} {pct}%: unique mismatch"
    assert data["violating_instances"]   == expected["violating_instances"], \
        f"{entity} {pct}%: violating mismatch"
    assert data["score_f1"]              == expected["score_f1"], \
        f"{entity} {pct}%: f1 mismatch"
    assert data["score_f2"]              == expected["score_f2"], \
        f"{entity} {pct}%: f2 mismatch"
    assert data["passed"]                == expected["passed"], \
        f"{entity} {pct}%: passed mismatch"
