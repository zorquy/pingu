"""Rigor de la tanda 635 — en una liga, una lista por jornada y cada
jornada se cierra por separado.

Cada mutación rompe el ORIGEN: quién juega una jornada, si está cerrada,
lo que llega al motor, la lectura en el momento de emparejar, la
publicación de las listas, la caja de «Tus jornadas», «Tu decklist» por
jornada, la entrada tardía y las puertas de las funciones de la base."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

JO = 'js/torneos/jornadas.js'
TO = 'js/torneos/torneo.js'
RO = 'js/torneos/ronda.js'
MIG = 'supabase-migration-torneos-jornadas.sql'

MUTACIONES = [
    # ── El módulo ──
    (JO, 'nadie juega nunca (quién juega no se calcula)', "  return new Set(j.listas.filter((l) => l.matchday === n).map((l) => l.user_id))", "  return new Set()"),
    (JO, 'una jornada cerrada sigue abierta', "export const jornadaCerrada = (j, n) => Boolean(j?.cerradas.has(n)) || jornadaEmpezada(j, n)", "export const jornadaCerrada = (j, n) => jornadaEmpezada(j, n)"),
    (JO, 'no se ofrece la lista anterior', "  return [...lista].reverse().find((x) => x.n < n && x.lista)?.lista || null", "  return null"),
    (JO, 'sin la migración se pinta igual', "  if (cerradas.error || rondas.error || mias.error) return null\n", ""),
    (JO, 'la primera abierta es siempre la 1', "  for (let n = 1; n <= (Number(torneo.swiss_rounds) || 0); n++) if (!jornadaCerrada(j, n)) return n", "  return 1"),

    # ── La ficha ──
    (TO, '«Enviar lista» no elige la jornada', "      jornadaElegida = n\n      pintarDecklist()", "      pintarDecklist()"),
    (TO, 'en una liga se edita la lista de siempre', "  if (esUnaLiga() && jornadas && session) {\n    pintarDecklistLiga()", "  if (false) {\n    pintarDecklistLiga()"),
    (TO, 'la lista de la jornada se guarda como la de siempre', "    if (jornada) {\n      const error = await enviarListaJornada(", "    if (false) {\n      const error = await enviarListaJornada("),
    (TO, '«No juego» no hace nada', "    const error = await quitarListaJornada(torneo.id, n)", "    const error = null"),
    (TO, 'una liga empezada no admite a nadie', "esUnaLiga() && ['registration_closed', 'in_progress'].includes(torneo.status) ? primeraAbierta(torneo, jornadas) : null", "null"),
    (TO, 'la liga se cierra entera', "  } else if (torneo.status === 'registration_open' && esUnaLiga()) {", "  } else if (false) {"),
    (TO, 'las listas de todos no se cargan para el organizador', "todas: Boolean(session && mando()) })", "todas: false })"),

    # ── El pareo ──
    (RO, 'el motor sienta a quien no tiene lista', "      if (juegan && i.status !== 'dropped' && !juegan.has(i.user_id)) {", "      if (false) {"),
    (RO, 'se empareja con lo del último refresco', "    if (frescas) ctx.jornadas = frescas\n", ""),
    (RO, 'se empareja una jornada abierta', "    if (!jornadaCerrada(ctx.jornadas, n)) {\n      showToast(`Cierra antes", "    if (false) {\n      showToast(`Cierra antes"),
    (RO, 'se empareja con una sola lista', "    if (sentables < 2) {\n      showToast(\n        `No hay con quién", "    if (false) {\n      showToast(\n        `No hay con quién"),
    (RO, 'la liga retira en la J1 a quien no mandó lista', "  if (n === 1 && !porJornadas) {", "  if (n === 1) {"),
    (RO, 'las listas no se publican al emparejar', "    const error = await publicarListasJornada(ctx.torneo.id, n)", "    const error = null"),
    (RO, 'el organizador no ve las jornadas', "    </div>${adminAvisos}${jornadasAdminHtml()}`", "    </div>${adminAvisos}`"),
    (RO, 'la liga no se lleva desde «Rondas» antes de empezar', "|| rondas.length > 0 || ligaPorJornadas", "|| rondas.length > 0"),

    # ── La base ──
    (MIG, 'se manda lista a una jornada cerrada', "     or exists (select 1 from tournament_matchday_closures where tournament_id = p_torneo and matchday = p_jornada) then\n    raise exception 'Las inscripciones de la jornada % están cerradas.', p_jornada;\n  end if;\n  if coalesce(trim(p_texto)", "     or false then\n    raise exception 'Las inscripciones de la jornada % están cerradas.', p_jornada;\n  end if;\n  if coalesce(trim(p_texto)"),
    (MIG, 'cualquiera ve las listas de una jornada', "  using (user_id = auth.uid() or torneos_mando(tournament_id) or torneos_soy_juez(tournament_id));", "  using (true);"),
    (MIG, 'cualquiera cierra jornadas', "  if not torneos_mando(p_torneo) then raise exception 'Solo quien lleva la liga cierra sus jornadas.'; end if;\n", ""),
    (MIG, 'una liga empezada no admite a nadie', "    v_torneo.format = 'league'\n    and v_torneo.status in ('registration_closed', 'in_progress')", "    false\n    and v_torneo.status in ('registration_closed', 'in_progress')"),
    (MIG, 'se reabre con pareos', "    if exists (select 1 from rounds where tournament_id = p_torneo and round_number = p_jornada) then\n      raise exception 'La jornada % ya tiene pareos", "    if false then\n      raise exception 'La jornada % ya tiene pareos"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-635.mjs')
