-- Fix fert_recommendations with NULL commodity_id — run in Supabase SQL Editor
-- Sets commodity_id to the dominant commodity from the recommendation's orchards

-- Update each recommendation to the most common commodity among its orchards
UPDATE fert_recommendations fr
SET commodity_id = sub.dominant_commodity_id
FROM (
  SELECT
    frl.recommendation_id,
    (SELECT o2.commodity_id
     FROM fert_recommendation_lines frl2
     JOIN orchards o2 ON o2.id = frl2.orchard_id
     WHERE frl2.recommendation_id = frl.recommendation_id
     GROUP BY o2.commodity_id
     ORDER BY COUNT(*) DESC
     LIMIT 1
    ) AS dominant_commodity_id
  FROM fert_recommendation_lines frl
  WHERE frl.orchard_id IS NOT NULL
  GROUP BY frl.recommendation_id
) sub
WHERE fr.id = sub.recommendation_id
  AND fr.commodity_id IS NULL
  AND sub.dominant_commodity_id IS NOT NULL;
