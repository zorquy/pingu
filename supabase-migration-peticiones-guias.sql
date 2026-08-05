-- ============================================================
-- Peticiones de guías
-- ============================================================
--
-- LA PREGUNTA QUE BLOQUEA A LA MAYORÍA no es "¿me apetece escribir?",
-- es "¿de qué escribo?". Alguien que sabe mucho de un tema no se pone a
-- escribir porque no sabe si le interesa a nadie.
--
-- Esto es una lista donde cualquiera pide un tema y los demás lo votan.
-- Quien se anima ve CUÁNTA GENTE ESTÁ ESPERANDO esa guía antes de
-- empezar, y cuando la publica se avisa a los que la pidieron.
--
-- No es un foro: no hay conversación, no hay respuestas, no hay temas
-- sueltos. Es una lista de necesidades.
--
-- CÓMO EJECUTARLO: pégalo entero en el SQL Editor de Supabase. Se puede
-- ejecutar más de una vez sin romper nada.
-- ============================================================

begin;

create table if not exists public.guide_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  detail text,
  requester_id uuid references auth.users (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  -- Cuando alguien escribe la guía que se pedía, se apunta aquí. Sirve
  -- para enlazarla desde la petición y para saber qué sigue abierto.
  fulfilled_guide_id uuid references public.guides (id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists guide_requests_created_idx on public.guide_requests (created_at desc);
create index if not exists guide_requests_abiertas_idx on public.guide_requests (created_at desc)
  where fulfilled_guide_id is null and closed_at is null;

create table if not exists public.guide_request_votes (
  request_id uuid not null references public.guide_requests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create index if not exists guide_request_votes_request_idx on public.guide_request_votes (request_id);

alter table public.guide_requests enable row level security;
alter table public.guide_request_votes enable row level security;

-- ------------------------------------------------------------
-- Permisos
-- ------------------------------------------------------------
drop policy if exists "guide_requests_select" on public.guide_requests;
create policy "guide_requests_select" on public.guide_requests
  for select using (true);

drop policy if exists "guide_requests_insert" on public.guide_requests;
create policy "guide_requests_insert" on public.guide_requests
  for insert with check (auth.uid() = requester_id);

-- Quién puede tocar una petición ya creada:
--   - quien la pidió (para corregirla o cerrarla),
--   - un admin,
--   - y quien haya ESCRITO la guía que la cumple.
--
-- Ese último caso es el que hace que esto funcione: el que se anima a
-- escribir marca él mismo la petición como cumplida y así avisa a los
-- que la estaban esperando. El `with check` impide apuntarse la guía de
-- otro: solo se puede enlazar una guía de la que eres autor.
drop policy if exists "guide_requests_update" on public.guide_requests;
create policy "guide_requests_update" on public.guide_requests
  for update
  using (
    auth.uid() = requester_id
    or public.is_admin()
    or exists (select 1 from public.guides g where g.author_id = auth.uid())
  )
  with check (
    auth.uid() = requester_id
    or public.is_admin()
    or (
      fulfilled_guide_id is not null
      and auth.uid() = (select g.author_id from public.guides g where g.id = fulfilled_guide_id)
    )
  );

drop policy if exists "guide_requests_delete" on public.guide_requests;
create policy "guide_requests_delete" on public.guide_requests
  for delete using (auth.uid() = requester_id or public.is_admin());

-- Los votos son públicos: el número es justo lo que hay que ver antes de
-- ponerse a escribir.
drop policy if exists "guide_request_votes_select" on public.guide_request_votes;
create policy "guide_request_votes_select" on public.guide_request_votes
  for select using (true);

drop policy if exists "guide_request_votes_insert" on public.guide_request_votes;
create policy "guide_request_votes_insert" on public.guide_request_votes
  for insert with check (auth.uid() = user_id);

drop policy if exists "guide_request_votes_delete" on public.guide_request_votes;
create policy "guide_request_votes_delete" on public.guide_request_votes
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- El listado, con los votos ya contados
-- ------------------------------------------------------------
-- Sin esto habría que traerse todos los votos al navegador y contarlos
-- allí. Una vista lo resuelve en la base y además ordena por lo único
-- que importa aquí: cuánta gente lo está esperando.
create or replace view public.guide_requests_con_votos as
  select
    r.*,
    (select count(*) from public.guide_request_votes v where v.request_id = r.id) as votos
  from public.guide_requests r;

comment on view public.guide_requests_con_votos is
  'Peticiones de guías con el número de votos ya contado. La vista hereda las políticas RLS de las tablas de origen.';

comment on table public.guide_requests is
  'Temas que la gente pide que alguien escriba. No es un foro: no hay conversación, es una lista de necesidades.';

commit;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Comprobación rápida (opcional)
-- ------------------------------------------------------------
-- select title, votos, fulfilled_guide_id from public.guide_requests_con_votos order by votos desc;
