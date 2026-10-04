"""Rigor de la tanda 521 — «¿Qué jugarías?» sacado de una repetición.

Lo que se rompe aquí no da error: la solución que se lee antes de contestar,
la mesa que enseña lo que viene después, una buena que no es la que marcó
quien lo hizo, o una estadística que se puede cambiar sabiendo la respuesta.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

REP = 'js/repeticiones.js'
DAT = 'js/repeticiones/datos.js'
CSS = 'css/repeticiones.css'
SQL = 'supabase-migration-repeticiones-puzles.sql'

MUTACIONES = [
    # Hacerlo
    (REP, 'las vacías no se quitan', '  const opciones = campos.filter(Boolean)\n', '  const opciones = campos\n'),
    (REP, 'la buena se cuenta con los huecos', '  const correcta = campos.slice(0, buena).filter(Boolean).length', '  const correcta = buena'),
    (REP, 'con una sola opción se deja crear', "  if (opciones.length < 2) return estadoDialogo(", '  if (false) return estadoDialogo('),
    (REP, 'una buena vacía se deja crear', '  if (!campos[buena]) return estadoDialogo(', '  if (false) return estadoDialogo('),
    (REP, 'se hace de otra jugada', '    const id = await datos.crearPuzle({ repeticion: R.origen.id, foto: R.i,', '    const id = await datos.crearPuzle({ repeticion: R.origen.id, foto: 0,'),
    (REP, 'de una sin guardar se deja hacer', '  if (!R.origen?.mia) {\n    abrirDialogo(\n      \'Hacer un puzle de esta jugada\'', "  if (false) {\n    abrirDialogo(\n      'Hacer un puzle de esta jugada'"),
    (REP, 'el botón sale en una ajena', "  if (puzle) puzle.classList.toggle('hidden', !puedeAnotar() || !sePuedeJugarDesde(", "  if (puzle) puzle.classList.toggle('hidden', !sePuedeJugarDesde("),
    # Resolverlo
    (REP, 'abre en otra jugada', '  ir(Math.min(puzle.foto, R.fotos.length - 1), { anunciar: false })\n', ''),
    (REP, 'se ve lo que viene después', "  document.documentElement.classList.add('rep-puzle')\n", ''),
    (REP, 'las teclas lo adelantan', '    if (P.activo) return\n    if (e.key', '    if (e.key'),
    (REP, 'el acierto sale al revés', '  const acierto = solucion.elegida === solucion.correcta', '  const acierto = solucion.elegida !== solucion.correcta'),
    (REP, 'la buena que se dice es la tuya', '`No: la buena era «${escapeHtml(pz.opciones[solucion.correcta])}».`', '`No: la buena era «${escapeHtml(pz.opciones[solucion.elegida])}».`'),
    (REP, 'el recuento no es un porcentaje', '    const pctDe = total ? Math.round((n / total) * 100) : 0', '    const pctDe = n'),
    (REP, 'se contesta otra opción', '    const r = await datos.responderPuzle(P.puzle.id, k)', '    const r = await datos.responderPuzle(P.puzle.id, 0)'),
    (REP, '«Ver cómo siguió» no devuelve la repetición', "function verComoSiguio() {\n  document.documentElement.classList.remove('rep-puzle')\n", 'function verComoSiguio() {\n'),
    (REP, 'un puzle que no existe abre algo', "  if (!puzle) return mostrarError('Este puzle no existe o ya no se comparte.')", '  if (!puzle) return'),
    (REP, '?puzle= no abre el puzle', "  if (q.get('puzle')) return abrirPuzle(q.get('puzle'))\n", ''),
    (REP, 'sin la migración sale la lista', "  if (!filas || !filas.length) return caja.classList.add('hidden')", "  if (filas && !filas.length) return caja.classList.add('hidden')"),
    (REP, 'la lista no enlaza al puzle', '<li class="rep-puzle-item"><a href="/repeticiones?puzle=${encodeURIComponent(f.id)}">', '<li class="rep-puzle-item"><a href="/repeticiones?r=${encodeURIComponent(f.id)}">'),
    (DAT, 'se pide la solución con el puzle', ".from('replay_puzzles').select('id,replay_id,foto,pregunta,opciones')", ".from('replay_puzzles').select('*')"),
    (CSS, 'el registro se ve durante el puzle', '.rep-puzle .rep-registro,\n', ''),
    (CSS, 'la cabecera se ve durante el puzle', '.rep-puzle .rep-prob,\n.rep-puzle .rep-cab-botones {', '.rep-puzle .rep-prob {'),
    # La base
    (SQL, 'la buena se lee de la tabla', 'grant select (id, replay_id, user_id, foto, pregunta, opciones, created_at)', 'grant select (id, replay_id, user_id, foto, pregunta, opciones, correcta, explicacion, created_at)'),
    (SQL, 'cualquiera hace puzles de una ajena', '  if not exists (select 1 from public.replays r where r.id = p_repeticion and r.user_id = auth.uid()) then', '  if not exists (select 1 from public.replays r where r.id = p_repeticion) then'),
    (SQL, 'contestar otra vez cambia lo apuntado', '    on conflict (puzzle_id, user_id) do nothing;', '    on conflict (puzzle_id, user_id) do update set opcion = excluded.opcion;'),
    (SQL, 'se ve aunque ya no se comparta', '  using (user_id = auth.uid() or public.repeticion_compartida(replay_id));', '  using (true);'),
    (SQL, 'se contesta aunque ya no se comparta', '    and (pz.user_id = auth.uid() or exists (select 1 from public.replays r where r.id = pz.replay_id and r.compartida));', '    ;'),
    (SQL, 'hacer un puzle no comparte la repetición', '  update public.replays set compartida = true where id = p_repeticion;\n', ''),
    (SQL, 'la lista enseña los que ya no se comparten', '  join public.replays r on r.id = pz.replay_id and r.compartida', '  join public.replays r on r.id = pz.replay_id'),
    (SQL, 'una opción que no existe se apunta', '  if p_opcion is null or p_opcion < 0 or p_opcion >= cardinality(v.opciones) then', '  if p_opcion is null then'),
    (SQL, 'las vacías cuentan como opción', "  where btrim(coalesce(o, '')) <> '';", '  where true;'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-521.mjs')
