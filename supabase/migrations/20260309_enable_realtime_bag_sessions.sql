-- Enable Supabase Realtime on qc_bag_sessions
-- So QC workers get instant notifications when runners log new bags
-- Run in Supabase SQL Editor

ALTER PUBLICATION supabase_realtime ADD TABLE qc_bag_sessions;
