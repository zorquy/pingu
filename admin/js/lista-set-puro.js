// «Pegar lista» de un set (1300, PINGU: «que yo pueda pegar una lista o una
// captura y que el panel me detecte la lista del set, para no tener que
// pedírtelo»). Lo puro, sin la base ni la página: se prueba en Node.
//
// Entra texto (la tabla de Bulbapedia, Serebii, Limitless, PokéCardex o
// Cardmarket copiada tal cual, una carta por línea, o lo que haya leído el OCR
// de una captura) y sale:
//   · `filasDeLista(texto)`: una fila por carta, con número, nombre, nombre en
//     inglés, rareza (en el inglés con el que la guardamos), tipos y categoría;
//     y las líneas que no se entienden, aparte, para enseñarlas.
//   · `planDeLista(filas, cartas)`: qué hacer con cada una contra las cartas
//     que el set YA tiene: «nueva», «completa» (rellena solo lo que la carta
//     tiene VACÍO: nada se pisa) o «igual»; y si el nombre no se parece, lo dice.
//   · `cambiosDeNueva(fila, setId)` / `idDeNueva`: lo que se manda a
//     `catalogo_corregir` para crearla, como «Nueva carta» del panel.
import { rarezaCanonica, rarezaConocida } from '../../js/rarezas-nombres.js'

// Las siglas de rareza de las listas (japonesas e inglesas) → el inglés con el
// que guardamos la rareza. Lo que no está aquí y son siglas (CHR, CSR…) entra
// tal cual en mayúsculas: una rareza nueva es un dato.
export const SIGLAS_DE_RAREZA = {
  c: 'Common', u: 'Uncommon', r: 'Rare', rr: 'Double Rare', rrr: 'Triple Rare',
  ar: 'Illustration Rare', ir: 'Illustration Rare', sar: 'Special Illustration Rare', sir: 'Special Illustration Rare',
  sr: 'Ultra Rare', ur: 'Hyper Rare', hr: 'Hyper Rare', ace: 'ACE SPEC Rare', pr: 'Promo', promo: 'Promo',
  s: 'Shiny Rare', ssr: 'Shiny Ultra Rare', '●': 'Common', '◆': 'Uncommon', '★': 'Rare', '★★': 'Double Rare',
}

// Los tipos (inglés y español) → el inglés que guarda `types`.
const TIPOS = {
  grass: 'Grass', planta: 'Grass', fire: 'Fire', fuego: 'Fire', water: 'Water', agua: 'Water',
  lightning: 'Lightning', rayo: 'Lightning', eléctrico: 'Lightning', electrico: 'Lightning',
  psychic: 'Psychic', psíquico: 'Psychic', psiquico: 'Psychic', fighting: 'Fighting', lucha: 'Fighting',
  darkness: 'Darkness', oscuro: 'Darkness', siniestro: 'Darkness', dark: 'Darkness',
  metal: 'Metal', metálico: 'Metal', metalico: 'Metal', acero: 'Metal', fairy: 'Fairy', hada: 'Fairy',
  dragon: 'Dragon', dragón: 'Dragon', colorless: 'Colorless', incoloro: 'Colorless',
}

// Categoría y tipo de Entrenador, solo cuando vienen en SU columna.
const CATEGORIAS = {
  trainer: { category: 'Trainer' }, entrenador: { category: 'Trainer' },
  item: { category: 'Trainer', trainer_type: 'Item' }, objeto: { category: 'Trainer', trainer_type: 'Item' },
  supporter: { category: 'Trainer', trainer_type: 'Supporter' }, partidario: { category: 'Trainer', trainer_type: 'Supporter' }, seguidor: { category: 'Trainer', trainer_type: 'Supporter' },
  stadium: { category: 'Trainer', trainer_type: 'Stadium' }, estadio: { category: 'Trainer', trainer_type: 'Stadium' },
  tool: { category: 'Trainer', trainer_type: 'Tool' }, 'pokémon tool': { category: 'Trainer', trainer_type: 'Tool' }, herramienta: { category: 'Trainer', trainer_type: 'Tool' },
  energy: { category: 'Energy' }, energía: { category: 'Energy' }, energia: { category: 'Energy' },
  'basic energy': { category: 'Energy', energy_type: 'Basic' }, 'special energy': { category: 'Energy', energy_type: 'Special' },
  pokémon: { category: 'Pokemon' }, pokemon: { category: 'Pokemon' },
}

// Lo que no es ni nombre ni dato (las columnas de precio o de «set» de una
// tabla copiada): se ignora sin protestar.
const SOBRA = /^(\d+([.,]\d+)?\s*(€|\$|usd|eur)?|€\s*\d+.*|n\/a|-+|—+|x\d+|\d+\s*hp)$/i
const TITULOS = /^(no\.?|nº|#|number|número|card ?(no|number)?)?\s*[·\t|;]?\s*(name|card name|nombre|carta)\b/i
const SEPARADOR = /\s*(?:\t|·|\||;|\s{2,})\s*/

// La rareza de un trozo de texto: siglas, símbolos o el nombre entero.
export function rarezaDe(trozo) {
  const t = String(trozo || '').trim()
  if (!t) return null
  const sigla = SIGLAS_DE_RAREZA[t.toLowerCase()]
  if (sigla) return sigla
  if (rarezaConocida(t)) return rarezaCanonica(t)
  // «Rare Holo», «Illustration Rare»… que el vocabulario no tenga escrito así.
  if (/(^|\s)(rare|holo|rara)$/i.test(t) && t.split(/\s+/).length <= 5) return rarezaCanonica(t)
  // Siglas desconocidas (2–4 mayúsculas): un dato, tal cual.
  if (/^[A-Z]{2,4}$/.test(t)) return t
  return null
}

// Los nombres de rareza que se pueden pegar al final de un nombre con un
// espacio («Pikachu ex Double Rare»), del más largo al más corto.
const RAREZAS_AL_FINAL = [...new Set([...Object.values(SIGLAS_DE_RAREZA).filter((x) => /\s/.test(x)), 'Special Illustration Rare', 'Illustration Rare', 'Double Rare', 'Ultra Rare', 'Hyper Rare', 'Secret Rare', 'Rare Holo', 'Holo Rare', 'Shiny Rare', 'Shiny Ultra Rare', 'ACE SPEC Rare', 'Triple Rare', 'Amazing Rare', 'Radiant Rare'])].sort((a, b) => b.length - a.length)

export const numeroComparable = (n) => String(n || '').trim().toLowerCase().replace(/^([a-z]*)0+(\d)/, '$1$2')

export function filasDeLista(texto) {
  const filas = []
  const raras = []
  const vistos = new Map()
  String(texto || '').split(/\r?\n/).forEach((linea, i) => {
    const t = linea.replace(/ /g, ' ').trim()
    if (!t || TITULOS.test(t)) return
    const m = /^#?\s*([A-Za-z]{0,5}-?\d{1,4}[A-Za-z]?)(?:\s*\/\s*[A-Za-z]{0,5}\d{1,4})?(?:\s*(?:\t|·|\||;|:|\.|-)\s*|\s+)(.+)$/.exec(t)
    if (!m) return void raras.push({ linea: i + 1, texto: t, motivo: 'no empieza por un número' })
    const numero = m[1].replace('-', '')
    const fila = { linea: i + 1, local_id: numero, name: '', name_en: null, rarity: null, types: [], category: null, trainer_type: null, energy_type: null, image_path: null }
    let trozos = m[2].split(SEPARADOR).map((x) => x.trim()).filter(Boolean)
    const columnas = trozos.length > 1
    const nombres = []
    for (const tr of trozos) {
      if (/^https?:\/\/\S+$/i.test(tr)) { fila.image_path = tr; continue }
      if (SOBRA.test(tr)) continue
      const tipo = TIPOS[tr.toLowerCase()]
      if (columnas && tipo) { if (!fila.types.includes(tipo)) fila.types.push(tipo); continue }
      const cat = CATEGORIAS[tr.toLowerCase()]
      if (columnas && cat) { Object.assign(fila, cat); continue }
      const rar = columnas && nombres.length ? rarezaDe(tr) : null
      if (rar && !fila.rarity) { fila.rarity = rar; continue }
      nombres.push(tr)
    }
    // Sin columnas, la rareza puede ir pegada al final con un espacio: las
    // siglas en mayúsculas («… ex RR») o el nombre entero («… Double Rare»).
    if (!columnas && nombres.length === 1) {
      // Un precio pegado al final (Cardmarket) no es parte del nombre.
      let n = nombres[0].replace(/\s+(?:€\s*)?\d+[.,]\d{2}\s*(?:€|\$)?$/, '')
      const sig = /\s+([A-Z]{1,4}|ACE|PR|●|◆|★★?)$/.exec(n)
      if (sig && SIGLAS_DE_RAREZA[sig[1].toLowerCase()]) { fila.rarity = SIGLAS_DE_RAREZA[sig[1].toLowerCase()]; n = n.slice(0, sig.index) }
      else {
        const r = RAREZAS_AL_FINAL.find((x) => n.toLowerCase().endsWith(' ' + x.toLowerCase()))
        if (r) { fila.rarity = rarezaCanonica(r); n = n.slice(0, n.length - r.length).trim() }
      }
      nombres[0] = n
    }
    ;[fila.name, fila.name_en] = [nombres[0] || '', nombres[1] || null]
    if (!fila.name) return void raras.push({ linea: i + 1, texto: t, motivo: 'falta el nombre' })
    const clave = numeroComparable(numero)
    if (vistos.has(clave)) return void raras.push({ linea: i + 1, texto: t, motivo: `el número ${numero} ya está en la línea ${vistos.get(clave)}` })
    vistos.set(clave, i + 1)
    filas.push(fila)
  })
  return { filas, raras }
}

const plano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

// Lo que se rellena de una carta que ya existe: solo lo VACÍO.
const RELLENABLES = ['rarity', 'name_en', 'types', 'category', 'trainer_type', 'energy_type', 'image_path']
const vacio = (v) => v == null || v === '' || (Array.isArray(v) && !v.length)

export function planDeLista(filas, cartas) {
  const porNumero = new Map((cartas || []).map((c) => [numeroComparable(c.local_id), c]))
  return filas.map((f) => {
    const c = porNumero.get(numeroComparable(f.local_id))
    if (!c) return { ...f, estado: 'nueva', cambios: null, carta: null }
    const cambios = {}
    for (const k of RELLENABLES) if (!vacio(f[k]) && vacio(c[k])) cambios[k] = f[k]
    const nombres = [c.name, c.name_en, c.name_es].map(plano).filter(Boolean)
    const otroNombre = nombres.length && ![f.name, f.name_en].map(plano).filter(Boolean).some((n) => nombres.some((x) => x === n || x.includes(n) || n.includes(x)))
    return { ...f, estado: Object.keys(cambios).length ? 'completa' : 'igual', cambios, carta: c, otroNombre }
  })
}

// El id de una carta creada a mano: el mismo que pone «Nueva carta».
export const idDeNueva = (setId, numero) => `mano-${setId}-${numero}`.toLowerCase().replace(/[^a-z0-9_-]+/g, '-')

export function cambiosDeNueva(f, setId) {
  const c = { set_id: setId, local_id: f.local_id, name: f.name }
  for (const k of ['name_en', 'rarity', 'category', 'trainer_type', 'energy_type', 'image_path']) if (!vacio(f[k])) c[k] = f[k]
  if (f.types?.length) c.types = f.types
  // Un Pokémon con tipo y sin categoría es un Pokémon.
  if (!c.category && f.types?.length) c.category = 'Pokemon'
  return c
}

export const cuentaDelPlan = (plan) => ({
  nuevas: plan.filter((p) => p.estado === 'nueva').length,
  completa: plan.filter((p) => p.estado === 'completa').length,
  igual: plan.filter((p) => p.estado === 'igual').length,
  otroNombre: plan.filter((p) => p.otroNombre).length,
})
