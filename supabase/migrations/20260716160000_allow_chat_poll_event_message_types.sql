-- Allow chat poll/event message types (WhatsApp-style structured messages).
do $$
declare
  con_name text;
begin
  select c.conname into con_name
  from pg_constraint c
  where c.conrelid = 'public.messages'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%message_type%'
  limit 1;

  if con_name is not null then
    execute format('alter table public.messages drop constraint %I', con_name);
  end if;
end $$;

alter table public.messages
  add constraint messages_message_type_check
  check (message_type = any (array['text'::text, 'image'::text, 'file'::text, 'call'::text, 'post'::text, 'poll'::text, 'event'::text]));

-- Ensure community poll RPC creates a proper poll post + options.
create or replace function public.create_post_with_poll(
  user_id uuid,
  content text,
  question text,
  options text[],
  duration character varying
)
returns posts
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  new_post posts;
  option_text text;
  option_position int := 0;
  expires_at timestamptz;
  poll_id uuid;
  duration_key text := coalesce(duration, '1day');
begin
  if auth.uid() is null or auth.uid() is distinct from user_id then
    raise exception 'Not authenticated';
  end if;

  if options is null or cardinality(options) < 2 then
    raise exception 'Poll needs at least 2 options';
  end if;

  -- Accept both DB keys and client day aliases.
  duration_key := case duration_key
    when '1d' then '1day'
    when '1' then '1day'
    when '3d' then '3days'
    when '3' then '3days'
    when '7d' then '1week'
    when '7' then '1week'
    when '14d' then '2weeks'
    when '14' then '2weeks'
    when '1week' then '1week'
    when '2weeks' then '2weeks'
    when '3days' then '3days'
    when '1day' then '1day'
    else '1day'
  end;

  expires_at := case duration_key
    when '1day' then (now() + interval '1 day')
    when '3days' then (now() + interval '3 days')
    when '1week' then (now() + interval '1 week')
    when '2weeks' then (now() + interval '2 weeks')
    else (now() + interval '1 day')
  end;

  insert into public.posts (user_id, content, post_type, published_at, allow_comments, allow_reactions, visibility)
  values (user_id, content, 'poll', now(), true, true, 'public')
  returning * into new_post;

  insert into public.polls (post_id, question, duration, expires_at, is_active, total_votes)
  values (new_post.id, question, duration_key, expires_at, true, 0)
  returning id into poll_id;

  foreach option_text in array options loop
    if nullif(trim(option_text), '') is null then
      continue;
    end if;
    insert into public.poll_options (poll_id, option_text, position, vote_count)
    values (poll_id, trim(option_text), option_position, 0);
    option_position := option_position + 1;
  end loop;

  if option_position < 2 then
    raise exception 'Poll needs at least 2 options';
  end if;

  return new_post;
end;
$function$;
