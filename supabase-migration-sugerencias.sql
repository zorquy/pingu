-- ============================================================
-- Sugerir correcciones a la guía de otro
-- ============================================================
--
-- POR QUÉ: escribir una guía entera es un salto muy grande. Ver una
-- errata, un dato que ya no es cierto o una explicación que no se
-- entiende, eso lo puede hacer cualquiera desde el primer día.
--
-- Y arregla otra cosa: las guías envejecen. El TCG cambia, salen sets
-- nuevos, y una guía escrita hace un año se queda coja sin que su autor
-- se entere. Quien lo nota es quien la está leyendo.
--
-- Lo que se gana al sugerir: si el autor la acepta, **quien la sugirió
-- aparece acreditado en la guía**. Es la forma de que aporte alguien que
-- no se ve capaz de escribir una guía entera — que son casi todos al
-- principio.
--
-- ACEPTAR NO EDITA NADA. La guía la sigue escribiendo su autor; aceptar
-- quiere decir "tienes razón y ya lo he arreglado". Meterle mano al texto
-- de otro automáticamente sería otra cosa muy distinta y bastante peor.
--
-- CÓMO EJECUTARLO: pégalo entero en el SQL Editor de Supabase. Se puede
-- ejecutar más de una vez sin romper nada.
-- ============================================================

begin;

create table if not exists public.guide_suggestions (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.guides (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  -- El trozo al que se refiere, copiado por quien sugiere. Opcional: a
  -- veces la corrección es sobre la guía entera.
  quote text,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists guide_suggestions_guide_idx on public.guide_suggestions (guide_id, status);
create index if not exists guide_suggestions_author_idx on public.guide_suggestions (author_id);

alter table public.guide_suggestions enable row level security;

-- ------------------------------------------------------------
-- Quién ve qué
-- ------------------------------------------------------------
-- Las ACEPTADAS son públicas: son el crédito de quien ayudó, y sin verlas
-- no habría forma de pintar el "con correcciones de..." de la guía.
--
-- Las PENDIENTES y las RECHAZADAS solo las ven el autor de la guía, quien
-- las escribió y los administradores. Una lista pública de "fallos de
-- esta guía" sería una picota: nadie publicaría nada.
drop policy if exists "guide_suggestions_select" on public.guide_suggestions;
create policy "guide_suggestions_select" on public.guide_suggestions
  for select using (
    status = 'accepted'
    or auth.uid() = author_id
    or auth.uid() = (select g.author_id from public.guides g where g.id = guide_id)
    or public.is_admin()
  );

drop policy if exists "guide_suggestions_insert" on public.guide_suggestions;
create policy "guide_suggestions_insert" on public.guide_suggestions
  for insert with check (
    auth.uid() = author_id
    -- Sugerirte una corrección a ti mismo no tiene sentido: edita la
    -- guía y ya.
    and auth.uid() is distinct from (select g.author_id from public.guides g where g.id = guide_id)
  );

-- Aceptar o descartar lo hace el autor de la guía (o un admin). Quien la
-- sugirió NO puede cambiarle el estado a la suya — si no, cualquiera se
-- acreditaría solo.
drop policy if exists "guide_suggestions_update" on public.guide_suggestions;
create policy "guide_suggestions_update" on public.guide_suggestions
  for update
  using (auth.uid() = (select g.author_id from public.guides g where g.id = guide_id) or public.is_admin())
  with check (auth.uid() = (select g.author_id from public.guides g where g.id = guide_id) or public.is_admin());

-- Retirar la tuya sí puedes, mientras no esté resuelta.
drop policy if exists "guide_suggestions_delete" on public.guide_suggestions;
create policy "guide_suggestions_delete" on public.guide_suggestions
  for delete using (
    (auth.uid() = author_id and status = 'pending') or public.is_admin()
  );

comment on table public.guide_suggestions is
  'Correcciones que propone alguien sobre la guía de otro. Aceptarlas NO edita el texto: acredita a quien avisó. Las aceptadas son públicas (son el crédito); las pendientes y rechazadas, solo para el autor y quien las escribió.';

-- ------------------------------------------------------------
-- XP para quien ayuda
-- ------------------------------------------------------------
-- Solo al ACEPTARLA, y solo la primera vez. Sugerir por sugerir no da
-- nada: si diera XP al enviarla, se llenaría de "buena guía :)".
--
-- Va en un disparador y no en el navegador por lo mismo que el resto del
-- XP que dan otros: quien lo concede es el autor de la guía, así que no
-- puede depender del navegador de quien lo recibe.
create or replace function public.xp_por_sugerencia_aceptada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status = 'accepted' and coalesce(old.status, '') <> 'accepted' and new.author_id is not null then
    update user_profiles set total_xp = coalesce(total_xp, 0) + 10 where id = new.author_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_xp_por_sugerencia_aceptada on public.guide_suggestions;
create trigger trg_xp_por_sugerencia_aceptada
  after update of status on public.guide_suggestions
  for each row execute function public.xp_por_sugerencia_aceptada();

commit;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Comprobación rápida (opcional)
-- ------------------------------------------------------------
-- select status, count(*) from public.guide_suggestions group by status;
-- select policyname, cmd from pg_policies where tablename = 'guide_suggestions';
