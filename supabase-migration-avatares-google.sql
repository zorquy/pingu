-- ============================================================
-- Rellena la foto de perfil de quien entró con Google.
--
-- Supabase guarda lo que manda el proveedor en
-- `auth.users.raw_user_meta_data`, pero eso NO se copia solo a
-- `user_profiles`. Por eso las cuentas de Google salían con la inicial
-- aunque en Supabase se les vea la foto.
--
-- La web ya la guarda sola la próxima vez que esa persona entre (ver
-- avatarFromSession en js/app.js), pero eso depende de que vuelva. Esto
-- lo hace de golpe para las cuentas que ya existen.
--
-- NO pisa a quien ya tiene foto propia subida: solo rellena las vacías.
--
-- Es idempotente: ejecutarlo otra vez no cambia nada más.
-- ============================================================

begin;

update user_profiles p
set avatar_url = coalesce(
  u.raw_user_meta_data ->> 'avatar_url',
  u.raw_user_meta_data ->> 'picture'
)
from auth.users u
where u.id = p.id
  and (p.avatar_url is null or p.avatar_url = '')
  and coalesce(
    u.raw_user_meta_data ->> 'avatar_url',
    u.raw_user_meta_data ->> 'picture'
  ) like 'https://%';

commit;


-- ────────────────────────────────────────────────────────────
-- COMPROBACIÓN
-- ────────────────────────────────────────────────────────────

-- Cuántas cuentas tienen ya foto y cuántas se quedan con la inicial.
select
  count(*) filter (where avatar_url is not null and avatar_url <> '') as con_foto,
  count(*) filter (where avatar_url is null or avatar_url = '') as sin_foto
from user_profiles;

-- Y cuáles siguen sin foto teniendo una USABLE en el proveedor: debe
-- salir vacío. Se exige https igual que arriba — si no, esta consulta
-- marcaría como pendientes las que se saltan a propósito por no tener
-- una URL válida, y parecería que la migración no ha funcionado.
select p.username
from user_profiles p
join auth.users u on u.id = p.id
where (p.avatar_url is null or p.avatar_url = '')
  and coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture') like 'https://%';
