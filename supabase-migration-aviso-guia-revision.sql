-- Avisar cuando una guía cambia de estado
-- ============================================================
--
-- El agujero: cuando alguien manda una guía a revisión NO SE ENTERA
-- NADIE. La fila se queda en la cola de /admin esperando a que alguien
-- del equipo entre a mirar por su cuenta. Con veinte personas se
-- aguanta; con el foro abierto, una guía puede pasarse días muerta
-- mientras su autor piensa que le están ignorando — y escribir una guía
-- cuesta días de trabajo.
--
-- Va como DISPARADOR y no en el JavaScript del panel a propósito: así
-- salta venga el cambio de donde venga (el editor del autor, el panel de
-- admin, una consulta a mano en el editor SQL), y no solo cuando se
-- pulsa un botón concreto de una pantalla concreta.
--
-- Necesita supabase-migration-correo-avisos.sql (de ahí salen
-- `enqueue_email` y `email_preview`) y supabase-migration-social.sql (de
-- ahí sale `guides.review_status`).
--
-- Es idempotente: se puede ejecutar más de una vez.
--
-- REPARTO CON EL JAVASCRIPT — importante para no duplicar avisos:
--
--   · Enviada a revisión → NADIE avisaba. Lo hace este disparador
--     entero: campanita Y correo, a todo el equipo.
--   · Aprobada o rechazada → la campanita del autor YA la escribe
--     admin/js/editor-guia.js (con el XP y el aviso a los seguidores,
--     que son cosa suya). Aquí se añade SOLO EL CORREO, que es lo que
--     faltaba: sin él, el autor tiene que entrar a la web por su cuenta
--     para descubrir que ya le han contestado.
--
-- Si algún día se mueve la campanita de aprobación aquí, hay que
-- quitarla de allí en el mismo cambio, o llegarán dos.
-- ============================================================

begin;

create or replace function public.on_guide_review_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autor text;
  v_titulo text;
  v_admin record;
  v_motivo text;
begin
  -- Solo interesan los CAMBIOS de estado. Un UPDATE que toca el texto de
  -- una guía en revisión (que ahora se puede, ver
  -- supabase-migration-editar-en-revision.sql) no puede volver a avisar
  -- al equipo en cada guardado.
  if tg_op = 'UPDATE' and new.review_status is not distinct from old.review_status then
    return new;
  end if;

  -- El título va dentro de la cabecera Subject del correo, y lo escribe
  -- quien sea. email_preview colapsa los saltos de línea, que es lo que
  -- permitiría inyectar cabeceras ahí.
  v_titulo := coalesce(email_preview(new.title, 70), 'Sin título');

  -- ── Enviada a revisión: avisar al equipo ──
  if new.review_status = 'pending' and new.author_id is not null then
    select coalesce(email_preview(display_name, 60), email_preview(username, 60), 'Alguien')
      into v_autor
      from user_profiles where id = new.author_id;
    v_autor := coalesce(v_autor, 'Alguien');

    for v_admin in select id from user_profiles where is_admin = true loop
      -- Que no se avise a sí mismo: un admin escribiendo su propia guía
      -- ya sabe que la ha enviado.
      continue when v_admin.id = new.author_id;

      insert into user_notifications (recipient_id, type, title, body, link)
      values (
        v_admin.id,
        'guide_submitted',
        'Guía nueva para revisar',
        v_autor || ' ha enviado «' || v_titulo || '»',
        '/admin/'
      );

      -- thread_key por GUÍA: si alguien la envía, la retiran y la vuelve
      -- a enviar en un rato, no se manda un correo por cada vuelta.
      perform enqueue_email(
        v_admin.id,
        'guide_submitted',
        'Guía nueva para revisar en PokeDoc',
        v_autor || ' ha enviado a revisión «' || v_titulo || '».',
        '/admin/',
        'guiarev:' || new.id::text
      );
    end loop;
    return new;
  end if;

  -- ── Aprobada o rechazada: SOLO el correo al autor ──
  -- (la campanita ya la escribe el panel de admin, ver la cabecera)
  if new.author_id is null then
    return new;
  end if;

  if new.review_status = 'approved' then
    perform enqueue_email(
      new.author_id,
      'guide_approved',
      'Tu guía ya está publicada en PokeDoc',
      'Hemos aprobado «' || v_titulo || '». Ya la puede leer todo el mundo.',
      '/guia.html?slug=' || coalesce(new.slug, ''),
      'guiaest:' || new.id::text
    );
  elsif new.review_status = 'rejected' then
    -- El motivo lo escribe una persona del equipo en un `prompt`, así
    -- que también pasa por email_preview antes de entrar en el cuerpo.
    v_motivo := coalesce(email_preview(new.rejection_reason, 200), '');
    perform enqueue_email(
      new.author_id,
      'guide_rejected',
      'Tu guía necesita unos cambios',
      case when v_motivo = '' then 'Entra en tu perfil para ver qué falta.'
           else 'Motivo: ' || v_motivo end,
      '/perfil.html',
      'guiaest:' || new.id::text
    );
  end if;

  return new;
end $$;

drop trigger if exists guide_review_email on public.guides;
create trigger guide_review_email
  after insert or update of review_status on public.guides
  for each row execute function public.on_guide_review_email();

-- Misma puerta cerrada que en el resto de disparadores de correo: la
-- función es SECURITY DEFINER, y sin esto PostgREST la expone como RPC.
-- Cualquiera con sesión podría llamarla y colar avisos al equipo.
revoke all on function public.on_guide_review_email() from public, anon, authenticated;

commit;
