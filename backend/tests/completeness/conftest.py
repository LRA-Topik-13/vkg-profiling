import pytest

_RECORDS = []


def _record(metric, pct, injected, detected, total=0):
    _RECORDS.append({
        "metric": metric, "pct": pct, "total": total,
        "injected": injected, "detected": detected,
    })


@pytest.fixture
def detection():
    return _record


def pytest_terminal_summary(terminalreporter, exitstatus, config):
    if not _RECORDS:
        return

    agg = {}
    for r in _RECORDS:
        key = (r["metric"], r["pct"])
        a = agg.setdefault(key, {"total": 0, "injected": 0, "detected": 0})
        for f in ("total", "injected", "detected"):
            a[f] += r[f]

    w = terminalreporter.write_line
    width = 60
    w("")
    w("=" * width)
    w("COMPLETENESS DEFECT DETECTION")
    w("=" * width)
    w(f"{'metric':<22}{'pct':>5}{'N':>8}{'injected':>10}{'detected':>10}")
    w("-" * width)

    totals = {"total": 0, "injected": 0, "detected": 0}
    for (metric, pct) in sorted(agg.keys()):
        a = agg[(metric, pct)]
        w(f"{metric:<22}{pct:>4}%{a['total']:>8}{a['injected']:>10}{a['detected']:>10}")
        for f in ("total", "injected", "detected"):
            totals[f] += a[f]

    w("-" * width)
    w(f"{'OVERALL':<22}{'':>5}{totals['total']:>8}{totals['injected']:>10}{totals['detected']:>10}")
    w("=" * width)
    if any(metric.endswith("*") for (metric, _) in agg):
        w("* smoke check — N = sample size (one severed entity per link-direction profile), not a graded basis")
