-- Allow chat listing/product card message type.
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
  check (message_type = any (array[
    'text'::text,
    'image'::text,
    'file'::text,
    'call'::text,
    'post'::text,
    'poll'::text,
    'event'::text,
    'listing'::text
  ]));
