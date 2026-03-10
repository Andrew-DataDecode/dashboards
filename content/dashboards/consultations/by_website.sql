SELECT
    clinician_name,
    yearmonth,
    CAST(yearmonth AS VARCHAR) AS year_month,
    async_count + scheduled_count AS total_consultations,
    stdcheck_async,
    stdcheck_scheduled,
    healthlabs_async,
    healthlabs_scheduled,
    treatmyuti_async,
    treatmyuti_scheduled,
    starfish_async,
    starfish_scheduled,
    COALESCE(total_async_consultation_fee, 0)
        + COALESCE(total_scheduled_consultation_fee, 0)
        + COALESCE(required_fee, 0) AS total_payment,
    required_fee,
    total_async_consultation_fee AS total_async_fee,
    total_scheduled_consultation_fee AS total_scheduled_fee,
    async_count,
    scheduled_count,
    avg_async_consultation_fee,
    avg_scheduled_consultation_fee
FROM rpt_clinician_consultation_website_and_payments
WHERE (async_count != 0 OR scheduled_count != 0
    OR total_async_consultation_fee > 0
    OR total_scheduled_consultation_fee > 0
    OR required_fee > 0)
