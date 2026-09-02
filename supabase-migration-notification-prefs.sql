-- Preferencias de notificaciones: qué tipos de notificación NO quiere
-- recibir cada usuario (todo activado por defecto, array vacío).
alter table user_profiles add column if not exists notification_prefs_disabled text[] not null default '{}';

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
