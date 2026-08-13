-- The status check predates the 'passed' -> 'verified' rename in
-- complete_gender_verification_session, so every successful verification hit a
-- constraint violation and rolled back: the session stayed pending and the
-- profile flags were never set. Widen the domain and settle on 'verified'.

alter table public.gender_verification_sessions
  drop constraint if exists gender_verification_sessions_status_check;

update public.gender_verification_sessions
set status = 'verified'
where status = 'passed';

alter table public.gender_verification_sessions
  add constraint gender_verification_sessions_status_check
  check (status in ('pending', 'passed', 'verified', 'failed', 'expired'));
