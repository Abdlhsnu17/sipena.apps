-- Older detail-level maintenance records also set the parent room/asset to
-- `maintenance`. Restore those parent statuses when there is no active
-- whole-asset maintenance record. Detail status remains the source of truth.

UPDATE medical_assets AS asset
SET asset.status = 'available', asset.updated_at = NOW()
WHERE asset.status = 'maintenance'
  AND NOT EXISTS (
    SELECT 1
    FROM maintenance_records AS maintenance
    WHERE maintenance.asset_id = asset.id
      AND COALESCE(maintenance.asset_type, 'medical') = 'medical'
      AND maintenance.status IN ('scheduled', 'in_progress', 'completed')
      AND maintenance.deleted_at IS NULL
      AND (
        maintenance.asset_detail_id IS NULL
        OR TRIM(maintenance.asset_detail_id) = ''
        OR maintenance.asset_detail_id = CONCAT('asset-', asset.id)
        OR maintenance.asset_detail_id = CONCAT('asset-medical-', asset.id)
      )
  );

UPDATE non_medical_assets AS asset
SET asset.status = 'available', asset.updated_at = NOW()
WHERE asset.status = 'maintenance'
  AND NOT EXISTS (
    SELECT 1
    FROM maintenance_records AS maintenance
    WHERE maintenance.asset_id = asset.id
      AND COALESCE(maintenance.asset_type, 'medical') = 'non_medical'
      AND maintenance.status IN ('scheduled', 'in_progress', 'completed')
      AND maintenance.deleted_at IS NULL
      AND (
        maintenance.asset_detail_id IS NULL
        OR TRIM(maintenance.asset_detail_id) = ''
        OR maintenance.asset_detail_id = CONCAT('asset-', asset.id)
        OR maintenance.asset_detail_id = CONCAT('asset-non_medical-', asset.id)
      )
  );
