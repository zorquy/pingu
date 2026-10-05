-- ═══════════════════════════════════════════════════════════════════
-- EL MAZO GUARDADO DE UNA PARTIDA (tanda 627)
--
-- PINGU: «que puedas añadir tus repeticiones a tus partidas vinculando
-- las repeticiones a uno de los mazos que tienes guardados en el
-- constructor».
--
-- Una partida de Mis partidas puede decir con QUÉ mazo guardado se jugó:
-- `match_log.user_deck_id`. No sustituye a `mi_mazo` (el arquetipo, que es
-- lo que agrupa la matriz con las partidas de torneo): es la lista
-- concreta, para poder ver cómo le va a ESA versión de tu mazo.
--
-- Si el mazo se borra, la partida se queda (sin el enlace): tu histórico
-- no depende de que conserves la lista.
--
-- Es re-ejecutable.
-- ═══════════════════════════════════════════════════════════════════

begin;

alter table public.match_log
  add column if not exists user_deck_id uuid references public.user_decks (id) on delete set null;

create index if not exists partidas_por_mazo_guardado
  on public.match_log (user_id, user_deck_id)
  where user_deck_id is not null;

-- Solo un mazo TUYO. La clave ajena comprueba que el mazo EXISTE, no de
-- quién es (una clave ajena no pasa por la RLS), y un mazo público de otro
-- se puede leer: sin esto, cualquiera podría colgar sus partidas de la
-- lista de otra persona.
create or replace function public.match_log_mazo_propio()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_deck_id is not null and not exists (
    select 1 from public.user_decks d where d.id = new.user_deck_id and d.user_id = new.user_id
  ) then
    raise exception 'Ese mazo no es tuyo.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists match_log_mazo_propio on public.match_log;
create trigger match_log_mazo_propio
  before insert or update of user_deck_id, user_id on public.match_log
  for each row execute function public.match_log_mazo_propio();

commit;

-- ── Comprobación ───────────────────────────────────────────────────
-- Tiene que salir la columna, de tipo uuid.
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'match_log' and column_name = 'user_deck_id';

-- PostgREST guarda en memoria el esquema que conoce: sin este aviso la
-- columna no existe para la API hasta que Supabase recarga (tanda 250).
notify pgrst, 'reload schema';
