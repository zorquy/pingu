// Importar una colección desde un CSV (tanda 580).
//
// Quien ya tiene dos mil cartas apuntadas en Dex, en Collectr o en una
// hoja de cálculo no las va a meter a mano: ESA es la barrera de entrada
// de /mi-coleccion, más que cualquier botón. Y cada app exporta a su
// manera —columnas con otro nombre, otro orden, «Near Mint» donde
// nosotros decimos NM, «025/198» donde nosotros guardamos «25»—, así que
// esto no lee «el formato de Dex»: lee UN CSV cualquiera y reconoce cada
// columna por su nombre, con todos los sinónimos que se han visto.
//
// ── LO QUE HACE FALTA PARA ENCONTRAR UNA CARTA ──
//
// La EXPANSIÓN y el NÚMERO. El nombre solo confirma: hay cuarenta
// Pikachus y «Pikachu» a secas no es una carta. La expansión se admite
// de tres maneras, porque cada app da una: el código de TCG Live («SVI»,
// «PAF»), nuestro id («sv1», «sv4pt5») o el nombre («Paldea Evolved»,
// con o sin «Scarlet & Violet:» delante). Si el fichero trae un id de
// TCGdex («sv8-1»), gana sobre todo lo demás.
//
// ── NADA SE ADIVINA A MEDIAS ──
//
// Una fila que no se encuentra no se mete «parecida»: se devuelve con su
// motivo y se enseña antes de guardar nada. Es la lección de la 505: un
// nombre que coincide confirma; uno que no coincide no concluye nada.
//
// Sin DOM y sin Supabase: `emparejar` recibe los sets y una función que
// trae las cartas de uno, así que se prueba en Node con listas a mano.
import { normalizeSearch } from '../texto.js'
import { nombreDeCarta } from '../catalogo-series.js'
import { CASAS } from './gradeo.js'

// ── 1. Leer el CSV ──

// Con qué se separa: la coma de todo el mundo, el punto y coma del Excel
// en español, el tabulador de un «pegar desde la hoja». Se decide por la
// PRIMERA línea, contando cuál aparece más fuera de comillas.
export function separadorDe(texto) {
  const primera = String(texto || '').split(/\r?\n/, 1)[0] || ''
  let mejor = ','
  let cuenta = -1
  for (const sep of [',', ';', '\t']) {
    let n = 0
    let dentro = false
    for (const ch of primera) {
      if (ch === '"') dentro = !dentro
      else if (ch === sep && !dentro) n++
    }
    if (n > cuenta) [mejor, cuenta] = [sep, n]
  }
  return mejor
}

// Un CSV a filas de celdas. Entiende comillas (y la comilla doblada que
// escapa otra), saltos de línea dentro de una celda, CRLF y el BOM que
// Excel pone delante. Las filas vacías se saltan.
export function leerCsv(texto, sep = separadorDe(texto)) {
  const s = String(texto || '').replace(/^﻿/, '')
  const filas = []
  let fila = []
  let celda = ''
  let dentro = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (dentro) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          celda += '"'
          i++
        } else dentro = false
      } else celda += ch
    } else if (ch === '"') dentro = true
    else if (ch === sep) {
      fila.push(celda)
      celda = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      fila.push(celda)
      if (fila.some((c) => c.trim() !== '')) filas.push(fila)
      fila = []
      celda = ''
    } else celda += ch
  }
  fila.push(celda)
  if (fila.some((c) => c.trim() !== '')) filas.push(fila)
  return filas.map((f) => f.map((c) => c.trim()))
}

// ── 2. Reconocer las columnas ──

// Cada campo nuestro y los nombres con los que lo llaman las demás apps,
// ya plegados (minúsculas, sin tildes). El orden importa: cuando dos
// nombres de columna casan con el mismo campo se queda el primero que
// aparezca en el fichero.
const SINONIMOS = {
  id: ['tcgdex_id', 'tcgdex id', 'card_id', 'card id', 'id', 'id carta', 'identificador'],
  nombre: ['name', 'card name', 'card_name', 'card', 'carta', 'nombre', 'pokemon', 'pokémon'],
  set: ['set', 'set name', 'set_name', 'expansion', 'expansión', 'expansion name', 'coleccion', 'colección', 'edition'],
  codigo: ['set code', 'set_code', 'set id', 'set_id', 'code', 'codigo', 'código', 'ptcgo code', 'ptcgl code', 'abbreviation', 'abbr', 'set abbreviation', 'expansion code'],
  numero: ['number', 'card number', 'card_number', 'collector number', 'collector_number', 'no', 'no.', '#', 'num', 'numero', 'número', 'card no', 'card no.'],
  cantidad: ['quantity', 'qty', 'count', 'amount', 'cantidad', 'copias', 'copies', 'owned'],
  estado: ['condition', 'cond', 'estado', 'state'],
  idioma: ['language', 'lang', 'idioma'],
  variante: ['variant', 'variante', 'finish', 'version', 'versión', 'printing', 'foil', 'type of print', 'edition type'],
  casa: ['grading company', 'grade company', 'grade_company', 'grading_company', 'company', 'casa', 'grader'],
  gradeo: ['grade', 'grade_value', 'grade value', 'grading', 'gradeo', 'graded', 'nota'],
  precioCompra: ['purchase price', 'purchase_price', 'price paid', 'paid', 'precio de compra', 'precio compra', 'precio_compra', 'lo que pagaste', 'lo que pagaste (€)', 'buy price', 'cost'],
  valor: ['tu valor', 'tu valor (€)', 'valor_manual', 'valor manual', 'my value', 'custom price', 'custom value'],
  notas: ['notes', 'note', 'notas', 'comment', 'comments', 'comentario'],
}

const plegar = (t) => normalizeSearch(t).replace(/\s+/g, ' ').trim()

// De una cabecera a {campo: índice}. Devuelve también qué app parece
// —solo para decirlo en pantalla— y qué columnas se quedan sin usar.
export function reconocerColumnas(cabecera) {
  const columnas = {}
  const plegadas = cabecera.map(plegar)
  for (const [campo, nombres] of Object.entries(SINONIMOS)) {
    const i = plegadas.findIndex((c, idx) => nombres.includes(c) && !Object.values(columnas).includes(idx))
    if (i >= 0) columnas[campo] = i
  }
  const tiene = (c) => plegadas.includes(c)
  const origen = tiene('id') && tiene('expansion') && tiene('tu valor (€)')
    ? 'PokeDoc'
    : tiene('grading company') && tiene('date added')
      ? 'Collectr'
      : tiene('tcgdex_id')
        ? 'TCG Vault'
        : tiene('price paid') || (tiene('set') && tiene('number') && tiene('variant'))
          ? 'Dex'
          : null
  const sinUsar = cabecera.filter((_, i) => !Object.values(columnas).includes(i))
  return { columnas, origen, sinUsar }
}

// Lo mínimo para encontrar una carta: el id, o la expansión (de cualquier
// manera) con el número.
export function faltanColumnas({ columnas }) {
  if (columnas.id !== undefined) return []
  const faltan = []
  if (columnas.set === undefined && columnas.codigo === undefined) faltan.push('la expansión (nombre o código)')
  if (columnas.numero === undefined) faltan.push('el número de la carta')
  return faltan
}

// ── 3. Traducir cada celda a lo nuestro ──

// Cardmarket contra el resto del mundo. Collectr y TCGplayer usan la
// escala americana (NM, LP, MP, HP, DMG) y Cardmarket la europea (MT, NM,
// EX, GD, LP, PL, PO); no son las mismas casillas, así que se traduce al
// escalón más parecido y nunca hacia arriba.
const ESTADOS = [
  [/^(mt|mint|m|gem mint|menta)$/, 'MT'],
  [/^(nm|near ?mint|nm\/m|nm-mt|casi nueva|nueva)$/, 'NM'],
  [/^(ex|excellent|excelente|lp|lightly played|light play|slightly played|sp)$/, 'EX'],
  [/^(gd|good|buena|mp|moderately played|moderate play)$/, 'GD'],
  [/^(light played|lightplayed|lplayed)$/, 'LP'],
  [/^(pl|played|jugada|hp|heavily played|heavy play)$/, 'PL'],
  [/^(po|poor|damaged|dmg|d|pobre|dañada|danada)$/, 'PO'],
]
export function estadoDe(texto, porDefecto = 'NM') {
  const t = plegar(texto)
  if (!t) return porDefecto
  for (const [re, id] of ESTADOS) if (re.test(t)) return id
  return porDefecto
}

const IDIOMAS = [
  [/^(es|esp|spa|spanish|espanol|español|castellano)$/, 'es'],
  [/^(en|eng|english|ingles|inglés|us|uk)$/, 'en'],
  [/^(fr|fra|french|frances|francés|francais|français)$/, 'fr'],
  [/^(de|deu|ger|german|aleman|alemán|deutsch)$/, 'de'],
  [/^(it|ita|italian|italiano)$/, 'it'],
  [/^(pt|por|portuguese|portugues|portugués|br|pt-br)$/, 'pt'],
  [/^(ja|jp|jpn|japanese|japones|japonés)$/, 'ja'],
]
export function idiomaDe(texto, porDefecto = 'es') {
  const t = plegar(texto)
  if (!t) return porDefecto
  for (const [re, id] of IDIOMAS) if (re.test(t)) return id
  return porDefecto
}

// Una versión que no se entiende es «normal», que es la que existe casi
// siempre (la 564). «Unlimited» y «Standard» son la normal con otro
// nombre; «Reverse Holofoil», «Holofoil» y «1st Edition» son las otras.
export function varianteDe(texto) {
  const t = plegar(texto)
  if (/reverse|rev\b|rh\b|reverso/.test(t)) return 'reverse'
  if (/1st|first|primera/.test(t)) return 'primera'
  if (/holo|foil/.test(t)) return 'holo'
  return 'normal'
}

// «PSA 10», «CGC 9.5», o la casa y la nota por separado. Lo que no es una
// casa que conozcamos se guarda tal cual, recortado: es texto libre.
export function gradeoDe(casa, nota) {
  const c = String(casa || '').trim()
  const n = String(nota || '').trim()
  if (!c && !n) return null
  // Solo con casa: `startsWith('')` es verdad para todo, y «PSA 8» en una
  // sola celda saldría «PSA PSA 8».
  const conocida = c ? CASAS.find((x) => x.id.toLowerCase() === c.toLowerCase() || plegar(x.nombre).startsWith(plegar(c))) : null
  if (conocida && n) return `${conocida.id} ${n}`.slice(0, 20)
  // «PSA 10» en una sola celda, o solo una nota sin casa.
  return (c && n ? `${c} ${n}` : c || n).slice(0, 20) || null
}

// «1,50 €», «$3.20», «3,2» → 3.2. Vacío o raro → null.
export function dineroDe(texto) {
  const t = String(texto || '').replace(/[^\d.,-]/g, '')
  if (!t) return null
  // La coma como decimal si es el último separador («1.234,56» y «1,5»).
  const normal = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  const n = Number(normal)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

// El número impreso en la carta, tal cual, sin el «/198» de detrás.
export function numeroDe(texto) {
  return String(texto || '').trim().split('/')[0].trim()
}

// Para COMPARAR: minúsculas y sin ceros a la izquierda en cada tramo de
// dígitos, como `numeroComparable` de netlify/lib/scrydex.mjs — «025»,
// «25» y «TG01/TG30» tienen que casar con nuestro `local_id`.
export function numeroComparable(n) {
  const s = String(n ?? '').trim().toLowerCase()
  return s ? s.replace(/\d+/g, (d) => String(Number(d))) : ''
}

// De las filas leídas a entradas con nuestros nombres. `idiomaSiFalta` es
// lo que se elige en pantalla cuando el fichero no trae idioma: un CSV
// de Collectr no lo dice, y suponer «es» o «en» a ciegas apuntaría mal
// una colección entera.
export function entradasDe(filas, columnas, { idiomaSiFalta = 'es' } = {}) {
  const celda = (fila, campo) => (columnas[campo] === undefined ? '' : fila[columnas[campo]] || '')
  return filas.map((fila, i) => {
    const cantidad = Math.max(1, Math.min(999, Math.round(Number(celda(fila, 'cantidad')) || 1)))
    return {
      fila: i + 2, // la línea del fichero, con la cabecera en la 1
      id: celda(fila, 'id').trim() || null,
      nombre: celda(fila, 'nombre').trim(),
      set: celda(fila, 'set').trim(),
      codigo: celda(fila, 'codigo').trim(),
      numero: numeroDe(celda(fila, 'numero')),
      cantidad,
      estado: estadoDe(celda(fila, 'estado')),
      idioma: columnas.idioma === undefined ? idiomaSiFalta : idiomaDe(celda(fila, 'idioma'), idiomaSiFalta),
      variante: varianteDe(celda(fila, 'variante')),
      gradeo: gradeoDe(celda(fila, 'casa'), celda(fila, 'gradeo')),
      precio_compra: dineroDe(celda(fila, 'precioCompra')),
      valor_manual: dineroDe(celda(fila, 'valor')),
      notas: celda(fila, 'notas').trim().slice(0, 280) || null,
    }
  })
}

// ── 4. Encontrar la expansión y la carta ──

// Las maneras de nombrar un set, plegadas: el nombre entero, sin la serie
// de delante («Scarlet & Violet: Paldea Evolved» → «paldea evolved»), y
// con «&» y «and» intercambiados. Se devuelven todas para comparar
// cualquiera contra cualquiera.
export function clavesDeNombreDeSet(nombre) {
  const base = plegar(nombre).replace(/\s*[—–-]\s*/g, ' - ')
  if (!base) return []
  const claves = new Set([base])
  const sinSerie = base.split(/:\s*|\s-\s/).pop().trim()
  if (sinSerie) claves.add(sinSerie)
  for (const k of [...claves]) {
    claves.add(k.replace(/&/g, 'and'))
    claves.add(k.replace(/\band\b/g, '&'))
  }
  return [...claves].map((k) => k.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

// Un índice de los sets por código, por id y por cada clave de nombre,
// para resolver mil filas sin recorrer doscientos sets mil veces.
export function indiceDeSets(sets) {
  const porCodigo = new Map()
  const porId = new Map()
  const porNombre = new Map()
  for (const s of sets || []) {
    if (s.tcg_online_code) porCodigo.set(String(s.tcg_online_code).toUpperCase(), s)
    porId.set(String(s.id).toLowerCase(), s)
    for (const n of [s.name, s.name_en]) {
      for (const k of clavesDeNombreDeSet(n)) if (!porNombre.has(k)) porNombre.set(k, s)
    }
  }
  return { porCodigo, porId, porNombre }
}

export function setDeEntrada(entrada, indice) {
  const codigo = entrada.codigo
  if (codigo) {
    const s = indice.porCodigo.get(codigo.toUpperCase()) || indice.porId.get(codigo.toLowerCase())
    if (s) return s
  }
  for (const k of clavesDeNombreDeSet(entrada.set)) {
    const s = indice.porNombre.get(k)
    if (s) return s
  }
  // El código a veces viene EN la columna del set («PAL» en «Set»).
  if (entrada.set) {
    const s = indice.porCodigo.get(entrada.set.toUpperCase()) || indice.porId.get(entrada.set.toLowerCase())
    if (s) return s
  }
  return null
}

// Empareja cada entrada con una carta. `cartasDeSet(setId)` trae las de
// un set (se pide una vez por set); `cartaPorId(id)` resuelve un id de
// TCGdex. Devuelve las líneas listas para `anadirVarias` y las perdidas
// con su motivo, para enseñarlas antes de guardar.
export async function emparejar(entradas, { sets, cartasDeSet, cartaPorId = async () => null, mercado = 'WEST' }) {
  const indice = indiceDeSets(sets)
  const cache = new Map()
  const cartasDe = async (setId) => {
    if (!cache.has(setId)) cache.set(setId, await cartasDeSet(setId).catch(() => []))
    return cache.get(setId)
  }
  const listas = []
  const perdidas = []
  for (const e of entradas) {
    let carta = null
    let motivo = ''
    if (e.id) carta = await cartaPorId(e.id).catch(() => null)
    if (!carta) {
      const set = setDeEntrada(e, indice)
      if (!set) motivo = e.set || e.codigo ? `no conozco la expansión «${e.set || e.codigo}»` : 'sin expansión'
      else if (!e.numero) motivo = 'sin número'
      else {
        const quiero = numeroComparable(e.numero)
        const suyas = await cartasDe(set.id)
        carta = suyas.find((c) => numeroComparable(c.local_id) === quiero) || null
        if (!carta) motivo = `en ${set.name || set.id} no hay ninguna carta con el número ${e.numero}`
      }
    }
    if (!carta) {
      perdidas.push({ entrada: e, motivo })
      continue
    }
    // El nombre, si viene, solo AVISA: puede ser el mismo en otro idioma.
    const nombreCasa = !e.nombre || [carta.name, carta.name_es, carta.name_en].some((n) => n && plegar(n) === plegar(e.nombre))
    listas.push({
      entrada: e,
      carta,
      nombreCasa,
      linea: {
        card_id: carta.id,
        market: carta.market || mercado,
        idioma: e.idioma,
        estado: e.estado,
        variante: e.variante,
        cantidad: e.cantidad,
        gradeo: e.gradeo,
        valor_manual: e.valor_manual,
        precio_compra: e.precio_compra,
        notas: e.notas,
      },
    })
  }
  return { listas, perdidas }
}

// ── 5. Y al revés: exportar ──

const CABECERA_EXPORT = ['Id', 'Carta', 'Expansión', 'Código', 'Número', 'Idioma', 'Estado', 'Versión', 'Cantidad', 'Gradeo', 'Tu valor (€)', 'Lo que pagaste (€)', 'Notas']

function celdaCsv(v) {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Las líneas de la colección a un CSV que esta misma pantalla sabe volver
// a leer (el `Id` manda al importar). `cartaDe(linea)` da la carta de
// cada línea, con su set embebido.
export function exportarCsv(lineas, cartaDe) {
  const filas = [CABECERA_EXPORT]
  for (const l of lineas || []) {
    const c = cartaDe(l) || {}
    filas.push([
      l.card_id,
      nombreDeCarta(c) || '',
      c.tcg_sets?.name || c.tcg_sets?.name_en || c.set_id || '',
      c.tcg_sets?.tcg_online_code || '',
      c.local_id || '',
      l.idioma || '',
      l.estado || '',
      l.variante || 'normal',
      l.cantidad ?? 1,
      l.gradeo || '',
      l.valor_manual ?? '',
      l.precio_compra ?? '',
      l.notas || '',
    ])
  }
  return filas.map((f) => f.map(celdaCsv).join(',')).join('\r\n') + '\r\n'
}
