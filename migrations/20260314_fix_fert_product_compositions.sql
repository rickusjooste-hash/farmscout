-- Fix fert_products nutrient compositions — run in Supabase SQL Editor
-- Products were imported with values in wrong columns; this corrects them.

-- Reset all nutrient values first, then set correct ones
-- (safer than trying to move individual values between columns)

-- Agmag — Agricultural Magnesium Sulphate (Mg=16%, S=13%)
UPDATE fert_products SET n_pct=0, p_pct=0, k_pct=0, ca_pct=0, mg_pct=16, s_pct=13
WHERE lower(name) = 'agmag';

-- Calcinit — Yara Calcium Nitrate (N=15.5%, Ca=19%)
UPDATE fert_products SET n_pct=15.5, p_pct=0, k_pct=0, ca_pct=19, mg_pct=0, s_pct=0
WHERE lower(name) = 'calcinit';

-- Calcite — Calcitic Lime (Ca=34%, Mg=0.5%)
UPDATE fert_products SET n_pct=0, p_pct=0, k_pct=0, ca_pct=34, mg_pct=0.5, s_pct=0
WHERE lower(name) = 'calcite';

-- Dolomitic Lime (Ca=22%, Mg=12%)
UPDATE fert_products SET n_pct=0, p_pct=0, k_pct=0, ca_pct=22, mg_pct=12, s_pct=0
WHERE lower(name) = 'dolomitic lime';

-- Gypsum (Ca=23%, S=18%)
UPDATE fert_products SET n_pct=0, p_pct=0, k_pct=0, ca_pct=23, mg_pct=0, s_pct=18
WHERE lower(name) = 'gypsum';

-- KCl Granular — Muriate of Potash (K=50%)
UPDATE fert_products SET n_pct=0, p_pct=0, k_pct=50, ca_pct=0, mg_pct=0, s_pct=0
WHERE lower(name) IN ('kcl granular', 'kcl');

-- LAN — Limestone Ammonium Nitrate (N=28%, Ca=10%)
UPDATE fert_products SET n_pct=28, p_pct=0, k_pct=0, ca_pct=10, mg_pct=0, s_pct=0
WHERE lower(name) = 'lan';

-- Maxiphos — Calcium Phosphate (P=9%, Ca=31%)
UPDATE fert_products SET n_pct=0, p_pct=9, k_pct=0, ca_pct=31, mg_pct=0, s_pct=0
WHERE lower(name) = 'maxiphos';

-- Nitrabor — Yara Calcium Nitrate + Boron (N=15.4%, Ca=18.3%)
UPDATE fert_products SET n_pct=15.4, p_pct=0, k_pct=0, ca_pct=18.3, mg_pct=0, s_pct=0
WHERE lower(name) = 'nitrabor';

-- MAP — Mono Ammonium Phosphate (N=11%, P=22%)
UPDATE fert_products SET n_pct=11, p_pct=22, k_pct=0, ca_pct=0, mg_pct=0, s_pct=0
WHERE lower(name) = 'map';

-- Comment — not a real product, zero out
UPDATE fert_products SET n_pct=0, p_pct=0, k_pct=0, ca_pct=0, mg_pct=0, s_pct=0
WHERE lower(name) = 'comment';

-- K (if this is KCl shorthand)
UPDATE fert_products SET n_pct=0, p_pct=0, k_pct=50, ca_pct=0, mg_pct=0, s_pct=0
WHERE lower(name) = 'k';
