-- ═══════════════════════════════════════════════════════════════════
-- LA IMAGEN DEL TORNEO (tanda 239)
--
-- Lo pidió Ibai: poder ponerle un icono o imagen a un torneo, y que el
-- listado la enseñe. Una columna y ya:
--
--   · La imagen se sube al bucket `avatars` que YA existe (migración
--     supabase-migration-avatars.sql), en la carpeta del usuario que
--     crea o edita el torneo (avatars/<user-id>/torneo-<ts>.<ext>).
--     Sus políticas valen tal cual — cada uno escribe en su carpeta y
--     todo el mundo lee — así que NO hace falta bucket ni política
--     nueva, que sería más superficie que mantener para lo mismo.
--   · En la tarjeta del listado, la imagen ocupa el hueco del bloque
--     de fecha (la fecha ya se repite en texto justo debajo).
--
-- Es re-ejecutable.
-- ═══════════════════════════════════════════════════════════════════

alter table public.tournaments
  add column if not exists image_url text;

-- ── Comprobación ───────────────────────────────────────────────────
-- Tiene que devolver 0 (ningún torneo con imagen todavía) y no dar
-- error.
select count(*) as torneos_con_imagen from public.tournaments where image_url is not null;

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
