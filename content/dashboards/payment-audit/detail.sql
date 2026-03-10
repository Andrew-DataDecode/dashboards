SELECT
    order_id,
    order_date,
    brand_name,
    order_status,
    order_payment_status,
    ol_count,
    ol_total,
    payment_count,
    gross_payment_total,
    approved_refund_total,
    net_payment_total,
    balance,
    audit_category,
    days_since_order,
    order_line_names,
    created_at
FROM rpt_payment_audit
