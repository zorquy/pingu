-- Poder seguir editando una guía mientras está en revisión
-- ============================================================
--
-- Escribir una guía lleva días. Hasta ahora, en cuanto le dabas a
-- "Enviar a revisión" la guía se te cerraba con llave: no podías tocarla
-- ni para corregir una errata, y no había forma de sacarla de ahí salvo
-- que el equipo la rechazara. Alguien que la mandó a medias —para ver
-- cómo iba, o sin saber que era definitivo— se quedaba sin poder
-- terminar lo que estaba escribiendo.
--
-- Eso lo imponían tres capas a la vez (la política de aquí, el editor y
-- el panel "Mis guías"). Esta es la primera: sin ella, el editor
-- guardaría y la base rechazaría la fila en silencio.
--
-- Lo que cambia: el autor puede editar sus guías en `pending`, además de
-- las `draft` y `rejected` que ya podía.
--
-- Lo que NO cambia: sigue sin poder tocar una `approved`. Una guía
-- aprobada ya la ha leído alguien del equipo y la está leyendo la
-- comunidad; cambiarla por detrás sin pasar por revisión sería publicar
-- sin revisar. Para eso están las sugerencias de corrección.
--
-- El `with check` se queda igual (`draft`/`pending`), que es lo que
-- impide que un autor se apruebe a sí mismo la guía.

-- Baneados y silenciados: al ampliar a `pending` hace falta decirlo
-- explícitamente. Editar un borrador es privado y no llega a nadie; una
-- guía en revisión está a un clic de publicarse, así que dejar que un
-- baneado siga metiéndole mano sería colarle contenido a la cola de
-- publicación. La condición se aplica SOLO al caso nuevo: quien esté
-- silenciado sigue pudiendo tocar sus borradores igual que hasta ahora,
-- porque eso no se lo enseña a nadie.
drop policy if exists "guides_author_update" on guides;
create policy "guides_author_update" on guides
  for update
  using (
    auth.uid() = author_id
    and (
      review_status in ('draft', 'rejected')
      or (review_status = 'pending' and not is_banned() and not is_muted())
    )
  )
  with check (auth.uid() = author_id and review_status in ('draft', 'pending'));

-- El borrado se queda como estaba: `draft` y `rejected`. Una guía en
-- revisión está en la cola de alguien, y que desaparezca mientras la
-- están leyendo es peor que tener que pedir que la quiten.
