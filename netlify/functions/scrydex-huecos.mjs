// LOS HUECOS, DESDE SCRYDEX (tanda 684): los sets nuestros que están vacíos
// y que TCGGO no tiene se rellenan con el catálogo de Scrydex.
//
// PINGU: «TCGGO no tiene los primeros sets… lo cogemos de Scrydex;
// móntamelo, que necesito esos sets antiguos rellenados de cartas». Scrydex
// declara 231 expansiones japonesas con 22.272 cartas y ficha completa
// (ataques, debilidades, Pokédex, escaneos), y es lo único que cubre el
// japonés anterior a 2008 —el Expansion Pack, Jungle, Fossil, Rocket—.
// Sus precios son dólares y yenes y no se tocan: el precio sigue siendo
// de TCGGO (para una copia japonesa de una carta occidental, el `_JP` del
// producto de Cardmarket). Aquí entra CATÁLOGO e IMÁGENES.
//
// Qué hace, en cada pasada programada:
//
//  1. La lista de expansiones de Scrydex del mercado (`ja` para JP, `en`
//     para WEST), una vez a la semana (3 créditos por mercado).
//  2. Mira hasta MAXIMO_PROBADOS sets nuestros que no haya mirado, o que
//     mirara hace más de DIAS_REVISAR —también los ESCONDIDOS por la 672 y
//     la 674, que son justo estos—, y a cada uno le pregunta a NUESTRA base
//     si tiene alguna carta (gratis). Con cartas: `lleno`.
//  3. Al primero vacío le busca su expansión de Scrydex: por `scrydex_id`
//     si ya lo lleva, por el nombre inglés exacto, y si no por la huella
//     de la 505 (fecha + cuenta, `emparejarSets`). Sin expansión: `sinPar`
//     (se vuelve a mirar a la semana). Con una de cero cartas: `vacioEnScrydex`.
//  4. Pide sus cartas (un crédito por 100), las convierte a NUESTRAS
//     columnas (`filaDeCartaScrydex`: ataques, habilidades, debilidades,
//     fase, tipos, Pokédex, rareza, ilustrador, escaneo) y las escribe por
//     REST con la clave de servicio (upsert por `(id, market)`, ids
//     `scrydex-<id suyo>`); apunta el set (`scrydex_id`, logo, cuentas y
//     fecha si estaban vacías) y lo DESESCONDE. UNA expansión por pasada.
//
// Frenos de la casa: un set por pasada; los fallos de Scrydex cuentan y a
// MAXIMO_INTENTOS se deja (el error queda en el estado y /admin lo enseña);
// un 401/403 suyo —sin suscripción— para hasta mañana (`parado`), que
// volver a pedir sin suscripción es pagar nada por nada; un fallo de
// NUESTRA base para la pasada sin contar intento (la 526: saltar vale para
// el fallo del otro). Con todo mirado, una pasada es leer el estado.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, SCRYDEX_API_KEY,
// SCRYDEX_TEAM_ID.
import { cabecerasDe, urlDeSonda, emparejarSets, fecha as fechaDe, clave as claveDeNombre } from '../lib/scrydex.mjs'
// La Pokédex Nacional en inglés, que es la misma lista que usa la web (no
// importa nada, así que se puede traer a una función).
import { POKEMON_POR_DEX } from '../../js/torneos/sprites-pokemon.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'scrydex_huecos'
export const MAXIMO_INTENTOS = 3
export const MAXIMO_PROBADOS = 8
export const DIAS_DE_LISTA = 7
export const DIAS_REVISAR = 7
export const MAXIMO_PAGINAS_CARTAS = 8
export const IDIOMA_DE_MERCADO = { JP: 'ja', WEST: 'en' }
// La versión del código. Un fallo de NUESTRA base deja la función parada
// hasta que se despliega otra versión (684.1): la primera pasada real
// gastó un crédito cada cuatro minutos pidiendo las mismas cartas para
// estrellarse contra la misma columna que no existía. «Saltar vale para el
// fallo del otro; para el tuyo, parar» (la 526) — y lo quita un humano
// desplegando el arreglo, que es lo que cambia esta cadena.
export const VERSION = '685'
// Cómo se montan los nombres ingleses; si cambia, los sets ya rellenados
// se vuelven a pasar (una expansión por pasada, un crédito por 100).
export const VERSION_NOMBRES = 1

async function rest(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    method: opciones?.method || 'GET',
    headers: { apikey: clave, Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json', Prefer: opciones?.method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal', ...(opciones?.headers || {}) },
    body: opciones?.body,
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  if (!opciones || opciones.method === 'GET') return res.json()
  const texto = await res.text()
  try { return texto ? JSON.parse(texto) : null } catch { return texto }
}

// ── Lo puro ──

const sinTilde = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
// La fase, en NUESTRO enum (el de TCGdex, con el que compara todo lo de
// /carta): «Stage 1» → `Stage1`. Lo que no es una fase (TAG TEAM, GX, ex)
// no es una fase.
const FASES = { basic: 'Basic', 'stage 1': 'Stage1', 'stage 2': 'Stage2', mega: 'MEGA', vmax: 'VMAX', vstar: 'VSTAR', 'v-union': 'V-UNION', break: 'BREAK', baby: 'Baby', restored: 'RESTORED', 'level-up': 'LEVEL-UP', 'level up': 'LEVEL-UP' }
export function faseDe(subtipos) {
  for (const s of Array.isArray(subtipos) ? subtipos : []) {
    const f = FASES[String(s || '').trim().toLowerCase()]
    if (f) return f
  }
  return null
}

// EL NOMBRE EN INGLÉS (685). El catálogo japonés de Scrydex da el nombre
// en katakana («カメックス»), que no se puede buscar ni leer desde aquí
// (PINGU: «el nombre tiene que ser buscable»). Lo que sí trae es la
// Pokédex Nacional, que es canónica (la 508): de ahí sale la especie en
// inglés, y de los subtipos el apellido («ex», «-GX», « V», « VMAX»…).
// Dos especies son un TAG TEAM («A & B-GX»). Un Entrenador o una Energía
// no tienen Pokédex y se quedan con su nombre japonés: no se inventa.
// Lo que no sale de aquí: los dueños y prefijos («Brock's», «Dark»,
// «Shining»), que no están en ningún campo canónico.
const APELLIDOS = [
  ['vstar', ' VSTAR'], ['vmax', ' VMAX'], ['v-union', ' V-UNION'], ['v', ' V'], ['gx', '-GX'], ['ex', ' ex'], ['break', ' BREAK'], ['lv.x', ' LV.X'], ['prism star', ' ◇'],
]
export function nombreInglesDe(carta) {
  const dex = (Array.isArray(carta?.national_pokedex_numbers) ? carta.national_pokedex_numbers : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= POKEMON_POR_DEX.length)
  if (!dex.length || dex.length > 2) return null
  const especies = dex.map((n) => POKEMON_POR_DEX[n - 1]).filter(Boolean)
  if (especies.length !== dex.length) return null
  const subtipos = (Array.isArray(carta?.subtypes) ? carta.subtypes : []).map((x) => String(x || '').trim())
  const bajos = subtipos.map((x) => x.toLowerCase())
  // «EX» (mayúsculas, era XY) y «ex» (minúsculas, Escarlata y Púrpura)
  // son dos apellidos distintos y Scrydex los distingue por la caja.
  let apellido = ''
  if (subtipos.includes('EX')) apellido = '-EX'
  else {
    for (const [sub, ap] of APELLIDOS) if (bajos.includes(sub)) { apellido = ap; break }
  }
  const mega = bajos.includes('mega') ? 'M ' : ''
  return `${mega}${especies.join(' & ')}${apellido}`
}

// El id nuestro de una carta suya. Suyo es `sm10-1`; el nuestro, con su
// marca de origen delante como las de TCGGO (`tcggo-49770`), para que no
// pise a ninguna de TCGdex y para que se sepa de dónde salió.
export const idNuestro = (idScrydex) => `scrydex-${String(idScrydex || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '')}`

// La base de la foto: `images.scrydex.com/pokemon/<id>` sin la calidad,
// que es lo que `urlDeFotoScrydex` espera para montar `/large` o `/small`.
export function baseDeFoto(carta) {
  const cara = (Array.isArray(carta?.images) ? carta.images : []).find((i) => String(i?.type || '').toLowerCase() === 'front')
  const url = cara?.large || cara?.medium || cara?.small || null
  if (typeof url !== 'string' || !/^https:\/\/images\.scrydex\.com\//.test(url)) return null
  return url.replace(/\/(small|medium|large)$/, '')
}

// Una carta suya, con nuestras columnas. Solo lo que viene.
export function filaDeCartaScrydex(carta, { setId, mercado, idioma, ahora = new Date() }) {
  if (!carta?.id || !setId) return null
  const fila = {
    id: idNuestro(carta.id), market: mercado, set_id: setId,
    local_id: String(carta.number ?? carta.printed_number?.split('/')[0] ?? '').trim(),
    name: String(carta.name || carta.id),
    // Sin `scrydex_id`: esa columna solo existe en `tcg_sets` (PGRST204 en
    // la primera pasada real); el id suyo va dentro del nuestro.
    scrydex_at: ahora.toISOString(), origen: 'scrydex',
    detalle_at: ahora.toISOString(), detalle_lang: idioma,
  }
  if (idioma === 'en') fila.name_en = fila.name
  else {
    const en = nombreInglesDe(carta)
    if (en) fila.name_en = en
  }
  const foto = baseDeFoto(carta)
  if (foto) fila.image_scrydex = foto
  if (carta.rarity) fila.rarity_en = String(carta.rarity)
  if (carta.artist) fila.illustrator = String(carta.artist)
  if (carta.supertype) fila.category = sinTilde(carta.supertype)
  if (Number.isInteger(Number(carta.hp)) && Number(carta.hp) > 0) fila.hp = Number(carta.hp)
  const fase = faseDe(carta.subtypes)
  if (fase) fila.stage = fase
  if (Array.isArray(carta.types) && carta.types.length) fila.types = carta.types.map(String)
  if (Array.isArray(carta.evolves_from) && carta.evolves_from[0]) fila.evolve_from = String(carta.evolves_from[0])
  else if (typeof carta.evolves_from === 'string' && carta.evolves_from) fila.evolve_from = carta.evolves_from
  if (Array.isArray(carta.attacks)) fila.attacks = carta.attacks.map((a) => ({ name: a?.name || '', cost: Array.isArray(a?.cost) ? a.cost : [], damage: a?.damage || '', effect: a?.text || '' }))
  if (Array.isArray(carta.abilities)) fila.abilities = carta.abilities.map((h) => ({ type: h?.type || 'Ability', name: h?.name || '', effect: h?.text || '' }))
  if (Array.isArray(carta.weaknesses)) fila.weaknesses = carta.weaknesses.map((w) => ({ type: w?.type || '', value: w?.value || '' }))
  if (Array.isArray(carta.resistances)) fila.resistances = carta.resistances.map((w) => ({ type: w?.type || '', value: w?.value || '' }))
  if (Number.isInteger(carta.converted_retreat_cost)) fila.retreat = carta.converted_retreat_cost
  else if (Array.isArray(carta.retreat_cost)) fila.retreat = carta.retreat_cost.length
  if (carta.regulation_mark) fila.regulation_mark = String(carta.regulation_mark)
  if (carta.flavor_text) fila.description = String(carta.flavor_text)
  const dex = (Array.isArray(carta.national_pokedex_numbers) ? carta.national_pokedex_numbers : []).map(Number).filter((n) => Number.isInteger(n) && n > 0)
  if (dex.length) fila.dex_ids = dex
  return fila
}

// Todas las filas con las MISMAS claves: un `insert` de varias filas por
// PostgREST exige que todas tengan las mismas columnas (la 585).
export function igualarClaves(filas) {
  const claves = [...new Set(filas.flatMap((f) => Object.keys(f)))]
  return filas.map((f) => Object.fromEntries(claves.map((k) => [k, f[k] === undefined ? null : f[k]])))
}

// Qué expansión suya es un set nuestro: por `scrydex_id`, por nombre
// exacto, y si no por la huella de la 505 (fecha + cuenta).
export function expansionDelSet(set, expansiones) {
  if (!set || !Array.isArray(expansiones)) return { por: null, expansion: null }
  if (set.scrydex_id) {
    const e = expansiones.find((x) => x.id === set.scrydex_id)
    if (e) return { por: 'scrydex_id', expansion: e }
  }
  const nombre = claveDeNombre(set.name_en || set.name)
  const porNombre = nombre ? expansiones.filter((x) => claveDeNombre(x.name) === nombre) : []
  if (porNombre.length === 1) return { por: 'nombre', expansion: porNombre[0] }
  const { pares } = emparejarSets([set], expansiones)
  if (pares.length === 1) return { por: pares[0].por || 'huella', expansion: pares[0].suyo }
  return { por: null, expansion: null, candidatas: porNombre.map((x) => x.id) }
}

// Lo que se apunta en el set al rellenarlo: su expansión, logo y símbolo,
// y la fecha y las cuentas SOLO si estaban vacías (la 508: no pisar).
export function parcheDeSet(set, expansion, ahora = new Date()) {
  const p = { scrydex_id: expansion.id, scrydex_por: 'huecos', oculto: false }
  if (typeof expansion.logo === 'string' && expansion.logo) p.logo_scrydex = expansion.logo
  if (typeof expansion.symbol === 'string' && expansion.symbol) p.symbol_scrydex = expansion.symbol
  if (!set.release_date && fechaDe(expansion.release_date)) p.release_date = fechaDe(expansion.release_date)
  if (!set.card_count_total && Number(expansion.total) > 0) p.card_count_total = Number(expansion.total)
  if (!set.card_count_official && Number(expansion.printed_total) > 0) p.card_count_official = Number(expansion.printed_total)
  if (!set.name_en && expansion.name) p.name_en = String(expansion.name)
  p.scrydex_at = ahora.toISOString()
  return p
}

const esDeSuscripcion = (status) => status === 401 || status === 403 || status === 402

// ── La pasada ──
export async function pasada({
  env = process.env, fetchImpl = fetch, restImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  ahora = new Date(), pausa = (ms) => new Promise((r) => setTimeout(r, ms)), mercados = ['JP', 'WEST'],
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const sc = cabecerasDe(env)
  if (sc.faltan) return { ok: true, saltado: `faltan ${sc.faltan.join(' y ')} en Netlify` }
  const pedir = restImpl || ((ruta, opciones = null) => rest(ruta, clave, opciones))
  const leerEstado = estadoImpl || (async (k) => (await pedir(`scrydex_estado?select=valor&clave=eq.${k}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((k, valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: k, valor, updated_at: new Date().toISOString() }]) }))
  const dia = ahora.toISOString().slice(0, 10)

  let estado
  try {
    estado = await leerEstado(CLAVE_ESTADO)
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|scrydex_estado/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-scrydex-cartas.sql (scrydex_estado)' }
    return { ok: false, error: m.slice(0, 200) }
  }
  estado = estado && typeof estado === 'object' ? estado : {}
  for (const k of ['listas', 'vistos', 'intentos']) if (!estado[k] || typeof estado[k] !== 'object') estado[k] = {}
  if (!estado.gasto || typeof estado.gasto !== 'object') estado.gasto = { creditos: 0 }
  const persistir = () => guardarEstado(CLAVE_ESTADO, estado)
  // Parado por Scrydex (401/403): hasta mañana. Parado por NUESTRA base:
  // hasta que se despliegue otra versión.
  if (estado.parado?.version ? estado.parado.version === VERSION : estado.parado?.dia === dia) return { ok: true, saltado: `parado${estado.parado.version ? ` desde la versión ${estado.parado.version}` : ' hoy'}: ${estado.parado.motivo}` }
  if (estado.parado) delete estado.parado

  // Una petición a Scrydex, contada. Un 401/403 para hasta mañana.
  const scrydex = async (ruta, params) => {
    estado.gasto.creditos = (Number(estado.gasto.creditos) || 0) + 1
    const res = await fetchImpl(urlDeSonda(ruta, params), { headers: sc.cabeceras })
    const texto = await res.text()
    if (!res.ok) {
      const error = `Scrydex ${res.status}: ${texto.slice(0, 160)}`
      if (esDeSuscripcion(res.status)) estado.parado = { dia, motivo: error }
      return { error, status: res.status }
    }
    try { return { datos: JSON.parse(texto) } } catch { return { error: 'Scrydex ha contestado algo que no es JSON', status: res.status } }
  }
  const resumen = () => {
    const v = Object.values(estado.vistos)
    const cuenta = (e) => v.filter((x) => x.estado === e).length
    return { mirados: v.length, rellenados: cuenta('rellenado'), llenos: cuenta('lleno'), sinPar: cuenta('sinPar'), vaciosEnScrydex: cuenta('vacioEnScrydex'), parados: cuenta('parado'), creditos: estado.gasto.creditos }
  }

  // ── 0. Los ya rellenados con nombres de una versión anterior (685) ──
  // Se vuelven a pedir y a escribir (el upsert es idempotente), uno por
  // pasada, para ponerles `name_en`. Un crédito por 100 cartas.
  const pendienteDeNombres = Object.entries(estado.vistos).find(([, v]) => v.estado === 'rellenado' && (Number(v.nombres) || 0) < VERSION_NOMBRES)
  if (pendienteDeNombres) {
    const [k, v] = pendienteDeNombres
    const [mercado, setId] = k.split('|')
    const idioma = IDIOMA_DE_MERCADO[mercado]
    const cartas = []
    let fallo = null
    for (let pagina = 1; pagina <= MAXIMO_PAGINAS_CARTAS; pagina++) {
      const r = await scrydex(`${idioma}/cards`, { q: `expansion.id:${v.expansion}`, page_size: 100, page: pagina })
      if (r.error) { fallo = r.error; break }
      const datos = Array.isArray(r.datos?.data) ? r.datos.data : []
      cartas.push(...datos)
      if (datos.length < 100) break
      await pausa(200)
    }
    if (fallo) {
      estado.ultimoError = { fecha: ahora.toISOString(), mercado, set: setId, expansion: v.expansion, donde: 'nombres', error: fallo }
      await persistir()
      return { ok: false, ...resumen(), error: fallo }
    }
    const filas = igualarClaves(cartas.map((c) => filaDeCartaScrydex(c, { setId, mercado, idioma, ahora })).filter(Boolean))
    try {
      for (let i = 0; i < filas.length; i += 200) await pedir('tcg_cards?on_conflict=id,market', { method: 'POST', body: JSON.stringify(filas.slice(i, i + 200)) })
    } catch (e) {
      estado.ultimoError = { fecha: ahora.toISOString(), mercado, set: setId, expansion: v.expansion, donde: 'nombres', error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
      estado.parado = { dia, motivo: estado.ultimoError.error, version: VERSION }
      await persistir()
      return { ok: false, ...resumen(), error: estado.ultimoError.error }
    }
    v.nombres = VERSION_NOMBRES
    v.conNombreIngles = filas.filter((f) => f.name_en).length
    await persistir()
    return { ok: true, ...resumen(), nombres: { mercado, set: setId, expansion: v.expansion, cartas: filas.length, conNombreIngles: v.conNombreIngles } }
  }

  for (const mercado of mercados) {
    const idioma = IDIOMA_DE_MERCADO[mercado]
    if (!idioma) continue
    // ── 1. Sus expansiones, una vez a la semana ──
    const lista = estado.listas[mercado]
    const edad = lista?.fecha ? (ahora.getTime() - new Date(lista.fecha).getTime()) / 86_400_000 : Infinity
    if (!Array.isArray(lista?.expansiones) || !lista.expansiones.length || edad > DIAS_DE_LISTA) {
      const expansiones = []
      for (let pagina = 1; pagina <= 6; pagina++) {
        const r = await scrydex(`${idioma}/expansions`, { page_size: 100, page: pagina })
        if (r.error) {
          estado.ultimoError = { fecha: ahora.toISOString(), mercado, donde: 'lista', error: r.error }
          await persistir()
          return { ok: false, ...resumen(), error: r.error }
        }
        const datos = Array.isArray(r.datos?.data) ? r.datos.data : []
        for (const e of datos) expansiones.push({ id: e.id, name: e.name, code: e.code || null, total: e.total ?? null, printed_total: e.printed_total ?? null, release_date: e.release_date || null, logo: e.logo || null, symbol: e.symbol || null, language_code: e.language_code || null })
        if (datos.length < 100) break
        await pausa(200)
      }
      // Una lista vacía no es un error de la pasada: se apunta (con su
      // fecha, para no volver a pedirla hasta la semana que viene) y se
      // pasa al otro mercado.
      estado.listas[mercado] = { fecha: ahora.toISOString(), expansiones }
      await persistir()
    }
    const expansiones = estado.listas[mercado].expansiones
    if (!expansiones.length) continue

    // ── 2. Nuestros sets, y cuáles están vacíos ──
    let sets
    try {
      sets = (await pedir(`tcg_sets?select=id,name,name_en,release_date,card_count_official,card_count_total,tcg_online_code,tcggo_id,scrydex_id,oculto&market=eq.${mercado}&order=id&limit=2000`)) || []
    } catch (e) {
      return { ok: false, ...resumen(), error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
    }
    const k = (s) => `${mercado}|${s.id}`
    const caducado = (v) => !v?.fecha || (ahora.getTime() - new Date(v.fecha).getTime()) / 86_400_000 > DIAS_REVISAR
    // Lo rellenado y lo parado no se vuelven a mirar; lo demás, a la semana.
    const porMirar = sets.filter((s) => {
      const v = estado.vistos[k(s)]
      if (!v) return true
      if (v.estado === 'rellenado' || v.estado === 'parado') return false
      return caducado(v)
    }).slice(0, MAXIMO_PROBADOS)
    let vacio = null
    for (const s of porMirar) {
      let alguna
      try {
        alguna = (await pedir(`tcg_cards?select=id&market=eq.${mercado}&set_id=eq.${encodeURIComponent(s.id)}&limit=1`)) || []
      } catch (e) {
        await persistir()
        return { ok: false, ...resumen(), error: `nuestra base (${s.id}): ${String(e?.message || e).slice(0, 160)}` }
      }
      if (alguna.length) { estado.vistos[k(s)] = { fecha: ahora.toISOString(), estado: 'lleno' }; continue }
      vacio = s
      break
    }
    if (!vacio) continue

    // ── 3. Su expansión ──
    const { por, expansion, candidatas } = expansionDelSet(vacio, expansiones)
    if (!expansion) {
      estado.vistos[k(vacio)] = { fecha: ahora.toISOString(), estado: 'sinPar', candidatas: candidatas || [] }
      await persistir()
      return { ok: true, ...resumen(), mirado: { mercado, set: vacio.id, estado: 'sinPar' } }
    }
    if (Number(expansion.total) === 0) {
      estado.vistos[k(vacio)] = { fecha: ahora.toISOString(), estado: 'vacioEnScrydex', expansion: expansion.id }
      await persistir()
      return { ok: true, ...resumen(), mirado: { mercado, set: vacio.id, estado: 'vacioEnScrydex', expansion: expansion.id } }
    }

    // ── 4. Sus cartas, y a nuestra base ──
    const cartas = []
    let fallo = null
    for (let pagina = 1; pagina <= MAXIMO_PAGINAS_CARTAS; pagina++) {
      const r = await scrydex(`${idioma}/cards`, { q: `expansion.id:${expansion.id}`, page_size: 100, page: pagina })
      if (r.error) { fallo = r.error; break }
      const datos = Array.isArray(r.datos?.data) ? r.datos.data : []
      cartas.push(...datos)
      if (datos.length < 100) break
      await pausa(200)
    }
    if (fallo) {
      // Un fallo SUYO cuenta; un 401/403 ya ha parado el día entero.
      const n = (Number(estado.intentos[k(vacio)]) || 0) + 1
      estado.intentos[k(vacio)] = n
      estado.ultimoError = { fecha: ahora.toISOString(), mercado, set: vacio.id, expansion: expansion.id, intento: n, error: fallo }
      if (n >= MAXIMO_INTENTOS) estado.vistos[k(vacio)] = { fecha: ahora.toISOString(), estado: 'parado', expansion: expansion.id, error: fallo }
      await persistir()
      return { ok: false, ...resumen(), error: fallo, mirado: { mercado, set: vacio.id, expansion: expansion.id, intento: n } }
    }
    const filas = igualarClaves(cartas.map((c) => filaDeCartaScrydex(c, { setId: vacio.id, mercado, idioma, ahora })).filter(Boolean))
    if (!filas.length) {
      estado.vistos[k(vacio)] = { fecha: ahora.toISOString(), estado: 'vacioEnScrydex', expansion: expansion.id, nota: 'la lista de cartas vino vacía' }
      await persistir()
      return { ok: true, ...resumen(), mirado: { mercado, set: vacio.id, estado: 'vacioEnScrydex', expansion: expansion.id } }
    }
    try {
      for (let i = 0; i < filas.length; i += 200) {
        await pedir('tcg_cards?on_conflict=id,market', { method: 'POST', body: JSON.stringify(filas.slice(i, i + 200)) })
      }
      await pedir(`tcg_sets?market=eq.${mercado}&id=eq.${encodeURIComponent(vacio.id)}`, { method: 'PATCH', body: JSON.stringify(parcheDeSet(vacio, expansion, ahora)) })
    } catch (e) {
      // Fallo NUESTRO: se para sin contar intento, se apunta, y NO se vuelve
      // a pedir nada a Scrydex hasta que se despliegue un arreglo.
      estado.ultimoError = { fecha: ahora.toISOString(), mercado, set: vacio.id, expansion: expansion.id, error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
      estado.parado = { dia, motivo: estado.ultimoError.error, version: VERSION }
      await persistir()
      return { ok: false, ...resumen(), error: estado.ultimoError.error }
    }
    delete estado.intentos[k(vacio)]
    estado.vistos[k(vacio)] = { fecha: ahora.toISOString(), estado: 'rellenado', expansion: expansion.id, por, cartas: filas.length, nombre: expansion.name, nombres: VERSION_NOMBRES, conNombreIngles: filas.filter((f) => f.name_en).length }
    await persistir()
    return { ok: true, ...resumen(), rellenado: { mercado, set: vacio.id, expansion: expansion.id, nombre: expansion.name, por, cartas: filas.length } }
  }
  await persistir()
  return { ok: true, ...resumen(), hecho: true }
}

export default async () => {
  const r = await pasada()
  if (!r.ok) console.warn('scrydex-huecos:', JSON.stringify(r).slice(0, 800))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada cuatro minutos, a y 3 (precios a los múltiplos de 5, el catálogo a
// y 2, el reemplazo a y 4, el calco en los impares): un set por pasada, ~70
// sets japoneses vacíos en unas cinco horas, una vez. Con todo mirado, una
// pasada es leer el estado.
export const config = { schedule: '3-59/4 * * * *' }
