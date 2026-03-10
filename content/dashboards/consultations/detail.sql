SELECT
    consultation_id,
    consultation_status_finalized_at,
    transaction_id,
    consultation_type,
    website_name,
    pharmacy_state,
    clinician_name,
    treatment_type_name,
    prescription_medications,
    pharmacy_name,
    current_consultation_fee,
    DATE_TRUNC('month', consultation_status_finalized_at::DATE) AS year_month
FROM consultations
WHERE consultation_status = 'prescribed'
    AND consultation_status_finalized_at IS NOT NULL
    AND consultation_status_finalized_at > '2024-01-01'
