"""Rigor de la tanda 516 — quién se lleva cada premio, y si ya se le dio.

Lo que se rompe aquí no da error: un premio que se le asigna a quien no
es, un puesto que no se entiende y se le da a alguien igual, una marca que
pone quien no debe, o la base que deja escribir a mano.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

COM = 'js/torneos/comun.js'
RON = 'js/torneos/ronda.js'
SQL = 'supabase-migration-torneos-premios-entrega.sql'

MUTACIONES = [
    (COM, '«Top N» no se entiende', "  let m = t.match(/^top (\\d+)$/)", "  let m = t.match(/^tope (\\d+)$/)"),
    (COM, 'un rango se lee al revés', "  if (m && n(m[1]) && n(m[2]) && n(m[2]) >= n(m[1])) return { desde: n(m[1]), hasta: n(m[2]) }",
     "  if (m && n(m[1]) && n(m[2])) return { desde: n(m[1]), hasta: n(m[2]) }"),
    (COM, 'los ordinales escritos no cuentan', "const ORDINALES = { primero: 1,", "const ORDINALES = { primerisimo: 1,"),
    (COM, '«Todos» no es para todo el mundo', "    if (r.todos) return { ...p, jugadores: [...orden], todos: true }\n", ''),
    (COM, 'lo que no se entiende se le da al primero', "    if (!r) return { ...p, jugadores: null }", "    if (!r) return { ...p, jugadores: orden.slice(0, 1) }"),
    (COM, 'el puesto cuenta desde cero', '    return { ...p, jugadores: orden.slice(r.desde - 1, r.hasta) }', '    return { ...p, jugadores: orden.slice(r.desde, r.hasta + 1) }'),
    (RON, 'el reparto sale con el torneo en juego', "  if (ctx.torneo.status !== 'finished') return ''\n  const premios = premiosDeTorneo(ctx.torneo)", "  const premios = premiosDeTorneo(ctx.torneo)"),
    (RON, 'el reparto va por la clasificación suiza y no por la final', '  const reparto = quienSeLleva(premios, clasificacionFinal().map((e) => e.playerId))',
     '  const reparto = quienSeLleva(premios, [...clasificacionFinal()].reverse().map((e) => e.playerId))'),
    (RON, 'el reparto ignora el corte (va por las suizas)', '  const reparto = quienSeLleva(premios, clasificacionFinal().map((e) => e.playerId))',
     '  const reparto = quienSeLleva(premios, computeStandings(montarSnapshot(rondas.length)).map((e) => e.playerId))'),
    (RON, 'un jugador ve los botones', '  const lleva = mando()\n', '  const lleva = true\n'),
    (RON, 'marcar dice siempre que sí', "p_entregado: boton.dataset.si === '1' })", 'p_entregado: true })'),
    (RON, 'tras marcar no se vuelve a pedir', '  await cargarEntregas()\n  pintarClasificacion()', '  pintarClasificacion()'),
    (RON, 'sin la tabla se pinta como si no hubiera nada dado',
     "  entregasPremios = error ? null : new Map((data || []).map((f) => [f.user_id, f.delivered_at]))",
     "  entregasPremios = new Map((data || []).map((f) => [f.user_id, f.delivered_at]))"),
    (RON, 'se pregunta por los dados aunque no haya premios',
     "if (entregasPremios === undefined && ctx.torneo.status === 'finished' && premiosDeTorneo(ctx.torneo).length) await cargarEntregas()",
     "if (entregasPremios === undefined) await cargarEntregas()"),
    (RON, 'la fila del que mira no se marca', "    return `<li class=\"${id === miId() ? 'torneo-fila-yo' : ''}\">", '    return `<li class="">'),
    (SQL, 'cualquiera con cuenta marca premios', '  if not public.torneos_mando(p_torneo) then', '  if false then'),
    (SQL, 'se marca con el torneo en juego', "  if not exists (select 1 from public.tournaments t where t.id = p_torneo and t.status = 'finished') then",
     "  if not exists (select 1 from public.tournaments t where t.id = p_torneo) then"),
    (SQL, 'se marca a quien no jugó', '  if not exists (select 1 from public.tournament_registrations r where r.tournament_id = p_torneo and r.user_id = p_usuario) then', '  if false then'),
    (SQL, 'se puede escribir en la tabla a mano', 'grant select on public.tournament_prize_deliveries to anon, authenticated;', 'grant select, insert, delete on public.tournament_prize_deliveries to anon, authenticated;'),
    (SQL, 'la de un torneo privado la ve cualquiera', '  using (exists (select 1 from public.tournaments t where t.id = tournament_id));', '  using (true);'),
    (SQL, 'desmarcar no quita nada', '    delete from public.tournament_prize_deliveries where tournament_id = p_torneo and user_id = p_usuario;', '    null;'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-516.mjs')
