-- Allow signed-in users to register/manage their own push devices (web / iOS / Android).
ALTER TABLE public.user_push_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_push_devices_select_own ON public.user_push_devices;
CREATE POLICY user_push_devices_select_own
  ON public.user_push_devices FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_push_devices_insert_own ON public.user_push_devices;
CREATE POLICY user_push_devices_insert_own
  ON public.user_push_devices FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_push_devices_update_own ON public.user_push_devices;
CREATE POLICY user_push_devices_update_own
  ON public.user_push_devices FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_push_devices_delete_own ON public.user_push_devices;
CREATE POLICY user_push_devices_delete_own
  ON public.user_push_devices FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_push_devices TO authenticated;
