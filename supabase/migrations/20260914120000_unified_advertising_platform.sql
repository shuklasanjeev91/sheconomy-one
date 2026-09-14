-- Unified app-wide advertising foundation.
--
-- Compatibility:
--   * Existing sponsored post campaigns and service functions continue to use
--     sponsored_campaigns / sponsored_campaign_events unchanged.
--   * Legacy inserts that omit account_id are assigned a default ad account.
--   * Advertisers can read configuration and aggregate reporting only. Raw
--     delivery, subject, membership, attribution and fraud rows are service-only.
--
-- Privacy:
--   * Targeting JSON rejects gender, IP, direct identifiers, raw CRM PII and
--     device fingerprints.
--   * Privacy-safe subject UUIDs separate ad data from profile IDs.

-- ---------------------------------------------------------------------------
-- Shared helpers and normalized advertiser accounts
-- ---------------------------------------------------------------------------

create or replace function public.ad_targeting_is_safe(p_targeting jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_key text;
  v_value jsonb;
begin
  if p_targeting is null then
    return true;
  end if;
  if jsonb_typeof(p_targeting) = 'object' then
    for v_key, v_value in select key, value from jsonb_each(p_targeting)
    loop
      if lower(regexp_replace(v_key, '[^a-z0-9]+', '_', 'g')) in (
        'gender', 'sex', 'ip', 'ip_address', 'last_login_ip',
        'device_fingerprint', 'fingerprint', 'advertising_id', 'device_id',
        'email', 'email_address', 'phone', 'phone_number', 'full_name',
        'raw_crm_pii', 'crm_pii', 'customer_email', 'customer_phone'
      ) then
        return false;
      end if;
      if not public.ad_targeting_is_safe(v_value) then
        return false;
      end if;
    end loop;
  elsif jsonb_typeof(p_targeting) = 'array' then
    for v_value in select value from jsonb_array_elements(p_targeting)
    loop
      if not public.ad_targeting_is_safe(v_value) then
        return false;
      end if;
    end loop;
  end if;
  return true;
end;
$$;

revoke all on function public.ad_targeting_is_safe(jsonb) from public, anon, authenticated;

create table if not exists public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status text not null default 'active'
    check (status in ('pending', 'active', 'suspended', 'closed')),
  currency text not null default 'INR' check (currency = 'INR'),
  timezone text not null default 'Asia/Kolkata',
  billing_status text not null default 'unfunded'
    check (billing_status in ('unfunded', 'funded', 'past_due', 'disabled')),
  spend_limit numeric(14,2) check (spend_limit is null or spend_limit >= 0),
  is_default boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ad_accounts_one_default_per_owner_idx
  on public.ad_accounts(owner_user_id) where is_default;
create index if not exists ad_accounts_owner_status_idx
  on public.ad_accounts(owner_user_id, status);

create table if not exists public.ad_account_members (
  account_id uuid not null references public.ad_accounts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'analyst'
    check (member_role in ('admin', 'campaign_manager', 'analyst', 'billing')),
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create index if not exists ad_account_members_user_idx
  on public.ad_account_members(user_id, status);

create or replace function public.ad_is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.role = 'A'
  );
$$;

create or replace function public.ad_can_access_account(
  p_account_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.ad_accounts a
    where a.id = p_account_id
      and (
        a.owner_user_id = p_user_id
        or exists (
          select 1 from public.ad_account_members m
          where m.account_id = a.id
            and m.user_id = p_user_id
            and m.status = 'active'
        )
        or public.ad_is_admin(p_user_id)
      )
  );
$$;

create or replace function public.advertiser_is_eligible(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and public.ad_can_access_account(p_account_id, auth.uid())
    and exists (
      select 1
      from public.ad_accounts a
      join public.profiles p on p.id = auth.uid()
      where a.id = p_account_id
        and a.status = 'active'
        and p.is_active = true
        and p.account_status = 'active'
        and (coalesce(p.email_verified, false) or coalesce(p.phone_verified, false))
    );
$$;

revoke all on function public.ad_is_admin(uuid) from public, anon, authenticated;
revoke all on function public.ad_can_access_account(uuid, uuid) from public, anon, authenticated;
revoke all on function public.advertiser_is_eligible(uuid) from public, anon;
grant execute on function public.advertiser_is_eligible(uuid) to authenticated;

create or replace function public.ad_protect_account_ownership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and new.owner_user_id is distinct from old.owner_user_id
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.ad_is_admin(auth.uid()) then
    raise exception 'ad account ownership is protected';
  end if;
  return new;
end;
$$;

drop trigger if exists ad_accounts_protect_ownership on public.ad_accounts;
create trigger ad_accounts_protect_ownership
before update on public.ad_accounts
for each row execute function public.ad_protect_account_ownership();
revoke all on function public.ad_protect_account_ownership() from public, anon, authenticated;

-- One default account for every legacy advertiser. Existing campaign IDs and
-- advertiser ownership remain unchanged.
insert into public.ad_accounts (owner_user_id, name, status, billing_status, is_default)
select distinct c.advertiser_user_id, 'Advertising account', 'active', 'funded', true
from public.sponsored_campaigns c
where not exists (
  select 1 from public.ad_accounts a where a.owner_user_id = c.advertiser_user_id
)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Extend legacy campaigns and events
-- ---------------------------------------------------------------------------

alter table public.sponsored_campaigns
  alter column post_id drop not null,
  add column if not exists account_id uuid references public.ad_accounts(id) on delete restrict,
  add column if not exists listing_id uuid references public.listings(id) on delete set null,
  add column if not exists shop_id uuid references public.shops(id) on delete set null,
  add column if not exists promoted_entity_type text,
  add column if not exists promoted_entity_id uuid,
  add column if not exists buying_model text not null default 'cpm',
  add column if not exists optimization_goal text not null default 'impressions',
  add column if not exists bid_amount numeric(14,6),
  add column if not exists billing_event text not null default 'impression',
  add column if not exists delivery_status text not null default 'not_delivering',
  add column if not exists delivery_priority smallint not null default 5,
  add column if not exists pacing_mode text not null default 'standard',
  add column if not exists quality_score numeric(5,2),
  add column if not exists relevance_score numeric(5,2),
  add column if not exists review_flags text[] not null default '{}',
  add column if not exists last_delivered_at timestamptz;

update public.sponsored_campaigns c
set account_id = a.id
from public.ad_accounts a
where c.account_id is null
  and a.owner_user_id = c.advertiser_user_id
  and a.is_default;

update public.sponsored_campaigns
set promoted_entity_type = 'post',
    promoted_entity_id = post_id,
    bid_amount = coalesce(bid_amount, cost_per_impression * 1000),
    buying_model = coalesce(buying_model, 'cpm'),
    billing_event = coalesce(billing_event, 'impression')
where post_id is not null
  and (promoted_entity_type is null or promoted_entity_id is null or bid_amount is null);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sponsored_campaigns'::regclass
      and conname = 'sponsored_campaigns_buying_model_check'
  ) then
    alter table public.sponsored_campaigns
      add constraint sponsored_campaigns_buying_model_check
      check (buying_model in ('cpm', 'cpc', 'ocpm', 'cpa'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sponsored_campaigns'::regclass
      and conname = 'sponsored_campaigns_billing_event_check'
  ) then
    alter table public.sponsored_campaigns
      add constraint sponsored_campaigns_billing_event_check
      check (billing_event in ('impression', 'click', 'conversion'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sponsored_campaigns'::regclass
      and conname = 'sponsored_campaigns_entity_type_check'
  ) then
    alter table public.sponsored_campaigns
      add constraint sponsored_campaigns_entity_type_check
      check (promoted_entity_type is null or promoted_entity_type in ('post', 'listing', 'shop'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sponsored_campaigns'::regclass
      and conname = 'sponsored_campaigns_bid_amount_check'
  ) then
    alter table public.sponsored_campaigns
      add constraint sponsored_campaigns_bid_amount_check
      check (bid_amount is null or bid_amount > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sponsored_campaigns'::regclass
      and conname = 'sponsored_campaigns_delivery_fields_check'
  ) then
    alter table public.sponsored_campaigns
      add constraint sponsored_campaigns_delivery_fields_check check (
        delivery_status in ('not_delivering', 'learning', 'delivering', 'limited', 'exhausted', 'ended')
        and delivery_priority between 1 and 10
        and pacing_mode in ('standard', 'accelerated')
        and (quality_score is null or quality_score between 0 and 100)
        and (relevance_score is null or relevance_score between 0 and 100)
      );
  end if;
end $$;

create index if not exists sponsored_campaigns_account_idx
  on public.sponsored_campaigns(account_id, created_at desc);
create index if not exists sponsored_campaigns_listing_idx
  on public.sponsored_campaigns(listing_id) where listing_id is not null;
create index if not exists sponsored_campaigns_shop_idx
  on public.sponsored_campaigns(shop_id) where shop_id is not null;
create index if not exists sponsored_campaigns_entity_idx
  on public.sponsored_campaigns(promoted_entity_type, promoted_entity_id);
create index if not exists sponsored_campaigns_unified_delivery_idx
  on public.sponsored_campaigns(delivery_status, status, starts_at, ends_at)
  where status = 'active';

create or replace function public.ad_validate_campaign_ownership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.ad_accounts%rowtype;
  v_owner uuid;
  v_shop_id uuid;
begin
  if new.account_id is null then
    select * into v_account
    from public.ad_accounts
    where owner_user_id = new.advertiser_user_id and is_default
    limit 1;
    if not found then
      insert into public.ad_accounts (
        owner_user_id, name, status, billing_status, is_default
      ) values (
        new.advertiser_user_id, 'Advertising account', 'active', 'funded', true
      )
      returning * into v_account;
    end if;
    new.account_id := v_account.id;
  else
    select * into v_account from public.ad_accounts where id = new.account_id;
    if not found then
      raise exception 'ad account not found';
    end if;
  end if;

  if v_account.owner_user_id <> new.advertiser_user_id
     and not exists (
       select 1 from public.ad_account_members m
       where m.account_id = v_account.id
         and m.user_id = new.advertiser_user_id
         and m.status = 'active'
         and m.member_role in ('admin', 'campaign_manager')
     ) then
    raise exception 'campaign advertiser does not control ad account';
  end if;

  if tg_op = 'UPDATE'
     and (
       new.account_id is distinct from old.account_id
       or new.advertiser_user_id is distinct from old.advertiser_user_id
     )
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.ad_is_admin(auth.uid()) then
    raise exception 'campaign ownership is protected';
  end if;

  if new.post_id is not null and new.listing_id is not null then
    raise exception 'a campaign cannot promote both a post and a listing';
  end if;

  if new.post_id is not null then
    select p.user_id into v_owner from public.posts p where p.id = new.post_id;
    if not found or v_owner is distinct from v_account.owner_user_id then
      raise exception 'promoted post must belong to ad account owner';
    end if;
    new.promoted_entity_type := 'post';
    new.promoted_entity_id := new.post_id;
  elsif new.listing_id is not null then
    select l.shop_id, s.user_id into v_shop_id, v_owner
    from public.listings l join public.shops s on s.id = l.shop_id
    where l.id = new.listing_id;
    if not found or v_owner is distinct from v_account.owner_user_id then
      raise exception 'promoted listing must belong to ad account owner shop';
    end if;
    new.shop_id := v_shop_id;
    new.promoted_entity_type := 'listing';
    new.promoted_entity_id := new.listing_id;
  elsif new.shop_id is not null then
    select s.user_id into v_owner from public.shops s where s.id = new.shop_id;
    if not found or v_owner is distinct from v_account.owner_user_id then
      raise exception 'promoted shop must belong to ad account owner';
    end if;
    new.promoted_entity_type := 'shop';
    new.promoted_entity_id := new.shop_id;
  elsif new.promoted_entity_type is not null or new.promoted_entity_id is not null then
    raise exception 'promoted entity reference is incomplete';
  end if;

  if not public.ad_targeting_is_safe(new.audience) then
    raise exception 'targeting contains prohibited personal data or attributes';
  end if;
  return new;
end;
$$;

drop trigger if exists sponsored_campaigns_validate_ownership on public.sponsored_campaigns;
create trigger sponsored_campaigns_validate_ownership
before insert or update of account_id, advertiser_user_id, post_id, listing_id, shop_id,
  promoted_entity_type, promoted_entity_id, audience
on public.sponsored_campaigns
for each row execute function public.ad_validate_campaign_ownership();
revoke all on function public.ad_validate_campaign_ownership() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ad sets, creatives, placements and inventory
-- ---------------------------------------------------------------------------

create table if not exists public.ad_sets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ad_accounts(id) on delete cascade,
  campaign_id uuid not null references public.sponsored_campaigns(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  targeting jsonb not null default '{}'::jsonb
    check (jsonb_typeof(targeting) = 'object' and public.ad_targeting_is_safe(targeting)),
  optimization_goal text not null default 'impressions',
  bid_amount numeric(14,6) check (bid_amount is null or bid_amount > 0),
  daily_budget numeric(14,2) check (daily_budget is null or daily_budget > 0),
  lifetime_budget numeric(14,2) check (lifetime_budget is null or lifetime_budget > 0),
  frequency_cap smallint not null default 3 check (frequency_cap between 1 and 30),
  attribution_click_days smallint not null default 7 check (attribution_click_days between 0 and 30),
  attribution_view_days smallint not null default 1 check (attribution_view_days between 0 and 7),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  unique (id, account_id)
);

create index if not exists ad_sets_campaign_status_idx
  on public.ad_sets(campaign_id, status);
create index if not exists ad_sets_account_idx
  on public.ad_sets(account_id, created_at desc);

create table if not exists public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ad_accounts(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  creative_type text not null
    check (creative_type in ('post', 'listing', 'shop', 'image', 'video', 'carousel', 'text')),
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  post_id uuid references public.posts(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  shop_id uuid references public.shops(id) on delete set null,
  headline text,
  body text,
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  destination_url text,
  call_to_action text,
  quality_score numeric(5,2) check (quality_score is null or quality_score between 0 and 100),
  review_flags text[] not null default '{}',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id)
);

create index if not exists ad_creatives_account_status_idx
  on public.ad_creatives(account_id, status, created_at desc);

create table if not exists public.ad_set_creatives (
  ad_set_id uuid not null references public.ad_sets(id) on delete cascade,
  creative_id uuid not null references public.ad_creatives(id) on delete cascade,
  account_id uuid not null references public.ad_accounts(id) on delete cascade,
  weight smallint not null default 100 check (weight between 1 and 1000),
  status text not null default 'active' check (status in ('active', 'paused')),
  created_at timestamptz not null default now(),
  primary key (ad_set_id, creative_id),
  foreign key (ad_set_id, account_id) references public.ad_sets(id, account_id) on delete cascade,
  foreign key (creative_id, account_id) references public.ad_creatives(id, account_id) on delete cascade
);

create table if not exists public.ad_placements (
  id uuid primary key default gen_random_uuid(),
  placement_key text not null unique check (placement_key ~ '^[a-z0-9_]{2,80}$'),
  name text not null,
  surface text not null,
  format text not null check (format in ('native', 'banner', 'card', 'video', 'carousel')),
  is_active boolean not null default true,
  supports_personalization boolean not null default true,
  floor_cpm numeric(14,6) not null default 0 check (floor_cpm >= 0),
  max_ads_per_request smallint not null default 1 check (max_ads_per_request between 1 and 20),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ad_placements (placement_key, name, surface, format)
values
  ('community_feed', 'Community feed', 'community', 'native'),
  ('commerce_home', 'Commerce home', 'commerce', 'card'),
  ('commerce_search', 'Commerce search', 'commerce', 'card'),
  ('commerce_browse', 'Commerce browse', 'commerce', 'card'),
  ('listing_detail', 'Listing detail', 'commerce', 'card'),
  ('shop_discovery', 'Shop discovery', 'commerce', 'card')
on conflict (placement_key) do nothing;

create table if not exists public.ad_inventory_slots (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.ad_placements(id) on delete cascade,
  slot_key text not null,
  position_min integer check (position_min is null or position_min >= 0),
  position_max integer check (position_max is null or position_max >= position_min),
  refresh_seconds integer check (refresh_seconds is null or refresh_seconds >= 15),
  is_active boolean not null default true,
  eligibility jsonb not null default '{}'::jsonb
    check (jsonb_typeof(eligibility) = 'object' and public.ad_targeting_is_safe(eligibility)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (placement_id, slot_key)
);

create table if not exists public.ad_set_placements (
  ad_set_id uuid not null references public.ad_sets(id) on delete cascade,
  placement_id uuid not null references public.ad_placements(id) on delete restrict,
  bid_adjustment numeric(7,4) not null default 1 check (bid_adjustment between 0.1 and 10),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (ad_set_id, placement_id)
);

create or replace function public.ad_validate_account_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign_account uuid;
  v_shop_owner uuid;
begin
  if tg_table_name = 'ad_sets' then
    select c.account_id into v_campaign_account
    from public.sponsored_campaigns c where c.id = new.campaign_id;
    if v_campaign_account is distinct from new.account_id then
      raise exception 'ad set and campaign must use the same account';
    end if;
  elsif tg_table_name = 'ad_creatives' then
    if new.created_by is distinct from (
      select a.owner_user_id from public.ad_accounts a where a.id = new.account_id
    ) and not exists (
      select 1 from public.ad_account_members m
      where m.account_id = new.account_id
        and m.user_id = new.created_by
        and m.status = 'active'
        and m.member_role in ('admin', 'campaign_manager')
    ) then
      raise exception 'creative creator does not control ad account';
    end if;
    if new.post_id is not null and not exists (
      select 1 from public.posts p
      join public.ad_accounts a on a.id = new.account_id
      where p.id = new.post_id and p.user_id = a.owner_user_id
    ) then
      raise exception 'creative post does not belong to account owner';
    end if;
    if new.listing_id is not null then
      select s.user_id into v_shop_owner
      from public.listings l join public.shops s on s.id = l.shop_id
      where l.id = new.listing_id;
      if v_shop_owner is distinct from (
        select a.owner_user_id from public.ad_accounts a where a.id = new.account_id
      ) then
        raise exception 'creative listing does not belong to account owner';
      end if;
    end if;
    if new.shop_id is not null and not exists (
      select 1 from public.shops s
      join public.ad_accounts a on a.id = new.account_id
      where s.id = new.shop_id and s.user_id = a.owner_user_id
    ) then
      raise exception 'creative shop does not belong to account owner';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and new.account_id is distinct from old.account_id
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.ad_is_admin(auth.uid()) then
    raise exception 'advertising object ownership is protected';
  end if;
  return new;
end;
$$;

drop trigger if exists ad_sets_validate_scope on public.ad_sets;
create trigger ad_sets_validate_scope
before insert or update on public.ad_sets
for each row execute function public.ad_validate_account_scope();
drop trigger if exists ad_creatives_validate_scope on public.ad_creatives;
create trigger ad_creatives_validate_scope
before insert or update on public.ad_creatives
for each row execute function public.ad_validate_account_scope();
revoke all on function public.ad_validate_account_scope() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Consent, audiences and privacy-safe subjects
-- ---------------------------------------------------------------------------

create table if not exists public.ad_privacy_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  personalized_ads boolean not null default false,
  measurement_allowed boolean not null default true,
  audience_membership_allowed boolean not null default false,
  retargeting_notifications boolean not null default false,
  external_analytics boolean not null default false,
  consent_version text not null default '1',
  consented_at timestamptz,
  withdrawn_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (personalized_ads = false and audience_membership_allowed = false)
    or consented_at is not null
  )
);

create table if not exists public.ad_consent_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  personalized_ads boolean not null,
  measurement_allowed boolean not null,
  audience_membership_allowed boolean not null,
  consent_version text not null,
  source text not null check (source in ('settings', 'onboarding', 'system', 'support')),
  occurred_at timestamptz not null default now()
);

create index if not exists ad_consent_history_user_time_idx
  on public.ad_consent_history(user_id, occurred_at desc);

create or replace function public.ad_record_consent_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if new.personalized_ads or new.audience_membership_allowed then
    new.consented_at := coalesce(new.consented_at, now());
    new.withdrawn_at := null;
  elsif tg_op = 'UPDATE'
        and (old.personalized_ads or old.audience_membership_allowed) then
    new.withdrawn_at := now();
  end if;
  insert into public.ad_consent_history (
    user_id, personalized_ads, measurement_allowed,
    audience_membership_allowed, consent_version, source
  ) values (
    new.user_id, new.personalized_ads, new.measurement_allowed,
    new.audience_membership_allowed, new.consent_version, 'settings'
  );
  return new;
end;
$$;

drop trigger if exists ad_privacy_preferences_history on public.ad_privacy_preferences;
create trigger ad_privacy_preferences_history
before insert or update on public.ad_privacy_preferences
for each row execute function public.ad_record_consent_change();
revoke all on function public.ad_record_consent_change() from public, anon, authenticated;

create table if not exists public.ad_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  personalization_allowed boolean not null default false,
  measurement_allowed boolean not null default true,
  rotated_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ad_audiences (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ad_accounts(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  audience_type text not null
    check (audience_type in ('contextual', 'engagement', 'commerce_intent', 'lookalike', 'suppression')),
  definition jsonb not null default '{}'::jsonb
    check (jsonb_typeof(definition) = 'object' and public.ad_targeting_is_safe(definition)),
  status text not null default 'building'
    check (status in ('building', 'ready', 'paused', 'expired', 'archived')),
  estimated_size_bucket text
    check (estimated_size_bucket is null or estimated_size_bucket in ('under_100', '100_1k', '1k_10k', '10k_100k', '100k_plus')),
  retention_days smallint not null default 30 check (retention_days between 1 and 180),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_audiences_account_status_idx
  on public.ad_audiences(account_id, status);

create table if not exists public.ad_audience_memberships (
  audience_id uuid not null references public.ad_audiences(id) on delete cascade,
  subject_id uuid not null references public.ad_subjects(id) on delete cascade,
  source_kind text not null
    check (source_kind in ('contextual', 'first_party_event', 'modeled', 'suppression')),
  confidence_bucket smallint check (confidence_bucket is null or confidence_bucket between 1 and 5),
  added_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (audience_id, subject_id),
  check (expires_at > added_at)
);

create index if not exists ad_audience_memberships_expiry_idx
  on public.ad_audience_memberships(expires_at);
create index if not exists ad_audience_memberships_subject_idx
  on public.ad_audience_memberships(subject_id, expires_at);

create or replace function public.ad_validate_membership_consent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.ad_subjects s
    join public.ad_privacy_preferences p on p.user_id = s.user_id
    where s.id = new.subject_id
      and s.personalization_allowed
      and p.personalized_ads
      and p.audience_membership_allowed
      and (s.expires_at is null or s.expires_at > now())
  ) then
    raise exception 'subject has not consented to audience membership';
  end if;
  return new;
end;
$$;

drop trigger if exists ad_audience_memberships_require_consent
  on public.ad_audience_memberships;
create trigger ad_audience_memberships_require_consent
before insert or update on public.ad_audience_memberships
for each row execute function public.ad_validate_membership_consent();
revoke all on function public.ad_validate_membership_consent() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Budget ledger, delivery events and aggregate reporting
-- ---------------------------------------------------------------------------

create table if not exists public.ad_budget_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ad_accounts(id) on delete restrict,
  campaign_id uuid not null references public.sponsored_campaigns(id) on delete restrict,
  entry_type text not null
    check (entry_type in ('reservation', 'release', 'charge', 'refund', 'adjustment')),
  amount numeric(14,6) not null check (amount > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  reservation_id uuid references public.ad_budget_ledger(id) on delete restrict,
  event_id uuid,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists ad_budget_ledger_campaign_time_idx
  on public.ad_budget_ledger(campaign_id, occurred_at desc);
create index if not exists ad_budget_ledger_account_time_idx
  on public.ad_budget_ledger(account_id, occurred_at desc);
create unique index if not exists ad_budget_ledger_reservation_resolution_idx
  on public.ad_budget_ledger(reservation_id, entry_type)
  where reservation_id is not null and entry_type in ('release', 'charge');

create or replace function public.ad_protect_budget_ledger()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  raise exception 'ad budget ledger is append-only';
end;
$$;

drop trigger if exists ad_budget_ledger_append_only on public.ad_budget_ledger;
create trigger ad_budget_ledger_append_only
before update or delete on public.ad_budget_ledger
for each row execute function public.ad_protect_budget_ledger();
revoke all on function public.ad_protect_budget_ledger() from public, anon, authenticated;

create table if not exists public.ad_placement_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  account_id uuid not null references public.ad_accounts(id) on delete cascade,
  campaign_id uuid not null references public.sponsored_campaigns(id) on delete cascade,
  ad_set_id uuid references public.ad_sets(id) on delete set null,
  creative_id uuid references public.ad_creatives(id) on delete set null,
  placement_id uuid not null references public.ad_placements(id) on delete restrict,
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  conversions bigint not null default 0 check (conversions >= 0),
  spend numeric(14,6) not null default 0 check (spend >= 0),
  conversion_value numeric(14,2) not null default 0 check (conversion_value >= 0),
  measurable_impressions bigint not null default 0 check (measurable_impressions >= 0),
  viewable_impressions bigint not null default 0 check (viewable_impressions >= 0),
  invalid_events bigint not null default 0 check (invalid_events >= 0),
  updated_at timestamptz not null default now()
);

create unique index if not exists ad_placement_metrics_dimensions_idx
  on public.ad_placement_daily_metrics(
    metric_date, campaign_id, ad_set_id, creative_id, placement_id
  ) nulls not distinct;
create index if not exists ad_placement_metrics_account_date_idx
  on public.ad_placement_daily_metrics(account_id, metric_date desc);
create index if not exists ad_placement_metrics_placement_date_idx
  on public.ad_placement_daily_metrics(placement_id, metric_date desc);

alter table public.sponsored_campaign_events
  alter column post_id drop not null,
  add column if not exists account_id uuid references public.ad_accounts(id) on delete restrict,
  add column if not exists ad_set_id uuid references public.ad_sets(id) on delete set null,
  add column if not exists creative_id uuid references public.ad_creatives(id) on delete set null,
  add column if not exists placement_id uuid references public.ad_placements(id) on delete set null,
  add column if not exists listing_id uuid references public.listings(id) on delete set null,
  add column if not exists shop_id uuid references public.shops(id) on delete set null,
  add column if not exists subject_id uuid references public.ad_subjects(id) on delete set null,
  add column if not exists billable boolean not null default true,
  add column if not exists billed_amount numeric(14,6) not null default 0,
  add column if not exists billing_status text not null default 'pending',
  add column if not exists viewable boolean,
  add column if not exists invalid_reason text,
  add column if not exists processed_at timestamptz;

alter table public.sponsored_campaign_events
  drop constraint if exists sponsored_campaign_events_event_type_check;
alter table public.sponsored_campaign_events
  add constraint sponsored_campaign_events_event_type_check
  check (event_type in ('impression', 'viewable_impression', 'click', 'conversion', 'hide', 'report'));
alter table public.sponsored_campaign_events
  drop constraint if exists sponsored_campaign_events_billing_status_check;
alter table public.sponsored_campaign_events
  add constraint sponsored_campaign_events_billing_status_check
  check (billing_status in ('pending', 'billed', 'not_billable', 'rejected'));
alter table public.sponsored_campaign_events
  drop constraint if exists sponsored_campaign_events_billed_amount_check;
alter table public.sponsored_campaign_events
  add constraint sponsored_campaign_events_billed_amount_check check (billed_amount >= 0);

update public.sponsored_campaign_events e
set account_id = c.account_id,
    listing_id = c.listing_id,
    shop_id = c.shop_id
from public.sponsored_campaigns c
where c.id = e.campaign_id
  and e.account_id is null;

update public.sponsored_campaign_events e
set placement_id = p.id
from public.ad_placements p
where p.placement_key = e.placement
  and e.placement_id is null;

create index if not exists sponsored_events_account_time_idx
  on public.sponsored_campaign_events(account_id, occurred_at desc);
create index if not exists sponsored_events_delivery_dimensions_idx
  on public.sponsored_campaign_events(campaign_id, ad_set_id, creative_id, placement_id, occurred_at desc);
create index if not exists sponsored_events_subject_cap_idx
  on public.sponsored_campaign_events(subject_id, campaign_id, occurred_at desc)
  where event_type = 'impression' and subject_id is not null;

create table if not exists public.ad_attribution_touches (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.ad_subjects(id) on delete cascade,
  campaign_id uuid not null references public.sponsored_campaigns(id) on delete cascade,
  ad_set_id uuid references public.ad_sets(id) on delete set null,
  creative_id uuid references public.ad_creatives(id) on delete set null,
  placement_id uuid references public.ad_placements(id) on delete set null,
  event_id uuid not null unique references public.sponsored_campaign_events(id)
    on delete cascade deferrable initially deferred,
  touch_type text not null check (touch_type in ('impression', 'click')),
  occurred_at timestamptz not null,
  expires_at timestamptz not null,
  check (expires_at > occurred_at)
);

create index if not exists ad_attribution_touches_subject_time_idx
  on public.ad_attribution_touches(subject_id, occurred_at desc);

create table if not exists public.ad_conversions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ad_accounts(id) on delete restrict,
  campaign_id uuid references public.sponsored_campaigns(id) on delete set null,
  subject_id uuid references public.ad_subjects(id) on delete set null,
  touch_id uuid references public.ad_attribution_touches(id) on delete set null,
  conversion_type text not null,
  external_event_key text not null unique,
  value numeric(14,2) not null default 0 check (value >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  attribution_model text not null default 'last_touch'
    check (attribution_model in ('last_touch', 'last_click', 'view_through', 'unattributed')),
  occurred_at timestamptz not null,
  attributed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index if not exists ad_conversions_campaign_time_idx
  on public.ad_conversions(campaign_id, occurred_at desc);
create index if not exists ad_conversions_account_time_idx
  on public.ad_conversions(account_id, occurred_at desc);

create table if not exists public.ad_fraud_signals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.sponsored_campaign_events(id) on delete cascade,
  campaign_id uuid references public.sponsored_campaigns(id) on delete cascade,
  subject_id uuid references public.ad_subjects(id) on delete set null,
  signal_type text not null,
  severity smallint not null check (severity between 1 and 5),
  decision text not null default 'review'
    check (decision in ('allow', 'review', 'reject', 'refund')),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists ad_fraud_signals_event_idx
  on public.ad_fraud_signals(event_id);
create index if not exists ad_fraud_signals_review_idx
  on public.ad_fraud_signals(decision, detected_at desc)
  where decision in ('review', 'reject');

-- ---------------------------------------------------------------------------
-- Experiments and feature flags
-- ---------------------------------------------------------------------------

create table if not exists public.ad_experiments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ad_accounts(id) on delete cascade,
  campaign_id uuid references public.sponsored_campaigns(id) on delete cascade,
  name text not null,
  hypothesis text,
  status text not null default 'draft'
    check (status in ('draft', 'running', 'paused', 'completed', 'cancelled')),
  allocation_percent smallint not null default 100 check (allocation_percent between 1 and 100),
  primary_metric text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists ad_experiments_account_status_idx
  on public.ad_experiments(account_id, status);

create table if not exists public.ad_experiment_variants (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.ad_experiments(id) on delete cascade,
  variant_key text not null,
  name text not null,
  allocation_weight smallint not null check (allocation_weight between 1 and 10000),
  ad_set_id uuid references public.ad_sets(id) on delete set null,
  creative_id uuid references public.ad_creatives(id) on delete set null,
  is_control boolean not null default false,
  created_at timestamptz not null default now(),
  unique (experiment_id, variant_key)
);

create table if not exists public.ad_feature_flags (
  flag_key text primary key check (flag_key ~ '^[a-z0-9_]{2,100}$'),
  description text,
  enabled boolean not null default false,
  rollout_percent smallint not null default 0 check (rollout_percent between 0 and 100),
  account_id uuid references public.ad_accounts(id) on delete cascade,
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Atomic service RPCs
-- ---------------------------------------------------------------------------

create or replace function public.reserve_ad_budget(
  p_campaign_id uuid,
  p_amount numeric,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.ad_budget_ledger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.sponsored_campaigns%rowtype;
  v_reserved numeric(14,6);
  v_entry public.ad_budget_ledger%rowtype;
begin
  if p_amount is null or p_amount <= 0 or nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'positive amount and idempotency key are required';
  end if;
  select * into v_entry from public.ad_budget_ledger
  where idempotency_key = p_idempotency_key;
  if found then
    return v_entry;
  end if;

  select * into v_campaign from public.sponsored_campaigns
  where id = p_campaign_id for update;
  if not found or v_campaign.account_id is null then
    raise exception 'campaign or ad account not found';
  end if;
  if v_campaign.status <> 'active'
     or v_campaign.starts_at > now()
     or v_campaign.ends_at <= now() then
    raise exception 'campaign is not deliverable';
  end if;

  select coalesce(sum(
    case when entry_type = 'reservation' then amount
         when entry_type in ('release', 'charge') and reservation_id is not null then -amount
         else 0 end
  ), 0)
  into v_reserved
  from public.ad_budget_ledger
  where campaign_id = p_campaign_id;

  if v_campaign.spent_amount + v_reserved + p_amount > v_campaign.total_budget + 0.000001 then
    raise exception 'insufficient campaign budget';
  end if;

  insert into public.ad_budget_ledger (
    account_id, campaign_id, entry_type, amount, idempotency_key, metadata
  ) values (
    v_campaign.account_id, p_campaign_id, 'reservation', p_amount,
    p_idempotency_key, coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_entry;
  return v_entry;
exception when unique_violation then
  select * into v_entry from public.ad_budget_ledger where idempotency_key = p_idempotency_key;
  return v_entry;
end;
$$;

create or replace function public.ad_bill_campaign_event(
  p_campaign_id uuid,
  p_event_type text,
  p_event_id uuid,
  p_idempotency_key text,
  p_reservation_id uuid default null,
  p_occurred_at timestamptz default now()
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.sponsored_campaigns%rowtype;
  v_daily_spend numeric(14,6) := 0;
  v_cost numeric(14,6) := 0;
  v_existing numeric(14,6);
  v_reservation_amount numeric(14,6);
begin
  select amount into v_existing from public.ad_budget_ledger
  where idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  select * into v_campaign from public.sponsored_campaigns
  where id = p_campaign_id for update;
  if not found or v_campaign.account_id is null then
    return 0;
  end if;
  if v_campaign.status <> 'active'
     and not (p_event_type = 'conversion' and v_campaign.status = 'completed') then
    return 0;
  end if;
  if p_event_type <> v_campaign.billing_event then
    return 0;
  end if;

  v_cost := case v_campaign.buying_model
    when 'cpm' then coalesce(v_campaign.bid_amount / 1000, v_campaign.cost_per_impression)
    when 'ocpm' then coalesce(v_campaign.bid_amount / 1000, v_campaign.cost_per_impression)
    when 'cpc' then coalesce(v_campaign.bid_amount, 0)
    when 'cpa' then coalesce(v_campaign.bid_amount, 0)
    else 0
  end;

  select coalesce((
    select spend
    from public.sponsored_campaign_daily_metrics
    where campaign_id = p_campaign_id and metric_date = p_occurred_at::date
  ), 0) into v_daily_spend;

  v_cost := least(
    v_cost,
    greatest(v_campaign.total_budget - v_campaign.spent_amount, 0),
    greatest(v_campaign.daily_budget - v_daily_spend, 0)
  );
  if v_cost <= 0 then
    return 0;
  end if;

  if p_reservation_id is not null then
    select amount into v_reservation_amount
    from public.ad_budget_ledger
    where id = p_reservation_id
      and campaign_id = p_campaign_id
      and entry_type = 'reservation'
    for update;
    if not found or exists (
      select 1 from public.ad_budget_ledger
      where reservation_id = p_reservation_id
        and entry_type in ('charge', 'release')
    ) then
      raise exception 'budget reservation is invalid or already resolved';
    end if;
    v_cost := least(v_cost, v_reservation_amount);
  end if;

  insert into public.ad_budget_ledger (
    account_id, campaign_id, entry_type, amount, reservation_id,
    event_id, idempotency_key
  ) values (
    v_campaign.account_id, p_campaign_id, 'charge', v_cost, p_reservation_id,
    p_event_id, p_idempotency_key
  );
  if p_reservation_id is not null and v_reservation_amount > v_cost then
    insert into public.ad_budget_ledger (
      account_id, campaign_id, entry_type, amount, reservation_id,
      event_id, idempotency_key, metadata
    ) values (
      v_campaign.account_id, p_campaign_id, 'release',
      v_reservation_amount - v_cost, p_reservation_id, p_event_id,
      p_idempotency_key || ':remainder',
      jsonb_build_object('reason', 'unused_reservation')
    );
  end if;

  update public.sponsored_campaigns
  set spent_amount = least(total_budget, spent_amount + v_cost),
      status = case when spent_amount + v_cost >= total_budget then 'completed' else status end,
      delivery_status = case when spent_amount + v_cost >= total_budget then 'exhausted' else 'delivering' end,
      completed_at = case when spent_amount + v_cost >= total_budget then coalesce(completed_at, now()) else completed_at end,
      last_delivered_at = now(),
      updated_at = now()
  where id = p_campaign_id;
  return v_cost;
exception when unique_violation then
  select amount into v_existing from public.ad_budget_ledger
  where idempotency_key = p_idempotency_key;
  return coalesce(v_existing, 0);
end;
$$;

create or replace function public.sponsored_campaign_apply_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.sponsored_campaigns%rowtype;
  v_cost numeric(14,6) := 0;
  v_unique bigint := 0;
  v_placement_id uuid;
begin
  select * into v_campaign from public.sponsored_campaigns where id = new.campaign_id;
  if not found then
    return new;
  end if;

  if new.subject_id is not null and not exists (
    select 1 from public.ad_subjects s
    join public.ad_privacy_preferences p on p.user_id = s.user_id
    where s.id = new.subject_id
      and s.measurement_allowed
      and p.measurement_allowed
      and (s.expires_at is null or s.expires_at > now())
  ) then
    new.subject_id := null;
  end if;

  new.account_id := coalesce(new.account_id, v_campaign.account_id);
  new.listing_id := coalesce(new.listing_id, v_campaign.listing_id);
  new.shop_id := coalesce(new.shop_id, v_campaign.shop_id);
  if new.placement_id is null then
    select id into v_placement_id from public.ad_placements where placement_key = new.placement;
    new.placement_id := v_placement_id;
  end if;

  if new.invalid_reason is not null or not new.billable then
    new.billing_status := 'not_billable';
  else
    v_cost := public.ad_bill_campaign_event(
      new.campaign_id, new.event_type, new.id, 'event:' || new.event_key,
      null, new.occurred_at
    );
    new.billed_amount := v_cost;
    new.billing_status := case when v_cost > 0 then 'billed' else 'not_billable' end;
  end if;
  new.processed_at := now();

  if new.event_type = 'impression' and v_campaign.status = 'active' then
    if coalesce(new.subject_id, new.viewer_id) is not null and not exists (
      select 1 from public.sponsored_campaign_events e
      where e.campaign_id = new.campaign_id
        and (
          (new.subject_id is not null and e.subject_id = new.subject_id)
          or (new.subject_id is null and e.viewer_id = new.viewer_id)
        )
        and e.event_type = 'impression'
    ) then
      v_unique := 1;
    end if;
    update public.sponsored_campaigns
    set impression_count = impression_count + 1, updated_at = now()
    where id = new.campaign_id;
  elsif new.event_type = 'click' and v_campaign.status in ('active', 'completed') then
    update public.sponsored_campaigns
    set click_count = click_count + 1, updated_at = now()
    where id = new.campaign_id;
  end if;

  if (new.event_type = 'impression' and v_campaign.status = 'active')
     or (new.event_type = 'click' and v_campaign.status in ('active', 'completed')) then
    insert into public.sponsored_campaign_daily_metrics (
      campaign_id, metric_date, impressions, clicks, spend, unique_viewers
    ) values (
      new.campaign_id,
      new.occurred_at::date,
      case when new.event_type = 'impression' then 1 else 0 end,
      case when new.event_type = 'click' then 1 else 0 end,
      v_cost,
      v_unique
    )
    on conflict (campaign_id, metric_date) do update set
      impressions = public.sponsored_campaign_daily_metrics.impressions + excluded.impressions,
      clicks = public.sponsored_campaign_daily_metrics.clicks + excluded.clicks,
      spend = public.sponsored_campaign_daily_metrics.spend + excluded.spend,
      unique_viewers = public.sponsored_campaign_daily_metrics.unique_viewers + excluded.unique_viewers,
      updated_at = now();
  end if;

  if new.account_id is not null and new.placement_id is not null then
    insert into public.ad_placement_daily_metrics (
      metric_date, account_id, campaign_id, ad_set_id, creative_id, placement_id,
      impressions, clicks, spend, measurable_impressions, viewable_impressions, invalid_events
    ) values (
      new.occurred_at::date, new.account_id, new.campaign_id, new.ad_set_id,
      new.creative_id, new.placement_id,
      case when new.event_type = 'impression' then 1 else 0 end,
      case when new.event_type = 'click' then 1 else 0 end,
      v_cost,
      case when new.event_type = 'impression' and new.viewable is not null then 1 else 0 end,
      case when new.event_type in ('impression', 'viewable_impression') and new.viewable then 1 else 0 end,
      case when new.invalid_reason is not null then 1 else 0 end
    )
    on conflict (metric_date, campaign_id, ad_set_id, creative_id, placement_id)
    do update set
      impressions = public.ad_placement_daily_metrics.impressions + excluded.impressions,
      clicks = public.ad_placement_daily_metrics.clicks + excluded.clicks,
      spend = public.ad_placement_daily_metrics.spend + excluded.spend,
      measurable_impressions = public.ad_placement_daily_metrics.measurable_impressions + excluded.measurable_impressions,
      viewable_impressions = public.ad_placement_daily_metrics.viewable_impressions + excluded.viewable_impressions,
      invalid_events = public.ad_placement_daily_metrics.invalid_events + excluded.invalid_events,
      updated_at = now();
  end if;

  if new.subject_id is not null
     and new.event_type in ('impression', 'click')
     and new.invalid_reason is null then
    insert into public.ad_attribution_touches (
      subject_id, campaign_id, ad_set_id, creative_id, placement_id,
      event_id, touch_type, occurred_at, expires_at
    ) values (
      new.subject_id, new.campaign_id, new.ad_set_id, new.creative_id, new.placement_id,
      new.id, new.event_type, new.occurred_at,
      new.occurred_at + case when new.event_type = 'click' then interval '30 days' else interval '7 days' end
    ) on conflict (event_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists sponsored_campaign_event_metrics on public.sponsored_campaign_events;
create trigger sponsored_campaign_event_metrics
before insert on public.sponsored_campaign_events
for each row execute function public.sponsored_campaign_apply_event();

create or replace function public.record_ad_event_and_bill(
  p_campaign_id uuid,
  p_event_type text,
  p_event_key text,
  p_placement_key text,
  p_subject_id uuid default null,
  p_ad_set_id uuid default null,
  p_creative_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns public.sponsored_campaign_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.sponsored_campaigns%rowtype;
  v_event public.sponsored_campaign_events%rowtype;
  v_placement public.ad_placements%rowtype;
begin
  if p_event_type not in ('impression', 'viewable_impression', 'click', 'hide', 'report') then
    raise exception 'unsupported delivery event';
  end if;
  select * into v_event from public.sponsored_campaign_events where event_key = p_event_key;
  if found then
    return v_event;
  end if;
  select * into v_campaign from public.sponsored_campaigns where id = p_campaign_id;
  if not found then raise exception 'campaign not found'; end if;
  if p_event_type in ('impression', 'viewable_impression', 'click')
     and (
       v_campaign.status <> 'active'
       or v_campaign.starts_at > p_occurred_at
       or v_campaign.ends_at <= p_occurred_at
     ) then
    raise exception 'campaign is not deliverable';
  end if;
  select * into v_placement from public.ad_placements
  where placement_key = p_placement_key and is_active;
  if not found then raise exception 'placement not found'; end if;

  insert into public.sponsored_campaign_events (
    campaign_id, post_id, listing_id, shop_id, account_id, ad_set_id,
    creative_id, placement_id, subject_id, event_type, placement,
    event_key, metadata, occurred_at
  ) values (
    v_campaign.id, v_campaign.post_id, v_campaign.listing_id, v_campaign.shop_id,
    v_campaign.account_id, p_ad_set_id, p_creative_id, v_placement.id,
    p_subject_id, p_event_type, v_placement.placement_key,
    p_event_key, coalesce(p_metadata, '{}'::jsonb), p_occurred_at
  )
  returning * into v_event;
  return v_event;
exception when unique_violation then
  select * into v_event from public.sponsored_campaign_events where event_key = p_event_key;
  return v_event;
end;
$$;

create or replace function public.record_ad_conversion(
  p_account_id uuid,
  p_subject_id uuid,
  p_conversion_type text,
  p_external_event_key text,
  p_value numeric default 0,
  p_currency text default 'INR',
  p_occurred_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns public.ad_conversions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_touch public.ad_attribution_touches%rowtype;
  v_conversion public.ad_conversions%rowtype;
  v_cost numeric(14,6) := 0;
begin
  select * into v_conversion from public.ad_conversions
  where external_event_key = p_external_event_key;
  if found then return v_conversion; end if;
  if p_value < 0 or p_currency <> 'INR' then
    raise exception 'invalid conversion value or currency';
  end if;
  if not exists (
    select 1 from public.ad_subjects s
    join public.ad_privacy_preferences p on p.user_id = s.user_id
    where s.id = p_subject_id
      and s.measurement_allowed
      and p.measurement_allowed
      and (s.expires_at is null or s.expires_at > now())
  ) then
    raise exception 'subject has not consented to advertising measurement';
  end if;

  select t.* into v_touch
  from public.ad_attribution_touches t
  join public.sponsored_campaigns c on c.id = t.campaign_id
  where t.subject_id = p_subject_id
    and c.account_id = p_account_id
    and t.occurred_at <= p_occurred_at
    and t.expires_at >= p_occurred_at
  order by (t.touch_type = 'click') desc, t.occurred_at desc
  limit 1;

  insert into public.ad_conversions (
    account_id, campaign_id, subject_id, touch_id, conversion_type,
    external_event_key, value, currency, attribution_model, occurred_at, metadata
  ) values (
    p_account_id, v_touch.campaign_id, p_subject_id, v_touch.id, p_conversion_type,
    p_external_event_key, p_value, p_currency,
    case when v_touch.id is null then 'unattributed'
         when v_touch.touch_type = 'click' then 'last_click'
         else 'view_through' end,
    p_occurred_at, coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_conversion;

  if v_touch.campaign_id is not null then
    v_cost := public.ad_bill_campaign_event(
      v_touch.campaign_id, 'conversion', v_conversion.id,
      'conversion:' || p_external_event_key, null, p_occurred_at
    );
    insert into public.sponsored_campaign_daily_metrics (
      campaign_id, metric_date, spend
    ) values (
      v_touch.campaign_id, p_occurred_at::date, v_cost
    )
    on conflict (campaign_id, metric_date) do update set
      spend = public.sponsored_campaign_daily_metrics.spend + excluded.spend,
      updated_at = now();

    if v_touch.placement_id is not null then
      insert into public.ad_placement_daily_metrics (
        metric_date, account_id, campaign_id, ad_set_id, creative_id,
        placement_id, conversions, spend, conversion_value
      ) values (
        p_occurred_at::date, p_account_id, v_touch.campaign_id,
        v_touch.ad_set_id, v_touch.creative_id, v_touch.placement_id,
        1, v_cost, p_value
      )
      on conflict (metric_date, campaign_id, ad_set_id, creative_id, placement_id)
      do update set
        conversions = public.ad_placement_daily_metrics.conversions + 1,
        conversion_value = public.ad_placement_daily_metrics.conversion_value + excluded.conversion_value,
        spend = public.ad_placement_daily_metrics.spend + excluded.spend,
        updated_at = now();
    end if;
  end if;
  return v_conversion;
exception when unique_violation then
  select * into v_conversion from public.ad_conversions
  where external_event_key = p_external_event_key;
  return v_conversion;
end;
$$;

revoke all on function public.reserve_ad_budget(uuid, numeric, text, jsonb) from public, anon, authenticated;
revoke all on function public.ad_bill_campaign_event(uuid, text, uuid, text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.record_ad_event_and_bill(uuid, text, text, text, uuid, uuid, uuid, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.record_ad_conversion(uuid, uuid, text, text, numeric, text, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.sponsored_campaign_apply_event() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS and least-privilege grants
-- ---------------------------------------------------------------------------

alter table public.ad_accounts enable row level security;
alter table public.ad_account_members enable row level security;
alter table public.ad_sets enable row level security;
alter table public.ad_creatives enable row level security;
alter table public.ad_set_creatives enable row level security;
alter table public.ad_placements enable row level security;
alter table public.ad_inventory_slots enable row level security;
alter table public.ad_set_placements enable row level security;
alter table public.ad_privacy_preferences enable row level security;
alter table public.ad_consent_history enable row level security;
alter table public.ad_subjects enable row level security;
alter table public.ad_audiences enable row level security;
alter table public.ad_audience_memberships enable row level security;
alter table public.ad_budget_ledger enable row level security;
alter table public.ad_placement_daily_metrics enable row level security;
alter table public.ad_attribution_touches enable row level security;
alter table public.ad_conversions enable row level security;
alter table public.ad_fraud_signals enable row level security;
alter table public.ad_experiments enable row level security;
alter table public.ad_experiment_variants enable row level security;
alter table public.ad_feature_flags enable row level security;

revoke all on table
  public.ad_accounts, public.ad_account_members, public.ad_sets,
  public.ad_creatives, public.ad_set_creatives, public.ad_placements,
  public.ad_inventory_slots, public.ad_set_placements,
  public.ad_privacy_preferences, public.ad_consent_history,
  public.ad_subjects, public.ad_audiences, public.ad_audience_memberships,
  public.ad_budget_ledger, public.ad_placement_daily_metrics,
  public.ad_attribution_touches, public.ad_conversions,
  public.ad_fraud_signals, public.ad_experiments,
  public.ad_experiment_variants, public.ad_feature_flags
from anon, authenticated;

grant select on public.ad_accounts, public.ad_account_members, public.ad_sets,
  public.ad_creatives, public.ad_set_creatives, public.ad_placements,
  public.ad_inventory_slots, public.ad_set_placements, public.ad_audiences,
  public.ad_budget_ledger, public.ad_placement_daily_metrics,
  public.ad_experiments, public.ad_experiment_variants, public.ad_feature_flags
to authenticated;
grant select, insert, update on public.ad_privacy_preferences to authenticated;
grant select on public.ad_consent_history to authenticated;
grant all on table
  public.ad_accounts, public.ad_account_members, public.ad_sets,
  public.ad_creatives, public.ad_set_creatives, public.ad_placements,
  public.ad_inventory_slots, public.ad_set_placements,
  public.ad_privacy_preferences, public.ad_consent_history,
  public.ad_subjects, public.ad_audiences, public.ad_audience_memberships,
  public.ad_budget_ledger, public.ad_placement_daily_metrics,
  public.ad_attribution_touches, public.ad_conversions,
  public.ad_fraud_signals, public.ad_experiments,
  public.ad_experiment_variants, public.ad_feature_flags
to service_role;
grant execute on function public.reserve_ad_budget(uuid, numeric, text, jsonb) to service_role;
grant execute on function public.record_ad_event_and_bill(uuid, text, text, text, uuid, uuid, uuid, jsonb, timestamptz) to service_role;
grant execute on function public.record_ad_conversion(uuid, uuid, text, text, numeric, text, timestamptz, jsonb) to service_role;

drop policy if exists ad_accounts_member_select on public.ad_accounts;
create policy ad_accounts_member_select on public.ad_accounts
for select to authenticated using (public.ad_can_access_account(id, (select auth.uid())));

drop policy if exists ad_account_members_member_select on public.ad_account_members;
create policy ad_account_members_member_select on public.ad_account_members
for select to authenticated using (public.ad_can_access_account(account_id, (select auth.uid())));

drop policy if exists ad_sets_account_select on public.ad_sets;
create policy ad_sets_account_select on public.ad_sets
for select to authenticated using (public.ad_can_access_account(account_id, (select auth.uid())));
drop policy if exists ad_creatives_account_select on public.ad_creatives;
create policy ad_creatives_account_select on public.ad_creatives
for select to authenticated using (public.ad_can_access_account(account_id, (select auth.uid())));
drop policy if exists ad_set_creatives_account_select on public.ad_set_creatives;
create policy ad_set_creatives_account_select on public.ad_set_creatives
for select to authenticated using (public.ad_can_access_account(account_id, (select auth.uid())));

drop policy if exists ad_placements_authenticated_select on public.ad_placements;
create policy ad_placements_authenticated_select on public.ad_placements
for select to authenticated using (is_active or public.ad_is_admin((select auth.uid())));
drop policy if exists ad_inventory_authenticated_select on public.ad_inventory_slots;
create policy ad_inventory_authenticated_select on public.ad_inventory_slots
for select to authenticated using (is_active or public.ad_is_admin((select auth.uid())));
drop policy if exists ad_set_placements_account_select on public.ad_set_placements;
create policy ad_set_placements_account_select on public.ad_set_placements
for select to authenticated using (
  exists (
    select 1 from public.ad_sets s
    where s.id = ad_set_id
      and public.ad_can_access_account(s.account_id, (select auth.uid()))
  )
);

drop policy if exists ad_preferences_owner_select on public.ad_privacy_preferences;
create policy ad_preferences_owner_select on public.ad_privacy_preferences
for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists ad_preferences_owner_insert on public.ad_privacy_preferences;
create policy ad_preferences_owner_insert on public.ad_privacy_preferences
for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists ad_preferences_owner_update on public.ad_privacy_preferences;
create policy ad_preferences_owner_update on public.ad_privacy_preferences
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
drop policy if exists ad_consent_history_owner_select on public.ad_consent_history;
create policy ad_consent_history_owner_select on public.ad_consent_history
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists ad_audiences_account_select on public.ad_audiences;
create policy ad_audiences_account_select on public.ad_audiences
for select to authenticated using (public.ad_can_access_account(account_id, (select auth.uid())));
drop policy if exists ad_budget_ledger_account_select on public.ad_budget_ledger;
create policy ad_budget_ledger_account_select on public.ad_budget_ledger
for select to authenticated using (public.ad_can_access_account(account_id, (select auth.uid())));
drop policy if exists ad_placement_metrics_account_select on public.ad_placement_daily_metrics;
create policy ad_placement_metrics_account_select on public.ad_placement_daily_metrics
for select to authenticated using (public.ad_can_access_account(account_id, (select auth.uid())));
drop policy if exists ad_experiments_account_select on public.ad_experiments;
create policy ad_experiments_account_select on public.ad_experiments
for select to authenticated using (public.ad_can_access_account(account_id, (select auth.uid())));
drop policy if exists ad_experiment_variants_account_select on public.ad_experiment_variants;
create policy ad_experiment_variants_account_select on public.ad_experiment_variants
for select to authenticated using (
  exists (
    select 1 from public.ad_experiments e
    where e.id = experiment_id
      and public.ad_can_access_account(e.account_id, (select auth.uid()))
  )
);
drop policy if exists ad_feature_flags_select on public.ad_feature_flags;
create policy ad_feature_flags_select on public.ad_feature_flags
for select to authenticated using (
  account_id is null
  or public.ad_can_access_account(account_id, (select auth.uid()))
);

-- No advertiser policies or grants are intentionally created for ad_subjects,
-- ad_audience_memberships, sponsored_campaign_events, ad_attribution_touches,
-- ad_conversions or ad_fraud_signals. These contain viewer/member-level data.
revoke all on public.sponsored_campaign_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retention cleanup and budget reconciliation
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_unified_advertising_data()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  v_rows integer := 0;
begin
  delete from public.ad_audience_memberships where expires_at < now();
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;
  delete from public.ad_attribution_touches
  where occurred_at < now() - interval '90 days';
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;
  delete from public.sponsored_campaign_events
  where occurred_at < now() - interval '90 days';
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;
  delete from public.ad_fraud_signals
  where detected_at < now() - interval '180 days'
    and decision in ('allow', 'reject', 'refund');
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;
  delete from public.ad_consent_history
  where occurred_at < now() - interval '730 days';
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;
  return v_count;
end;
$$;

create or replace function public.reconcile_unified_ad_budget()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  insert into public.ad_budget_ledger (
    account_id, campaign_id, entry_type, amount, reservation_id,
    idempotency_key, metadata
  )
  select r.account_id, r.campaign_id, 'release', r.amount, r.id,
    'expired-reservation:' || r.id::text,
    jsonb_build_object('reason', 'reservation_timeout')
  from public.ad_budget_ledger r
  where r.entry_type = 'reservation'
    and r.created_at < now() - interval '15 minutes'
    and not exists (
      select 1 from public.ad_budget_ledger x
      where x.reservation_id = r.id and x.entry_type in ('release', 'charge')
    )
  on conflict (idempotency_key) do nothing;
  get diagnostics v_count = row_count;

  update public.sponsored_campaigns
  set delivery_status = case
        when ends_at <= now() then 'ended'
        when spent_amount >= total_budget then 'exhausted'
        when status = 'active' then 'delivering'
        else 'not_delivering'
      end,
      updated_at = now()
  where delivery_status is distinct from case
        when ends_at <= now() then 'ended'
        when spent_amount >= total_budget then 'exhausted'
        when status = 'active' then 'delivering'
        else 'not_delivering'
      end;
  return v_count;
end;
$$;

revoke all on function public.cleanup_unified_advertising_data() from public, anon, authenticated;
revoke all on function public.reconcile_unified_ad_budget() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job where jobname = 'cleanup-unified-advertising-data';
    perform cron.schedule(
      'cleanup-unified-advertising-data',
      '35 3 * * *',
      $cron$select public.cleanup_unified_advertising_data()$cron$
    );
    perform cron.unschedule(jobid)
    from cron.job where jobname = 'reconcile-unified-ad-budget';
    perform cron.schedule(
      'reconcile-unified-ad-budget',
      '*/10 * * * *',
      $cron$select public.reconcile_unified_ad_budget()$cron$
    );
  end if;
exception when others then
  raise notice 'Unified advertising cron schedule skipped: %', sqlerrm;
end $$;

comment on table public.ad_subjects is
  'Service-only mapping between profiles and rotating privacy-safe advertising subject IDs.';
comment on table public.ad_audience_memberships is
  'Service-only segment membership; advertisers receive only audience size buckets and aggregate metrics.';
comment on table public.sponsored_campaign_events is
  'Viewer-level delivery data. No anon/authenticated grants or advertiser RLS policies.';
comment on function public.record_ad_conversion(uuid, uuid, text, text, numeric, text, timestamptz, jsonb) is
  'Service-only, server-authoritative last eligible touch attribution and CPA billing.';
