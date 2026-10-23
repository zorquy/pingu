// Los retos diarios y lo que da cada uno (tanda 835). PURO: lo importan el
// menú de /retos, cada juego (para decir «ahora vale +40 XP») y la prueba
// que comprueba que esto y `retos_xp` de la base dicen lo mismo — la XP que
// cuenta la calcula la BASE (supabase-migration-retos-xp.sql); esto es
// solo para enseñarla antes de jugar.

// Los seis, en el orden del menú. `juego` es la clave de `retos_resultados`.
// Desde la 989 el sexto es «Parejas» y «El reto de hoy» (el cuestionario,
// 'reto') ya no está: sus resultados viejos siguen en la base.
// `local` es dónde guarda el navegador la partida de hoy (se puede jugar sin
// cuenta): el menú lo lee para pintar «Hecho» también sin sesión.
export const RETOS = [
  { juego: 'carta', titulo: '¿Qué carta es?', ruta: '/carta-del-dia', arte: 'morado', icono: 'eye', texto: 'Una carta borrosa que se aclara con cada intento. Tienes seis.', chips: ['Hasta +50 XP', '6 intentos'], local: 'pokedoc-carta-del-dia' },
  { juego: 'caro', titulo: '¿Más caro o más barato?', ruta: '/mas-caro', arte: 'ambar', icono: 'coins', texto: 'Dos cartas con precio real de Cardmarket. ¿Cuál vale más?', chips: ['Hasta +30 XP', '5 rondas'], local: 'pokedoc-mas-caro' },
  { juego: 'silueta', titulo: '¿Quién es ese Pokémon?', ruta: '/quien-es', arte: 'cian', icono: 'sparkles', texto: 'La silueta de la tele, borrosa al principio: cada fallo la aclara. Elige entre cuatro.', chips: ['Hasta +30 XP', '3 intentos'], local: 'pokedoc-quien-es' },
  { juego: 'ordena', titulo: 'Ordena por precio', ruta: '/ordena-precio', arte: 'verde', icono: 'trendingUp', texto: 'Cuatro cartas: ponlas de la más barata a la más cara.', chips: ['Hasta +25 XP', '3 intentos'], local: 'pokedoc-ordena-precio' },
  { juego: 'expansion', titulo: '¿De qué expansión es?', ruta: '/que-expansion', arte: 'rosa', icono: 'layers', texto: 'Sale una carta: ¿de qué colección es? Para los que se saben las eras.', chips: ['Hasta +20 XP', '5 rondas'], local: 'pokedoc-que-expansion' },
  { juego: 'parejas', titulo: 'Parejas', ruta: '/parejas', arte: 'azul', icono: 'cards', texto: 'Doce cartas boca abajo: encuentra las seis parejas en los menos movimientos.', chips: ['Hasta +30 XP', '6 parejas'], local: 'pokedoc-parejas' },
]

// Los que hacen falta para el «día perfecto» (los seis) y su premio.
export const XP_DIA_PERFECTO = 25
export const XP_RACHA_SEMANA = 50

// Parejas (989): con los mínimos (6) o uno de más, +30; hasta 10, +20;
// hasta 14, +10; y +5 si tardas más. Siempre se acaba.
export const PAREJAS = 6
export function xpDeMovimientos(m) {
  const n = Number(m) || 0
  if (n <= PAREJAS + 1) return 30
  if (n <= 10) return 20
  if (n <= 14) return 10
  return 5
}

const XP_CARTA = { 1: 50, 2: 45, 3: 40, 4: 30, 5: 20, 6: 15 }
// 991: el primer intento va borroso y vale más.
const XP_SILUETA = { 1: 30, 2: 20, 3: 10 }
const XP_ORDENA = { 1: 25, 2: 15, 3: 8 }

// Lo que da un resultado. `r` = { aciertos, total, intentos, acertada, tira }.
export function xpDe(juego, r = {}) {
  const aciertos = Math.max(0, Number(r.aciertos) || 0)
  if (juego === 'reto') return 0
  if (juego === 'carta') return r.acertada ? XP_CARTA[r.intentos] ?? 15 : 5
  if (juego === 'caro') {
    if (!Array.isArray(r.tira)) return Math.min(30, aciertos * 3)
    let puntos = 0
    let racha = 0
    for (const bien of r.tira.slice(0, 5)) {
      if (bien) { racha++; puntos += racha >= 3 ? 6 : 3 } else racha = 0
    }
    if (r.tira.length === 5 && r.tira.every(Boolean)) puntos += 6
    return Math.min(30, puntos)
  }
  if (juego === 'silueta') return r.acertada ? XP_SILUETA[r.intentos] ?? 10 : 0
  if (juego === 'ordena') return r.acertada ? XP_ORDENA[r.intentos] ?? 8 : 2
  if (juego === 'expansion') return Math.min(5, aciertos) * 4
  // Parejas: `intentos` son los movimientos (989).
  if (juego === 'parejas') return xpDeMovimientos(r.intentos)
  return 0
}

// «Ahora vale +N XP»: lo que daría acertar en el intento que toca.
export const xpSiAciertasCarta = (intentosHechos) => XP_CARTA[intentosHechos + 1] ?? 0
export const xpSiAciertasSilueta = (intentosHechos) => XP_SILUETA[intentosHechos + 1] ?? 0
export const xpSiAciertasOrdena = (intentosHechos) => XP_ORDENA[intentosHechos + 1] ?? 0

// En «¿Más caro?», lo que vale el SIGUIENTE acierto con la racha que llevas.
export function xpDelSiguienteCaro(tira) {
  let racha = 0
  for (const bien of tira || []) racha = bien ? racha + 1 : 0
  return racha + 1 >= 3 ? 6 : 3
}

// La parte de la gente que lo ha hecho PEOR que tú (por aciertos), en %.
// null con menos de cinco jugadores: un «mejor que el 100 %» de dos
// personas no dice nada.
export function mejorQue(porAciertos, misAciertos) {
  const filas = Object.entries(porAciertos || {}).map(([a, n]) => [Number(a), Number(n)])
  const total = filas.reduce((t, [, n]) => t + n, 0)
  if (total < 5) return null
  const peor = filas.filter(([a]) => a < misAciertos).reduce((t, [, n]) => t + n, 0)
  return Math.round((peor / total) * 100)
}

// Cómo va hoy un juego según lo que guardó el navegador (se juega sin
// cuenta): { hecho, empezado, texto, xp } o null si hoy no se ha tocado.
// Lo usa el menú de /retos para pintar «Hecho» también sin sesión.
export function resumenLocal(juego, g, dia) {
  if (!g || g.dia !== dia) return null
  if (juego === 'carta') {
    const n = (g.intentos || []).length
    if (!n) return null
    const hecho = Boolean(g.acertada) || n >= 6
    return { hecho, empezado: true, texto: g.acertada ? `Acertada en ${n}` : hecho ? 'No acertada' : `${n} de 6 intentos`, xp: hecho ? xpDe('carta', { acertada: g.acertada, intentos: n }) : 0 }
  }
  if (juego === 'caro') {
    const r = g.respuestas || []
    if (!r.length) return null
    const hecho = r.length >= 5
    const a = r.filter(Boolean).length
    return { hecho, empezado: true, texto: hecho ? (a === 5 ? 'Perfecto' : `${a} de 5`) : `Ronda ${r.length + 1} de 5`, xp: hecho ? xpDe('caro', { tira: r }) : 0 }
  }
  if (juego === 'silueta') {
    const e = g.elegidos || []
    if (!e.length) return null
    const fallos = e.length - (g.acertada ? 1 : 0)
    const hecho = Boolean(g.acertada) || fallos >= 3
    return { hecho, empezado: true, texto: g.acertada ? (e.length === 1 ? 'A la primera' : `Acertado en ${e.length}`) : hecho ? 'No acertado' : `${e.length} de 3 intentos`, xp: hecho ? xpDe('silueta', { acertada: g.acertada, intentos: e.length }) : 0 }
  }
  if (juego === 'ordena') {
    const n = (g.intentos || []).length
    if (!n) return null
    const hecho = Boolean(g.acertada) || n >= 3
    return { hecho, empezado: true, texto: g.acertada ? `Ordenadas en ${n}` : hecho ? 'No ordenadas' : `${n} de 3 intentos`, xp: hecho ? xpDe('ordena', { acertada: g.acertada, intentos: n }) : 0 }
  }
  if (juego === 'parejas') {
    const m = Number(g.movimientos) || 0
    if (!m) return null
    const hecho = (g.hechas || []).length >= PAREJAS
    return { hecho, empezado: true, texto: hecho ? `${m} movimientos` : `${(g.hechas || []).length} de ${PAREJAS} parejas`, xp: hecho ? xpDeMovimientos(m) : 0 }
  }
  if (juego === 'expansion') {
    const e = g.elegidas || []
    if (!e.length) return null
    const hecho = e.length >= 5
    const a = (g.tira || []).filter(Boolean).length
    return { hecho, empezado: true, texto: hecho ? (a === 5 ? 'Perfecto' : `${a} de 5`) : `Carta ${e.length + 1} de 5`, xp: hecho ? xpDe('expansion', { aciertos: a }) : 0 }
  }
  return null
}

// Del resultado de la base (`retos_mis_numeros().hoy[juego]`) al mismo resumen.
export function resumenDeBase(juego, h) {
  if (!h) return null
  const t = { carta: h.acertada ? `Acertada en ${h.intentos}` : 'No acertada', caro: h.aciertos === 5 ? 'Perfecto' : `${h.aciertos} de 5`, silueta: h.acertada ? (h.intentos === 1 ? 'A la primera' : `Acertado en ${h.intentos}`) : 'No acertado', ordena: h.acertada ? `Ordenadas en ${h.intentos}` : 'No ordenadas', expansion: h.aciertos === 5 ? 'Perfecto' : `${h.aciertos} de 5`, reto: `${h.aciertos} de ${h.total}`, parejas: `${h.intentos} movimientos` }
  return { hecho: true, empezado: true, texto: t[juego] || 'Hecho', xp: h.xp || 0 }
}
