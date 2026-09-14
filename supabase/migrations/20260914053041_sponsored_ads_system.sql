-- Self-serve sponsored community posts.
--
-- Payment, delivery and moderation writes are performed by authenticated Edge
-- Functions using the service role. Clients can only read campaigns/payments
-- they own; staff can read all rows for review and support.

-- Staff authorization in this application is backed by profiles.role. Existing
-- own-profile UPDATE policies do not protect individual columns, so prevent a
-- member from assigning themselves the admin role before relying on it here.
create or replace function public.protect_profile_admin_role()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.role = 'A'
    and (tg_op = 'INSERT' or old.role is distinct from new.role)
    and coalesce(auth.role(), '') <> 'service_role'
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'A'
    )
  then
    raise exception 'Only an administrator can assign the administrator role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_admin_role on public.profiles;
create trigger profiles_protect_admin_role
before insert or update on public.profiles
for each row execute function public.protect_profile_admin_role();
revoke all on function public.protect_profile_admin_role() from public, anon, authenticated;

create table if not exists public.sponsored_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  company_id uuid references public.companypages(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  objective text not null default 'awareness'
    check (objective in ('awareness', 'engagement', 'traffic')),
  status text not null default 'draft'
    check (status in (
      'draft', 'pending_payment', 'pending_review', 'active', 'paused',
      'completed', 'rejected', 'cancelled', 'refund_requested', 'refunded'
    )),
  audience jsonb not null default '{}'::jsonb
    check (jsonb_typeof(audience) = 'object'),
  destination_url text,
  call_to_action text not null default 'learn_more'
    check (call_to_action in (
      'learn_more', 'shop_now', 'sign_up', 'contact_us', 'visit_profile', 'none'
    )),
  currency text not null default 'INR' check (currency = 'INR'),
  total_budget numeric(12,2) not null check (total_budget >= 100),
  daily_budget numeric(12,2) not null check (daily_budget >= 50),
  cost_per_impression numeric(12,4) not null default 0.2000
    check (cost_per_impression > 0),
  spent_amount numeric(12,4) not null default 0 check (spent_amount >= 0),
  impression_count bigint not null default 0 check (impression_count >= 0),
  click_count bigint not null default 0 check (click_count >= 0),
  frequency_cap_per_day smallint not null default 3
    check (frequency_cap_per_day between 1 and 10),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  paid_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  rejection_reason text,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (daily_budget <= total_budget),
  check (spent_amount <= total_budget + 0.01)
);

create index if not exists sponsored_campaigns_advertiser_created_idx
  on public.sponsored_campaigns(advertiser_user_id, created_at desc);
create index if not exists sponsored_campaigns_delivery_idx
  on public.sponsored_campaigns(status, starts_at, ends_at)
  where status = 'active';
create index if not exists sponsored_campaigns_post_idx
  on public.sponsored_campaigns(post_id);

create table if not exists public.sponsored_campaign_payments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.sponsored_campaigns(id) on delete cascade,
  advertiser_user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'payu' check (provider = 'payu'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  transaction_id text not null unique,
  gateway_transaction_id text,
  failure_code text,
  failure_reason text,
  provider_response jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sponsored_campaign_payments_campaign_idx
  on public.sponsored_campaign_payments(campaign_id, created_at desc);

create table if not exists public.sponsored_campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.sponsored_campaigns(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('impression', 'click', 'hide', 'report')),
  placement text not null default 'community_feed',
  session_id text,
  event_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists sponsored_campaign_events_campaign_time_idx
  on public.sponsored_campaign_events(campaign_id, occurred_at desc);
create index if not exists sponsored_campaign_events_viewer_cap_idx
  on public.sponsored_campaign_events(viewer_id, campaign_id, occurred_at desc)
  where event_type = 'impression';

create table if not exists public.sponsored_campaign_daily_metrics (
  campaign_id uuid not null references public.sponsored_campaigns(id) on delete cascade,
  metric_date date not null,
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  spend numeric(12,4) not null default 0 check (spend >= 0),
  unique_viewers bigint not null default 0 check (unique_viewers >= 0),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, metric_date)
);

create table if not exists public.sponsored_campaign_audit_log (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.sponsored_campaigns(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sponsored_campaign_audit_campaign_idx
  on public.sponsored_campaign_audit_log(campaign_id, created_at desc);

create or replace function public.sponsored_campaign_apply_event()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cost numeric(12,4) := 0;
  v_remaining numeric(12,4) := 0;
  v_daily_budget numeric(12,4) := 0;
  v_daily_spend numeric(12,4) := 0;
  v_unique bigint := 0;
begin
  if new.event_type = 'impression' then
    select cost_per_impression, greatest(total_budget - spent_amount, 0), daily_budget
    into v_cost, v_remaining, v_daily_budget
    from public.sponsored_campaigns
    where id = new.campaign_id and status = 'active'
    for update;

    if not found then
      return new;
    end if;

    select coalesce(spend, 0)
    into v_daily_spend
    from public.sponsored_campaign_daily_metrics
    where campaign_id = new.campaign_id
      and metric_date = new.occurred_at::date;

    v_cost := least(v_cost, v_remaining, greatest(v_daily_budget - v_daily_spend, 0));
    if v_cost <= 0 then
      return new;
    end if;

    if new.viewer_id is not null and not exists (
      select 1
      from public.sponsored_campaign_events e
      where e.campaign_id = new.campaign_id
        and e.viewer_id = new.viewer_id
        and e.event_type = 'impression'
        and e.id <> new.id
    ) then
      v_unique := 1;
    end if;

    update public.sponsored_campaigns
    set impression_count = impression_count + 1,
        spent_amount = least(total_budget, spent_amount + v_cost),
        status = case
          when spent_amount + v_cost >= total_budget then 'completed'
          else status
        end,
        completed_at = case
          when spent_amount + v_cost >= total_budget then now()
          else completed_at
        end,
        updated_at = now()
    where id = new.campaign_id;

    insert into public.sponsored_campaign_daily_metrics(
      campaign_id, metric_date, impressions, spend, unique_viewers
    )
    values (new.campaign_id, new.occurred_at::date, 1, v_cost, v_unique)
    on conflict (campaign_id, metric_date) do update
      set impressions = sponsored_campaign_daily_metrics.impressions + 1,
          spend = sponsored_campaign_daily_metrics.spend + excluded.spend,
          unique_viewers = sponsored_campaign_daily_metrics.unique_viewers + excluded.unique_viewers,
          updated_at = now();
  elsif new.event_type = 'click' then
    update public.sponsored_campaigns
    set click_count = click_count + 1, updated_at = now()
    where id = new.campaign_id and status in ('active', 'completed');

    insert into public.sponsored_campaign_daily_metrics(
      campaign_id, metric_date, clicks
    )
    values (new.campaign_id, new.occurred_at::date, 1)
    on conflict (campaign_id, metric_date) do update
      set clicks = sponsored_campaign_daily_metrics.clicks + 1,
          updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists sponsored_campaign_event_metrics
  on public.sponsored_campaign_events;
create trigger sponsored_campaign_event_metrics
after insert on public.sponsored_campaign_events
for each row execute function public.sponsored_campaign_apply_event();

create or replace function public.reconcile_sponsored_campaigns()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.sponsored_campaigns
  set status = 'completed',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where status in ('active', 'paused')
    and (ends_at <= now() or spent_amount >= total_budget);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.reconcile_sponsored_campaigns() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'reconcile-sponsored-campaigns';
    perform cron.schedule(
      'reconcile-sponsored-campaigns',
      '*/10 * * * *',
      $cron$select public.reconcile_sponsored_campaigns()$cron$
    );
  end if;
exception when others then
  raise notice 'Sponsored campaign cron schedule skipped: %', sqlerrm;
end $$;

alter table public.sponsored_campaigns enable row level security;
alter table public.sponsored_campaign_payments enable row level security;
alter table public.sponsored_campaign_events enable row level security;
alter table public.sponsored_campaign_daily_metrics enable row level security;
alter table public.sponsored_campaign_audit_log enable row level security;

grant select on public.sponsored_campaigns to authenticated;
grant select on public.sponsored_campaign_payments to authenticated;
grant select on public.sponsored_campaign_daily_metrics to authenticated;
grant select on public.sponsored_campaign_audit_log to authenticated;

drop policy if exists sponsored_campaigns_owner_select on public.sponsored_campaigns;
create policy sponsored_campaigns_owner_select
on public.sponsored_campaigns for select to authenticated
using (
  advertiser_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'A'
  )
);

drop policy if exists sponsored_payments_owner_select on public.sponsored_campaign_payments;
create policy sponsored_payments_owner_select
on public.sponsored_campaign_payments for select to authenticated
using (
  advertiser_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'A'
  )
);

drop policy if exists sponsored_metrics_owner_select on public.sponsored_campaign_daily_metrics;
create policy sponsored_metrics_owner_select
on public.sponsored_campaign_daily_metrics for select to authenticated
using (
  exists (
    select 1 from public.sponsored_campaigns c
    where c.id = campaign_id
      and (
        c.advertiser_user_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'A'
        )
      )
  )
);

drop policy if exists sponsored_audit_owner_select on public.sponsored_campaign_audit_log;
create policy sponsored_audit_owner_select
on public.sponsored_campaign_audit_log for select to authenticated
using (
  exists (
    select 1 from public.sponsored_campaigns c
    where c.id = campaign_id
      and (
        c.advertiser_user_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'A'
        )
      )
  )
);

-- Events contain viewer-level delivery data and remain service-role only.
revoke all on public.sponsored_campaign_events from anon, authenticated;
