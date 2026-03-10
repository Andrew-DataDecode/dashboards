SELECT
    website_name,
    COUNT(DISTINCT order_id) AS order_count,
    SUM(order_line_price) AS total_price,
    SUM(total_payment) AS total_payment,
    SUM(total_refund_processed) AS total_refund,
    SUM(current_revenue) AS current_revenue,
    SUM(total_cost) AS total_cost
FROM rpt_data_dumps_with_payment_detail
GROUP BY website_name
ORDER BY total_payment DESC
