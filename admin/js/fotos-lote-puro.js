// Las fotos de muchas cartas a la vez (961), sin DOM ni base: así se prueba
// en Node. PINGU: «es un poco tedioso tener que descargarme 60 imágenes y
// meterlas una a una».

// El número de una carta tal como se compara: en minúsculas y sin ceros
// delante de la parte numérica («004» → «4», «SH02» → «sh2», «TG01» → «tg1»).
export function numeroComparable(n) {
  const m = /^([a-z]*)0*(\d+)([a-z]?)$/i.exec(String(n ?? '').trim())
  return m ? `${m[1]}${m[2]}${m[3]}`.toLowerCase() : String(n ?? '').trim().toLowerCase()
}

// De qué carta es un fichero, por su nombre: «4.jpg», «004.png»,
// «Jolteon 4.webp», «jungle-4-64.jpg», «SH2.png» o el id entero de la carta.
// Se prueban los trozos que parecen un número de carta y gana el primero que
// casa con una carta del set; sin ninguno, «sin casar» (no se adivina).
export function cartaDeFichero(nombre, cartas) {
  const base = String(nombre || '').replace(/\.[a-z0-9]{2,5}$/i, '')
  const bajo = base.toLowerCase()
  const porId = (cartas || []).filter((c) => c.id && bajo.includes(String(c.id).toLowerCase()))
    .sort((a, b) => String(b.id).length - String(a.id).length)
  if (porId.length) return porId[0]
  const porNumero = new Map()
  for (const c of cartas || []) {
    const k = numeroComparable(c.local_id)
    porNumero.set(k, porNumero.has(k) ? null : c) // dos con el mismo número: no se sabe
  }
  // «4-64» o «4_de_64»: el primero es el número de la carta, el segundo la
  // cuenta del set; por eso van en orden y no del último al primero.
  for (const trozo of base.match(/[a-z]{0,4}\d+[a-z]?/gi) || []) {
    const c = porNumero.get(numeroComparable(trozo))
    if (c) return c
  }
  return null
}

// Cada fichero con su carta, o con por qué no: «sin casar» o «repetida» (dos
// ficheros para la misma carta: no se elige uno a ciegas).
export function casarFicheros(nombres, cartas) {
  const filas = (nombres || []).map((nombre) => ({ nombre, carta: cartaDeFichero(nombre, cartas) }))
  const cuenta = new Map()
  for (const f of filas) if (f.carta) cuenta.set(f.carta.id, (cuenta.get(f.carta.id) || 0) + 1)
  return filas.map((f) => ({ ...f, motivo: !f.carta ? 'sin casar' : cuenta.get(f.carta.id) > 1 ? 'repetida' : null }))
}

// Una dirección con el número dentro: {n} el número tal cual, {n2}/{n3} con
// ceros delante hasta dos o tres cifras, {id} el id de la carta y {set} el
// del set. Sin ningún hueco no vale: sería la misma foto para todas.
export const HUECOS = /\{(n|n2|n3|id|set)\}/
export function urlDePatron(patron, carta, setId = carta?.set_id) {
  const p = String(patron || '').trim()
  if (!/^https:\/\//i.test(p) || !HUECOS.test(p)) return null
  const n = String(carta?.local_id ?? '').trim()
  const relleno = (largo) => (/^\d+$/.test(n) ? n.padStart(largo, '0') : n)
  return p.replace(/\{n\}/g, encodeURIComponent(n)).replace(/\{n2\}/g, encodeURIComponent(relleno(2)))
    .replace(/\{n3\}/g, encodeURIComponent(relleno(3))).replace(/\{id\}/g, encodeURIComponent(carta?.id ?? ''))
    .replace(/\{set\}/g, encodeURIComponent(setId ?? ''))
}

// ¿Tiene ya foto puesta a mano? (una dirección entera en `image_path`, 885)
export const tieneFotoAMano = (c) => /^https?:\/\//i.test(String(c?.image_path || ''))
