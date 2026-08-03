-- Mensajería privada (conversaciones 1 a 1). Cualquier usuario logueado
-- puede escribirle a cualquier otro, sin restricción de seguimiento mutuo.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.private_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists private_messages_conversation_idx on public.private_messages (conversation_id, created_at desc);
create index if not exists conversation_participants_user_idx on public.conversation_participants (user_id);

-- Función auxiliar SECURITY DEFINER (como is_admin()): comprobar "¿formo
-- parte de esta conversación?" sin que la propia política de RLS de
-- conversation_participants tenga que consultarse recursivamente a sí misma.
create or replace function public.is_conversation_participant(conv_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id and user_id = auth.uid()
  );
$$;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.private_messages enable row level security;

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select using (public.is_conversation_participant(id));

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert to authenticated with check (true);

drop policy if exists conversation_participants_select on public.conversation_participants;
create policy conversation_participants_select on public.conversation_participants
  for select using (public.is_conversation_participant(conversation_id));

-- Solo puedes añadir tu propia fila de participante, o añadir a alguien más
-- a una conversación de la que tú ya formas parte (así, para crear una
-- conversación nueva: primero te insertas a ti mismo, y esa segunda
-- condición ya te deja insertar también a la otra persona).
drop policy if exists conversation_participants_insert on public.conversation_participants;
create policy conversation_participants_insert on public.conversation_participants
  for insert to authenticated with check (
    user_id = auth.uid() or public.is_conversation_participant(conversation_id)
  );

drop policy if exists conversation_participants_update on public.conversation_participants;
create policy conversation_participants_update on public.conversation_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists private_messages_select on public.private_messages;
create policy private_messages_select on public.private_messages
  for select using (public.is_conversation_participant(conversation_id));

drop policy if exists private_messages_insert on public.private_messages;
create policy private_messages_insert on public.private_messages
  for insert to authenticated with check (
    sender_id = auth.uid() and public.is_conversation_participant(conversation_id)
  );

drop policy if exists private_messages_delete on public.private_messages;
create policy private_messages_delete on public.private_messages
  for delete using (sender_id = auth.uid());
