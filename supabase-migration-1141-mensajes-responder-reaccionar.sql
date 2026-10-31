-- ════════════════════════════════════════════════════════════════════
-- Tanda 1141 — mensajes privados: responder a un mensaje, reacciones,
-- fijar y archivar (de la propuesta «Comunidad, guías y menú», PINGU:
-- «responder a un mensaje concreto, sí. Reacciones, sí. Escribiendo, sí»).
--
-- 1. `private_messages.reply_to_id`: el mensaje al que se responde. Solo de
--    la MISMA conversación (lo comprueba un disparador: con un id de otra,
--    se le enseñaría a uno un trozo de una conversación ajena).
-- 2. `private_message_reactions`: una reacción por persona y mensaje, con
--    las cuatro del foro (like, love, laugh, wow). Lleva `conversation_id`
--    para que el tiempo real filtre por conversación; la política exige que
--    sea la del mensaje. Nadie reacciona a lo suyo (como en el foro).
-- 3. `conversation_participants.fijada_at` / `archivada_at`: lo de CADA uno
--    (la fila es suya, la política de update ya lo deja). Archivada vuelve
--    sola a la lista cuando llega un mensaje posterior: eso lo decide la web.
--
-- Se puede ejecutar dos veces. Cada sentencia va por su lado (tanda 631).
-- ════════════════════════════════════════════════════════════════════

alter table public.private_messages
  add column if not exists reply_to_id uuid references public.private_messages(id) on delete set null;

create or replace function public.mensaje_respuesta_misma_conversacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from public.private_messages p
    where p.id = new.reply_to_id and p.conversation_id = new.conversation_id
  ) then
    raise exception 'Solo se puede responder a un mensaje de la misma conversación' using errcode = '23514';
  end if;
  return new;
end
$$;

drop trigger if exists trg_mensaje_respuesta on public.private_messages;
create trigger trg_mensaje_respuesta
  before insert or update of reply_to_id on public.private_messages
  for each row execute function public.mensaje_respuesta_misma_conversacion();

create table if not exists public.private_message_reactions (
  message_id uuid not null references public.private_messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('like', 'love', 'laugh', 'wow')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists private_message_reactions_conv_idx on public.private_message_reactions (conversation_id);

-- ¿Puedo reaccionar a este mensaje? Es de esta conversación, estoy en ella y
-- no es mío. `security definer` para leer el mensaje sin pasar otra vez por
-- su política (y que no dependa del orden en que se evalúan).
create or replace function public.mensaje_reaccionable(p_mensaje uuid, p_conversacion uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.private_messages m
    where m.id = p_mensaje
      and m.conversation_id = p_conversacion
      and m.sender_id <> auth.uid()
      and m.deleted_at is null
  ) and public.is_conversation_participant(p_conversacion);
$$;

alter table public.private_message_reactions enable row level security;

drop policy if exists private_message_reactions_select on public.private_message_reactions;
create policy private_message_reactions_select on public.private_message_reactions
  for select to authenticated using (public.is_conversation_participant(conversation_id));

drop policy if exists private_message_reactions_insert on public.private_message_reactions;
create policy private_message_reactions_insert on public.private_message_reactions
  for insert to authenticated with check (user_id = auth.uid() and public.mensaje_reaccionable(message_id, conversation_id));

drop policy if exists private_message_reactions_update on public.private_message_reactions;
create policy private_message_reactions_update on public.private_message_reactions
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.mensaje_reaccionable(message_id, conversation_id));

drop policy if exists private_message_reactions_delete on public.private_message_reactions;
create policy private_message_reactions_delete on public.private_message_reactions
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.private_message_reactions to authenticated;
grant execute on function public.mensaje_reaccionable(uuid, uuid) to authenticated;

-- Al tiempo real, para que la reacción llegue sin recargar (si no, la recoge
-- el sondeo de respaldo de la conversación).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'private_message_reactions'
  ) then
    alter publication supabase_realtime add table public.private_message_reactions;
  end if;
end $$;

alter table public.conversation_participants add column if not exists fijada_at timestamptz;
alter table public.conversation_participants add column if not exists archivada_at timestamptz;

notify pgrst, 'reload schema';

-- Comprobación: las tres columnas nuevas y las cuatro políticas.
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'private_messages' and column_name = 'reply_to_id') as respuesta,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'conversation_participants' and column_name in ('fijada_at', 'archivada_at')) as fijar_archivar,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'private_message_reactions') as politicas_reacciones;
