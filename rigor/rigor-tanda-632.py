"""Rigor de la tanda 632 — Mis partidas al mejor de tres, juego a juego.

Cada mutación rompe el ORIGEN: la cuenta del resultado, lo que se recorta,
la fila siguiente, lo que se guarda, la sonda de la migración, el formato
de una ronda, la lista, las estadísticas, la migración o el tamaño de los
botones."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

JU = 'js/partidas-juegos.js'
MP = 'js/mis-partidas.js'
MIG = 'supabase-migration-partidas-juegos.sql'
CSS = 'css/partidas.css'

MUTACIONES = [
    # ── Las cuentas ──
    (JU, 'un empate de juegos cuenta como victoria', "  return g > p ? 'win' : g < p ? 'loss' : 'draw'", "  return g >= p ? 'win' : 'loss'"),
    (JU, 'una partida decidida conserva el juego de más', "    if (formato === 'bo3' && decidida('bo3', out)) break\n", ""),
    (JU, 'la fila siguiente no sale', "Math.min(js.length + 1, MAX_JUEGOS.bo3)", "Math.min(js.length, MAX_JUEGOS.bo3)"),
    (JU, 'la salida se guarda aunque no se sepa ninguna', "    salida: js.some((j) => j.s) ? js.map((j) => j.s || '-').join('') : null,", "    salida: js.map((j) => j.s || '-').join(''),"),

    # ── La página ──
    (MP, 'se guarda sin resultado marcado', "  if (tipoElegido === 'normal' && !$('partidaResultado').value) {", "  if (false) {"),
    (MP, 'se da por hecha la migración', "  juegosEnBase = !sondaJuegos.error\n", "  juegosEnBase = true\n"),
    (MP, 'los juegos no se mandan a la base', "    ...(juegosEnBase ? (tipoElegido === 'normal' ? aColumnas(", "    ...(false ? (tipoElegido === 'normal' ? aColumnas("),
    (MP, 'una ronda abre al mejor de uno', "  return esRonda ? 'bo3' : 'bo1'\n", "  return 'bo1'\n"),
    (MP, 'quién empieza no se puede marcar antes del resultado', "  juegosElegidos = siguiente && !siguiente.r && siguiente.s &&", "  juegosElegidos = false &&"),
    (MP, 'el foco no salta al juego siguiente', "hechos.length > antes ? document.querySelector", "hechos.length > antes && false ? document.querySelector"),
    (MP, 'volver a tocar lo marcado no lo quita', "    if (js[i].r === boton.dataset.r) js.splice(i)\n", "    if (false) js.splice(i)\n"),
    (MP, 'editar abre siempre al mejor de uno', "  ponerJuegos(p.juegos?.length ? p.formato : 'bo1',", "  ponerJuegos('bo1',"),
    (MP, 'la lista no enseña los juegos', "${LETRA_RESULTADO[p.resultado] || '?'}</span>${juegosMiniHtml(p)}\n      <span class=\"subtext partidas-fila-donde\">", "${LETRA_RESULTADO[p.resultado] || '?'}</span>\n      <span class=\"subtext partidas-fila-donde\">"),
    (MP, 'las estadísticas no cuentan los juegos', "    ...datosDeJuegos(jugadas, dato),\n", ""),

    # ── La base y el dibujo ──
    (MIG, 'un Bo1 con dos juegos entra', " and (formato = 'bo3' or length(juegos) = 1)));", "));"),
    (CSS, 'los botones de V/D/E miden 36', ".partidas-juego-r {\n  min-width: 44px;\n  min-height: 44px;", ".partidas-juego-r {\n  min-width: 44px;\n  min-height: 36px;"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-632.mjs')
