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
  // El id de PRODUCTO de Cardmarket (1459). No es nuestro id, pero lo
  // tenemos al lado de cada carta (`cm_id_product_propio`, y por versión en
  // `tcg_card_versions.cm_id_product`), así que casa sin set ni número: es
  // lo que traen el export de Cardmarket y el de TheHobbyClub.
  cardmarket: ['cardmarket_id', 'cardmarket id', 'cardmarketid', 'idproduct', 'id product', 'cm_id', 'cm id', 'id de cardmarket'],
  nombre: ['name', 'card name', 'card_name', 'card', 'carta', 'nombre', 'pokemon', 'pokémon'],
  set: ['set', 'set name', 'set_name', 'expansion', 'expansión', 'expansion name', 'coleccion', 'colección', 'edition'],
  codigo: ['set code', 'set_code', 'set id', 'set_id', 'code', 'codigo', 'código', 'ptcgo code', 'ptcgl code', 'abbreviation', 'abbr', 'set abbreviation', 'expansion code'],
  numero: ['number', 'card number', 'card_number', 'collector number', 'collector_number', 'no', 'no.', '#', 'num', 'numero', 'número', 'card no', 'card no.'],
  cantidad: ['quantity', 'qty', 'count', 'amount', 'cantidad', 'copias', 'copies', 'owned', 'unidades', 'stock'],
  estado: ['condition', 'cond', 'estado', 'state'],
  idioma: ['language', 'lang', 'idioma'],
  variante: ['variant', 'variante', 'finish', 'version', 'versión', 'printing', 'foil', 'type of print', 'edition type'],
  // Cardmarket lo dice con un sí/no (1329): en lo moderno, un foil es la Reverse.
  foil: ['isfoil', 'is foil', 'foil?'],
  casa: ['grading company', 'grade company', 'grade_company', 'grading_company', 'company', 'casa', 'grader'],
  gradeo: ['grade', 'grade_value', 'grade value', 'grading', 'gradeo', 'graded', 'nota'],
  precioCompra: ['purchase price', 'purchase_price', 'price paid', 'paid', 'precio de compra', 'precio compra', 'precio_compra', 'lo que pagaste', 'lo que pagaste (€)', 'buy price', 'cost', 'coste'],
  valor: ['tu valor', 'tu valor (€)', 'valor_manual', 'valor manual', 'my value', 'custom price', 'custom value'],
  notas: ['notes', 'note', 'notas', 'comment', 'comments', 'comentario'],
  // Las de una tienda (1068): a cuánto lo vende, dónde está y si se enseña.
  // Mi colección no las usa; el importador del stock, sí.
  precioVenta: ['pvp', 'precio venta', 'precio de venta', 'precio_venta', 'sell price', 'selling price', 'sale price', 'tu precio', 'tu precio (€)'],
  ubicacion: ['ubicacion', 'ubicación', 'location', 'donde esta', 'dónde está', 'storage'],
  visible: ['visible', 'escaparate', 'en escaparate'],
}

const plegar = (t) => normalizeSearch(t).replace(/\s+/g, ' ').trim()

// ── TheHobbyClub (tanda 1459) ──
//
// Su export no se deja leer con los sinónimos: «estado» es si la TIENES
// (`have`) o te FALTA (`missing`) en una de sus colecciones, el estado de la
// carta va en «estado_carta», el nombre de la colección va antes que el del
// set y «numero» es SU id («me55c_es-203», o el de Cardmarket en lo que solo
// vende Cardmarket). Así que cuando la cabecera es la suya, cada columna se
// coge por su nombre exacto. Un usuario llegó con 3.226 filas y no casaba
// ninguna («no conozco la expansión «30 aniversario Classic»», que era el
// nombre de SU colección).
const COLUMNAS_THC = {
  coleccion: 'coleccion',
  tiene: 'estado',
  nombre: 'carta',
  set: 'set',
  numero: 'numero',
  variante: 'variante',
  idioma: 'idioma',
  estado: 'estado_carta',
  casa: 'empresa_gradeo',
  gradeo: 'nota_gradeo',
  precioCompra: 'precio_compra',
  notas: 'notas',
  cardmarket: 'cardmarket_id',
}
export const esDeTheHobbyClub = (plegadas) => ['coleccion', 'carta', 'estado_carta', 'cardmarket_id'].every((c) => plegadas.includes(c))

// De una cabecera a {campo: índice}. Devuelve también qué app parece
// —solo para decirlo en pantalla— y qué columnas se quedan sin usar.
export function reconocerColumnas(cabecera) {
  const columnas = {}
  const plegadas = cabecera.map(plegar)
  if (esDeTheHobbyClub(plegadas)) {
    for (const [campo, nombre] of Object.entries(COLUMNAS_THC)) {
      const i = plegadas.indexOf(nombre)
      if (i >= 0) columnas[campo] = i
    }
    const sinUsar = cabecera.filter((_, i) => !Object.values(columnas).includes(i))
    return { columnas, origen: 'TheHobbyClub', sinUsar }
  }
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
          : tiene('simple name') || (tiene('product id') && tiene('printing'))
            ? 'TCGplayer'
            : tiene('idproduct') || tiene('cardmarketid') || tiene('isfoil')
              ? 'Cardmarket'
              : null
  const sinUsar = cabecera.filter((_, i) => !Object.values(columnas).includes(i))
  return { columnas, origen, sinUsar }
}

// Lo mínimo para encontrar una carta: el id (el nuestro o el de Cardmarket),
// o la expansión (de cualquier manera) con el número.
export function faltanColumnas({ columnas }) {
  if (columnas.id !== undefined || columnas.cardmarket !== undefined) return []
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
  // TheHobbyClub dice «KO» y «ZH» (1459): sin ellas, una coreana entraba
  // con el idioma por defecto, es decir, como española.
  [/^(ko|kor|korean|coreano)$/, 'ko'],
  [/^(zh|chi|chinese|chino|zh-tw|zh-cn)$/, 'zh'],
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

// Las versiones de TheHobbyClub van en camelCase («reverseHolofoil»,
// «firstEditionHolofoil», «cardmarket_only_rh»). Se parten en palabras y se
// llevan a las cuatro de siempre; lo que es un SELLO o una versión que
// nuestro catálogo no separa («leagueStamp», «cardmarket_only») va como la
// normal o la reverse, y lo dice `selloDeTheHobbyClub` para apuntarlo en la
// nota de la copia, que no se pierda.
const palabrasThc = (t) => String(t || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase().trim()
export function varianteDeTheHobbyClub(texto) {
  const t = palabrasThc(texto)
  if (/\brh\b|reverse/.test(t)) return 'reverse'
  if (/first edition/.test(t)) return 'primera'
  if (/holofoil|\bholo\b/.test(t)) return 'holo'
  return 'normal'
}
const SELLOS_THC = {
  'league stamp': 'Sello de Liga',
  'winner stamp': 'Sello «Winner»',
  'world championships stamp': 'Sello del Mundial',
  'anniversary stamp': 'Sello de aniversario',
  'play pokemon stamp holofoil': 'Sello Play! Pokémon',
  'cardmarket only': 'Versión que solo vende Cardmarket',
  'cardmarket only rh': 'Versión que solo vende Cardmarket',
  'rocket reverse holofoil': 'Reverse del Team Rocket',
  'poke ball reverse holofoil': 'Reverse Poké Ball',
  'cosmos holofoil': 'Holo cósmico',
  'peelable ditto': 'Ditto despegable',
}
export function selloDeTheHobbyClub(texto) {
  const t = palabrasThc(texto)
  if (!t || ['normal', 'holofoil', 'reverse holofoil', 'first edition', 'first edition holofoil', 'unlimited holofoil'].includes(t)) return null
  return SELLOS_THC[t] || `Versión de TheHobbyClub: ${String(texto).trim()}`
}

// SU número: «me55c_es-203» (su set, guion, el número), «xyp-XY209», o el id
// de Cardmarket a secas en lo que solo vende Cardmarket — eso no es un
// número de carta y se deja vacío.
export function numeroDeTheHobbyClub(texto, cardmarket = null) {
  const t = String(texto || '').trim()
  if (!t || (cardmarket && t === String(cardmarket)) || /^\d{5,}$/.test(t)) return ''
  const i = t.lastIndexOf('-')
  return numeroDe(i > 0 ? t.slice(i + 1) : t)
}

// El nombre como lo escribe Cardmarket (y TheHobbyClub, que lo copia):
// «Arceus VSTAR [Trinity Nova | Starbirth]». Lo de los corchetes son sus
// ataques: para comparar con nuestro nombre, fuera.
export const nombreSinCorchetes = (n) => String(n || '').replace(/\s*\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()

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
// `destino` (1459) es adónde va cada fila cuando el FICHERO lo dice: la de
// TheHobbyClub dice si la tienes (a tu colección) o te falta (a «La quiero»);
// sin decirlo, `null`, y manda lo elegido en pantalla. `'nada'` es una fila
// que no dice ni lo uno ni lo otro: no se adivina.
export function entradasDe(filas, columnas, { idiomaSiFalta = 'es', origen = null } = {}) {
  const celda = (fila, campo) => (columnas[campo] === undefined ? '' : fila[columnas[campo]] || '')
  const thc = origen === 'TheHobbyClub'
  return filas.map((fila, i) => {
    const cantidad = Math.max(1, Math.min(999, Math.round(Number(celda(fila, 'cantidad')) || 1)))
    const cardmarket = Number(String(celda(fila, 'cardmarket')).replace(/\D/g, '')) || null
    const tiene = plegar(celda(fila, 'tiene'))
    const casaThc = thc && celda(fila, 'casa').trim()
    // TCGplayer pega el número al nombre («Pikachu ex - 063/191»).
    const nombreCrudo = celda(fila, 'nombre').trim().replace(/\s+-\s+[\w-]+\/[\w-]+$/, '')
    return {
      fila: i + 2, // la línea del fichero, con la cabecera en la 1
      id: celda(fila, 'id').trim() || null,
      cardmarket,
      nombre: nombreSinCorchetes(nombreCrudo),
      // El de la fila tal cual, para enseñar lo que no casa como lo escribió.
      nombreOriginal: nombreCrudo,
      set: celda(fila, 'set').trim(),
      codigo: celda(fila, 'codigo').trim(),
      numero: thc ? numeroDeTheHobbyClub(celda(fila, 'numero'), cardmarket) : numeroDe(celda(fila, 'numero')),
      cantidad,
      estado: estadoDe(celda(fila, 'estado')),
      idioma: columnas.idioma === undefined ? idiomaSiFalta : idiomaDe(celda(fila, 'idioma'), idiomaSiFalta),
      variante: thc
        ? varianteDeTheHobbyClub(celda(fila, 'variante'))
        : columnas.variante === undefined && /^(1|true|yes|si|sí|x)$/i.test(celda(fila, 'foil').trim()) ? 'reverse' : varianteDe(celda(fila, 'variante')),
      // Si el fichero NO dice la versión, «normal» es lo que se supone para
      // una copia; un deseo sin versión es «cualquiera» (1047).
      varianteDada: thc || columnas.variante !== undefined || columnas.foil !== undefined,
      sello: thc ? selloDeTheHobbyClub(celda(fila, 'variante')) : null,
      // TheHobbyClub pone la nota sin casa cuando no está gradeada: sin casa, nada.
      gradeo: thc && !casaThc ? null : gradeoDe(celda(fila, 'casa'), celda(fila, 'gradeo')),
      precio_compra: dineroDe(celda(fila, 'precioCompra')),
      valor_manual: dineroDe(celda(fila, 'valor')),
      notas: celda(fila, 'notas').trim().slice(0, 280) || null,
      destino: columnas.tiene === undefined ? null : tiene === 'have' ? 'coleccion' : tiene === 'missing' ? 'deseo' : 'nada',
      coleccion: celda(fila, 'coleccion').trim() || null,
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
  // Cardmarket cuelga de cada expansión otra con lo que vende aparte
  // («Ascended Heroes: Additionals», 1459): son cartas de ESA expansión.
  const sinAdicionales = String(entrada.set || '').replace(/\s*:?\s*additionals?\s*$/i, '')
  if (sinAdicionales && sinAdicionales !== entrada.set) return setDeEntrada({ ...entrada, set: sinAdicionales, codigo: '' }, indice)
  return null
}

// El nombre de una carta en cualquiera de sus idiomas, plegado y sin los
// corchetes de Cardmarket.
// Las formas de un nombre para comparar: sin los ataques entre corchetes, sin
// el nivel de las de Diamante y Perla («Luxray Lv.48»), y con la marca corta
// que Cardmarket pone entre corchetes («Empoleon [FB]» → «empoleon fb»,
// «Unown [A]» → «unown a»), que en nuestro catálogo va pegada al nombre.
export function clavesDeNombre(nombre) {
  const t = String(nombre || '')
  const base = plegar(nombreSinCorchetes(t).replace(/\s+lv\.?\s*\d+\b/gi, ''))
  if (!base) return []
  // Con marca, SOLO con ella: «Empoleon [FB]» no es el Empoleon a secas.
  const marcas = [...t.matchAll(/\[([^\]|]{1,4})\]/g)].map((m) => plegar(m[1]))
  return marcas.length ? [...new Set(marcas.map((x) => `${base} ${x}`))] : [base]
}
const casaNombre = (carta, nombre) => {
  const quiero = clavesDeNombre(nombre)
  if (!quiero.length) return false
  return [carta?.name, carta?.name_es, carta?.name_en].some((n) => n && clavesDeNombre(n).some((k) => quiero.includes(k)))
}
// Los ataques y habilidades entre corchetes («Lucario [Vacuum Wave | Fight
// Alone]»), plegados: desempatan dos cartas que se llaman igual en un set.
export const ataquesDelNombre = (nombre) => [...String(nombre || '').matchAll(/\[([^\]]*\|[^\]]*|[^\]]{5,})\]/g)]
  .flatMap((m) => m[1].split('|'))
  .map((x) => plegar(x))
  .filter(Boolean)

// Empareja cada entrada con una carta. `cartasDeSet(setId)` trae las de
// un set (se pide una vez por set); `cartaPorId(id)` resuelve un id de
// TCGdex; `cartasPorCardmarket(ids)` (1459) da, por id de producto de
// Cardmarket, las cartas que lo llevan: `[{ carta, variante }]`, con
// `variante` cuando el id es el de UNA versión (`tcg_card_versions`) y null
// cuando es el de la carta. Devuelve las líneas listas para `anadirVarias`
// y las perdidas con su motivo, para enseñarlas antes de guardar.
//
// Por orden: el id de Cardmarket, nuestro id, la expansión y el número, y
// —solo si la fila NO trae número— la expansión y un nombre que en ese set
// lleva UNA sola carta (lo que solo vende Cardmarket, sellos de liga: no
// tienen número propio). Un nombre repetido en el set no se elige.
export async function emparejar(entradas, { sets, cartasDeSet, cartaPorId = async () => null, cartasPorCardmarket = async () => new Map(), ataquesDe = async () => new Map(), mercado = 'WEST' }) {
  const indice = indiceDeSets(sets)
  const cache = new Map()
  const cartasDe = async (setId) => {
    if (!cache.has(setId)) cache.set(setId, await cartasDeSet(setId).catch(() => []))
    return cache.get(setId)
  }
  const idsCm = [...new Set(entradas.map((e) => e.cardmarket).filter(Boolean))]
  const porCm = idsCm.length ? await cartasPorCardmarket(idsCm).catch(() => new Map()) : new Map()
  const listas = []
  const perdidas = []
  for (const e of entradas) {
    if (e.destino === 'nada') {
      perdidas.push({ entrada: e, motivo: 'el fichero no dice si la tienes o te falta' })
      continue
    }
    let carta = null
    let variante = e.variante
    let via = ''
    let motivo = ''
    const set = setDeEntrada(e, indice)
    const delCm = e.cardmarket ? porCm.get(e.cardmarket) || [] : []
    if (delCm.length) {
      // Dos filas del catálogo con el mismo producto (la de TCGdex y su
      // gemela de TCGGO): la del set de la fila, luego la del nombre.
      const ids = [...new Set(delCm.map((x) => x.carta.id))]
      const puntua = (id) => {
        const c = delCm.find((x) => x.carta.id === id).carta
        return (set && c.set_id === set.id ? 4 : 0) + (casaNombre(c, e.nombreOriginal || e.nombre) ? 2 : 0) + (/^(tcggo|mano)-/.test(id) ? 0 : 1)
      }
      const elegido = ids.sort((a, b) => puntua(b) - puntua(a) || a.localeCompare(b))[0]
      const suyas = delCm.filter((x) => x.carta.id === elegido)
      carta = suyas[0].carta
      // Un id de VERSIÓN dice la versión; si es el de varias (la Normal y la
      // Reverse de un set viejo comparten producto), manda la de la fila.
      const versiones = suyas.map((x) => x.variante).filter(Boolean)
      if (versiones.length && !versiones.includes(e.variante) && !suyas.some((x) => !x.variante)) variante = versiones[0]
      via = 'cardmarket'
    }
    if (!carta && e.id) {
      carta = await cartaPorId(e.id).catch(() => null)
      if (carta) via = 'id'
    }
    if (!carta) {
      if (!set) motivo = e.set || e.codigo ? `no conozco la expansión «${e.set || e.codigo}»` : 'sin expansión'
      else if (!e.numero) {
        const delSet = e.nombre ? await cartasDe(set.id) : []
        let suyas = delSet.filter((c) => casaNombre(c, e.nombreOriginal || e.nombre))
        // «Boss's Orders - Giovanni»: Cardmarket le pone al Entrenador el
        // personaje detrás de un guion, y nuestro catálogo no. Solo si con el
        // nombre entero no hay ninguna.
        const corto = String(e.nombreOriginal || e.nombre || '').split(' - ')[0]
        if (!suyas.length && corto !== (e.nombreOriginal || e.nombre)) suyas = delSet.filter((c) => casaNombre(c, corto))
        // La misma impresión dos veces (la fila de TCGdex y su gemela de
        // TCGGO, con el mismo número): es una carta, la de TCGdex.
        if (suyas.length > 1 && new Set(suyas.map((c) => numeroComparable(c.local_id))).size === 1) {
          suyas = [suyas.find((c) => !/^(tcggo|mano)-/.test(c.id)) || suyas[0]]
        }
        // Y dos cartas distintas con el mismo nombre se desempatan por sus
        // ataques, si la fila los trae (el nombre de Cardmarket los lleva).
        const ataques = ataquesDelNombre(e.nombreOriginal)
        if (suyas.length > 1 && ataques.length) {
          const suyos = await ataquesDe(suyas.map((c) => c.id)).catch(() => new Map())
          const casan = suyas.filter((c) => {
            const de = (suyos.get(c.id) || []).map((x) => plegar(x))
            return de.length && ataques.every((a) => de.includes(a))
          })
          if (casan.length === 1) suyas = casan
        }
        // Un sello (de liga, de Prize Pack, lo que solo vende Cardmarket) se
        // pone sobre la impresión NORMAL de un Entrenador o una Energía, no
        // sobre su arte completo ni su dorada: el mismo nombre en un set es el
        // mismo texto, así que es la de número más bajo. En un Pokémon no:
        // dos con el mismo nombre son dos cartas distintas.
        if (suyas.length > 1 && e.sello && suyas.every((c) => c.category && !['Pokemon', 'Pokémon'].includes(c.category))) {
          const n = (c) => {
            const x = parseInt(String(c.local_id || '').replace(/^\D+/, ''), 10)
            return Number.isFinite(x) ? x : Infinity
          }
          suyas = [[...suyas].sort((a, b) => n(a) - n(b))[0]]
        }
        if (suyas.length === 1) {
          carta = suyas[0]
          via = 'nombre'
        } else motivo = suyas.length ? `en ${set.name || set.id} hay ${suyas.length} cartas que se llaman así y no trae número` : 'sin número'
      } else {
        const quiero = numeroComparable(e.numero)
        const suyas = await cartasDe(set.id)
        carta = suyas.find((c) => numeroComparable(c.local_id) === quiero) || null
        if (carta) via = 'numero'
        else motivo = `en ${set.name || set.id} no hay ninguna carta con el número ${e.numero}`
      }
    }
    if (!carta) {
      // Una japonesa en el catálogo occidental (1459): el catálogo se elige
      // arriba de la pantalla y el fichero hay que pasarlo otra vez allí.
      if (e.idioma === 'ja' && mercado !== 'JP') motivo = 'es japonesa: elige el catálogo Japonés y vuelve a importar el fichero'
      perdidas.push({ entrada: e, motivo })
      continue
    }
    // El nombre, si viene, solo AVISA: puede ser el mismo en otro idioma.
    const nombreCasa = !e.nombre || casaNombre(carta, e.nombreOriginal || e.nombre)
    // La versión que solo existía allí (un sello de liga) va en la nota de
    // la copia, salvo que el id de Cardmarket ya haya dicho cuál es.
    const notas = e.notas || (e.sello && via !== 'cardmarket' ? e.sello : null)
    listas.push({
      entrada: e,
      carta,
      nombreCasa,
      via,
      destino: e.destino || null,
      linea: {
        card_id: carta.id,
        market: carta.market || mercado,
        idioma: e.idioma,
        estado: e.estado,
        variante,
        cantidad: e.cantidad,
        gradeo: e.gradeo,
        valor_manual: e.valor_manual,
        precio_compra: e.precio_compra,
        notas,
      },
    })
  }
  return { listas, perdidas }
}

// Dos filas que son LA MISMA copia (misma carta, idioma, estado, versión y
// gradeo) se juntan sumando copias (1459): TheHobbyClub pone una fila por
// hueco de cada colección, y la misma carta en dos colecciones entraba como
// dos líneas gemelas que la lista enseñaría dos veces.
export function juntarLineas(lineas) {
  const porClave = new Map()
  for (const l of lineas || []) {
    const k = [l.card_id, l.market, l.idioma, l.estado, l.variante, l.gradeo || ''].join('|')
    const ya = porClave.get(k)
    if (ya) ya.cantidad = Math.min(999, (Number(ya.cantidad) || 1) + (Number(l.cantidad) || 1))
    else porClave.set(k, { ...l })
  }
  return [...porClave.values()]
}

// Adónde va cada carta encontrada (1459): lo elegido en pantalla
// (`coleccion`, `cambio` —a la colección y para cambio, «Las que doy»— o
// `deseo`), salvo que el fichero diga que te FALTA: eso va a «La quiero»
// siempre, que meterla en la colección sería decir que la tienes.
export function destinoDe(item, elegido = 'coleccion') {
  if (elegido === 'deseo' || item?.destino === 'deseo') return 'deseo'
  return elegido === 'cambio' ? 'cambio' : 'coleccion'
}

// Lo que va a «La quiero» (1459): un deseo por carta, idioma y versión, sin
// repetir los que ya tienes apuntados (`ya`, las filas de `user_wants`).
// `items` son los de `emparejar` ({ linea, entrada }): sin versión en el
// fichero, el deseo es de cualquiera.
export function deseosDeImportar(items, ya = []) {
  const clave = (d) => [d.card_id, d.idioma || '', d.variante || ''].join('|')
  const vistos = new Set((ya || []).map(clave))
  const out = []
  for (const { linea: l, entrada: e } of items || []) {
    const d = { card_id: l.card_id, idioma: l.idioma || null, variante: e?.varianteDada === false ? null : l.variante || null }
    if (vistos.has(clave(d))) continue
    vistos.add(clave(d))
    out.push(d)
  }
  return out
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
