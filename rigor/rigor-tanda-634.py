"""Rigor de la tanda 634 — en una liga, apuntarse y desapuntarse de las
jornadas antes de que empiecen.

Cada mutación rompe el ORIGEN: quién falta a una jornada, si una jornada
sigue abierta, lo que llega al motor, la lectura en el momento de
emparejar, la caja de «Tu plaza», el aviso del organizador y las puertas
de la función de la base."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

JO = 'js/torneos/jornadas.js'
TO = 'js/torneos/torneo.js'
RO = 'js/torneos/ronda.js'
MIG = 'supabase-migration-torneos-jornadas.sql'
CSS = 'css/torneos.css'

MUTACIONES = [
    # ── El módulo ──
    (JO, 'nadie falta nunca', "  return new Set((jornadas?.ausencias || []).filter((a) => a.matchday === n).map((a) => a.user_id))", "  return new Set()"),
    (JO, 'una jornada emparejada sigue abierta', "      abierta: !jornadas.empezadas.has(n),", "      abierta: true,"),
    (JO, 'sin la tabla se pinta como si nadie faltara', "  if (ausencias.error || rondas.error) return null\n", ""),
    (JO, 'el botón no dice qué hará', "data-juega=\"${j.juego ? 'no' : 'si'}\"", "data-juega=\"no\""),

    # ── La ficha ──
    (TO, '«Tus jornadas» no sale', "      ${misJornadasHtml(misJornadas(torneo, ['finished', 'cancelled'].includes(torneo.status) ? null : jornadas, session.user.id), fechaBonita)}\n", ""),
    (TO, 'los botones no hacen nada', "    engancharJornadas()\n", ""),
    (TO, 'las jornadas no se cargan', "  jornadas = await cargarJornadas(torneo)\n", ""),

    # ── El pareo ──
    (RO, 'el motor sienta a quien no juega', "      if (i.status !== 'dropped' && ausentes.has(i.user_id)) {", "      if (false) {"),
    (RO, 'se empareja con lo del último refresco', "    if (frescas) ctx.jornadas = frescas\n", ""),
    (RO, 'la J1 cuenta a quien no juega', "i.status === 'active' && !noJuegan.includes(i.user_id)).length", "i.status === 'active').length"),
    (RO, 'el organizador no ve quién falta', "${avisoDeJornada(rondas.length + 1)}`", "`"),

    # ── La base y el dibujo ──
    (MIG, 'se cambia una jornada ya emparejada', "  if exists (select 1 from rounds where tournament_id = p_torneo and round_number = p_jornada) then", "  if false then"),
    (MIG, 'se apunta cualquiera', "where r.tournament_id = p_torneo and r.user_id = auth.uid() and r.status = 'active'", "where r.tournament_id = p_torneo"),
    (MIG, 'la tabla no se puede leer', "create policy ausencias_leer on public.tournament_matchday_absences for select using (true);", "create policy ausencias_leer on public.tournament_matchday_absences for select using (false);"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-634.mjs')
