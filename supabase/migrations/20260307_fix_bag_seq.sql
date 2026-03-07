-- Fix bag_seq for today's bags that all got assigned #40
-- Reassigns sequential numbers based on collected_at order

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY collected_at) AS new_seq
  FROM qc_bag_sessions
  WHERE collected_at::date = '2026-03-07'
)
UPDATE qc_bag_sessions s
SET bag_seq = n.new_seq
FROM numbered n
WHERE s.id = n.id;
