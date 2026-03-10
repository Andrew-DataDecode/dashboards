SELECT
    lab_network_name,
    COUNT(DISTINCT order_id) AS order_count,
    SUM(current_revenue) AS revenue,
    SUM(total_cost) AS total_cost
FROM rpt_data_dumps_with_payment_detail
WHERE lab_result_status = 'Final Result'
  AND result_date IS NOT NULL
GROUP BY lab_network_name
ORDER BY total_cost DESC
