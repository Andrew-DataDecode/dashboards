SELECT
    date,
    order_id,
    transaction_id,
    website_name,
    lab_network_name,
    order_status,
    order_line_item_number,
    order_line_name,
    order_line_price,
    lab_result_status,
    result_date,
    payment_status,
    current_revenue,
    total_payment,
    total_refund_processed,
    total_cost
FROM rpt_data_dumps_with_payment_detail
