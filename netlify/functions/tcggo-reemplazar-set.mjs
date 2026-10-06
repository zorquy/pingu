// Reemplazar una expansión nuestra por la de TCGGO, entera y SOLA (tanda 654).
//
// PINGU, con el 30 aniversario roto a partir de la Classic Collection:
// «sustituye todo el set con todas las cartas que tenga dentro la API de
// TCGGO y ya está, que está bien; no hagas mezclas de nada». Y después:
// «no me lo pongas como un botón en el admin, hazlo tú automáticamente».
// Así que es una función PROGRAMADA: cada cinco minutos mira si queda
// algún reemplazo de la lista `REEMPLAZOS` sin hacer, hace UNO y lo apunta
// en `scrydex_estado` (`tcggo_reemplazos`). Hecho, no vuelve a tocarlo;
// fallado, lo reintenta hasta `MAXIMO_INTENTOS` y para (la lección de la
// 510: un freno cuenta intentos, no pregunta «¿queda algo?»). Con todo
// hecho, una pasada es leer el estado y nada más: cero peticiones a
// TCGGO.
//
// La expansión suya NO va escrita a mano: se lee del emparejamiento que
// ya hizo `tcggo-emparejar` para el set destino (`tcggo_pares.hechos`), o
// se resuelve por código/nombre contra su lista. Sin eso, se espera.
//
// Qué hace un reemplazo (`procesar`), en este orden y solo si TCGGO ha
// contestado la expansión ENTERA (si se corta a mitad no se escribe nada):
//
//  1. Pide las cartas del episodio (solo «singles»).
//  2. Lee nuestras cartas de los sets que se van a reemplazar.
//  3. Arma las filas de TCGGO: una carta nuestra del set DESTINO que ya
//     lleve su `tcggo_id` conserva su id (es la misma carta: cambiarle el
//     id sería cambiar la URL y la llave de la colección para nada); las
//     demás entran como «tcggo-<id suyo>».
//  4. Lo nuestro que no está en esa lista SE VA. Antes de borrarlo, lo que
//     la gente tenga apuntado de esas cartas (colección, deseos, álbumes)
//     se reapunta a la carta de TCGGO del mismo nombre —único en los dos
//     lados, y si no, nombre + dígitos del número—. Una carta que alguien
//     tiene y no tiene equivalente NO se borra: se deja y se dice. Lo que
//     no tiene nadie se borra sin más, con sus precios y su histórico.
//  5. Los sets que sobran (todos menos el destino) se borran si se han
//     quedado vacíos, con su valor diario y sus favoritos.
//  6. El destino queda apuntado al episodio (`tcggo_id`) con el total de
//     cartas de TCGGO.
//
// Sin migración: escribe por la RPC que ya existe (`tcggo_guardar_cartas`)
// y lo demás por REST con la clave de servicio, que se salta la RLS. Los
// precios de las cartas nuevas llegan con la pasada siguiente de
// `tcggo-precios` por su `cm_id_product_propio`.
//
// Y el modo ENTERO (tanda 666), que es lo que PINGU pidió la segunda vez
// —«te paso esto y sustituyes todo, que sigue estando mal con cartas
// duplicadas, cartas que enlazan mal, mal las imágenes… simplemente coge
// todo el set como aquí»—: NADA se conserva. Toda carta entra como
// «tcggo-<id suyo>» con el número y la foto de TCGGO, la que ya era la
// misma carta incluida (su línea de colección se reapunta por el
// `tcggo_id`, que es exacto); lo que alguien tiene y no casa por nombre
// se reapunta a la suya del mismo nombre con el número más cercano
// (`nombre aproximado`, apuntado para poder corregirlo), y lo que no
// tiene NINGUNA suya con ese nombre se borra con sus líneas, que se dejan
// escritas en el estado (quién, qué carta, cuántas) para que no se pierda
// en silencio. La expansión va escrita (431, de su propia respuesta).
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY; opcionales
// TCGGO_BASE y TCGGO_PAUSA_MS.
import {
  cabeceras, baseDe, baseJpDe, urlCartasDeEpisodio, hayMasPaginas, esCartaSuelta, esLimiteDelPlan, filaDeCartaTcggo, nombreComparable, soloDigitos,
} from '../lib/tcggo.mjs'
import { CLAVE_ESTADO as CLAVE_PARES, PAUSA_MS } from './tcggo-emparejar.mjs'
import { CLAVE_ESTADO as CLAVE_CATALOGO } from './tcggo-catalogo.mjs'
import { episodioDeSet } from '../lib/tcggo.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const MS_DE_MARGEN = 22_000
const MAXIMO_SETS = 5
export const CLAVE_ESTADO = 'tcggo_reemplazos'
export const MAXIMO_INTENTOS = 5
// EL BARRIDO DE HUECOS (670). PINGU: «el Expansion Pack japonés está
// vacío: el logo está y te dice cuántas cartas contiene, pero cuando
// entras no hay cartas». Son sets que TCGdex trae con nombre y logo pero
// sin una sola carta (68 de los 186 japoneses), y que el catálogo de TCGGO
// no rellena porque solo escribe en los sets que casa por código o
// nombre. Con los reemplazos de la lista hechos, cada pasada mira hasta
// `MAXIMO_PROBADOS` sets que no haya mirado (o que mirara hace más de
// `DIAS_REVISAR`), pregunta a NUESTRA base si tienen alguna carta (gratis),
// y al PRIMERO vacío con expansión de TCGGO conocida lo rellena con
// `procesar` — uno por pasada, que es una expansión entera a la API de
// pago. Un set vacío cuya expansión ya la lleva OTRO set nuestro no se
// rellena (sería la misma expansión dos veces, y la 646 ya los pliega):
// se le apunta el `tcggo_id` para que se plieguen, y nada más. Lo que
// falla cuenta intentos y para en `MAXIMO_INTENTOS`; lo que no tiene
// expansión se vuelve a mirar a la semana, por si el emparejador la trae.
export const MAXIMO_PROBADOS = 8
export const DIAS_REVISAR = 7
// Qué expansiones se reemplazan enteras por las de TCGGO. El 30
// aniversario: TCGGO lleva la Classic Collection dentro con los números
// de la carta original, y lo nuestro (TCGdex) tenía la Classic aparte en
// `30th-c` y la parte buena duplicada. La expansión suya se resuelve en
// ejecución (ver `episodioDe`), no va aquí.
export const REEMPLAZOS = [
  { clave: '30th', sets: ['30th', '30th-c'], destino: '30th', mercado: 'WEST' },
  // La segunda vez, entero y con su expansión escrita (666).
  { clave: '30th-entero', sets: ['30th', '30th-c'], destino: '30th', mercado: 'WEST', episodio: 431, entero: true },
]
const MAXIMO_PAGINAS = 40

async function rest(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...(opciones || {}),
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      ...(opciones ? { 'content-type': 'application/json' } : {}),
      ...(opciones && !ruta.startsWith('rpc/') ? { prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
      ...(opciones?.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}

const lista = (ids) => ids.map((s) => `"${encodeURIComponent(s)}"`).join(',')
const idDeSet = (s) => String(s || '').trim()

// Qué carta de TCGGO es cada carta nuestra que se va: la del mismo
// `tcggo_id` si lo tiene (es LA MISMA carta), si no por el nombre inglés
// (único en los dos lados), y si el nombre se repite —«Pikachu» dos veces—
// por nombre + dígitos del número. Con `aproximar`, lo que siga sin pareja
// y tenga alguna suya del mismo nombre va a la del número más cercano
// (666: PINGU quiere el set entero de TCGGO y nada nuestro dentro).
// Devuelve un mapa id viejo → id nuevo.
export function equivalencias(viejas, nuevas, { aproximar = false } = {}) {
  const cuenta = (xs, clave) => {
    const m = new Map()
    for (const x of xs) { const k = clave(x); if (k) m.set(k, (m.get(k) || []).concat([x])) }
    return m
  }
  const nombreDe = (c) => nombreComparable(c.name_en || c.name)
  const nombreYNumero = (c) => `${nombreDe(c)}#${soloDigitos(c.local_id)}`
  const resultado = new Map()
  const porTcggo = new Map(nuevas.filter((n) => Number.isInteger(n.tcggo_id)).map((n) => [n.tcggo_id, n]))
  for (const v of viejas) {
    const n = Number.isInteger(v.tcggo_id) ? porTcggo.get(v.tcggo_id) : null
    if (n && n.id !== v.id) resultado.set(v.id, { a: n.id, por: 'tcggo_id' })
  }
  for (const [clave, rotulo] of [[nombreDe, 'nombre'], [nombreYNumero, 'nombre+numero']]) {
    const porViejo = cuenta(viejas.filter((v) => !resultado.has(v.id)), clave)
    const porNuevo = cuenta(nuevas, clave)
    for (const [k, vs] of porViejo) {
      const ns = porNuevo.get(k) || []
      if (vs.length === 1 && ns.length === 1 && vs[0].id !== ns[0].id) resultado.set(vs[0].id, { a: ns[0].id, por: rotulo })
    }
  }
  if (aproximar) {
    const porNombre = cuenta(nuevas, nombreDe)
    for (const v of viejas) {
      if (resultado.has(v.id)) continue
      const ns = (porNombre.get(nombreDe(v)) || []).filter((n) => n.id !== v.id)
      if (!ns.length) continue
      const numero = Number(soloDigitos(v.local_id)) || 0
      const distancia = (n) => Math.abs((Number(soloDigitos(n.local_id)) || 0) - numero)
      const [mejor] = [...ns].sort((a, b) => distancia(a) - distancia(b) || String(a.id).localeCompare(String(b.id)))
      resultado.set(v.id, { a: mejor.id, por: 'nombre aproximado' })
    }
  }
  return resultado
}

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, guardarCartasImpl = null,
  sets = [], episodio = null, destino = null, mercado = 'WEST', entero = false,
  reloj = () => Date.now(), pausa = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const claveTcggo = env.TCGGO_API_KEY
  if (!claveTcggo) return { ok: false, error: 'Falta TCGGO_API_KEY en Netlify' }
  const idsSets = [...new Set((Array.isArray(sets) ? sets : []).map(idDeSet).filter(Boolean))].slice(0, MAXIMO_SETS)
  const setDestino = idDeSet(destino) || idsSets[0]
  const idEpisodio = Number(episodio)
  if (!idsSets.length) return { ok: false, error: 'Di qué sets nuestros se reemplazan.' }
  if (!idsSets.includes(setDestino)) return { ok: false, error: 'El set destino tiene que ser uno de los que se reemplazan.' }
  if (!Number.isInteger(idEpisodio) || idEpisodio <= 0) return { ok: false, error: 'Di el número de la expansión de TCGGO (episode_id).' }
  if (!['WEST', 'JP'].includes(mercado)) return { ok: false, error: 'Mercado desconocido.' }
  const pausaMs = env.TCGGO_PAUSA_MS !== undefined && env.TCGGO_PAUSA_MS !== '' && Number(env.TCGGO_PAUSA_MS) >= 0 ? Number(env.TCGGO_PAUSA_MS) : PAUSA_MS
  const { base, host } = baseDe(env)
  const baseMercado = mercado === 'JP' ? baseJpDe(base) : base
  const arranque = reloj()
  const quedaTiempo = () => reloj() - arranque < MS_DE_MARGEN
  const pedir = restImpl || ((ruta, opciones = null) => rest(ruta, clave, opciones))
  const guardarCartas = guardarCartasImpl || ((filas, m) => rest('rpc/tcggo_guardar_cartas', clave, { method: 'POST', body: JSON.stringify({ p_cartas: filas, p_market: m }) }))

  // ── 1. La expansión de TCGGO, entera ──
  const suyas = []
  let descartadas = 0
  let peticiones = 0
  let pagina = 1
  for (;;) {
    if (!quedaTiempo()) return { ok: false, error: 'No ha dado tiempo a pedir la expansión entera; no se ha tocado nada. Vuelve a intentarlo.' }
    if (peticiones && pausaMs) await pausa(pausaMs)
    peticiones++
    const res = await fetchImpl(urlCartasDeEpisodio(idEpisodio, pagina, baseMercado), { headers: cabeceras(claveTcggo, host) })
    const texto = await res.text()
    if (!res.ok) return { ok: false, peticiones, error: esLimiteDelPlan(res.status, texto) ? `RapidAPI ${res.status}: el plan no da más por ahora` : `TCGGO ${res.status}: ${texto.slice(0, 160)}` }
    let datos
    try { datos = JSON.parse(texto) } catch { return { ok: false, peticiones, error: 'TCGGO ha contestado algo que no es JSON' } }
    for (const s of datos.data || []) {
      if (esCartaSuelta(s)) suyas.push(s)
      else descartadas++
    }
    // Se sigue mientras SU `paging` diga que queda página (y con tope,
    // por si lo dijera siempre): una página corta no es el final si
    // paging dice lo contrario.
    if (!hayMasPaginas(datos) || !(datos.data || []).length || pagina >= MAXIMO_PAGINAS) break
    pagina++
  }
  if (!suyas.length) return { ok: false, peticiones, error: `TCGGO no da ninguna carta en la expansión ${idEpisodio}: no se reemplaza nada por nada.` }

  // ── 2. Lo nuestro ──
  let nuestras
  let setsNuestros
  try {
    setsNuestros = (await pedir(`tcg_sets?select=id,name,name_en,tcggo_id&market=eq.${mercado}&id=in.(${lista(idsSets)})`)) || []
    nuestras = (await pedir(`tcg_cards?select=id,set_id,local_id,name,name_en,tcggo_id&market=eq.${mercado}&set_id=in.(${lista(idsSets)})&limit=5000`)) || []
  } catch (e) {
    return { ok: false, peticiones, error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
  }
  if (!setsNuestros.some((s) => s.id === setDestino)) return { ok: false, peticiones, error: `El set «${setDestino}» no existe en el mercado ${mercado}.` }

  // ── 3. Las filas de TCGGO ──
  // En el modo entero no se conserva ninguna: todas con el id, el número
  // y la foto de TCGGO (666).
  const porTcggoId = new Map()
  if (!entero) for (const c of nuestras) if (c.set_id === setDestino && Number.isInteger(c.tcggo_id)) porTcggoId.set(c.tcggo_id, c)
  const filas = []
  const conservadas = []
  for (const s of suyas) {
    const n = porTcggoId.get(s.id)
    if (n) conservadas.push(n.id)
    filas.push(filaDeCartaTcggo(s, { setId: setDestino, nuestra: n || null }))
  }
  const idsNuevos = new Set(filas.map((f) => f.id))
  const seVan = nuestras.filter((c) => !idsNuevos.has(c.id))

  // ── 4. Lo que la gente tiene apuntado de las que se van ──
  const equiv = equivalencias(seVan, filas, { aproximar: entero })
  const idsQueSeVan = seVan.map((c) => c.id)
  const traer = async (tabla, columnas) => (idsQueSeVan.length ? (await pedir(`${tabla}?select=${columnas}&card_id=in.(${lista(idsQueSeVan)})&limit=10000`)) || [] : [])
  let lineas
  let deseos
  let albumes = []
  try {
    lineas = await traer('user_collection', 'id,card_id,user_id,cantidad')
    deseos = await traer('user_wants', 'id,card_id,user_id')
    // Los álbumes guardan ids en un JSON: se piden los que contengan alguna.
    for (const id of idsQueSeVan.filter((id) => equiv.has(id))) {
      const encontrados = (await pedir(`user_albums?select=id,cartas&cartas=cs.${encodeURIComponent(JSON.stringify([{ id }]))}`)) || []
      for (const a of encontrados) if (!albumes.some((b) => b.id === a.id)) albumes.push(a)
    }
  } catch (e) {
    return { ok: false, peticiones, error: `nuestra base al leer colecciones: ${String(e?.message || e).slice(0, 160)}` }
  }
  // Una carta que alguien tiene y no tiene equivalente se queda — salvo
  // en el modo entero, donde se va con sus líneas, y las líneas se dejan
  // escritas en el resumen (quién, qué, cuántas): se borra, pero no en
  // silencio.
  const conLineas = new Set([...lineas, ...deseos].map((l) => l.card_id))
  const seQuedan = entero ? [] : seVan.filter((c) => conLineas.has(c.id) && !equiv.has(c.id))
  const seBorran = seVan.filter((c) => !seQuedan.some((q) => q.id === c.id))
  const nombreDe = (id) => { const c = seVan.find((x) => x.id === id); return c ? c.name_en || c.name : id }
  const lineasSinDestino = entero ? [...lineas.map((l) => ({ ...l, tabla: 'user_collection' })), ...deseos.map((l) => ({ ...l, tabla: 'user_wants' }))].filter((l) => !equiv.has(l.card_id)).map((l) => ({ tabla: l.tabla, id: l.id, usuario: l.user_id || null, carta: l.card_id, nombre: nombreDe(l.card_id), copias: l.cantidad ?? null })) : []

  // ── Escribir, en el orden que no deja nada colgando ──
  let escritas = 0
  let lineasMovidas = 0
  let deseosMovidos = 0
  let albumesTocados = 0
  try {
    for (let k = 0; k < filas.length; k += 300) escritas += Number(await guardarCartas(filas.slice(k, k + 300), mercado)) || 0
  } catch (e) {
    const m = String(e?.message || e)
    if (/tcggo_guardar_cartas|42883|PGRST202/.test(m)) return { ok: false, peticiones, error: 'falta ejecutar supabase-migration-tcggo-catalogo.sql (tcggo_guardar_cartas)' }
    return { ok: false, peticiones, error: `nuestra base al escribir cartas: ${m.slice(0, 160)}` }
  }
  try {
    for (const l of lineas) {
      const e = equiv.get(l.card_id)
      if (!e) continue
      await pedir(`user_collection?id=eq.${encodeURIComponent(l.id)}`, { method: 'PATCH', body: JSON.stringify({ card_id: e.a }) })
      lineasMovidas++
    }
    for (const d of deseos) {
      const e = equiv.get(d.card_id)
      if (!e) continue
      await pedir(`user_wants?id=eq.${encodeURIComponent(d.id)}`, { method: 'PATCH', body: JSON.stringify({ card_id: e.a }) })
      deseosMovidos++
    }
    for (const a of albumes) {
      const cartas = (Array.isArray(a.cartas) ? a.cartas : []).map((x) => (x && equiv.has(x.id) ? { ...x, id: equiv.get(x.id).a } : x))
      await pedir(`user_albums?id=eq.${encodeURIComponent(a.id)}`, { method: 'PATCH', body: JSON.stringify({ cartas }) })
      albumesTocados++
    }
    const idsBorrar = seBorran.map((c) => c.id)
    if (idsBorrar.length) {
      // En el modo entero, las líneas que no tienen a dónde ir se van con
      // su carta (ya están apuntadas en `lineasSinDestino`).
      for (const l of lineasSinDestino) await pedir(`${l.tabla}?id=eq.${encodeURIComponent(l.id)}`, { method: 'DELETE' })
      for (const tabla of ['tcg_card_history', 'tcg_card_prices']) await pedir(`${tabla}?card_id=in.(${lista(idsBorrar)})`, { method: 'DELETE' })
      await pedir(`tcg_cards?market=eq.${mercado}&id=in.(${lista(idsBorrar)})`, { method: 'DELETE' })
    }
  } catch (e) {
    return { ok: false, peticiones, escritas, lineasMovidas, error: `nuestra base al reapuntar o borrar: ${String(e?.message || e).slice(0, 160)}` }
  }

  // ── 5. Los sets que sobran, si se han quedado vacíos ──
  const setsBorrados = []
  const setsQueSeQuedan = []
  try {
    for (const s of idsSets.filter((x) => x !== setDestino)) {
      const quedan = seQuedan.filter((c) => c.set_id === s).length
      if (quedan) { setsQueSeQuedan.push({ set: s, cartas: quedan }); continue }
      await pedir(`tcg_set_valor?market=eq.${mercado}&set_id=eq.${encodeURIComponent(s)}`, { method: 'DELETE' })
      await pedir(`collection_favorite_sets?set_id=eq.${encodeURIComponent(s)}`, { method: 'DELETE' })
      await pedir(`tcg_sets?market=eq.${mercado}&id=eq.${encodeURIComponent(s)}`, { method: 'DELETE' })
      setsBorrados.push(s)
    }
    // ── 6. El destino, apuntado a su expansión ──
    await pedir(`tcg_sets?market=eq.${mercado}&id=eq.${encodeURIComponent(setDestino)}`, { method: 'PATCH', body: JSON.stringify({ tcggo_id: idEpisodio, card_count_total: suyas.length }) })
  } catch (e) {
    return { ok: false, peticiones, escritas, lineasMovidas, error: `nuestra base al recoger los sets: ${String(e?.message || e).slice(0, 160)}` }
  }

  return {
    ok: true, mercado, episodio: idEpisodio, destino: setDestino, sets: idsSets, peticiones, entero,
    suyas: suyas.length, descartadas, escritas, conservadas: conservadas.length, nuevas: filas.length - conservadas.length,
    borradas: seBorran.length, equivalencias: [...equiv].map(([de, e]) => ({ de, a: e.a, por: e.por })),
    lineasMovidas, deseosMovidos, albumesTocados,
    seQuedan: seQuedan.map((c) => ({ id: c.id, nombre: c.name_en || c.name, motivo: 'alguien la tiene y TCGGO no tiene ninguna con ese nombre' })),
    aproximadas: [...equiv].filter(([, e]) => e.por === 'nombre aproximado').map(([de, e]) => ({ de, a: e.a, nombre: nombreDe(de) })),
    lineasSinDestino,
    setsBorrados, setsQueSeQuedan,
  }
}

// Qué expansión de TCGGO es un set nuestro: la que decidió el emparejador
// (`tcggo_pares.hechos[set].episodio`), y si no, la que case por código o
// nombre contra su lista. Sin lista, no se sabe y se espera a que corra.
export function episodioDe(set, pares) {
  const h = pares?.hechos?.[set?.id]
  if (h && Number.isInteger(h.episodio) && !h.sospechoso) return { episodio: h.episodio, por: 'pares' }
  const lista = Array.isArray(pares?.episodios?.lista) ? pares.episodios.lista : []
  if (!lista.length || !set) return { episodio: null, por: 'sin lista de expansiones todavía' }
  const r = episodioDeSet(set, lista)
  return r?.episodio ? { episodio: r.episodio.id, por: r.por } : { episodio: null, por: r?.porque || 'ninguna expansión suya casa' }
}

// La pasada programada: un reemplazo pendiente por pasada, apuntado.
export async function pasada({ env = process.env, restImpl = null, estadoImpl = null, guardarEstadoImpl = null, procesarImpl = null, reemplazos = REEMPLAZOS, ahora = new Date(), ...resto } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const pedir = restImpl || ((ruta, opciones = null) => rest(ruta, clave, opciones))
  const leerEstado = estadoImpl || (async (k) => (await pedir(`scrydex_estado?select=valor&clave=eq.${k}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((k, valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: k, valor, updated_at: new Date().toISOString() }]) }))
  let estado
  let pares
  try {
    estado = await leerEstado(CLAVE_ESTADO)
    pares = await leerEstado(CLAVE_PARES)
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|scrydex_estado/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-scrydex-cartas.sql (scrydex_estado)' }
    return { ok: false, error: m.slice(0, 200) }
  }
  estado = estado && typeof estado === 'object' ? estado : {}
  if (!estado.hechos || typeof estado.hechos !== 'object') estado.hechos = {}
  if (!estado.intentos || typeof estado.intentos !== 'object') estado.intentos = {}
  const pendiente = reemplazos.find((r) => !estado.hechos[r.clave] && (Number(estado.intentos[r.clave]) || 0) < MAXIMO_INTENTOS)
  if (!pendiente) {
    // Con la lista hecha, el barrido de huecos (670).
    let catalogo = {}
    try { catalogo = await leerEstado(CLAVE_CATALOGO) } catch { catalogo = {} }
    const huecos = await barrerHuecos({ env, restImpl, pedir, estado, pares, catalogo, procesarImpl, ahora, ...resto })
    await guardarEstado(CLAVE_ESTADO, estado)
    return { ok: true, hecho: true, hechos: Object.keys(estado.hechos), parados: reemplazos.filter((r) => !estado.hechos[r.clave]).map((r) => r.clave), huecos }
  }
  // El set destino, para resolver su expansión.
  let set = null
  try {
    set = (await pedir(`tcg_sets?select=id,name,name_en,tcg_online_code&market=eq.${pendiente.mercado || 'WEST'}&id=eq.${encodeURIComponent(pendiente.destino)}&limit=1`))?.[0] || null
  } catch (e) {
    return { ok: false, error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
  }
  if (!set) {
    estado.intentos[pendiente.clave] = (Number(estado.intentos[pendiente.clave]) || 0) + 1
    estado.ultimo = { clave: pendiente.clave, fecha: ahora.toISOString(), error: `el set «${pendiente.destino}» no existe` }
    await guardarEstado(CLAVE_ESTADO, estado)
    return { ok: false, clave: pendiente.clave, error: estado.ultimo.error }
  }
  // Una expansión escrita en la lista manda (666: la dio PINGU de la
  // propia respuesta de TCGGO); si no, la de los pares.
  const { episodio, por } = Number.isInteger(pendiente.episodio) && pendiente.episodio > 0 ? { episodio: pendiente.episodio, por: 'lista' } : episodioDe(set, pares)
  // Sin expansión suya no se cuenta como intento: no se ha gastado nada y
  // el emparejador puede traerla en su próxima pasada.
  if (!episodio) return { ok: true, clave: pendiente.clave, esperando: `sin expansión de TCGGO para «${set.id}»: ${por}` }
  const r = await (procesarImpl || procesar)({ env, restImpl, sets: pendiente.sets, destino: pendiente.destino, mercado: pendiente.mercado || 'WEST', episodio, entero: !!pendiente.entero, ...resto })
  if (r.ok) {
    estado.hechos[pendiente.clave] = { fecha: ahora.toISOString(), episodio, por, resumen: { suyas: r.suyas, escritas: r.escritas, conservadas: r.conservadas, nuevas: r.nuevas, borradas: r.borradas, lineasMovidas: r.lineasMovidas, deseosMovidos: r.deseosMovidos, albumesTocados: r.albumesTocados, seQuedan: r.seQuedan, aproximadas: r.aproximadas, lineasSinDestino: r.lineasSinDestino, setsBorrados: r.setsBorrados, setsQueSeQuedan: r.setsQueSeQuedan } }
  } else {
    estado.intentos[pendiente.clave] = (Number(estado.intentos[pendiente.clave]) || 0) + 1
    estado.ultimo = { clave: pendiente.clave, fecha: ahora.toISOString(), error: r.error }
  }
  await guardarEstado(CLAVE_ESTADO, estado)
  return { ...r, clave: pendiente.clave, episodioPor: por, intentos: estado.intentos[pendiente.clave] || 0 }
}

// El barrido (670): ver el comentario de MAXIMO_PROBADOS. Devuelve lo que ha
// hecho esta pasada y deja el detalle en `estado.huecos`.
export async function barrerHuecos({ env = process.env, restImpl = null, pedir, estado, pares, catalogo, procesarImpl = null, ahora = new Date(), mercados = ['JP', 'WEST'], ...resto } = {}) {
  if (!estado.huecos || typeof estado.huecos !== 'object') estado.huecos = {}
  const h = estado.huecos
  if (!h.vistos || typeof h.vistos !== 'object') h.vistos = {}
  if (!h.intentos || typeof h.intentos !== 'object') h.intentos = {}
  const resumen = { probados: 0, llenos: 0, hermanos: 0, sinEpisodio: 0, rellenado: null, error: null }
  const clave = (m, id) => `${m}:${id}`
  const caducado = (v) => !v?.fecha || (ahora.getTime() - new Date(v.fecha).getTime()) / 86_400_000 > DIAS_REVISAR
  const listaDe = (m) => (m === 'WEST' ? pares?.episodios?.lista : catalogo?.episodiosJp?.lista) || []
  let pendientes = MAXIMO_PROBADOS
  let rellenadoEstaPasada = false
  for (const m of mercados) {
    if (pendientes <= 0 || rellenadoEstaPasada) break
    let sets
    try {
      sets = (await pedir(`tcg_sets?select=id,name,name_en,tcg_online_code,tcggo_id,oculto&market=eq.${m}&order=id&limit=2000`)) || []
    } catch (e) {
      resumen.error = `nuestra base (${m}): ${String(e?.message || e).slice(0, 160)}`
      break
    }
    const conEpisodio = new Map()
    for (const x of sets) if (Number.isInteger(x.tcggo_id)) conEpisodio.set(x.tcggo_id, (conEpisodio.get(x.tcggo_id) || []).concat([x.id]))
    for (const set of sets) {
      if (pendientes <= 0 || rellenadoEstaPasada) break
      if (set.oculto) continue
      const k = clave(m, set.id)
      const visto = h.vistos[k]
      // Lo rellenado y lo parado no se vuelve a mirar; lo demás, a la semana.
      if (visto && (visto.estado === 'rellenado' || visto.estado === 'parado' || !caducado(visto))) continue
      pendientes--
      resumen.probados++
      let alguna
      try {
        alguna = (await pedir(`tcg_cards?select=id&market=eq.${m}&set_id=eq.${encodeURIComponent(set.id)}&limit=1`)) || []
      } catch (e) {
        resumen.error = `nuestra base (${k}): ${String(e?.message || e).slice(0, 160)}`
        break
      }
      if (alguna.length) {
        h.vistos[k] = { fecha: ahora.toISOString(), estado: 'lleno' }
        resumen.llenos++
        continue
      }
      // Vacío: ¿qué expansión suya es?
      let episodio = Number.isInteger(set.tcggo_id) && set.tcggo_id > 0 ? set.tcggo_id : null
      let por = episodio ? 'tcggo_id' : null
      if (!episodio) {
        const r = m === 'WEST' ? episodioDe(set, pares) : (() => { const x = episodioDeSet(set, listaDe(m)); return x?.episodio ? { episodio: x.episodio.id, por: x.por } : { episodio: null, por: x?.porque || 'ninguna' } })()
        episodio = r.episodio
        por = r.por
      }
      if (!episodio) {
        // Un set vacío que no es ninguna expansión de TCGGO es un cascarón
        // (672): TCGdex trae nombre y logo de 68 sets japoneses sin una
        // carta. PINGU: «sigue habiendo sets japoneses sin cartas». Se
        // esconde (`oculto`): sin cartas no hay nada de nadie dentro, y si
        // TCGGO lo trae algún día el catálogo lo crea aparte.
        try {
          await pedir(`tcg_sets?market=eq.${m}&id=eq.${encodeURIComponent(set.id)}`, { method: 'PATCH', body: JSON.stringify({ oculto: true }) })
          h.vistos[k] = { fecha: ahora.toISOString(), estado: 'ocultado', porque: String(por || '') }
        } catch {
          h.vistos[k] = { fecha: ahora.toISOString(), estado: 'sinEpisodio', porque: String(por || '') }
        }
        resumen.sinEpisodio++
        continue
      }
      const enLista = listaDe(m).find((e) => e.id === episodio)
      if (enLista && enLista.cartas === 0) {
        h.vistos[k] = { fecha: ahora.toISOString(), estado: 'vacioEnTcggo', episodio }
        resumen.sinEpisodio++
        continue
      }
      // La misma expansión ya la lleva otro set nuestro: hermanos (646),
      // no se rellena dos veces. Si a este le falta el tcggo_id, se le
      // apunta para que se plieguen.
      const otros = (conEpisodio.get(episodio) || []).filter((id) => id !== set.id)
      if (otros.length) {
        if (!Number.isInteger(set.tcggo_id)) {
          try { await pedir(`tcg_sets?market=eq.${m}&id=eq.${encodeURIComponent(set.id)}`, { method: 'PATCH', body: JSON.stringify({ tcggo_id: episodio }) }) } catch { /* se reintenta a la semana */ }
        }
        h.vistos[k] = { fecha: ahora.toISOString(), estado: 'hermano', episodio, de: otros }
        resumen.hermanos++
        continue
      }
      // Rellenar: uno por pasada.
      const r = await (procesarImpl || procesar)({ env, restImpl, sets: [set.id], destino: set.id, mercado: m, episodio, ...resto })
      rellenadoEstaPasada = true
      if (r.ok) {
        h.vistos[k] = { fecha: ahora.toISOString(), estado: 'rellenado', episodio, por, cartas: r.escritas }
        delete h.intentos[k]
        resumen.rellenado = { set: set.id, mercado: m, episodio, cartas: r.escritas }
      } else {
        h.intentos[k] = (Number(h.intentos[k]) || 0) + 1
        h.ultimoError = { set: k, fecha: ahora.toISOString(), intento: h.intentos[k], error: r.error }
        if (h.intentos[k] >= MAXIMO_INTENTOS) h.vistos[k] = { fecha: ahora.toISOString(), estado: 'parado', episodio, error: r.error }
        resumen.error = `${k}: ${r.error}`
      }
    }
  }
  return resumen
}

export default async () => {
  const r = await pasada()
  if (!r.ok) console.warn('tcggo-reemplazar-set:', JSON.stringify(r).slice(0, 800))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada cinco minutos, a y 4 (la de precios va a y 0, el catálogo a y 2):
// con todo hecho, una pasada es leer dos estados y nada más.
export const config = { schedule: '4-59/5 * * * *' }
