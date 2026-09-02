-- Racha diaria: cuántos días seguidos ha entrado el usuario, con un
-- pequeño bonus de XP la primera vez que entra cada día.

alter table user_profiles add column if not exists current_streak integer not null default 0;
alter table user_profiles add column if not exists last_active_date date;

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
