-- ════════════════════════════════════════════════════════════════════
-- Tanda 350 — el correo de «tu guía necesita cambios» no llevaba a la guía
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU: «hay algunos que el botón no funciona, otros te llevan al
-- foro... vamos a repasarlo».
--
-- Repasados los dieciséis correos que manda PokeDoc, el enlace roto es
-- este: el de una guía rechazada llevaba a `/perfil.html`. No es un 404
-- —por eso no lo cazó nadie—, es peor: te deja en tu perfil a buscar la
-- guía tú, justo en el correo que existe para decirte qué cambiar.
--
-- Ahora abre la guía EN EL EDITOR. Y el editor toma `?id=`, no `?slug=`:
-- con el slug abriría una guía nueva y en blanco, que se parece
-- muchísimo a haber perdido lo escrito.
--
-- Es la MISMA función de supabase-migration-aviso-guia-revision.sql con
-- ese enlace cambiado (y el texto de la vista previa, que decía «entra
-- en tu perfil»). Se recrea entera porque en Postgres una función se
-- sustituye entera.
--
-- Ejecutar en el SQL Editor de Supabase. Re-ejecutable.

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
      case when v_motivo = '' then 'Ábrela en el editor para ver qué falta.'
           else 'Motivo: ' || v_motivo end,
      -- Tanda 350: iba a `/perfil.html`, que es «búscala tú». El editor
      -- toma `?id=`, no `?slug=` — con el slug la página abre una guía
      -- NUEVA y en blanco, que es peor que no llevar enlace.
      '/editor-guia.html?id=' || new.id::text,
      'guiaest:' || new.id::text
    );
  end if;

  return new;
end $$;

-- El disparador no se toca: sigue apuntando a esta misma función.
