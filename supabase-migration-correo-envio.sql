-- ════════════════════════════════════════════════════════════════════
-- Tanda 350 — por qué el resumen semanal llega varias veces
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU, con quejas de gente: «los correos de resumen semanal se
-- duplican y llegan varias veces».
--
-- ── Lo que pasa ──
--
-- `send-emails` corre cada 5 minutos y hace esto: pide las 50 filas
-- `pending` más viejas, y por cada una manda el correo y DESPUÉS la
-- marca como `sent`. Entre esas dos cosas la fila sigue estando
-- `pending`, y no hay nada que impida que otra pasada la coja.
--
-- Con los avisos sueltos no se nota: son dos o tres filas y la pasada
-- acaba en un segundo. **El resumen semanal encola una fila POR
-- PERSONA**, así que de golpe hay cientos. Cada envío por SMTP tarda su
-- rato, y **una función programada de Netlify se mata a los 30
-- segundos**: la pasada muere a mitad habiendo mandado treinta correos y
-- sin marcar ninguno de los que le faltaban. Cinco minutos después la
-- siguiente pasada se encuentra esas mismas filas en `pending` y las
-- vuelve a mandar. Y otra vez. Por eso se duplica justo el semanal y no
-- los demás.
--
-- ── El arreglo ──
--
-- Un estado intermedio. La pasada RECLAMA las filas antes de mandar
-- nada, con un UPDATE condicionado a que sigan `pending`: si otra pasada
-- llegó antes, el UPDATE no toca nada y esta se queda sin ellas. Es el
-- patrón de una cola de toda la vida, y es atómico porque lo resuelve
-- Postgres, no el JavaScript.
--
-- `claimed_at` es la marca de CUÁNDO se reclamó, para poder rescatar lo
-- que se quedó a medias: una fila reclamada hace media hora es una
-- pasada que murió, y vuelve a `pending` — pero contando el intento, que
-- si no volvería a morir en bucle.
--
-- Ejecutar en el SQL Editor de Supabase. Re-ejecutable.

-- ── 1. El estado nuevo ──
alter table public.email_outbox drop constraint if exists email_outbox_status_check;

alter table public.email_outbox
  add constraint email_outbox_status_check
  check (status in ('pending', 'sending', 'sent', 'failed'));

alter table public.email_outbox
  add column if not exists claimed_at timestamptz;

-- ── 2. Los índices ──
--
-- El de lo pendiente ya existe. Este es para el rescate: buscar lo que
-- lleva demasiado rato reclamado.
create index if not exists email_outbox_sending_idx
  on public.email_outbox (claimed_at)
  where status = 'sending';

-- ── 3. Y lo que esté a medias AHORA MISMO ──
--
-- Al desplegar esto no hay ninguna fila en `sending`, pero sí puede
-- haber filas `pending` que se hayan mandado ya y no se marcaran (justo
-- el fallo). No se puede saber cuáles, así que no se tocan: como mucho
-- llegan una vez más, y a partir de ahí no vuelve a pasar.

-- ── Para ver cómo va la cola ──
--
-- select status, type, count(*) from public.email_outbox
-- group by status, type order by 3 desc;

-- ── 4. Ver la cola desde /admin, sin ver los correos de nadie ──
--
-- `email_outbox` tiene RLS y CERO políticas a propósito: nadie desde el
-- navegador lee la cola, ni siquiera la suya. Eso sigue igual.
--
-- Pero «se duplican los correos» no se puede diagnosticar sin ver la
-- cola, así que esta función devuelve el RECUENTO por tipo y estado —
-- números, nunca asuntos ni destinatarios— y solo al admin del sitio.
create or replace function public.email_outbox_resumen()
returns table (type text, status text, cuantos bigint, ultimo timestamptz)
language sql
security definer
set search_path = public
as $$
  select o.type, o.status, count(*), max(coalesce(o.sent_at, o.created_at))
  from public.email_outbox o
  where exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
  group by o.type, o.status
  order by 3 desc
$$;

revoke all on function public.email_outbox_resumen() from public, anon;
grant execute on function public.email_outbox_resumen() to authenticated;

-- Y los últimos errores, que es lo que dice POR QUÉ no sale un correo.
-- Tampoco lleva destinatario: el tipo, el error y cuándo.
create or replace function public.email_outbox_errores()
returns table (type text, last_error text, attempts int, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select o.type, o.last_error, o.attempts, o.created_at
  from public.email_outbox o
  where o.last_error is not null
    and exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  order by o.created_at desc
  limit 20
$$;

revoke all on function public.email_outbox_errores() from public, anon;
grant execute on function public.email_outbox_errores() to authenticated;
