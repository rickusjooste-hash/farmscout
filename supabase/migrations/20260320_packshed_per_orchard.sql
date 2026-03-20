-- Floor stock is per orchard — add orchard_id and update unique constraint
ALTER TABLE packout_floor_stock ADD COLUMN IF NOT EXISTS orchard_id uuid REFERENCES orchards(id);

-- Drop old unique constraint (without orchard_id) and add new one
ALTER TABLE packout_floor_stock DROP CONSTRAINT IF EXISTS packout_floor_stock_organisation_id_packhouse_id_stock_dat_key;
ALTER TABLE packout_floor_stock ADD CONSTRAINT packout_floor_stock_ph_orch_date_bt_sz_key
  UNIQUE (organisation_id, packhouse_id, orchard_id, stock_date, box_type_id, size_id);
