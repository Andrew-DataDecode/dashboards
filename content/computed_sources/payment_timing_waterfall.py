"""Payment Timing Waterfall computed function.

Parses payment and refund JSON detail arrays, computes month offsets
from order month, and builds waterfall pivot matrices showing payment
timing distribution.
"""

import json
from collections import defaultdict
from datetime import datetime
from typing import Any


def _parse_date(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        if "T" in str(s):
            return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        return datetime.strptime(str(s)[:10], "%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def _year_month(dt: datetime) -> str:
    return dt.strftime("%Y-%m")


def _months_between(dt1: datetime, dt2: datetime) -> int:
    return (dt1.year - dt2.year) * 12 + (dt1.month - dt2.month)


def payment_timing_waterfall(
    inputs: dict[str, list[dict]],
    params: dict[str, Any],
) -> dict[str, list[dict] | dict]:
    rows = next(iter(inputs.values()), []) if inputs else []
    max_months = params.get("max_months", 24)
    now = datetime.now()
    current_ym = _year_month(now)

    # Accumulators: {order_month: {col: amount}}
    payments_grid: dict[str, dict[str, float | None]] = defaultdict(lambda: defaultdict(float))
    refunds_grid: dict[str, dict[str, float | None]] = defaultdict(lambda: defaultdict(float))
    brand_payments: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    brand_totals: dict[str, dict[str, float]] = defaultdict(lambda: {"order_month": 0.0, "subsequent": 0.0, "total": 0.0})

    total_pre = 0.0
    total_month_0 = 0.0
    total_subsequent = 0.0

    for row in rows:
        order_line_num = row.get("order_line_item_number")
        if order_line_num is not None and int(order_line_num) != 1:
            continue

        order_date = _parse_date(row.get("date"))
        if not order_date:
            continue

        order_ym = _year_month(order_date)
        website = row.get("website_name", "Unknown")

        # Parse payments
        payments_raw = row.get("payments_detail")
        if isinstance(payments_raw, str):
            try:
                payments_list = json.loads(payments_raw)
            except (json.JSONDecodeError, TypeError):
                payments_list = []
        elif isinstance(payments_raw, list):
            payments_list = payments_raw
        else:
            payments_list = []

        for p in payments_list:
            pay_date = _parse_date(p.get("created_at"))
            amount = float(p.get("amount", 0) or 0)
            if not pay_date or amount == 0:
                continue

            months_after = _months_between(pay_date, order_date)

            if months_after < 0:
                payments_grid[order_ym]["pre"] += amount
                total_pre += amount
                brand_payments[website]["pre"] += amount
                brand_totals[website]["order_month"] += amount
            elif months_after > max_months:
                continue
            else:
                col = str(months_after)
                target_ym = f"{pay_date.year:04d}-{pay_date.month:02d}"
                if target_ym > current_ym:
                    payments_grid[order_ym][col] = None
                else:
                    payments_grid[order_ym][col] += amount

                if months_after == 0:
                    total_month_0 += amount
                    brand_payments[website]["0"] += amount
                    brand_totals[website]["order_month"] += amount
                else:
                    total_subsequent += amount
                    brand_totals[website]["subsequent"] += amount

                brand_totals[website]["total"] += amount

        # Parse refunds
        refunds_raw = row.get("approved_refunds_detail")
        if isinstance(refunds_raw, str):
            try:
                refunds_list = json.loads(refunds_raw)
            except (json.JSONDecodeError, TypeError):
                refunds_list = []
        elif isinstance(refunds_raw, list):
            refunds_list = refunds_raw
        else:
            refunds_list = []

        for r in refunds_list:
            refund_date = _parse_date(r.get("approved_at"))
            amount = float(r.get("amount", 0) or 0)
            if not refund_date or amount == 0:
                continue

            months_after = _months_between(refund_date, order_date)

            if months_after < 0:
                refunds_grid[order_ym]["pre"] += amount
            elif months_after > max_months:
                continue
            else:
                col = str(months_after)
                target_ym = f"{refund_date.year:04d}-{refund_date.month:02d}"
                if target_ym > current_ym:
                    refunds_grid[order_ym][col] = None
                else:
                    refunds_grid[order_ym][col] += amount

    # Build waterfall tables
    all_cols = ["pre"] + [str(i) for i in range(max_months + 1)]
    sorted_months = sorted(payments_grid.keys())

    payments_waterfall = []
    for ym in sorted_months:
        row_data: dict[str, Any] = {"order_month": ym}
        for col in all_cols:
            val = payments_grid[ym].get(col)
            if val is None and col in payments_grid[ym]:
                row_data[col] = None
            elif val:
                row_data[col] = round(val, 2)
            else:
                row_data[col] = 0
        payments_waterfall.append(row_data)

    refund_months = sorted(refunds_grid.keys())
    refunds_waterfall = []
    for ym in refund_months:
        row_data = {"order_month": ym}
        for col in all_cols:
            val = refunds_grid[ym].get(col)
            if val is None and col in refunds_grid[ym]:
                row_data[col] = None
            elif val:
                row_data[col] = round(val, 2)
            else:
                row_data[col] = 0
        refunds_waterfall.append(row_data)

    # Order month by brand
    order_month_by_brand = []
    for website in sorted(brand_payments.keys()):
        bp = brand_payments[website]
        order_month_by_brand.append({
            "website": website,
            "pre_payments": round(bp.get("pre", 0), 2),
            "month_0_payments": round(bp.get("0", 0), 2),
            "order_month_total": round(bp.get("pre", 0) + bp.get("0", 0), 2),
        })

    # Payment timing summary
    payment_timing_summary = []
    for website in sorted(brand_totals.keys()):
        bt = brand_totals[website]
        payment_timing_summary.append({
            "website": website,
            "order_month_payments": round(bt["order_month"], 2),
            "subsequent_payments": round(bt["subsequent"], 2),
            "total_payments": round(bt["total"], 2),
        })

    return {
        "payments_waterfall": payments_waterfall,
        "refunds_waterfall": refunds_waterfall,
        "order_month_by_brand": order_month_by_brand,
        "payment_timing_summary": payment_timing_summary,
        "_metrics": {
            "total_pre": round(total_pre, 2),
            "total_month_0": round(total_month_0, 2),
            "total_subsequent": round(total_subsequent, 2),
        },
    }
