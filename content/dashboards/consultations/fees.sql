SELECT
    clinician_name,
    yearmonth,
    CAST(yearmonth AS VARCHAR) AS year_month,
    required_fee,
    avg_async_consultation_fee,
    avg_scheduled_consultation_fee
FROM rpt_clinician_consultation_website_and_payments
WHERE yearmonth = (SELECT MAX(yearmonth) FROM rpt_clinician_consultation_website_and_payments)
