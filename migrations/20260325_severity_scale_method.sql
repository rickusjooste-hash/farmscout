-- Add severity_scale observation method for scale insect tree scouting
-- Scale: 0=none, 1=scattered, 2=moderate, 3=heavy, 4=severe
-- Value stored in inspection_observations.count (integer 0-4)
ALTER TYPE observation_method ADD VALUE IF NOT EXISTS 'severity_scale';
