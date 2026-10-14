// La decklist OFICIAL de Play! Pokémon, rellena desde el constructor
// (tanda 834). Ibai: «imprimir decklist, que te dé el documento para
// imprimir directamente con la plantilla oficial».
//
// Sin librerías (aquí no hay npm para el cliente) y sin servidor (el nombre,
// el Player ID y la fecha de nacimiento no salen del navegador): la
// plantilla es el PDF oficial de TPCi preparado UNA vez
// (assets/decklist/, ver SCHEMA «La decklist oficial»), con la página así:
//
//   /Contents [ «q»  la plantilla  «Q»  HUECO ]
//
// HUECO (el objeto 8) es un flujo vacío. Rellenar es una ACTUALIZACIÓN
// INCREMENTAL, que es como guarda un PDF cualquier programa que lo edita:
// se añade al final del fichero una versión nueva del objeto 8 con nuestro
// texto, una tabla xref que solo habla de él y un trailer que apunta a la
// anterior (/Prev). La plantilla sigue siendo vectorial e idéntica, y el
// texto va en Helvetica, que trae todo lector de PDF y no se incrusta (las
// casillas se marcan dibujando). Lo que hay que saber de la plantilla son las medidas de abajo
// (sacadas del propio PDF con pdfplumber) y el número del HUECO; la prueba
// de la tanda comprueba las dos cosas contra el fichero.
//
// Sin DOM y sin Supabase: se prueba en Node.
import { seccionesDelMazo, esEnergiaBasica, letraDeCartaDeEnergia, numeroSinCeros, nombreVisible } from './constructor/nucleo.js'

export const PLANTILLA_DECKLIST = '/assets/decklist/play-pokemon-decklist-a4.pdf'
// La temporada de la plantilla («2026 Pokémon TCG Tournament Season»): de
// ella salen las categorías por año de nacimiento. Cuando TPCi publique la
// de la siguiente, se cambian el PDF y este número a la vez.
export const TEMPORADA = 2026
const OBJETO_HUECO = 8

// ── La categoría por año de nacimiento ──
// Lo que dice la plantilla de 2026: Junior nacidos en 2014 o después,
// Senior en 2010–2013, Masters en 2009 o antes. O sea, temporada − 12 y
// temporada − 16, que es la regla de cada año.
export function divisionPorNacimiento(fecha, temporada = TEMPORADA) {
  const anio = Number(String(fecha || '').slice(0, 4))
  if (!Number.isInteger(anio) || anio < 1900 || anio > temporada) return null
  if (anio >= temporada - 12) return 'junior'
  if (anio >= temporada - 16) return 'senior'
  return 'masters'
}

export const DIVISIONES = {
  junior: { nombre: 'Junior', nacidos: `${TEMPORADA - 12} o después` },
  senior: { nombre: 'Senior', nacidos: `${TEMPORADA - 16}–${TEMPORADA - 13}` },
  masters: { nombre: 'Masters', nacidos: `${TEMPORADA - 17} o antes` },
}

// El Player ID se limpia en js/player-id.js (lo usa también el perfil).
export { limpiarPlayerId } from './player-id.js'

// ── La abreviatura de la colección, como la pide la hoja ──
// `codigoDeSet` da el código de TCG Live («TWM», «PR-SV»). La hoja escribe
// las promos SV y ME como SVP y MEP, y las de antes como «PR» a secas (su
// tabla de «Promotional Cards»).
const PROMOS_DE_LA_HOJA = { 'PR-SV': 'SVP', 'PR-ME': 'MEP' }
export function abreviaturaDeSet(codigo) {
  const c = String(codigo || '').trim().toUpperCase()
  if (!c) return ''
  if (PROMOS_DE_LA_HOJA[c]) return PROMOS_DE_LA_HOJA[c]
  if (/^PR-/.test(c)) return 'PR'
  return c
}

const TIPOS_ENERGIA = {
  G: ['Grass', 'Planta'],
  R: ['Fire', 'Fuego'],
  W: ['Water', 'Agua'],
  L: ['Lightning', 'Rayo'],
  P: ['Psychic', 'Psíquica'],
  F: ['Fighting', 'Lucha'],
  D: ['Darkness', 'Oscura'],
  M: ['Metal', 'Metálica'],
}

// ── Lo que va en cada sección ──
// En el orden del export de TCG Live (`seccionesDelMazo`). Los Pokémon con
// colección, número y marca de regulación; entrenadores y energías solo con
// el nombre, que es lo que pide la hoja. Las básicas del mismo tipo se
// juntan en una línea («Basic Fire Energy» de SVE y de MEE son la misma
// carta para la hoja). `idioma`: 'en' (los nombres de TCG Live, los que
// conoce cualquier juez) o 'es'.
export function lineasDeLaHoja(entradas, { codigoDeSet = () => null, idioma = 'en' } = {}) {
  const s = seccionesDelMazo(entradas)
  const nombre = (c) => (idioma === 'es' ? nombreVisible(c) : c.name || nombreVisible(c)) || ''
  const pokemon = s.P.map((e) => {
    const codigo = codigoDeSet(e.carta.set_id)
    return {
      n: e.n,
      nombre: nombre(e.carta),
      set: abreviaturaDeSet(codigo) || String(e.carta.set_id || '').toUpperCase(),
      numero: numeroSinCeros(e.carta.local_id),
      reg: String(e.carta.regulation_mark || '').trim().toUpperCase().slice(0, 1),
      // Sin código de TCG Live va el id del catálogo: la hoja no lo
      // reconocerá, y el diálogo lo dice para que se corrija a mano.
      sinCodigo: !codigo,
    }
  })
  // Lo que aún no tiene categoría va con los entrenadores, como en el
  // export de TCG Live.
  const entrenadores = [...s.T, ...s.X].map((e) => ({ n: e.n, nombre: nombre(e.carta) }))
  const energias = []
  for (const e of s.E) {
    const letra = esEnergiaBasica(e.carta) ? letraDeCartaDeEnergia(e.carta) : null
    const tipo = letra && TIPOS_ENERGIA[letra]
    const nom = tipo ? (idioma === 'es' ? `Energía ${tipo[1]} Básica` : `Basic ${tipo[0]} Energy`) : nombre(e.carta)
    const ya = tipo && energias.find((x) => x.nombre === nom)
    if (ya) ya.n += e.n
    else energias.push({ n: e.n, nombre: nom })
  }
  return { pokemon, entrenadores, energias }
}

// ── Las medidas de la plantilla (en puntos, origen ABAJO a la izquierda) ──
// Sacadas de play-pokemon-decklist-a4.pdf: cada fila de tabla mide 13,116.
const ALTO_PAGINA = 841.89
const FILA = 13.116
const TABLAS = {
  pokemon: { arriba: 186.412, filas: 10 },
  entrenadores: { arriba: 362.593, filas: 18 },
  energias: { arriba: 644.495, filas: 4 },
}
const COLUMNAS = {
  cantidad: { x0: 247.7, x1: 284.0 },
  nombre: { x0: 284.0, x1: 455.4 },
  nombreAncho: { x0: 284.0, x1: 566.0 },
  set: { x0: 455.4, x1: 492.4 },
  numero: { x0: 492.4, x1: 529.4 },
  reg: { x0: 529.4, x1: 566.0 },
}
// La línea de los datos del jugador: el texto se apoya un pelo encima de
// la raya de cada campo.
const LINEA_DATOS = 81.6
const CAMPOS = {
  nombre: { x0: 84.5, x1: 227.5 },
  playerId: { x0: 271.5, x1: 364.5 },
  mes: { x0: 485.4, x1: 501.9 },
  dia: { x0: 512.9, x1: 529.4 },
  anio: { x0: 540.4, x1: 567.9 },
}
// Las casillas ❒ (su caja, de arriba abajo).
const CASILLAS = {
  standard: { x0: 146.0, x1: 153.5, arriba: 48.6, abajo: 56.2 },
  expanded: { x0: 195.8, x1: 203.3, arriba: 48.6, abajo: 56.2 },
  junior: { x0: 367.6, x1: 374.5, arriba: 110.6, abajo: 117.8 },
  senior: { x0: 367.6, x1: 374.5, arriba: 124.1, abajo: 131.3 },
  masters: { x0: 367.6, x1: 374.5, arriba: 137.6, abajo: 144.8 },
}

// ── Helvetica (WinAnsi): anchos y codificación ──
// Los anchos de la métrica estándar de Helvetica para los códigos 32–255 de
// WinAnsiEncoding (de su AFM). Hacen falta para encoger un nombre largo
// hasta que quepa en su celda en vez de pisar la de al lado.
const ANCHOS = (
  '278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,' +
  '1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,' +
  '333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,' +
  '556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,' +
  '278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,' +
  '667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,' +
  '556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500'
)
  .split(',')
  .map(Number)

// Los de WinAnsi que no son Latin-1 (0x80–0x9F).
const WINANSI_EXTRA = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b,
  'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99,
  'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
}
// Lo que Helvetica no tiene se escribe como lo escribe TCG Live o un juez.
const EQUIVALENCIAS = { '♀': ' F', '♂': ' M', 'δ': 'Delta', '★': '*', '☆': '*', '◇': '(Prism Star)' }

// Texto → códigos WinAnsi. Lo que no cabe en WinAnsi pierde el acento
// (NFD) y, si aun así no, sale «?» — nunca un byte que el lector pinte
// como otra letra.
export function aWinAnsi(texto) {
  const codigos = []
  for (const ch of String(texto ?? '')) {
    if (EQUIVALENCIAS[ch]) {
      codigos.push(...aWinAnsi(EQUIVALENCIAS[ch]))
      continue
    }
    const cp = ch.codePointAt(0)
    if ((cp >= 32 && cp <= 126) || (cp >= 0xa0 && cp <= 0xff)) codigos.push(cp)
    else if (WINANSI_EXTRA[ch]) codigos.push(WINANSI_EXTRA[ch])
    else if (/\s/.test(ch)) codigos.push(32)
    else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
      codigos.push(...(base && base !== ch ? aWinAnsi(base) : [63]))
    }
  }
  return codigos
}

const anchoDe = (codigos, tam) => codigos.reduce((s, c) => s + (ANCHOS[c - 32] ?? 556), 0) * tam / 1000

// Un literal de cadena de PDF: paréntesis y barras escapados, y todo lo que
// no es ASCII imprimible en octal, para que el flujo sea ASCII puro.
function cadenaPdf(codigos) {
  return (
    '(' +
    codigos
      .map((c) => (c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c) : c >= 32 && c <= 126 ? String.fromCharCode(c) : '\\' + c.toString(8).padStart(3, '0')))
      .join('') +
    ')'
  )
}

const num = (n) => (Math.round(n * 100) / 100).toString()

// Un texto en una caja: encoge hasta `minimo` y, si ni así cabe, se corta
// con «…». `alinear`: 'izq' o 'centro'.
function textoEnCaja(texto, { x0, x1, base, tam = 9, minimo = 5, alinear = 'izq', margen = 3 }) {
  let codigos = aWinAnsi(texto)
  if (!codigos.length) return ''
  const ancho = x1 - x0 - margen * 2
  let t = tam
  const w = anchoDe(codigos, t)
  if (w > ancho) t = Math.max(minimo, (t * ancho) / w)
  while (codigos.length > 1 && anchoDe(codigos, t) > ancho) codigos = [...codigos.slice(0, -2), 0x85]
  const real = anchoDe(codigos, t)
  const x = alinear === 'centro' ? (x0 + x1) / 2 - real / 2 : x0 + margen
  return `BT /PDH ${num(t)} Tf ${num(x)} ${num(ALTO_PAGINA - base)} Td ${cadenaPdf(codigos)} Tj ET\n`
}

// Una marca ✔ dentro de una casilla, DIBUJADA (dos trazos) y no escrita:
// con ZapfDingbats, poppler pintaba otro símbolo, y una casilla tiene que
// verse marcada en cualquier lector y en cualquier impresora.
function marcar(c) {
  const ancho = c.x1 - c.x0
  const alto = c.abajo - c.arriba
  const y = (arriba) => num(ALTO_PAGINA - arriba)
  const p1 = [c.x0 + ancho * 0.12, c.arriba + alto * 0.52]
  const p2 = [c.x0 + ancho * 0.42, c.abajo - alto * 0.1]
  const p3 = [c.x1 + ancho * 0.15, c.arriba - alto * 0.12]
  return `q 1.3 w 1 J 1 j ${num(p1[0])} ${y(p1[1])} m ${num(p2[0])} ${y(p2[1])} l ${num(p3[0])} ${y(p3[1])} l S Q\n`
}

// Las filas de una tabla. Si hay más líneas que filas (un mazo con 13
// Pokémon distintos y una plantilla de 10), se reparten en el alto de la
// tabla entera con renglones más estrechos y letra más pequeña: todo en una
// hoja, como lo escribiría a mano quien se queda sin renglones. Con una
// por fila, cada una en su raya.
export function porFila(lineas, filas) {
  if (lineas.length <= filas) return { apretada: false, paso: FILA, tam: 8.5 }
  const paso = (filas * FILA) / lineas.length
  return { apretada: true, paso, tam: Math.min(8.5, paso * 0.74) }
}

function tabla(lineas, { arriba, filas }, columnas) {
  if (!lineas.length) return ''
  const { paso, tam } = porFila(lineas, filas)
  let out = ''
  lineas.forEach((l, i) => {
    // La base de cada renglón: centrada en su hueco (la fila, o el trozo
    // de tabla que le toca si va apretada).
    const base = arriba + i * paso + paso / 2 + tam * 0.36
    for (const [campo, col, opciones] of columnas) {
      const valor = l[campo]
      if (valor === undefined || valor === null || valor === '') continue
      out += textoEnCaja(String(valor), { ...col, base, tam, minimo: Math.min(tam, 4), ...opciones })
    }
  })
  return out
}

// ── Todo el texto de la hoja, como flujo de contenido de PDF ──
// datos: { nombre, playerId, nacimiento ('AAAA-MM-DD'), division
// ('junior'|'senior'|'masters'|null), formato ('standard'|'expanded'|null),
// lineas (las de `lineasDeLaHoja`) }.
export function contenidoDeLaHoja({ nombre = '', playerId = '', nacimiento = '', division = null, formato = null, lineas }) {
  let c = '% PokeDoc: decklist oficial\n0 g\n'
  c += textoEnCaja(nombre, { ...CAMPOS.nombre, base: LINEA_DATOS, tam: 10, minimo: 6 })
  c += textoEnCaja(playerId, { ...CAMPOS.playerId, base: LINEA_DATOS, tam: 10, minimo: 6 })
  const f = String(nacimiento || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (f) {
    c += textoEnCaja(f[2], { ...CAMPOS.mes, base: LINEA_DATOS, tam: 10, alinear: 'centro', margen: 0 })
    c += textoEnCaja(f[3], { ...CAMPOS.dia, base: LINEA_DATOS, tam: 10, alinear: 'centro', margen: 0 })
    c += textoEnCaja(f[1], { ...CAMPOS.anio, base: LINEA_DATOS, tam: 10, alinear: 'centro', margen: 0 })
  }
  if (CASILLAS[formato]) c += marcar(CASILLAS[formato])
  if (CASILLAS[division]) c += marcar(CASILLAS[division])
  const centro = { alinear: 'centro', margen: 1 }
  c += tabla(lineas.pokemon, TABLAS.pokemon, [
    ['n', COLUMNAS.cantidad, centro],
    ['nombre', COLUMNAS.nombre],
    ['set', COLUMNAS.set, centro],
    ['numero', COLUMNAS.numero, centro],
    ['reg', COLUMNAS.reg, centro],
  ])
  c += tabla(lineas.entrenadores, TABLAS.entrenadores, [
    ['n', COLUMNAS.cantidad, centro],
    ['nombre', COLUMNAS.nombreAncho],
  ])
  c += tabla(lineas.energias, TABLAS.energias, [
    ['n', COLUMNAS.cantidad, centro],
    ['nombre', COLUMNAS.nombreAncho],
  ])
  return c
}

// ── La actualización incremental ──
// `plantilla`: los bytes del PDF preparado (Uint8Array). Devuelve los del
// PDF relleno. Lee del trailer lo que hay que repetir (/Root, /Info, /ID,
// /Size) y el `startxref` de la sección anterior, que va en /Prev.
export function rellenarPlantilla(plantilla, contenido) {
  const bytes = plantilla instanceof Uint8Array ? plantilla : new Uint8Array(plantilla)
  // La cola del fichero, como texto: el trailer está en el último KB.
  const cola = String.fromCharCode(...bytes.subarray(Math.max(0, bytes.length - 2048)))
  const xrefs = [...cola.matchAll(/startxref\s+(\d+)/g)]
  const trailers = [...cola.matchAll(/trailer\s*<<([\s\S]*?)>>\s*startxref/g)]
  if (!xrefs.length || !trailers.length) throw new Error('La plantilla no tiene trailer: ¿es la preparada?')
  const prev = Number(xrefs[xrefs.length - 1][1])
  const trailer = trailers[trailers.length - 1][1]
  const tamano = Number(trailer.match(/\/Size\s+(\d+)/)?.[1])
  const raiz = trailer.match(/\/Root\s+(\d+\s+\d+\s+R)/)?.[1]
  const info = trailer.match(/\/Info\s+(\d+\s+\d+\s+R)/)?.[1]
  const id = trailer.match(/\/ID\s*(\[[^\]]*\])/)?.[1]
  if (!tamano || !raiz || tamano <= OBJETO_HUECO) throw new Error('La plantilla no es la preparada (trailer raro).')

  // El flujo es ASCII puro (cadenaPdf escapa lo demás), así que su
  // longitud en bytes es la de la cadena.
  const flujo = contenido.endsWith('\n') ? contenido : contenido + '\n'
  const inicio = bytes[bytes.length - 1] === 0x0a ? '' : '\n'
  const objeto = `${inicio}${OBJETO_HUECO} 0 obj\n<< /Length ${flujo.length} >>\nstream\n${flujo}endstream\nendobj\n`
  const offsetObjeto = bytes.length + inicio.length
  const offsetXref = bytes.length + objeto.length
  const xref =
    `xref\n${OBJETO_HUECO} 1\n${String(offsetObjeto).padStart(10, '0')} 00000 n \n` +
    `trailer\n<< /Size ${tamano} /Root ${raiz}${info ? ` /Info ${info}` : ''}${id ? ` /ID ${id}` : ''} /Prev ${prev} >>\n` +
    `startxref\n${offsetXref}\n%%EOF\n`
  const anadido = new TextEncoder().encode(objeto + xref)
  const fuera = new Uint8Array(bytes.length + anadido.length)
  fuera.set(bytes, 0)
  fuera.set(anadido, bytes.length)
  return fuera
}

// Cuántas líneas de cada sección y si van apretadas: para que el diálogo
// lo diga ANTES de generar la hoja.
export function resumenDeLaHoja(lineas) {
  return Object.fromEntries(
    Object.entries(TABLAS).map(([seccion, t]) => [seccion, { lineas: lineas[seccion].length, filas: t.filas, apretada: porFila(lineas[seccion], t.filas).apretada }])
  )
}
