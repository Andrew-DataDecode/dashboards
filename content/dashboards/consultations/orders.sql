SELECT
    order_date,
    result_date,
    clinician_id,
    order_status,
    test_result_status,
    website_name,
    total_payment,
    STRFTIME(order_date, '%Y-%m') AS year_month
FROM orders
