-- Permite reportar mensajes privados (content_type = 'private_message'),
-- y deja que un admin lea el contenido de un mensaje ya reportado -- solo
-- ese mensaje puntual, no el resto de la conversación.

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'content_reports'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%content_type%';
  if cname is not null then
    execute format('alter table content_reports drop constraint %I', cname);
  end if;
end $$;

alter table content_reports add constraint content_reports_content_type_check
  check (content_type in ('guide', 'profile_comment', 'guide_comment', 'profile_review', 'private_message'));

create policy private_messages_admin_select_reported on private_messages
  for select using (
    is_admin() and exists (
      select 1 from content_reports
      where content_reports.content_type = 'private_message'
        and content_reports.content_id = private_messages.id
    )
  );
