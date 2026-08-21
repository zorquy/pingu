-- ─────────────────────────────────────────────────────────────
-- Cumpleaños (opcional) en el perfil
-- ─────────────────────────────────────────────────────────────
-- Ejecutar en el editor SQL de Supabase.
--
-- Quien quiera puede poner su fecha de nacimiento en Editar perfil, y el
-- día señalado el foro lo felicita en «El foro en números». Es opcional
-- y se puede quitar dejando el campo vacío.
--
-- `birthday_md` es una columna GENERADA con el mes y el día ("08-21"):
-- es lo único que se necesita para saber quién cumple HOY, y filtrar por
-- ella usa un índice normal — filtrar por mes/día de una fecha no puede.
-- Se construye con extract/lpad y no con to_char porque una columna
-- generada exige una expresión inmutable, y to_char depende de la
-- configuración regional (no lo es).

alter table public.user_profiles
  add column if not exists birthday date;

alter table public.user_profiles
  add column if not exists birthday_md text generated always as (
    case
      when birthday is null then null
      else lpad(extract(month from birthday)::int::text, 2, '0')
        || '-'
        || lpad(extract(day from birthday)::int::text, 2, '0')
    end
  ) stored;

create index if not exists user_profiles_birthday_md_idx
  on public.user_profiles (birthday_md)
  where birthday_md is not null;

-- Sin políticas nuevas: la de "cada cual edita su propia fila" que ya
-- existe cubre la columna nueva, y la de lectura pública también (el
-- cumpleaños lo pone quien quiere que se vea).

notify pgrst, 'reload schema';
