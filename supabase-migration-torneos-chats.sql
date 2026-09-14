-- El chat de la mesa y el del juez: cerrar la puerta de atrás (tanda 294).
--
-- ── EL AGUJERO ──
--
-- En PostgreSQL, un INSERT **no mira el `using`** de la política: solo
-- el `with check`. Y las dos políticas de chat estaban escritas así:
--
--   create policy mensajes_mesa on public.match_messages for all
--     using ( ...eres de la mesa, o juez, o admin... )
--     with check (sender_id = auth.uid());
--
-- O sea que para LEER había que ser de la mesa… pero para ESCRIBIR
-- bastaba con firmar con tu propio nombre. Y los ids de las mesas son
-- de lectura pública (es lo que hace que un enlace de torneo enseñe el
-- directo), así que cualquiera con cuenta podía meter mensajes en el
-- chat de dos desconocidos en mitad de su partida. Igual en el chat de
-- una llamada al juez.
--
-- No es un fallo que se vea: la parte de LEER estaba bien, así que
-- nadie se lo encuentra mirando. Se encontró barriendo todas las
-- políticas `for all` en busca de un `with check` más flojo que su
-- `using`. En todo el proyecto había exactamente estas dos.
--
-- Comprobado contra PostgreSQL de verdad (sql-chats.sql, en la rama de
-- pruebas): antes el desconocido escribía; ahora le salta la RLS, y
-- quien SÍ juega esa mesa sigue escribiendo.
--
-- Ejecutar en el SQL Editor de Supabase. Se puede repetir entera.

-- ── Chat de la mesa: sus dos jugadores, jueces y admin ──
drop policy if exists mensajes_mesa on public.match_messages;
create policy mensajes_mesa on public.match_messages for all
  using (
    exists (
      select 1 from tournament_matches m
      where m.id = match_id
        and (m.player_a_id = auth.uid() or m.player_b_id = auth.uid()
             or torneos_soy_admin()
             or torneos_soy_juez((select r.tournament_id from rounds r where r.id = m.round_id)))
    )
  )
  -- La misma condición que para leer, Y la firma. Las dos: sin la
  -- pertenencia entra cualquiera; sin la firma se puede escribir en
  -- nombre de otro.
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from tournament_matches m
      where m.id = match_id
        and (m.player_a_id = auth.uid() or m.player_b_id = auth.uid()
             or torneos_soy_admin()
             or torneos_soy_juez((select r.tournament_id from rounds r where r.id = m.round_id)))
    )
  );

-- ── Chat de la llamada al juez: el que la abrió, jueces y admin ──
drop policy if exists mensajes_llamada on public.judge_messages;
create policy mensajes_llamada on public.judge_messages for all
  using (
    exists (
      select 1 from judge_calls c
      where c.id = judge_call_id
        and (c.created_by = auth.uid() or torneos_soy_admin() or torneos_soy_juez(c.tournament_id))
    )
  )
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from judge_calls c
      where c.id = judge_call_id
        and (c.created_by = auth.uid() or torneos_soy_admin() or torneos_soy_juez(c.tournament_id))
    )
  );

notify pgrst, 'reload schema';
