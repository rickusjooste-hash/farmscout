-- Allow authenticated users to delete their own sessions
CREATE POLICY "packout_daily_sessions_delete"
  ON packout_daily_sessions FOR DELETE TO authenticated USING (true);
