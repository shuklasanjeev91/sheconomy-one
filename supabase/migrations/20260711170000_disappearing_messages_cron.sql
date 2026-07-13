-- Server-side cleanup for disappearing messages.
--
-- This project has an event trigger `log_function_changes` that writes to
-- `public.function_change_log`, but (a) the table was missing and (b) the
-- INSERT used an unqualified name, so it failed whenever `search_path` was
-- restricted (e.g. during CREATE EXTENSION / migrations). Both are fixed here:
-- the audit table is restored and the trigger function is hardened to
-- schema-qualify the table and pin its search_path. This unblocks all function
-- DDL and extension installs on the project.
--
-- Applied via execute_sql (needs `public` in search_path); kept here for history.
create table if not exists public.function_change_log (
  id bigint generated always as identity primary key,
  function_name text,
  change_type text,
  function_signature text,
  function_definition text,
  changed_by text,
  source_info jsonb,
  changed_at timestamptz not null default now()
);

create or replace function public.log_function_changes()
returns event_trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  obj record;
  func_def text;
begin
  for obj in select * from pg_event_trigger_ddl_commands()
  loop
    if obj.object_type = 'function' then
      select pg_get_functiondef(obj.objid) into func_def;
      insert into public.function_change_log (
        function_name, change_type, function_signature, function_definition, changed_by, source_info
      ) values (
        obj.object_identity,
        case
          when obj.command_tag = 'CREATE FUNCTION' then 'CREATE'
          when obj.command_tag = 'ALTER FUNCTION' then 'REPLACE'
          else 'OTHER'
        end,
        obj.object_identity,
        func_def,
        current_user,
        jsonb_build_object('command_tag', obj.command_tag, 'schema', obj.schema_name, 'session_user', session_user)
      );
    end if;
  end loop;
end;
$function$;

create or replace function public.log_function_drops()
returns event_trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  obj record;
begin
  for obj in select * from pg_event_trigger_dropped_objects()
  loop
    if obj.object_type = 'function' then
      insert into public.function_change_log (function_name, change_type, changed_by, source_info)
      values (
        obj.object_identity,
        'DROP',
        current_user,
        jsonb_build_object('schema', obj.schema_name, 'session_user', session_user)
      );
    end if;
  end loop;
end;
$function$;

-- pg_cron powers the recurring cleanup job.
create extension if not exists pg_cron;

-- Hard-delete messages older than their conversation's TTL every 5 minutes.
-- Child rows (reactions, stars, status) cascade; reply_to_id / last_message_id
-- are set null. Re-scheduling with the same name replaces the existing job.
select cron.schedule(
  'delete-expired-disappearing-messages',
  '*/5 * * * *',
  $$delete from public.messages m
    using public.conversations c
    where m.conversation_id = c.id
      and c.disappearing_seconds is not null
      and m.created_at < now() - make_interval(secs => c.disappearing_seconds);$$
);
