SELECT
    order_line_name,
    COUNT(DISTINCT order_id) AS order_count,
    SUM(order_line_price) AS total_price,
    SUM(total_payment) AS total_payment,
    SUM(total_refund_processed) AS total_refund,
    SUM(current_revenue) AS current_revenue
FROM rpt_data_dumps_with_payment_detail
GROUP BY order_line_name
ORDER BY total_price DESC
