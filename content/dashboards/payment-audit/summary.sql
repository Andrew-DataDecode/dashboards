SELECT
    brand_name,
    audit_category,
    COUNT(*) AS order_count,
    SUM(ABS(balance)) AS total_discrepancy,
    AVG(days_since_order) AS avg_days_outstanding
FROM rpt_payment_audit
GROUP BY brand_name, audit_category
ORDER BY brand_name, audit_category
