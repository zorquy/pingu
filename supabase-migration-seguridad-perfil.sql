-- La seguridad del perfil (tanda 805), a raíz del informe de Luisfe.
--
-- Lo que el informe pedía mirar primero —¿puede alguien ponerse
-- `is_admin` a sí mismo?— ya estaba cerrado: `solo_admin_da_titulos`
-- (torneos-organizadores, redactor-noticias) devuelve a su valor el admin,
-- la moderación, el título del foro, el organizador y el redactor. Pero
-- ese mismo disparador NO miraba otras columnas que cada uno puede
-- escribir en su fila con una llamada a la API, sin pasar por la web:
--
--   · `is_banned` e `is_muted`: alguien baneado se quitaba el baneo él solo;
--   · `is_pro`;
--   · `total_xp` y `level`: el XP lo suma la base (`xp_sumar`, los torneos,
--     el foro, las sugerencias), pero la fila se dejaba escribir a pelo;
--   · `avatar_url` y `banner_url`, con cualquier texto: la web pintaba la
--     foto dentro de un `style="…"` y una comilla doble colaba código en el
--     avatar de esa persona, en cada página donde sale (lo arregla también
--     el cliente, js/html.js → `urlParaCss`; esto es el candado de la base).
--
-- CÓMO SABE QUIÉN ESCRIBE: una llamada de la web llega con el rol
-- `authenticated` (o `anon`). Las funciones de la casa que reparten XP son
-- `security definer` y corren con el rol de su dueño, igual que el SQL
-- Editor y las funciones de Netlify con la clave de servicio. El disparador
-- es `security invoker` A PROPÓSITO, para ver ese rol: solo frena lo que
-- llega directo de la web y no es de un admin.
--
-- Y `xp_sumar`, que es la única puerta de XP que el cliente puede llamar,
-- lleva desde aquí un tope de 2.000 XP al día por persona: el premio más
-- grande son 500 por llamada, y sin tope se podía llamar en bucle.
--
-- Lo que NO toca: la racha (`current_streak`, `last_active_date`,
-- `streak_shields`), que la sigue escribiendo el navegador — cerrarla
-- rompería las rachas de todo el mundo hasta moverla a una función.
--
-- Ejecutar en el SQL Editor de Supabase. Se puede repetir entera. La última
-- consulta enseña las políticas de `user_profiles`: pásale el resultado a
-- quien lleve la web, que esas políticas se pusieron a mano y no están en
-- ninguna migración.

-- ── 1. ¿Es una dirección de imagen que se puede pintar? ──
create or replace function public.url_de_imagen_segura(p_url text)
returns boolean language sql immutable as $$
  select p_url is null or p_url ~ '^https://[^[:space:]"''()<>\\`]+$'
$$;

-- ── 2. El candado de las columnas que no son de cada uno ──
create or replace function public.perfil_guarda_columnas()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  -- De la casa (funciones definer, SQL Editor, clave de servicio): pasa.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Una fila nueva nace sin mando, sin castigo y sin XP regalado.
    new.is_admin := false;
    new.is_moderator := false;
    new.is_tournament_admin := false;
    new.is_news_writer := false;
    new.is_banned := false;
    new.is_muted := false;
    new.is_pro := false;
    new.forum_title := null;
    new.forum_title_color := null;
    new.total_xp := 0;
    new.level := public.nivel_de_xp(0);
    if not public.url_de_imagen_segura(new.avatar_url) then new.avatar_url := null; end if;
    if not public.url_de_imagen_segura(new.banner_url) then new.banner_url := null; end if;
    return new;
  end if;

  new.is_banned := old.is_banned;
  new.is_muted := old.is_muted;
  new.is_pro := old.is_pro;
  new.forum_title_color := old.forum_title_color;
  new.total_xp := old.total_xp;
  new.level := old.level;
  if new.avatar_url is distinct from old.avatar_url and not public.url_de_imagen_segura(new.avatar_url) then
    new.avatar_url := old.avatar_url;
  end if;
  if new.banner_url is distinct from old.banner_url and not public.url_de_imagen_segura(new.banner_url) then
    new.banner_url := old.banner_url;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_perfil_guarda_columnas on public.user_profiles;
create trigger trg_perfil_guarda_columnas
  before insert or update on public.user_profiles
  for each row execute function public.perfil_guarda_columnas();

-- ── 3. Y lo que crea una fila nueva tampoco se da mando ──
--
-- `solo_admin_da_titulos` solo corría al ACTUALIZAR. Quien entra con Google
-- sin fila todavía la crea con un `upsert` (onboarding.js), y un INSERT no
-- pasaba por él. Lo cubre el de arriba (rama INSERT).

-- ── 4. El tope diario de `xp_sumar` ──
create table if not exists public.xp_diario (
  user_id uuid not null,
  dia date not null default current_date,
  sumado int not null default 0,
  primary key (user_id, dia)
);
-- Solo la escribe `xp_sumar` (definer); nadie la lee desde la web.
alter table public.xp_diario enable row level security;

create or replace function public.xp_sumar(p_cuanto int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_hoy int;
  v_tope constant int := 2000;
  v_suma int;
begin
  if auth.uid() is null then
    raise exception 'hay que tener sesión para sumar XP';
  end if;
  if p_cuanto is null or p_cuanto <= 0 or p_cuanto > 500 then
    raise exception 'premio de XP fuera de rango: %', p_cuanto;
  end if;

  -- Lo que queda de hoy. Pasado el tope no se suma, pero se contesta el
  -- total: el cliente no tiene por qué romperse por un premio que no entra.
  insert into public.xp_diario (user_id, dia, sumado)
  values (auth.uid(), current_date, 0)
  on conflict (user_id, dia) do nothing;
  select sumado into v_hoy from public.xp_diario where user_id = auth.uid() and dia = current_date for update;
  v_suma := greatest(0, least(p_cuanto, v_tope - coalesce(v_hoy, 0)));

  if v_suma > 0 then
    update public.xp_diario set sumado = sumado + v_suma where user_id = auth.uid() and dia = current_date;
  end if;

  update public.user_profiles
     set total_xp = coalesce(total_xp, 0) + v_suma,
         level = public.nivel_de_xp(coalesce(total_xp, 0) + v_suma)
   where id = auth.uid()
   returning total_xp into v_total;

  if v_total is null then
    raise exception 'no hay perfil para %', auth.uid();
  end if;
  return v_total;
end;
$$;

revoke all on function public.xp_sumar(int) from public, anon;
grant execute on function public.xp_sumar(int) to authenticated, service_role;

notify pgrst, 'reload schema';

-- ── Comprobación: las políticas de user_profiles ──
-- La de UPDATE debería limitarse a la fila de cada uno (auth.uid() = id)
-- o a los admins. Si alguna dice `true` a secas, avisa.
select policyname as politica, cmd as para, roles, qual as usando, with_check as comprueba
  from pg_policies
 where schemaname = 'public' and tablename = 'user_profiles'
 order by cmd, policyname;
