SELECT
    consultation_id,
    consultation_status_finalized_at,
    consultation_type,
    website_name,
    clinician_name
FROM consultations
WHERE consultation_status = 'prescribed'
    AND consultation_status_finalized_at IS NOT NULL
