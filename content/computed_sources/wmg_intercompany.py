"""WMG Intercompany computed function.

Calculates intercompany billing between FPK and WMG entities based on
consultation and order data. Returns summary table, management fee breakdown,
and balanced journal entries for both WMG and FPK.
"""

from typing import Any


def wmg_intercompany(
    inputs: dict[str, list[dict]],
    params: dict[str, Any],
) -> dict[str, list[dict] | dict]:
    consultations = inputs.get("consultations", [])
    orders = inputs.get("orders", [])

    tech_fee = params.get("tech_fee", 137500)
    doxypep_fpk_rate = params.get("doxypep_fpk_rate", 49)
    std_hl_fpk_rate = params.get("std_hl_fpk_rate", 95)
    wmg_consultation_rate = params.get("wmg_consultation_rate", 64)
    req_fpk_rate = params.get("req_fpk_rate", 2)
    req_wmg_rate = params.get("req_wmg_rate", 1.5)
    walkin_rate = params.get("walkin_rate", 5)
    mgmt_fee_pct = params.get("mgmt_fee_pct", 0.50)

    std_hl_websites = {"STDcheck", "HealthLabs"}
    tmu_sf_websites = {"TreatMyUTI", "Starfish"}
    req_clinician_ids = {111, 5, 114}

    # Categorize consultations
    doxypep_count = 0
    std_hl_count = 0
    tmu_count = 0
    sf_count = 0
    tmu_total_payment = 0.0
    sf_total_payment = 0.0

    for c in consultations:
        website = c.get("website_name", "")
        treatment = c.get("treatment_type_name", c.get("treatment_type", ""))
        consult_type = c.get("consultation_type", "")

        if website in std_hl_websites:
            if treatment == "DoxyPep" and consult_type == "Async":
                doxypep_count += 1
            else:
                std_hl_count += 1
        elif website == "TreatMyUTI":
            tmu_count += 1
            tmu_total_payment += float(c.get("total_payment", 0) or 0)
        elif website == "Starfish":
            sf_count += 1
            sf_total_payment += float(c.get("total_payment", 0) or 0)

    # Categorize orders
    walkin_count = 0
    req_count = 0

    for o in orders:
        clinician_id = o.get("clinician_id")
        try:
            cid = int(clinician_id) if clinician_id is not None else None
        except (ValueError, TypeError):
            cid = None

        order_status = o.get("order_status", "")
        test_result = o.get("test_result_status", "")

        if cid in req_clinician_ids and order_status == "Active" and test_result == "Final Result":
            req_count += 1
        else:
            walkin_count += 1

    # Calculate amounts
    doxypep_fpk = doxypep_count * doxypep_fpk_rate
    doxypep_wmg = doxypep_count * wmg_consultation_rate
    std_hl_fpk = std_hl_count * std_hl_fpk_rate
    std_hl_wmg = std_hl_count * wmg_consultation_rate
    tmu_fpk = tmu_total_payment
    tmu_wmg = tmu_count * wmg_consultation_rate
    sf_fpk = sf_total_payment
    sf_wmg = sf_count * wmg_consultation_rate
    walkin_wmg = walkin_count * req_wmg_rate
    walkin_lab = walkin_count * walkin_rate
    req_fpk = req_count * req_fpk_rate
    req_wmg = req_count * req_wmg_rate

    # FPK to WMG = sum of all WMG amounts
    fpk_to_wmg_total = doxypep_wmg + std_hl_wmg + tmu_wmg + sf_wmg

    # Summary totals
    total_reqs = req_fpk + req_wmg
    total_doxypep = doxypep_fpk + doxypep_wmg
    total_std_hl = std_hl_fpk + std_hl_wmg
    total_tmu = tmu_fpk + tmu_wmg
    total_sf = sf_fpk + sf_wmg
    total_walkin = walkin_lab + walkin_wmg

    grand_total = total_reqs + total_doxypep + total_std_hl + total_tmu + total_sf + total_walkin

    # Management fee
    consult_fpk_total = doxypep_fpk + std_hl_fpk + tmu_fpk + sf_fpk
    gross_receipts = req_fpk + consult_fpk_total + walkin_lab - walkin_wmg
    mgmt_fees = gross_receipts * mgmt_fee_pct

    # Net payment
    net_payment = (req_fpk + consult_fpk_total) - tech_fee - mgmt_fees - walkin_wmg

    # Summary table
    summary_table = [
        {"category": "Totals", "reqs": req_fpk + req_wmg, "doxypep": doxypep_fpk + doxypep_wmg, "std_hl": std_hl_fpk + std_hl_wmg, "tmu": tmu_fpk + tmu_wmg, "sf": sf_fpk + sf_wmg, "walkin": walkin_lab + walkin_wmg, "total": grand_total},
        {"category": "FPK to WMG", "reqs": req_wmg, "doxypep": doxypep_wmg, "std_hl": std_hl_wmg, "tmu": tmu_wmg, "sf": sf_wmg, "walkin": 0, "total": fpk_to_wmg_total + req_wmg},
        {"category": "WMG Tech Fees", "reqs": 0, "doxypep": 0, "std_hl": 0, "tmu": 0, "sf": 0, "walkin": 0, "total": tech_fee},
        {"category": "Walk-In WMG", "reqs": 0, "doxypep": 0, "std_hl": 0, "tmu": 0, "sf": 0, "walkin": walkin_wmg, "total": walkin_wmg},
        {"category": "Net Payment", "reqs": 0, "doxypep": 0, "std_hl": 0, "tmu": 0, "sf": 0, "walkin": 0, "total": net_payment},
    ]

    # Management fee breakdown
    mgmt_fee_table = [
        {"line_item": "Requisitions", "amount": req_fpk},
        {"line_item": "Consultations", "amount": consult_fpk_total},
        {"line_item": "Walk-In Lab", "amount": walkin_lab},
        {"line_item": "Requisition Fee Credit", "amount": -walkin_wmg},
        {"line_item": "Gross Receipts", "amount": gross_receipts},
        {"line_item": f"{int(mgmt_fee_pct * 100)}% of Gross Receipts", "amount": mgmt_fees},
    ]

    # WMG Journal Entry (debits = credits)
    # Cash entry balances the JE: positive = debit (paying out), negative = credit (receiving)
    wmg_expense_total = tech_fee + mgmt_fees + walkin_wmg
    wmg_revenue_total = req_fpk + consult_fpk_total
    wmg_cash = wmg_revenue_total - wmg_expense_total
    wmg_je = [
        {"account": "Revenue", "description": "Requisition Fees", "debit": 0, "credit": req_fpk},
        {"account": "Revenue", "description": "Consultation Fees", "debit": 0, "credit": consult_fpk_total},
        {"account": "Expense", "description": "Technology Fee", "debit": tech_fee, "credit": 0},
        {"account": "Expense", "description": "Management Fee", "debit": mgmt_fees, "credit": 0},
        {"account": "Expense", "description": "Walk-In Lab WMG", "debit": walkin_wmg, "credit": 0},
    ]
    if wmg_cash >= 0:
        wmg_je.append({"account": "Cash", "description": "Net Payment to FPK", "debit": wmg_cash, "credit": 0})
    else:
        wmg_je.append({"account": "Cash", "description": "Net Receipt from FPK", "debit": 0, "credit": abs(wmg_cash)})

    # FPK Journal Entry (mirror of WMG)
    fpk_je = [
        {"account": "Revenue", "description": "Technology Fee", "debit": 0, "credit": tech_fee},
        {"account": "Revenue", "description": "Management Fee", "debit": 0, "credit": mgmt_fees},
        {"account": "Revenue", "description": "Walk-In Lab", "debit": 0, "credit": walkin_wmg},
        {"account": "Expense", "description": "Requisition Fees", "debit": req_fpk, "credit": 0},
        {"account": "Expense", "description": "Consultation Fees", "debit": consult_fpk_total, "credit": 0},
    ]
    if wmg_cash >= 0:
        fpk_je.insert(0, {"account": "Cash", "description": "Net Payment from WMG", "debit": 0, "credit": wmg_cash})
    else:
        fpk_je.insert(0, {"account": "Cash", "description": "Net Payment to WMG", "debit": abs(wmg_cash), "credit": 0})

    return {
        "summary_table": summary_table,
        "mgmt_fee": mgmt_fee_table,
        "wmg_je": wmg_je,
        "fpk_je": fpk_je,
        "_metrics": {
            "net_payment": net_payment,
            "gross_receipts": gross_receipts,
            "mgmt_fees": mgmt_fees,
            "tech_fee": tech_fee,
        },
    }
