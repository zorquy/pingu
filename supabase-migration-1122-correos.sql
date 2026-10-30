-- ============================================================
-- Tanda 1122 — Los textos de los correos, editables desde /admin
--
-- PINGU: «que se pueda editar desde aquí los correos». Hasta ahora el verbo
-- del botón y el motivo del pie estaban escritos en js/email-plantilla.js y
-- para cambiar una coma había que pedirlo.
--
--   · `correo_textos`: una fila por tipo de correo con lo que el equipo ha
--     cambiado (asunto como plantilla con {asunto}, un texto encima de la
--     cita, el botón y el motivo del pie). Lo vacío es lo de siempre; borrar
--     la fila es «Volver al de siempre». La lee y escribe el equipo; la
--     función de envío la lee con la clave de servicio.
--   · `admin_correo_prueba(tipo, asunto, cita, enlace)`: mete en la cola un
--     correo de ese tipo para quien lo pide (solo admin), que sale en la
--     siguiente pasada de send-emails (cada cinco minutos) con los textos
--     guardados.
--
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create table if not exists public.correo_textos (
  tipo text primary key,
  asunto text,
  intro text,
  cta text,
  pie text,
  updated_at timestamptz not null default now(),
  por uuid references auth.users(id) on delete set null
);

alter table public.correo_textos enable row level security;
drop policy if exists "correo_textos_equipo" on public.correo_textos;
create policy "correo_textos_equipo" on public.correo_textos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.correo_textos to authenticated;

create or replace function public.admin_correo_prueba(p_tipo text, p_asunto text, p_cita text default null, p_enlace text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'solo el equipo puede mandarse pruebas';
  end if;
  if coalesce(trim(p_tipo), '') = '' or coalesce(trim(p_asunto), '') = '' then
    raise exception 'falta el tipo o el asunto';
  end if;
  -- Cinco pruebas por hora como mucho: es un botón, y la cola es de verdad.
  if (select count(*) from email_outbox
       where recipient_id = auth.uid() and thread_key like 'prueba:%' and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'ya van cinco pruebas esta hora';
  end if;
  insert into email_outbox (recipient_id, type, subject, preview, link, thread_key)
  values (auth.uid(), left(p_tipo, 60), left(trim(p_asunto), 200), left(p_cita, 2000), left(p_enlace, 500), 'prueba:' || gen_random_uuid());
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_correo_prueba(text, text, text, text) from public, anon;
grant execute on function public.admin_correo_prueba(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
