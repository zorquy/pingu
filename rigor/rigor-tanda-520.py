"""Rigor de la tanda 520 — publicar una repetición como partida de ejemplo.

Lo que se rompe aquí no da error: el nombre de verdad de un rival que no ha
dicho que quiera salir en una galería, una partida que sale en la ficha de
otro mazo, o una lista que enseña las que su dueño ya hizo privadas.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

AN = 'js/repeticiones/anonimizar.js'
REP = 'js/repeticiones.js'
MM = 'js/meta-mazo.js'
MD = 'js/meta/datos.js'
SQL = 'supabase-migration-repeticiones-galeria.sql'

MUTACIONES = [
    # Los nombres
    (AN, 'el nombre se cambia dentro de otra palabra',
     "const palabra = (nombre) => new RegExp(`(?<![\\\\p{L}\\\\p{N}_])${esc(nombre)}(?![\\\\p{L}\\\\p{N}_])`, 'gu')",
     "const palabra = (nombre) => new RegExp(esc(nombre), 'gu')"),
    (AN, 'Rojo y Azul se pisan al cruzarse',
     "  orden.forEach((n, k) => (out = out.replace(palabra(n), `\\u0000${k}\\u0000`)))\n  orden.forEach((_, k) => (out = out.split(`\\u0000${k}\\u0000`).join(NOMBRES_DE_EJEMPLO[k])))",
     "  orden.forEach((n, k) => (out = out.replace(palabra(n), NOMBRES_DE_EJEMPLO[k])))"),
    (AN, 'quien la copió no es Rojo', '  const orden = primero === b ? [b, a] : [a, b]', '  const orden = [a, b]'),
    (AN, 'un nombre que es una carta se cambia igual', '  if (choca) return {', '  if (false) return {'),
    (AN, 'no se comprueba leyéndolo', "    return { error: 'Con los nombres cambiados el registro ya no se lee igual: no se puede publicar así.' }\n", ''),
    # Publicar desde /repeticiones
    (REP, 'con la casilla marcada se publica el registro de verdad', '      registro: anonima ? p.anon.texto : R.texto,', '      registro: R.texto,'),
    (REP, 'los jugadores se guardan con su nombre de verdad', '      jugadores: orden.map(nombre),', '      jugadores: orden,'),
    (REP, 'el ganador se guarda con su nombre de verdad', '      ganador: ganador ? nombre(ganador) : null,', '      ganador: ganador || null,'),
    (REP, 'la copia no se comparte', '      turnos: R.turnos.length,\n      compartida: true,\n      mazos,', '      turnos: R.turnos.length,\n      compartida: false,\n      mazos,'),
    (REP, 'se publica sin sus mazos del meta', '    await datos.publicar(fila.id, true, p.ids)', '    await datos.publicar(fila.id, true, null)'),
    (REP, 'un mazo deducido cuenta como del meta', '  const delMeta = arqs.filter((a) => a?.id)', '  const delMeta = arqs.filter(Boolean)'),
    (REP, 'la casilla se marca aunque no se puedan cambiar', "<input type=\"checkbox\" id=\"repPublicarAnonima\"${anon.error ? ' disabled' : ' checked'} />", '<input type="checkbox" id="repPublicarAnonima" checked />'),
    (REP, '«Quitar de la galería» no la quita', '      await datos.publicar(id, false)\n', '      await datos.publicar(id, true)\n'),
    (REP, '«Publicada» sale aunque ya no se comparta', '      ${r.publica && r.compartida ? `<span class="rep-chapa-compartida">', '      ${r.publica ? `<span class="rep-chapa-compartida">'),
    (REP, 'sin la migración se guarda la copia igual', '  if (!(await datos.galeriaPuesta())) {', '  if (false) {'),
    ('js/repeticiones/datos.js', 'la galería siempre parece puesta', '  return !(error && migracionVieja(error))\n}', '  return true\n}'),
    (REP, 'sin cuenta se abre la ventana igual', "  if (!R.sesion) {\n    abrirDialogo('Publicar como partida de ejemplo'", "  if (false) {\n    abrirDialogo('Publicar como partida de ejemplo'"),
    # La ficha del mazo en /meta
    (MM, 'gana el nombre del jugador y no su mazo', '      const gana = f.ganador && f.ganador === f.jugador_a ? a : f.ganador && f.ganador === f.jugador_b ? b : null', '      const gana = f.ganador || null'),
    (MM, 'sin la migración sale la sección', '  if (!filas) return\n', "  if (!filas) return void $('mmPartidas').classList.remove('hidden')\n"),
    (MM, 'el vacío no se dice', "  $('mmPartidasVacio').classList.toggle('hidden', filas.length > 0)", "  $('mmPartidasVacio').classList.toggle('hidden', true)"),
    (MM, 'los turnos no salen', "f.turnos != null ? `${f.turnos} ${f.turnos === 1 ? 'turno' : 'turnos'}` : ''", "''"),
    (MM, 'no se piden', '  await pintarPartidas()\n', ''),
    (MD, 'sin la migración se pinta vacía', '  if (error) return null\n  return data || []\n}', '  if (error) return []\n  return data || []\n}'),
    # La base
    (SQL, 'publicar no la deja compartida', '     set publica = true, compartida = true, arquetipos', '     set publica = true, arquetipos'),
    (SQL, 'la lista enseña las que ya no se comparten', '  where r.publica and r.compartida and r.arquetipos @> array[p_arquetipo]', '  where r.publica and r.arquetipos @> array[p_arquetipo]'),
    (SQL, 'otro publica la tuya', "  if v_dueno <> auth.uid() then\n    raise exception 'Solo quien la guardó puede publicarla.'", "  if false then\n    raise exception 'Solo quien la guardó puede publicarla.'"),
    (SQL, 'cualquiera la quita', "    if v_dueno <> auth.uid() and not exists", "    if false and not exists"),
    (SQL, 'el tope cuenta dos veces la que ya está', 'and publica and compartida and id <> p_id) >= 30', 'and publica and compartida) >= 30'),
    (SQL, 'volver a publicarla le cambia la fecha', 'publicada_at = coalesce(publicada_at, now())', 'publicada_at = now()'),
    (SQL, 'la lista devuelve la más vieja primero', '  order by r.publicada_at desc nulls last', '  order by r.publicada_at asc nulls last'),
    (SQL, 'el tope de la lista no se respeta', '  limit least(greatest(coalesce(p_limite, 12), 1), 50)', '  limit 50'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-520.mjs')
