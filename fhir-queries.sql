-- Shoulder on FHIR — PostgreSQL Queries
-- Run against the HAPI FHIR database (hapi@localhost:5432/hapi)
--
-- Connect options:
--   docker exec -it shoulder-postgres psql -U hapi -d hapi
--   psql postgresql://hapi:hapi@localhost:5432/hapi
--
-- Schema overview:
--   hfj_resource       resource metadata (type, fhir_id, timestamps) — no JSON here
--   hfj_res_ver        actual FHIR JSON (res_text_vc column)
--   hfj_spidx_token    indexed: codes, identifiers, status, category, gender, boolean flags
--   hfj_spidx_string   indexed: names, descriptions, publisher, address
--   hfj_spidx_date     indexed: birthDate, onsetDate, recordedDate, performedDateTime
--   hfj_spidx_quantity indexed: measurement values (ROM angles, scores)
--   hfj_spidx_uri      indexed: profile URLs, system URIs
--   hfj_res_link       resource references (subject, reasonReference, etc.)
--   trm_concept        terminology concepts (CodeSystem codes live here)


-- ─────────────────────────────────────────────────────────────
-- OVERVIEW
-- ─────────────────────────────────────────────────────────────

-- Resource counts by type
SELECT res_type, count(*) AS count
FROM hfj_resource
WHERE res_deleted_at IS NULL
GROUP BY res_type
ORDER BY count DESC;

-- All resource types ever stored (including deleted)
SELECT res_type, count(*) AS total, count(res_deleted_at) AS deleted
FROM hfj_resource
GROUP BY res_type
ORDER BY total DESC;


-- ─────────────────────────────────────────────────────────────
-- PATIENTS
-- ─────────────────────────────────────────────────────────────

-- All patients (fhir_id + timestamps)
SELECT fhir_id, res_published, res_updated
FROM hfj_resource
WHERE res_type = 'Patient' AND res_deleted_at IS NULL
ORDER BY res_published;

-- Patient names (from string search index) THIS one is incorrect, check second
SELECT r.fhir_id, s.sp_name, s.sp_value
FROM hfj_resource r
JOIN hfj_spidx_string s ON s.res_id = r.res_id
WHERE r.res_type = 'Patient'
  AND r.res_deleted_at IS NULL
  AND s.sp_name IN ('family', 'given', 'name')
ORDER BY r.fhir_id, s.sp_name;

-- Patient names (from string search index)
SELECT r.fhir_id, s.sp_name
FROM hfj_resource r
JOIN hfj_spidx_string s ON s.res_id = r.res_id
WHERE r.res_type = 'Patient'
  AND r.res_deleted_at IS NULL
  AND s.sp_name IN ('family', 'given', 'name')
ORDER BY r.fhir_id, s.sp_name;

-- Patient gender + birthdate
SELECT r.fhir_id,
       MAX(CASE WHEN t.sp_name = 'gender' THEN t.sp_value END) AS gender,
       MAX(CASE WHEN d.sp_name = 'birthdate' THEN d.sp_value_low::date END) AS birthdate
FROM hfj_resource r
LEFT JOIN hfj_spidx_token t ON t.res_id = r.res_id AND t.sp_name = 'gender'
LEFT JOIN hfj_spidx_date  d ON d.res_id = r.res_id AND d.sp_name = 'birthdate'
WHERE r.res_type = 'Patient' AND r.res_deleted_at IS NULL
GROUP BY r.fhir_id;


-- ─────────────────────────────────────────────────────────────
-- CONDITIONS (RotatorCuffCondition)
-- ─────────────────────────────────────────────────────────────

-- All conditions with diagnosis codes
SELECT r.fhir_id, t.sp_system, t.sp_value AS code
FROM hfj_resource r
JOIN hfj_spidx_token t ON t.res_id = r.res_id
WHERE r.res_type = 'Condition'
  AND r.res_deleted_at IS NULL
  AND t.sp_name = 'code'
ORDER BY r.fhir_id;

-- Conditions by verification status (confirmed / provisional)
SELECT r.fhir_id, t.sp_value AS verification_status
FROM hfj_resource r
JOIN hfj_spidx_token t ON t.res_id = r.res_id
WHERE r.res_type = 'Condition'
  AND r.res_deleted_at IS NULL
  AND t.sp_name = 'verification-status';

-- Condition body sites (laterality)
SELECT r.fhir_id, t.sp_value AS body_site
FROM hfj_resource r
JOIN hfj_spidx_token t ON t.res_id = r.res_id
WHERE r.res_type = 'Condition'
  AND r.res_deleted_at IS NULL
  AND t.sp_name = 'body-site';


-- ─────────────────────────────────────────────────────────────
-- PROCEDURES (ShoulderProcedure)
-- ─────────────────────────────────────────────────────────────

-- All procedures with codes
SELECT r.fhir_id, t.sp_system, t.sp_value AS code, t.sp_name
FROM hfj_resource r
JOIN hfj_spidx_token t ON t.res_id = r.res_id
WHERE r.res_type = 'Procedure'
  AND r.res_deleted_at IS NULL
  AND t.sp_name = 'code'
ORDER BY r.fhir_id;

-- Procedure performed dates
SELECT r.fhir_id, d.sp_value_low::date AS performed_date
FROM hfj_resource r
JOIN hfj_spidx_date d ON d.res_id = r.res_id
WHERE r.res_type = 'Procedure'
  AND r.res_deleted_at IS NULL
  AND d.sp_name = 'date';


-- ─────────────────────────────────────────────────────────────
-- OBSERVATIONS (ShoulderObservation — all subtypes)
-- ─────────────────────────────────────────────────────────────

-- All observations with category and code
SELECT r.fhir_id,
       MAX(CASE WHEN t.sp_name = 'category' THEN t.sp_value END) AS category,
       MAX(CASE WHEN t.sp_name = 'code'     THEN t.sp_value END) AS code
FROM hfj_resource r
JOIN hfj_spidx_token t ON t.res_id = r.res_id
WHERE r.res_type = 'Observation'
  AND r.res_deleted_at IS NULL
  AND t.sp_name IN ('category', 'code')
GROUP BY r.fhir_id
ORDER BY category, code;

-- Observations with numeric values (ROM angles, scores)
SELECT r.fhir_id, q.sp_name, q.sp_value, q.sp_units
FROM hfj_resource r
JOIN hfj_spidx_quantity q ON q.res_id = r.res_id
WHERE r.res_type = 'Observation'
  AND r.res_deleted_at IS NULL
ORDER BY r.fhir_id;

-- Imaging observations (Goutallier / Patte classifications)
SELECT r.fhir_id, t.sp_name, t.sp_system, t.sp_value
FROM hfj_resource r
JOIN hfj_spidx_token t ON t.res_id = r.res_id
WHERE r.res_type = 'Observation'
  AND r.res_deleted_at IS NULL
  AND t.sp_name = 'category'
  AND t.sp_value = 'imaging';


-- ─────────────────────────────────────────────────────────────
-- RESOURCE REFERENCES (hfj_res_link)
-- ─────────────────────────────────────────────────────────────

-- All references between resources (source → target)
SELECT src.res_type AS from_type, src.fhir_id AS from_id,
       lnk.src_path              AS reference_path,
       tgt.res_type AS to_type,   tgt.fhir_id AS to_id
FROM hfj_res_link lnk
JOIN hfj_resource src ON src.res_id = lnk.src_resource_id
JOIN hfj_resource tgt ON tgt.res_id = lnk.target_resource_id
WHERE src.res_deleted_at IS NULL
ORDER BY src.res_type, src.fhir_id;

-- All resources linked to a specific patient (replace <fhir_id>)
-- SELECT src.res_type, src.fhir_id, lnk.src_path
-- FROM hfj_res_link lnk
-- JOIN hfj_resource src ON src.res_id = lnk.src_resource_id
-- JOIN hfj_resource tgt ON tgt.res_id = lnk.target_resource_id
-- WHERE tgt.res_type = 'Patient' AND tgt.fhir_id = '<fhir_id>'
-- ORDER BY src.res_type;


-- ─────────────────────────────────────────────────────────────
-- RAW FHIR JSON
-- ─────────────────────────────────────────────────────────────

-- Read raw FHIR JSON for all patients
SELECT r.fhir_id, v.res_text_vc
FROM hfj_resource r
JOIN hfj_res_ver v ON v.res_id = r.res_id AND v.res_ver = r.res_ver
WHERE r.res_type = 'Patient' AND r.res_deleted_at IS NULL;

-- Read raw FHIR JSON for a specific resource (replace type and fhir_id)
-- SELECT v.res_text_vc
-- FROM hfj_resource r
-- JOIN hfj_res_ver v ON v.res_id = r.res_id AND v.res_ver = r.res_ver
-- WHERE r.res_type = 'Condition' AND r.fhir_id = '<fhir_id>';


-- ─────────────────────────────────────────────────────────────
-- TERMINOLOGY
-- ─────────────────────────────────────────────────────────────

-- All CodeSystems stored in terminology tables
SELECT cs.code_system_uri, ver.cs_version_id, count(c.pid) AS concept_count
FROM trm_codesystem cs
JOIN trm_codesystem_ver ver ON ver.codesystem_pid = cs.pid
JOIN trm_concept c ON c.codesystem_pid = ver.pid
GROUP BY cs.code_system_uri, ver.cs_version_id
ORDER BY concept_count DESC;

-- Concepts in the custom Goutallier CodeSystem
SELECT c.code, c.display
FROM trm_concept c
JOIN trm_codesystem_ver ver ON c.codesystem_pid = ver.pid
JOIN trm_codesystem cs ON ver.codesystem_pid = cs.pid
WHERE cs.code_system_uri LIKE '%goutallier%'
ORDER BY c.code;

-- Concepts in the custom Patte CodeSystem
SELECT c.code, c.display
FROM trm_concept c
JOIN trm_codesystem_ver ver ON c.codesystem_pid = ver.pid
JOIN trm_codesystem cs ON ver.codesystem_pid = cs.pid
WHERE cs.code_system_uri LIKE '%patte%'
ORDER BY c.code;


-- ─────────────────────────────────────────────────────────────
-- SEARCH PARAMETER INDEX INTROSPECTION
-- ─────────────────────────────────────────────────────────────

-- What token params are indexed (and how many values)
SELECT sp_name, count(*) AS count
FROM hfj_spidx_token
GROUP BY sp_name ORDER BY count DESC;

-- What string params are indexed
SELECT sp_name, count(*) AS count
FROM hfj_spidx_string
GROUP BY sp_name ORDER BY count DESC;

-- What date params are indexed
SELECT sp_name, count(*) AS count
FROM hfj_spidx_date
GROUP BY sp_name ORDER BY count DESC;

-- What quantity params are indexed
SELECT sp_name, count(*) AS count
FROM hfj_spidx_quantity
GROUP BY sp_name ORDER BY count DESC;
