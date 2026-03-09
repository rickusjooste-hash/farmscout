-- Migration: Split QC into Runner + QC Worker Apps
-- Run in Supabase SQL Editor
-- Date: 2026-03-05

-- 1. Add rfid_tag column to qc_employees
ALTER TABLE public.qc_employees ADD COLUMN IF NOT EXISTS rfid_tag text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_qc_employees_rfid_tag ON public.qc_employees(rfid_tag) WHERE rfid_tag IS NOT NULL;

-- 2. Add new roles to enum (if not already present)
-- Note: ALTER TYPE ... ADD VALUE is idempotent with IF NOT EXISTS
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'runner';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'qc_worker';

-- 3. Add modules column to organisations for SaaS module gating
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS modules text[] NOT NULL DEFAULT ARRAY['farmscout'];

-- 4. Set current org to have both modules (adjust org ID as needed)
UPDATE organisations SET modules = ARRAY['farmscout','qc']
WHERE id = '93d1760e-a484-4379-95fb-6cad294e2191';
