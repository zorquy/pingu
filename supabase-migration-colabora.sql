-- ════════════════════════════════════════════════════════════════════
-- Tanda 361 — «Colabora»: quién quiere echar una mano
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU quiere delegar: gente que escriba noticias, que organice
-- torneos, que eche una mano con el foro. No hay dinero, así que esto va
-- de voluntarios — y con voluntarios lo que decide no es el anuncio,
-- es a QUIÉN le dices que sí.
--
-- ── Por qué pide sesión ──
--
-- Un formulario de fuera (un Google Form) te da un nombre. Este te da
-- un nombre CON SU HISTORIAL: cuántos mensajes ha escrito en el foro,
-- cuántos torneos ha jugado, cuánto lleva registrado. Eso es lo que hace
-- falta para contestar, y por eso `user_id` es obligatorio y no hay
-- forma anónima. De paso filtra: quien no se registra para escribirte,
-- tampoco iba a durar.
--
-- ── Lo que NO se guarda ──
--
-- Ni correo ni teléfono. El correo ya está en la cuenta y se responde
-- por el privado de la web o por ahí; pedirlo otra vez sería una copia
-- de un dato personal que luego hay que acordarse de borrar.
--
-- Ejecutar en el SQL Editor de Supabase. Re-ejecutable.

create table if not exists public.collab_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Qué le gustaría llevar. Es una lista porque casi todo el mundo marca
  -- dos: «escribir noticias» y «lo que haga falta».
  roles text[] not null default '{}',
  -- Cuánto tiempo al mes, DE VERDAD. Tres tramos y no un número: nadie
  -- sabe cuántas horas tiene, pero todo el mundo sabe si es poco o
  -- bastante.
  horas text not null check (horas in ('poca', 'media', 'mucha')),
  experiencia text,
  por_que text,
  -- La muestra: cinco líneas escritas ahí mismo. Predice quién va a
  -- hacer el trabajo mejor que las otras cuatro preguntas juntas.
  muestra text,
  status text not null default 'nueva'
    check (status in ('nueva', 'hablando', 'aceptada', 'descartada')),
  nota_admin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Los textos, acotados aquí y no solo en el navegador: esta tabla la
-- escribe cualquiera con cuenta.
alter table public.collab_applications drop constraint if exists collab_applications_largos_check;
alter table public.collab_applications
  add constraint collab_applications_largos_check check (
    array_length(roles, 1) is null or array_length(roles, 1) <= 6
  );

-- Una solicitud viva por persona. Si ya hay una sin resolver, la
-- siguiente no entra — y el cliente lo cuenta en vez de enseñar un error
-- de la base.
create unique index if not exists collab_applications_una_viva_idx
  on public.collab_applications (user_id)
  where status in ('nueva', 'hablando');

create index if not exists collab_applications_status_idx
  on public.collab_applications (status, created_at desc);

alter table public.collab_applications enable row level security;

drop policy if exists "collab_insert_propia" on public.collab_applications;
create policy "collab_insert_propia" on public.collab_applications
  for insert to authenticated with check (auth.uid() = user_id);

-- Cada cual ve la suya: hace falta para poder decirle «ya la mandaste».
drop policy if exists "collab_ver_propia" on public.collab_applications;
create policy "collab_ver_propia" on public.collab_applications
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "collab_admin_ver" on public.collab_applications;
create policy "collab_admin_ver" on public.collab_applications
  for select to authenticated using (is_admin());

drop policy if exists "collab_admin_tocar" on public.collab_applications;
create policy "collab_admin_tocar" on public.collab_applications
  for update to authenticated using (is_admin()) with check (is_admin());

-- Nadie borra nada: una solicitud descartada se queda descartada. Si
-- algún día hace falta, se borra a mano con la clave de servicio.


-- ────────────────────────────────────────────────────────────
-- Y que PINGU se entere el mismo día
-- ────────────────────────────────────────────────────────────
--
-- Una solicitud que se queda esperando una semana es un voluntario
-- perdido: se ofreció, no le contestaron, y ya no vuelve a ofrecerse.
-- Campanita y correo, como las guías que entran a revisión.
create or replace function public.on_collab_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quien text;
  v_admin record;
begin
  select coalesce(email_preview(display_name, 60), email_preview(username, 60), 'Alguien')
    into v_quien
    from user_profiles where id = new.user_id;
  v_quien := coalesce(v_quien, 'Alguien');

  for v_admin in select id from user_profiles where is_admin = true loop
    continue when v_admin.id = new.user_id;

    insert into user_notifications (recipient_id, type, title, body, link)
    values (
      v_admin.id,
      'collab_application',
      'Alguien quiere colaborar',
      v_quien || ' se ha ofrecido para echar una mano',
      '/admin/'
    );

    perform enqueue_email(
      v_admin.id,
      'collab_application',
      'Alguien quiere colaborar en PokeDoc',
      v_quien || ' se ha ofrecido para echar una mano. Su solicitud está en /admin.',
      '/admin/',
      -- Por PERSONA: si alguien manda dos en una tarde, un aviso.
      'colabora:' || new.user_id::text
    );
  end loop;

  return new;
end $$;

revoke all on function public.on_collab_application() from public, anon, authenticated;

drop trigger if exists collab_application_aviso on public.collab_applications;
create trigger collab_application_aviso
  after insert on public.collab_applications
  for each row execute function public.on_collab_application();


-- ── Comprobación ──
--
-- select status, count(*) from public.collab_applications group by 1;
