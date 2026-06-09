import pytest

_RECORDS = []


def _record(metric, pct, injected, detected, total=0):
    tp = min(injected, detected)
    fp = max(detected - injected, 0)
    fn = max(injected - detected, 0)
    _RECORDS.append({
        "metric": metric, "pct": pct, "total": total,
        "injected": injected, "detected": detected,
        "tp": tp, "fp": fp, "fn": fn,
    })


@pytest.fixture
def detection():
    return _record


def _safe_div(num, den):
    return 1.0 if den == 0 else num / den


def pytest_terminal_summary(terminalreporter, exitstatus, config):
    if not _RECORDS:
        return

    agg = {}
    for r in _RECORDS:
        key = (r["metric"], r["pct"])
        a = agg.setdefault(key, {"total": 0, "injected": 0, "detected": 0, "tp": 0, "fp": 0, "fn": 0})
        for f in ("total", "injected", "detected", "tp", "fp", "fn"):
            a[f] += r[f]

    w = terminalreporter.write_line
    width = 100
    w("")
    w("=" * width)
    w("COMPLETENESS DEFECT DETECTION METRICS")
    w("=" * width)
    header = (f"{'metric':<22}{'pct':>5}{'N':>7}{'inj':>7}{'eff%':>8}"
              f"{'det':>7}{'TP':>6}{'FP':>6}{'FN':>6}{'prec':>8}{'recall':>8}{'f1':>8}")
    w(header)
    w("-" * width)

    totals = {"total": 0, "injected": 0, "tp": 0, "fp": 0, "fn": 0}
    for (metric, pct) in sorted(agg.keys()):
        a = agg[(metric, pct)]
        prec = _safe_div(a["tp"], a["tp"] + a["fp"])
        rec = _safe_div(a["tp"], a["tp"] + a["fn"])
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
        eff = (a["injected"] / a["total"] * 100) if a["total"] else 0.0
        w(f"{metric:<22}{pct:>4}%{a['total']:>7}{a['injected']:>7}{eff:>7.1f}%"
          f"{a['detected']:>7}{a['tp']:>6}{a['fp']:>6}{a['fn']:>6}{prec:>8.3f}{rec:>8.3f}{f1:>8.3f}")
        for f in ("total", "injected", "tp", "fp", "fn"):
            totals[f] += a[f]

    w("-" * width)
    prec = _safe_div(totals["tp"], totals["tp"] + totals["fp"])
    rec = _safe_div(totals["tp"], totals["tp"] + totals["fn"])
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    eff = (totals["injected"] / totals["total"] * 100) if totals["total"] else 0.0
    w(f"{'OVERALL':<22}{'':>5}{totals['total']:>7}{totals['injected']:>7}{eff:>7.1f}%"
      f"{'':>7}{totals['tp']:>6}{totals['fp']:>6}{totals['fn']:>6}{prec:>8.3f}{rec:>8.3f}{f1:>8.3f}")
    w("=" * width)
