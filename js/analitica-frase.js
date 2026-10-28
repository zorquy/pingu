// LA FRASE DEL RESUMEN (tanda 1066). «Esta semana han entrado 612 personas
// (+14 %), 1 de cada 3 desde la app…»: lo que el panel de Analítica pone
// arriba y lo que el lunes llega a la campanita del equipo. Puro y sin
// dependencias: lo importan /admin y la función de Netlify `lunes`, y se
// prueba en Node. `r` es lo que devuelve `admin_analitica_resumen`;
// `vuelven` (opcional) el % de quien volvió la última semana entera.

const NOMBRES_ACCION = {
  cartas: ['Se han añadido', 'cartas'],
  deseos: ['Se han apuntado', 'deseos'],
  retos: ['Se han jugado', 'retos'],
  foro: ['Se han escrito', 'mensajes en el foro'],
  guias: ['Se han terminado', 'guías y cursos'],
  partidas: ['Se han apuntado', 'partidas'],
}
const CORTOS = { cartas: 'las cartas', deseos: 'los deseos', retos: 'los retos', foro: 'el foro', guias: 'las guías', partidas: 'las partidas' }
export const ORDEN_ACCIONES = ['cartas', 'deseos', 'retos', 'foro', 'guias', 'partidas']

const miles = (n) => Number(n || 0).toLocaleString('es-ES', { useGrouping: 'always' })

// La variación en %, o null si antes no había nada (no es «+∞ %»).
export function variacion(ahora, antes) {
  const a = Number(ahora || 0)
  const b = Number(antes || 0)
  if (!b) return null
  return Math.round(((a - b) / b) * 100)
}
const conSigno = (p) => `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)} %`

// Un porcentaje de una parte (o null si no hay de dónde).
export const pct = (parte, todo) => (Number(todo) > 0 ? Math.round((Number(parte || 0) / Number(todo)) * 100) : null)

// «1 de cada 3»: con menos de un 5 % no se dice así (sería «1 de cada 40»).
export function unoDeCada(parte, todo) {
  const p = Number(parte || 0)
  const t = Number(todo || 0)
  if (!p || !t || p / t < 0.05) return null
  return Math.max(1, Math.round(t / p))
}

const cuando = (dias) => (dias === 7 ? 'Esta semana' : dias === 30 ? 'Este mes' : `En estos ${dias} días`)

// Devuelve la frase en trozos `{ texto, tono }` (tono: 'sube' | 'baja' |
// null) para que el panel pinte el color y el lunes la junte en texto plano.
export function trozosDeResumen(r, { vuelven = null } = {}) {
  if (!r) return []
  const t = []
  const dias = Number(r.dias) || 7
  const medido = Boolean(r.medido_desde)
  if (medido && r.personas) {
    const v = variacion(r.personas, r.personas_antes)
    t.push({ texto: `${cuando(dias)} han entrado ${miles(r.personas)} ${r.personas === 1 ? 'persona' : 'personas'}` })
    if (v != null) t.push({ texto: ` (${conSigno(v)})`, tono: v > 0 ? 'sube' : v < 0 ? 'baja' : null })
    const k = unoDeCada(r.personas_app, r.personas)
    t.push({ texto: k ? `, ${k === 1 ? 'casi todas' : `1 de cada ${k}`} desde la app.` : '.' })
  } else {
    const v = variacion(r.activos, r.activos_antes)
    t.push({ texto: `${cuando(dias)} han entrado ${miles(r.activos)} ${r.activos === 1 ? 'persona' : 'personas'} con cuenta` })
    if (v != null) t.push({ texto: ` (${conSigno(v)})`, tono: v > 0 ? 'sube' : v < 0 ? 'baja' : null })
    t.push({ texto: '.' })
  }
  if (vuelven != null) t.push({ texto: ` Vuelve el ${vuelven} % de quien tiene cuenta.` })
  // Lo que más ha subido y lo que más ha bajado de lo que hace la gente (con
  // al menos 10 cosas: un 2 → 4 no es «+100 %» que contar).
  const acc = r.acciones || {}
  const cambios = ORDEN_ACCIONES.map((k) => ({ k, n: Number(acc[k]?.n || 0), v: variacion(acc[k]?.n, acc[k]?.antes) }))
    .filter((x) => x.n >= 10 && x.v != null)
  const mejor = [...cambios].sort((a, b) => b.v - a.v)[0]
  const peor = [...cambios].sort((a, b) => a.v - b.v)[0]
  if (mejor) {
    const [verbo, que] = NOMBRES_ACCION[mejor.k]
    t.push({ texto: ` ${verbo} ${miles(mejor.n)} ${que} ` }, { texto: `(${conSigno(mejor.v)})`, tono: mejor.v > 0 ? 'sube' : mejor.v < 0 ? 'baja' : null })
    if (peor && peor.k !== mejor.k && peor.v < 0) {
      t.push({ texto: `; ${CORTOS[peor.k]} ${peor.k === 'foro' ? 'baja' : 'bajan'} ` }, { texto: `(${conSigno(peor.v)})`, tono: 'baja' })
    }
    t.push({ texto: '.' })
  }
  return t
}

export const fraseDeResumen = (r, opciones) => trozosDeResumen(r, opciones).map((x) => x.texto).join('')
