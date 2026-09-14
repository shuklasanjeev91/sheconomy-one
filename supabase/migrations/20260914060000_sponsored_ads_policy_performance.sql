-- Cover remaining sponsored-ad foreign keys and avoid per-row auth function
-- evaluation in owner reporting policies.

create index if not exists sponsored_campaigns_company_idx
  on public.sponsored_campaigns(company_id)
  where company_id is not null;
create index if not exists sponsored_campaigns_reviewed_by_idx
  on public.sponsored_campaigns(reviewed_by)
  where reviewed_by is not null;
create index if not exists sponsored_payments_advertiser_idx
  on public.sponsored_campaign_payments(advertiser_user_id);
create index if not exists sponsored_events_post_idx
  on public.sponsored_campaign_events(post_id);
create index if not exists sponsored_audit_actor_idx
  on public.sponsored_campaign_audit_log(actor_id)
  where actor_id is not null;

drop policy if exists sponsored_campaigns_owner_select on public.sponsored_campaigns;
create policy sponsored_campaigns_owner_select
on public.sponsored_campaigns for select to authenticated
using (
  advertiser_user_id = (select auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'A'
  )
);

drop policy if exists sponsored_payments_owner_select on public.sponsored_campaign_payments;
create policy sponsored_payments_owner_select
on public.sponsored_campaign_payments for select to authenticated
using (
  advertiser_user_id = (select auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'A'
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
        c.advertiser_user_id = (select auth.uid())
        or exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.role = 'A'
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
        c.advertiser_user_id = (select auth.uid())
        or exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.role = 'A'
        )
      )
  )
);
