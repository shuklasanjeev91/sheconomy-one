-- Some old connection rows were already removed, so their peer profile can no
-- longer be recovered. Send those notifications to Network, where pending
-- requests are loaded from current state, instead of retaining a dead token.
UPDATE public.notifications
SET
  action_url = '/community/network',
  updated_at = now()
WHERE type IN ('connection_request', 'connection_accepted')
  AND (action_url IS NULL OR action_url LIKE '%{{%');
