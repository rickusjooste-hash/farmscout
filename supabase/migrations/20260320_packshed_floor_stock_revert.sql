-- Revert floor stock to per-packhouse (not per-orchard)
-- Floor stock is a shared pool across orchards

-- Drop the per-orchard constraint
ALTER TABLE packout_floor_stock DROP CONSTRAINT IF EXISTS packout_floor_stock_ph_orch_date_bt_sz_key;

-- Restore the original constraint (without orchard_id)
ALTER TABLE packout_floor_stock ADD CONSTRAINT packout_floor_stock_ph_date_bt_sz_key
  UNIQUE (organisation_id, packhouse_id, stock_date, box_type_id, size_id);

-- orchard_id column can stay (nullable, informational) but is not used for the grid
