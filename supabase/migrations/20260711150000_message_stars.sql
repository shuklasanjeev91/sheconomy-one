-- Per-user starred (bookmarked) messages.
create table if not exists public.message_stars (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

alter table public.message_stars enable row level security;

create policy "message_stars_select_own"
  on public.message_stars for select
  to authenticated
  using (auth.uid() = user_id);

create policy "message_stars_insert_own"
  on public.message_stars for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "message_stars_delete_own"
  on public.message_stars for delete
  to authenticated
  using (auth.uid() = user_id);
