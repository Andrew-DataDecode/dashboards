SELECT
    clinician_name,
    yearmonth,
    CAST(yearmonth AS VARCHAR) AS year_month,
    COALESCE(total_async_consultation_fee, 0)
        + COALESCE(total_scheduled_consultation_fee, 0)
        + COALESCE(required_fee, 0) AS total_payment,
    required_fee,
    async_count + scheduled_count AS total_consultations,
    async_count,
    total_async_consultation_fee AS total_async_fee,
    scheduled_count,
    total_scheduled_consultation_fee AS total_scheduled_fee
FROM rpt_clinician_consultation_website_and_payments
WHERE (async_count != 0 OR scheduled_count != 0
    OR total_async_consultation_fee > 0
    OR total_scheduled_consultation_fee > 0
    OR required_fee > 0)
