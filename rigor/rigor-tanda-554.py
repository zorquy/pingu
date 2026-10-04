"""Rigor de la tanda 554 — «¿Cómo encuentro esta carta?».

Lo que se rompe aquí no da error: una cifra que mira el orden de verdad
del mazo (trampa), un reparto que mete en los premios lo que sabes que está
en el mazo, una partida que se queda con el estado de un reparto, o un
«100 %» que puede fallar.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

CAM = 'js/constructor/caminos.js'
HTM = 'js/constructor/caminos-html.js'
LAB = 'js/constructor/laboratorio.js'
REP = 'js/repeticiones.js'

MUTACIONES = [
    # El reparto de lo que no sabes
    (CAM, 'el reparto no toca los premios', '  huecosPremio.forEach((i, j) => (s.premios[i] = bolsa[sinConf.length + j]))\n', ''),
    (CAM, 'lo de arriba se baraja también', '  const t = Math.min(k.arriba, D)\n', '  const t = 0\n'),
    (CAM, 'lo confirmado puede caer en premios', '  const conf = medio.filter((u) => k.confirmados[u])\n  const sinConf = medio.filter((u) => !k.confirmados[u])\n', '  const conf = []\n  const sinConf = medio\n'),
    (CAM, 'usa el orden de verdad (trampa)', '  for (let i = 0; i < muestras; i++) raices.push({ s: repartoDeLoQueNoSabes(real.s, azar), op: real.op, m: mRaiz })', '  for (let i = 0; i < muestras; i++) raices.push({ s: structuredClone(real.s), op: real.op, m: mRaiz })'),
    # Lo que se puede hacer
    (CAM, 'no cuentan las habilidades al bajar', "      if (def.cuando === 'bajar' && esBasicoEnJuego(c) && p.huecosBanca > 0) {", '      if (false) {'),
    (CAM, 'no cuentan las habilidades con botón', '    if (!def || def.cuando || def.pasiva) continue\n', '    continue\n'),
    (CAM, 'sin puentes', '  const directas = await probarPuentes(objetivo, 1)', '  const directas = []'),
    (CAM, 'dos partidarios en un camino', '        if (p.s.estricta && accion.partidario && nodo.pasos.some((x) => x.partidario)) continue\n', ''),
    (CAM, 'los peores no se marcan', '    dominado: ordenados.some((q) => q !== c && q.pasos.length < c.pasos.length && q.p >= c.p - 0.005),', '    dominado: false,'),
    # Dejar la partida como estaba
    (CAM, 'la partida se queda con un reparto', '    } finally {\n      ponerFoto(p, real, { copiar: false })\n    }\n    return { pasos: [...nodo.pasos, accion]', '    } finally {\n    }\n    return { pasos: [...nodo.pasos, accion]'),
    (CAM, 'con mesa, el otro se queda tocado', '  if (p.oponente && f.op) p.oponente.s = copiar ? structuredClone(f.op) : f.op\n', ''),
    # Cómo se enseña
    (HTM, '«100 %» aunque pueda fallar', "  if (x >= 1 && !puedeFallar) return '100 %'", "  if (x >= 1) return '100 %'"),
    (HTM, 'el «si la tienes» no sale', '  const si = paso.siempre ? \'\' :', "  const si = true ? '' :"),
    (HTM, 'bajar a la banca no se dice', "paso.tipo === 'banca' ? `Bajar ${n} (${h})`", "paso.tipo === 'banca' ? n"),
    # El laboratorio
    (LAB, 'con la mesa cambiada se enseña lo viejo', '  else if (c.resultado && c.de === p && c.firma === firmaDeMesa(p)) resultado = resultadoDeCaminosHtml(c.resultado, c.nombre)', '  else if (c.resultado) resultado = resultadoDeCaminosHtml(c.resultado, c.nombre)'),
    (LAB, 'la pestaña no está', "${tab('caminos', 'Encontrar')}", ''),
    # Las repeticiones
    (REP, 'se calcula con la mano sin ver', '  if (!manoEnteraDe(f, quien)) {', '  if (false) {'),
    (REP, 'el botón no se apaga en la preparación', '    caminos.disabled = !se\n', ''),
    (REP, 'se ofrece la «Carta sin ver»', "      if (e.carta?.id === 'sin-ver') continue\n", ''),
    (REP, 'sin su lista no se avisa', '    const sinLista = R.lista?.jugador !== quien', '    const sinLista = false'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-554.mjs')
