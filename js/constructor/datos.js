// Lo que el constructor le pide a la base: buscar cartas, traerlas por
// identificador, resolver una lista pegada y guardar mazos.
//
// Todo va contra NUESTRO espejo (`tcg_cards`), igual que el buscador y
// las decklists. La única excepción es el respaldo en inglés de
// `idsPorNombreIngles`: desde la tanda 330 el espejo reescribe el nombre
// de cada carta engordada en español, así que «Boss's Orders» ya no está
// en ninguna columna — y es como lo escribe media comunidad. Es UNA
// petición a TCGdex y solo cuando la búsqueda en casa ha dado cero, que
// es la misma excepción que admite la ficha de carta (tanda 331): lo
// caro es pedirle el catálogo entero, no una búsqueda que alguien acaba
// de escribir.
import { supabase } from '../supabase.js'
import { normalizeSearch } from '../tcgdex.js'
import { codigoLiveDeNombreDeSet } from '../torneos/comun.js'
import { marcasLegales } from '../carta-legalidad.js'
import { canonizarCarta } from '../carta-detalle.js'
import { claveDeNombre, esEnergiaBasica, idDeEnergiaBasica, letraDeCartaDeEnergia, letraDeEnergia, plano } from './nucleo.js'
import { canonizarEntradas } from '../impresiones-del-set.js'

// Las marcas legales de la temporada salen del mismo sitio que la ficha
// de carta (site_settings, con respaldo): se reexportan para que la
// página no tenga que saber de dónde vienen.
export { marcasLegales }

// `name` es el inglés y `name_es` el que se enseña (tanda 335).
export const COLUMNAS =
  'id,set_id,local_id,name,name_es,name_key,image_path,category,stage,evolve_from,trainer_type,energy_type,suffix,rarity,regulation_mark,hp,types'

const MERCADO = 'WEST'

// Las filas del espejo traen los enumerados mitad en inglés y mitad en
// español («Trainer»/«Entrenador»). Se pasan a la forma canónica al
// llegar, con la misma función que la ficha, y el resto del constructor
// ya solo ve una.
const canonizar = (filas) => (filas || []).map(canonizarCarta)

// ── Las colecciones y sus códigos de TCG Live ──
//
// `tcg_online_code` está a null en ~100 sets (TCGdex no lo trae en la
// era ME ni en los antiguos), así que el código sale de tres sitios, en
// este orden: la base, la tabla de nombres de /torneo (comun.js) y estos
// pocos que no tienen nombre en esa tabla. Los códigos de un admin
// (site_settings 'torneos_sets_live') mandan sobre todo, como en /torneo.
// Las promos de cada era: TCG Live las escribe «PR-XX» y Limitless con
// su propio código (SVP, SP, SMP…), y los dos se aceptan al importar.
const CODIGOS_EXTRA = { svp: 'PR-SV', swshp: 'PR-SW', smp: 'PR-SM', xyp: 'PR-XY', bwp: 'PR-BLW', sve: 'SVE', mee: 'MEE', mep: 'MEP' }
// Y al revés, los alias con los que llega un código en una lista.
const ALIAS_DE_CODIGO = {
  'PR-SV': 'svp', SVP: 'svp',
  'PR-SW': 'swshp', SP: 'swshp',
  'PR-SM': 'smp', SMP: 'smp',
  'PR-XY': 'xyp', XYP: 'xyp',
  'PR-BLW': 'bwp', BWP: 'bwp',
  'PR-ME': 'mep', MEP: 'mep',
  SVE: 'sve', MEE: 'mee',
}
// En el espejo, el número de una promo antigua lleva la era delante
// («SWSH251», «SM01»); en una lista viene a secas («251»).
export const PREFIJO_PROMO = { swshp: 'SWSH', smp: 'SM', xyp: 'XY', bwp: 'BW' }

let setsCache = null
export async function cargarSets() {
  if (setsCache) return setsCache
  const [{ data, error }, ajustes] = await Promise.all([
    supabase
      .from('tcg_sets')
      .select('id,name,serie_id,serie_name,tcg_online_code,release_date,card_count_official')
      .eq('market', MERCADO),
    supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'torneos_sets_live')
      .maybeSingle()
      .then((r) => r.data?.value?.codigos || {})
      .catch(() => ({})),
  ])
  if (error) throw error
  const sets = (data || []).slice()
  // Lo más nuevo arriba. Se ordena AQUÍ y no en la consulta: los sets sin
  // fecha tienen que ir al final, y PostgREST no garantiza el nullslast
  // (CLAUDE.md, tanda 322).
  sets.sort((a, b) => String(b.release_date || '').localeCompare(String(a.release_date || '')))

  const codigoDeId = new Map()
  const idDeCodigo = new Map()
  for (const s of sets) {
    const codigo = (s.tcg_online_code || codigoLiveDeNombreDeSet(s.name) || CODIGOS_EXTRA[s.id] || '').toUpperCase() || null
    if (codigo) {
      codigoDeId.set(s.id, codigo)
      if (!idDeCodigo.has(codigo)) idDeCodigo.set(codigo, s.id)
    }
  }
  for (const [codigo, id] of Object.entries(ALIAS_DE_CODIGO)) if (!idDeCodigo.has(codigo)) idDeCodigo.set(codigo, id)
  for (const [codigo, id] of Object.entries(ajustes)) {
    idDeCodigo.set(String(codigo).toUpperCase(), id)
    codigoDeId.set(id, String(codigo).toUpperCase())
  }
  setsCache = { sets, codigoDeId, idDeCodigo, porId: new Map(sets.map((s) => [s.id, s])) }
  return setsCache
}

// ── Buscar ──
//
// Los valores de categoría, subtipo y tipo están en DOS idiomas en el
// espejo (ver nucleo.js), así que cada filtro pide las dos formas.
const CATEGORIAS = { P: ['Pokemon', 'Pokémon'], T: ['Trainer', 'Entrenador'], E: ['Energy', 'Energía'] }
const SUBTIPOS = {
  partidario: ['Supporter', 'Partidario'],
  objeto: ['Item', 'Objeto'],
  herramienta: ['Tool', 'Herramienta', 'Pokémon Tool'],
  estadio: ['Stadium', 'Estadio'],
  basica: ['Básico', 'Normal', 'Basic'],
  especial: ['Special', 'Especial'],
}
export const TIPOS = [
  { id: 'planta', nombre: 'Planta', valores: ['Grass', 'Planta'] },
  { id: 'fuego', nombre: 'Fuego', valores: ['Fire', 'Fuego'] },
  { id: 'agua', nombre: 'Agua', valores: ['Water', 'Agua'] },
  // TCGdex declina en femenino los tipos con género («Oscura», no
  // «Oscuro»: concuerdan con «energía», tanda 342) y en el espejo se han
  // visto las dos formas, así que el filtro pide todas las conocidas —
  // las mismas que acepta `canonizarCarta` en carta-detalle.js.
  { id: 'rayo', nombre: 'Rayo', valores: ['Lightning', 'Rayo', 'Eléctrica', 'Eléctrico', 'Relámpago'] },
  { id: 'psiquico', nombre: 'Psíquico', valores: ['Psychic', 'Psíquico', 'Psíquica'] },
  { id: 'lucha', nombre: 'Lucha', valores: ['Fighting', 'Lucha', 'Combate'] },
  { id: 'oscura', nombre: 'Oscuridad', valores: ['Darkness', 'Oscura', 'Oscuro', 'Oscuridad', 'Siniestra', 'Siniestro'] },
  { id: 'metalica', nombre: 'Metálica', valores: ['Metal', 'Metálica', 'Metálico', 'Acero'] },
  { id: 'dragon', nombre: 'Dragón', valores: ['Dragon', 'Dragón'] },
  { id: 'hada', nombre: 'Hada', valores: ['Fairy', 'Hada'] },
  { id: 'incolora', nombre: 'Incolora', valores: ['Colorless', 'Incolora', 'Incoloro'] },
]
const SERIES_EXPANDIDO = ['bw', 'xy', 'sm', 'swsh', 'sv', 'me']

function aplicarFiltros(q, { categoria, subtipo, tipo, set, formato, legales }) {
  if (categoria && CATEGORIAS[categoria]) q = q.in('category', CATEGORIAS[categoria])
  // Las energías, por colección y no por `energy_type`, que en el espejo
  // marca «Básico» a especiales como la Prisma o la Ignición (ver
  // esEnergiaBasica en nucleo.js). Las básicas son las ocho de MEE, que
  // se pintan con el dibujo del 30 aniversario; las especiales, el resto
  // (las básicas de colecciones viejas las quita `buscarCartas` después).
  if (subtipo === 'basica') q = q.eq('set_id', 'mee')
  else if (subtipo === 'especial') q = q.in('category', CATEGORIAS.E).not('set_id', 'in', '(sve,mee)')
  else if (subtipo && SUBTIPOS[subtipo]) q = q.in('trainer_type', SUBTIPOS[subtipo])
  if (tipo) {
    const t = TIPOS.find((x) => x.id === tipo)
    if (t) q = q.overlaps('types', t.valores)
  }
  if (set) q = q.eq('set_id', set)
  if (formato === 'standard') {
    // Las básicas no rotan nunca, pero muchas llevan marca G: sin el `or`
    // el filtro de Estándar las escondería. Van las de MEE (ver arriba).
    q = q.or(`regulation_mark.in.(${legales.join(',')}),set_id.eq.mee`)
  } else if (formato === 'expanded') {
    q = q.or(SERIES_EXPANDIDO.map((s) => `set_id.like.${s}*`).join(','))
  }
  return q
}

// Devuelve { cartas, total }. Sin texto también busca si hay algún
// filtro (una colección entera, todos los partidarios de Estándar…),
// que es como más se construye.
export async function buscarCartas({ texto = '', categoria = '', subtipo = '', tipo = '', set = '', formato = 'standard', desde = 0, limite = 60 } = {}) {
  const legales = await marcasLegales()
  const palabras = normalizeSearch(texto).split(/\s+/).filter(Boolean)
  if (!palabras.length && !categoria && !subtipo && !tipo && !set) return { cartas: [], total: 0, sinFiltro: true }

  let q = supabase.from('tcg_cards').select(COLUMNAS, { count: 'exact' }).eq('market', MERCADO)
  for (const p of palabras) q = q.like('name_search', `%${p.replace(/[%_]/g, '')}%`)
  q = aplicarFiltros(q, { categoria, subtipo, tipo, set, formato, legales })
  // Dentro de una colección, por su número (así se ve como el álbum);
  // fuera, por nombre, para que las versiones de una carta salgan juntas.
  // (y las básicas, en el orden de siempre: Planta, Fuego, Agua…).
  q = set || subtipo === 'basica' ? q.order('local_id') : q.order('name_search').order('set_id', { ascending: false })
  const { data, error, count } = await q.range(desde, desde + limite - 1)
  if (error) throw error
  // Una energía básica es la misma carta en cualquier colección: se deja
  // solo la de MEE de cada tipo (sve y las de 2004 repetían ocho dibujos
  // en trescientas filas). `leidas` es lo que ha devuelto la base, que es
  // lo que cuenta para pedir la página siguiente.
  const leidas = (data || []).length
  let cartas = canonizar(data).filter(soloUnaBasica)
  let total = count ?? cartas.length

  // Cero en casa y hay texto: puede estar escrito en inglés.
  if (!cartas.length && palabras.length && desde === 0) {
    const ids = await idsPorNombreIngles(texto)
    if (ids.length) {
      let q2 = supabase.from('tcg_cards').select(COLUMNAS).eq('market', MERCADO).in('id', ids)
      q2 = aplicarFiltros(q2, { categoria, subtipo, tipo, set, formato, legales })
      const { data: d2 } = await q2.limit(limite)
      cartas = canonizar(d2).filter(soloUnaBasica)
      total = cartas.length
    }
  }
  return { cartas, total, leidas }
}

// Se quita la repetida solo si TIENE gemela en MEE (las de tipo con
// letra): la Energía Hada es básica sin gemela y tiene que salir.
const soloUnaBasica = (c) => !esEnergiaBasica(c) || c.set_id === 'mee' || !letraDeCartaDeEnergia(c)

// El respaldo en inglés: TCGdex busca por nombre «a lo laxo» (contiene)
// y devuelve identificadores, que son los mismos que los nuestros.
const ingles = new Map()
export async function idsPorNombreIngles(texto) {
  const t = String(texto || '').trim()
  if (t.length < 3) return []
  if (ingles.has(t)) return ingles.get(t)
  const promesa = cartasInglesas(t).then((lista) => lista.map((c) => c.id))
  ingles.set(t, promesa)
  return promesa
}

// Lo mismo, pero con el nombre inglés de cada una: para saber cuáles se
// llaman EXACTAMENTE así y no solo lo contienen.
const inglesas = new Map()
function cartasInglesas(t) {
  if (!inglesas.has(t)) {
    inglesas.set(
      t,
      fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(t)}`, { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : []))
        .then((lista) => (Array.isArray(lista) ? lista.filter((c) => c?.id).slice(0, 200) : []))
        .catch(() => [])
    )
  }
  return inglesas.get(t)
}

export async function cartasPorIds(ids) {
  const unicos = [...new Set(ids.filter(Boolean))]
  if (!unicos.length) return new Map()
  const fuera = new Map()
  // En tandas de 100: una URL con 300 identificadores se pasa del largo
  // que aceptan algunos proxies.
  for (let i = 0; i < unicos.length; i += 100) {
    const { data, error } = await supabase.from('tcg_cards').select(COLUMNAS).eq('market', MERCADO).in('id', unicos.slice(i, i + 100))
    if (error) throw error
    for (const c of canonizar(data)) fuera.set(c.id, c)
  }
  return fuera
}

// ── Lo que el laboratorio necesita y el buscador no (tanda 384) ──
//
// Ataques, habilidades, retirada, debilidad: el buscador no los pide
// porque pesan y no los pinta. El laboratorio sí los usa, y los pide al
// abrirse, UNA consulta por el mazo entero (de 100 en 100 como arriba).
// Las cartas que el engorde aún no ha visitado vuelven con esos campos a
// null, y el laboratorio lo dice al ver la carta en vez de inventárselos.
const COLUMNAS_DE_JUEGO = 'id,attacks,abilities,retreat,weaknesses,resistances,hp,types,stage,evolve_from,rarity'

export async function detallesDeJuego(ids) {
  const unicos = [...new Set(ids.filter(Boolean))]
  const fuera = new Map()
  for (let i = 0; i < unicos.length; i += 100) {
    const { data, error } = await supabase.from('tcg_cards').select(COLUMNAS_DE_JUEGO).eq('market', MERCADO).in('id', unicos.slice(i, i + 100))
    if (error) throw error
    // Sin los campos que vienen a null: `{ ...carta, ...detalle }` no
    // puede borrar con un null lo que la carta ya traía.
    for (const c of data || []) fuera.set(c.id, Object.fromEntries(Object.entries(c).filter(([, v]) => v != null)))
  }
  return fuera
}

// ── La regla de la reimpresión ──
// Qué cartas del mazo tienen ALGUNA impresión con marca legal. Devuelve
// el conjunto de sus `claveDeNombre`, que es lo que mira `validarMazo`.
//
// Se cruza por el nombre INGLÉS (`name`), como `hayReimpresionLegal` de
// carta-legalidad.js (tanda 335), y también por `name_key` mientras dure
// la reparación de los nombres: una fila que aún tenga el español en
// `name` sigue casando por su clave. Dos consultas para el mazo entero,
// en vez de una por carta como hace la ficha. Y una tercera por
// `name_es`: con la reparación a medias, la promo vieja de «Boss's
// Orders» ya tiene el inglés en `name` y las modernas todavía el español,
// así que por `name` no se encuentran entre sí; el nombre traducido, en
// cambio, lo llevan las dos.
export async function nombresConReimpresionLegal(cartas) {
  const lista = cartas.filter(Boolean)
  const nombres = [...new Set(lista.map((c) => c.name).filter(Boolean))]
  const claves = [...new Set(lista.map((c) => c.name_key).filter(Boolean))]
  const traducidos = [...new Set(lista.map((c) => c.name_es).filter(Boolean))]
  if (!nombres.length && !claves.length) return new Set()
  const legales = await marcasLegales()
  const pedir = (columna, valores) =>
    valores.length
      ? supabase
          .from('tcg_cards')
          .select('name,name_es,name_key')
          .eq('market', MERCADO)
          .in(columna, valores)
          .in('regulation_mark', legales)
          .limit(1000)
          .then(({ data }) => data || [])
          .catch(() => [])
      : Promise.resolve([])
  try {
    const filas = (await Promise.all([pedir('name', nombres), pedir('name_key', claves), pedir('name_es', traducidos)])).flat()
    const nombresLegales = new Set(filas.flatMap((r) => [r.name, r.name_es]).filter(Boolean))
    const clavesLegales = new Set(filas.map((r) => r.name_key))
    const fuera = new Set()
    for (const c of lista) {
      if (nombresLegales.has(c.name) || (c.name_es && nombresLegales.has(c.name_es)) || clavesLegales.has(c.name_key)) fuera.add(claveDeNombre(c))
    }
    return fuera
  } catch {
    return new Set()
  }
}

// ── Resolver una lista pegada ──
//
// Cada línea { n, nombre, set, numero } se convierte en una carta del
// espejo. Tres tiros, del más fiable al menos:
//   1. Su colección y su número: ES la impresión que la persona escribió.
//   2. Si es una energía básica, la de SVE de su tipo: se escriben de
//      mil maneras y todas son la misma carta.
//   3. Por el nombre (en casa, y si no, en inglés contra TCGdex), y de las
//      gemelas la más nueva con marca legal — la misma elección que hace
//      /torneo con las cartas que no identifica.
// Lo que no se resuelve vuelve en `sinResolver`: nunca se pierde una
// línea sin decirlo.
export async function resolverLineas(lineas) {
  const { idDeCodigo } = await cargarSets()
  const legales = await marcasLegales()
  const resueltas = []
  const sinResolver = []

  const candidatos = new Map() // línea → [ids]
  for (const l of lineas) {
    // Una línea de un ENLACE (los de /meta y los del constructor de
    // Limitless) no trae nombre: solo set y número. Las energías del 30
    // aniversario son MEE 9–16, que el espejo no tiene (solo MEE 1–8), y
    // por eso un mazo abierto desde /meta llegaba con 52 cartas y «No he
    // encontrado 3 MEE 13, 3 MEE 10…» (tanda 413). El tipo sale del
    // número, que va en el orden de siempre (G R W L P F D M).
    const letra = letraDeEnergia(l.nombre) || letraDeEnergiaPorNumero(l.set, l.numero)
    const esBasica =
      letra &&
      (letraDeEnergiaPorNumero(l.set, l.numero) ||
        /^(basic\s+)?(\{[a-z]\}|[a-z]+)\s+energy$/i.test(plano(l.nombre)) ||
        /^energia\s+\S+$/.test(plano(l.nombre)))
    // Una energía básica es la misma carta la escriban como la escriban
    // («SVE 18», «MEE 10», «Energy 2», una de 2004…): se lleva SIEMPRE a
    // la MEE de su tipo, que es la que se pinta con el dibujo del 30
    // aniversario. Así el mazo no parte en dos filas la misma energía.
    if (esBasica) {
      candidatos.set(l, [idDeEnergiaBasica(letra), `sve-${String('GRWLPFDM'.indexOf(letra) + 1).padStart(3, '0')}`])
      continue
    }
    if (l.set && l.numero) {
      const setId = idDeCodigo.get(l.set) || null
      if (setId) {
        const num = String(l.numero)
        const ids = [`${setId}-${num}`, `${setId}-${num.padStart(3, '0')}`, `${setId}-${num.replace(/^0+(?=\d)/, '')}`]
        const pre = PREFIJO_PROMO[setId]
        if (pre && /^\d+$/.test(num)) ids.push(`${setId}-${pre}${num}`, `${setId}-${pre}${num.padStart(2, '0')}`, `${setId}-${pre}${num.padStart(3, '0')}`)
        candidatos.set(l, ids)
      }
    }
  }
  const porId = await cartasPorIds([...candidatos.values()].flat())

  const porNombre = []
  for (const l of lineas) {
    const carta = (candidatos.get(l) || []).map((id) => porId.get(id)).find(Boolean)
    if (carta) resueltas.push({ linea: l, carta, exacta: true })
    else porNombre.push(l)
  }

  // Por nombre, de seis en seis para no lanzar cincuenta consultas a la
  // vez contra la base si alguien pega una lista entera sin códigos.
  for (let i = 0; i < porNombre.length; i += 6) {
    const tanda = porNombre.slice(i, i + 6)
    const res = await Promise.all(tanda.map((l) => mejorPorNombre(l.nombre, legales)))
    tanda.forEach((l, k) => {
      if (res[k]) resueltas.push({ linea: l, carta: res[k], exacta: false })
      else sinResolver.push(l)
    })
  }

  // La impresión que se enseña (tanda 413, js/impresion-canonica.js): la
  // de rareza más baja de su colección, y una sola colección por carta.
  // Juntar es también lo que hace que dos líneas de la MISMA carta (MEE 13
  // y SVE 5, las dos Psíquica) sumen sus copias: antes la segunda pisaba
  // a la primera en el mapa del mazo y se perdían cartas.
  const { codigoDeId } = await cargarSets()
  const juntas = await canonizarEntradas(
    resueltas.map((r) => ({ carta: r.carta, n: r.linea.n, linea: r.linea, exacta: r.exacta })),
    { columnas: COLUMNAS, codigoDeSet: (id) => codigoDeId.get(id) || '' }
  ).catch(() => resueltas.map((r) => ({ carta: r.carta, n: r.linea.n, linea: r.linea, exacta: r.exacta })))
  return {
    resueltas: juntas.map((e) => ({ linea: { ...e.linea, n: e.n }, carta: canonizarCarta(e.carta), exacta: e.exacta })),
    sinResolver,
  }
}

// El tipo de una energía básica por su número, para las líneas que no
// traen nombre. MEE 1–8 y 9–16 (las del 30 aniversario) y SVE 1–8 van
// en el mismo orden.
export function letraDeEnergiaPorNumero(set, numero) {
  const codigo = String(set || '').toUpperCase()
  const n = Number(String(numero || '').replace(/^0+(?=\d)/, ''))
  const tope = codigo === 'MEE' ? 16 : codigo === 'SVE' ? 8 : 0
  if (!tope || !Number.isInteger(n) || n < 1 || n > tope) return null
  return 'GRWLPFDM'[(n - 1) % 8]
}

// De todas las cartas que se llaman así, la que se juega hoy: marca legal
// primero, marca más alta después (la marca es cronológica) y, a falta de
// marca, la colección más nueva.
async function mejorPorNombre(nombre, legales) {
  const objetivo = normalizeSearch(nombre)
  const { sets } = await cargarSets()
  const orden = new Map(sets.map((s, i) => [s.id, i]))
  // Exacta en cualquiera de los dos idiomas: la lista puede venir de TCG
  // Live (inglés) o escrita a mano en español.
  const esExacta = (c) => normalizeSearch(c.name) === objetivo || (c.name_es && normalizeSearch(c.name_es) === objetivo) || c.name_key === objetivo
  // `yaExactas`: las que vienen de TCGdex casan por su nombre INGLÉS,
  // que en el espejo puede no estar (mientras dura la reparación de la
  // tanda 335 la fila moderna aún lleva el español en `name`). Volver a
  // filtrarlas aquí las tiraba, y se elegía una impresión vieja.
  const elegir = (lista, yaExactas = false) => {
    const exactas = yaExactas ? lista : lista.filter(esExacta)
    const pool = exactas.length ? exactas : lista
    return [...pool].sort((a, b) => {
      const la = legales.includes(a.regulation_mark) ? 1 : 0
      const lb = legales.includes(b.regulation_mark) ? 1 : 0
      if (la !== lb) return lb - la
      const ma = String(a.regulation_mark || '')
      const mb = String(b.regulation_mark || '')
      if (ma !== mb) return mb.localeCompare(ma)
      return (orden.get(a.set_id) ?? 9999) - (orden.get(b.set_id) ?? 9999)
    })[0]
  }
  try {
    // Se juntan las gemelas de los DOS idiomas antes de elegir: desde la
    // tanda 330 la impresión moderna de «Boss's Orders» se llama «Órdenes
    // de Jefes» en el espejo, y la única que sigue en inglés es una promo
    // de 2020. Elegir solo entre las de casa se quedaba con la promo
    // (fuera de Estándar) teniendo la legal a un paso.
    const [{ cartas }, deFuera] = await Promise.all([
      buscarCartas({ texto: nombre, formato: 'libre', limite: 60 }),
      String(nombre).trim().length >= 3 ? cartasInglesas(String(nombre).trim()) : [],
    ])
    const exactasCasa = cartas.filter(esExacta)
    const idsIngles = deFuera.filter((c) => normalizeSearch(c.name) === objetivo).map((c) => c.id)
    const exactasFuera = idsIngles.length ? [...(await cartasPorIds(idsIngles)).values()] : []
    const exactas = [...new Map([...exactasCasa, ...exactasFuera].map((c) => [c.id, c])).values()]
    if (exactas.length) return elegir(exactas, true)
    // Nadie se llama exactamente así: lo que más se le parezca.
    if (cartas.length) return elegir(cartas)
    if (deFuera.length) {
      const todas = [...(await cartasPorIds(deFuera.map((c) => c.id))).values()]
      if (todas.length) return elegir(todas)
    }
    return null
  } catch {
    return null
  }
}

// ── Los mazos guardados ──
//
// Si la migración aún no está puesta, PostgREST contesta que la tabla no
// existe (PGRST205 / 42P01). Se traduce a un mensaje que diga qué falta,
// en vez de un «error» a secas que nadie sabe arreglar.
export const FICHERO_MIGRACION = 'supabase-migration-mazos.sql'
function traducirError(error) {
  if (!error) return null
  const falta = error.code === 'PGRST205' || error.code === '42P01' || /user_decks/.test(String(error.message || '')) && /not find|does not exist/i.test(String(error.message || ''))
  const e = new Error(falta ? `Falta ejecutar ${FICHERO_MIGRACION} en el SQL Editor de Supabase: hasta entonces los mazos no se pueden guardar.` : error.message || 'No se ha podido guardar.')
  e.faltaMigracion = falta
  return e
}

const COLUMNAS_MAZO = 'id,user_id,name,format,cards,cover_card,is_public,created_at,updated_at'

export async function misMazos(userId) {
  const { data, error } = await supabase.from('user_decks').select(COLUMNAS_MAZO).eq('user_id', userId).order('updated_at', { ascending: false })
  if (error) throw traducirError(error)
  return data || []
}

export async function cargarMazo(id) {
  const { data, error } = await supabase.from('user_decks').select(COLUMNAS_MAZO).eq('id', id).maybeSingle()
  if (error) throw traducirError(error)
  return data
}

export async function guardarMazo({ id, name, format, cards, cover_card, is_public }) {
  const fila = { name: String(name || '').trim().slice(0, 80) || 'Mazo sin nombre', format, cards, cover_card: cover_card || null, is_public: !!is_public }
  const consulta = id
    ? supabase.from('user_decks').update(fila).eq('id', id).select(COLUMNAS_MAZO).maybeSingle()
    : supabase.from('user_decks').insert(fila).select(COLUMNAS_MAZO).maybeSingle()
  const { data, error } = await consulta
  if (error) throw traducirError(error)
  // Un UPDATE que la política rechaza NO da error: vuelve vacío (CLAUDE.md,
  // torneos). Sin fila de vuelta, no se ha guardado — y hay que decirlo.
  // `sinFila` dice POR QUÉ (tanda 420): el mazo de ese id no está en tu
  // cuenta —se borró, o es de otra—, y quien guarda puede hacerlo como
  // mazo nuevo en vez de quedarse con el error.
  if (!data) {
    const e = new Error(id ? 'Ese mazo ya no está en tu cuenta.' : 'No se ha guardado. Prueba otra vez.')
    e.sinFila = Boolean(id)
    throw e
  }
  return data
}

// Cambiar SOLO la portada (tanda 413, «Mis mazos»): sin tocar las
// cartas ni el nombre, para no pisar un cambio hecho en otra pestaña.
// Con `.select()` como guardarMazo: un update que la política rechaza
// vuelve vacío y sin error.
export async function cambiarPortada(id, cartaId) {
  const { data, error } = await supabase.from('user_decks').update({ cover_card: cartaId }).eq('id', id).select(COLUMNAS_MAZO).maybeSingle()
  if (error) throw traducirError(error)
  if (!data) throw new Error('No se ha cambiado: este mazo no es tuyo.')
  return data
}

export async function borrarMazo(id) {
  const { error, count } = await supabase.from('user_decks').delete({ count: 'exact' }).eq('id', id)
  if (error) throw traducirError(error)
  if (count === 0) throw new Error('No se ha borrado: el mazo no existe o no es tuyo.')
}
