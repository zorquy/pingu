// Scrydex: emparejar su catálogo con el nuestro, y no tragarse un relleno.
//
// Todo lo PURO de la integración. Sin red y sin base: se prueba en Node con
// respuestas guardadas. Lo que sí pide cosas vive en la función programada.
//
// ── POR QUÉ NO SE EMPAREJA POR IDENTIFICADOR ──
//
// Porque el suyo no se deriva del nuestro. Lo midió la sesión de COWORK con
// cuatro cartas de control, y tres de las cuatro siguen una regla y la
// cuarta no:
//
//   SM1M-001  → sm1m_ja-1     (minúsculas + `_ja`)
//   M4-001    → m4_ja-1       (igual)
//   SM12a-001 → sm12a_ja-1    (igual)
//   S8b-001   → swsh8b_ja-1   ← OTRO ESQUEMA
//
// La era Espada y Escudo la nombran con el prefijo INGLÉS (`swsh`) donde
// TCGdex usa el JAPONÉS (`S`). O sea que «minúsculas + _ja» acierta en la
// mayoría y falla en una era entera — que es la peor clase de regla: la que
// funciona lo bastante para que te la creas.
//
// Y una tabla de equivalencias a mano se queda vieja el día que salga un
// set (la lección de la 323, las megas de `FORMAS_TCG`). Así que esto
// empareja por HECHOS que no dependen de cómo llame nadie a las cosas: la
// FECHA de salida y CUÁNTAS cartas tiene. Dos sets del mismo catálogo que
// salgan el mismo día con el mismo número de cartas no existen; y si
// existieran, esto lo llama AMBIGUO y no elige — que es lo contrario de
// adivinar.

// ── El relleno de su servidor de imágenes ──
//
// `images.scrydex.com` devuelve **200 con una imagen de relleno** para
// cualquier identificador que no exista. O sea que un HEAD no prueba nada:
// preguntar «¿existe?» te dice que sí SIEMPRE.
//
// Sin esto, el relleno entraría en la base como si fuera un escaneo bueno y
// la pantalla saldría llena de la misma imagen gris repetida quince mil
// veces, sin un solo error en ninguna parte. Es el fallo favorito de esta
// casa: el que no avisa.
//
// Las huellas son el SHA-1 de los PRIMEROS 1.500 BYTES del fichero, medidas
// por COWORK el 2026-10-03. Se comparan los primeros bytes y no el fichero
// entero porque basta para distinguirlos y evita descargar la imagen.
export const HUELLAS_DE_RELLENO = {
  carta: 'ce9ae950ca',
  logo: '5422192d31',
}

// ¿Lo que ha contestado su servidor es el relleno?
//
// Se compara por PREFIJO para no atarse a cuántos caracteres de SHA-1
// apuntó quien lo midió. Un `huella` más corto que la nuestra no se da por
// bueno: eso sería decir «no es relleno» por no tener con qué comparar.
export function esRelleno(huella, tipo = 'carta') {
  const conocida = HUELLAS_DE_RELLENO[tipo]
  if (!conocida) return false
  const h = String(huella || '').toLowerCase()
  if (h.length < conocida.length) return false
  return h.startsWith(conocida)
}

// Normaliza un nombre de set para compararlo: sin tildes, sin signos y en
// minúsculas. Vale para desempatar, NUNCA para emparejar solo — los nombres
// de un set japonés y su versión inglesa no se parecen en nada.
export function clave(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

const fecha = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : null)
const entero = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null)

// La huella de un set: su fecha y cuántas cartas tiene. Es lo único que
// las dos partes dicen igual.
//
// La cuenta se toma de `card_count_official` y, si no, de la total: un
// catálogo cuenta las secretas y el otro puede que no, así que se guardan
// las DOS y vale que coincida cualquiera (ver `casan`).
export function huellaDeSet(set, campos = {}) {
  const f = fecha(set?.[campos.fecha || 'release_date'])
  const oficial = entero(set?.[campos.oficial || 'card_count_official'])
  const total = entero(set?.[campos.total || 'card_count_total'])
  return { fecha: f, oficial, total, nombre: clave(set?.[campos.nombre || 'name']) }
}

// Dos huellas casan si comparten la fecha Y alguna de las dos cuentas.
//
// La fecha sola no basta: en Japón salen tres o cuatro sets el mismo día
// —un set y sus dos mazos de ejemplo— y emparejar por fecha a secas los
// mezclaría. La cuenta sola tampoco: hay decenas de sets de 30 cartas.
export function casan(a, b) {
  if (!a?.fecha || !b?.fecha || a.fecha !== b.fecha) return false
  const cuentas = [a.oficial, a.total].filter(Boolean)
  const suyas = [b.oficial, b.total].filter(Boolean)
  if (!cuentas.length || !suyas.length) return false
  return cuentas.some((n) => suyas.includes(n))
}

// ── El emparejamiento ──
//
// Devuelve TRES listas, y las tres importan:
//
//   · `pares`     — los que casan sin duda.
//   · `ambiguos`  — los nuestros a los que les casan DOS o más suyos. No se
//                   elige ninguno: elegir a ojo aquí es escribir el
//                   escaneo de otro set encima del bueno, y no daría error.
//   · `sueltos`   — los nuestros que no casan con nada. Son los que habrá
//                   que mirar a mano, y saber CUÁNTOS son es la medida de
//                   si esto funciona.
//
// El nombre solo entra para DESEMPATAR entre varios candidatos que ya casan
// por fecha y cuenta, y solo si uno de ellos gana claramente.
export function emparejarSets(nuestros, suyos, campos = {}) {
  const deEllos = (suyos || []).map((s) => ({ set: s, h: huellaDeSet(s, campos.suyos) }))
  const pares = []
  const ambiguos = []
  const sueltos = []
  const yaUsados = new Set()

  for (const nuestro of nuestros || []) {
    const h = huellaDeSet(nuestro, campos.nuestros)
    if (!h.fecha) {
      sueltos.push({ nuestro, porque: 'no tenemos su fecha de salida' })
      continue
    }
    const candidatos = deEllos.filter((c) => !yaUsados.has(c.set) && casan(h, c.h))
    if (candidatos.length === 1) {
      yaUsados.add(candidatos[0].set)
      pares.push({ nuestro, suyo: candidatos[0].set, por: 'fecha+cuenta' })
      continue
    }
    if (candidatos.length === 0) {
      sueltos.push({ nuestro, porque: 'ninguno suyo con esa fecha y esa cuenta' })
      continue
    }
    // Varios: solo se desempata si UNO tiene el mismo nombre normalizado.
    const porNombre = candidatos.filter((c) => c.h.nombre && c.h.nombre === h.nombre)
    if (porNombre.length === 1) {
      yaUsados.add(porNombre[0].set)
      pares.push({ nuestro, suyo: porNombre[0].set, por: 'fecha+cuenta+nombre' })
      continue
    }
    ambiguos.push({ nuestro, candidatos: candidatos.map((c) => c.set) })
  }
  return { pares, ambiguos, sueltos }
}
