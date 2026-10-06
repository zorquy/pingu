// La sonda de orígenes (tanda 683): de UNA carta, qué tiene cada sitio.
//
// PINGU: «TCGGO no tiene los primeros sets… haz un análisis, dime de dónde
// podemos conseguir cada cosa; pon de ejemplo el Charizard de Base Set y
// el del Expansion Pack, y haz pruebas a ver qué nos podemos traer de cada
// sitio». Desde el contenedor de Claude la red está cerrada, así que la
// prueba la hace esta función y la pide el botón de /admin → Cartas.
//
// Para la carta que se le dé (nuestro id y mercado) pregunta, cada uno en
// su `try`, y devuelve lo que contestó cada uno TAL CUAL resumido:
//
// · NUESTRA base: la fila de `tcg_cards` (con su set) y la de precios.
// · TCGdex: la carta en inglés, en español y —si es japonesa— en japonés,
//   y su set: nombre, si trae imagen, cuántos ataques.
// · TCGGO: la lista ENTERA de expansiones de las dos puertas (occidental
//   y japonesa), de la que se saca la más antigua y las ocho primeras por
//   fecha —que es la pregunta de PINGU—; la expansión que casa con nuestro
//   set (por `tcggo_id`, por nombre inglés, por código); y dentro de ella
//   la carta por número y por nombre, con qué precios trae (qué idiomas de
//   Cardmarket, TCGplayer). Y dos intentos de BÚSQUEDA (`?search=` y
//   `?name=`) para saber si su `/cards` busca por nombre, que no está en
//   nuestra documentación.
// · Scrydex: con las claves que haya en Netlify, la carta por nuestro id
//   (`en/cards/base1-4`: sus ids occidentales son los nuestros) y, si es
//   japonesa, la expansión por nombre; sin claves o con la suscripción
//   caducada, lo dice (401/403 es una respuesta).
//
// GASTA: unas 20 peticiones a TCGGO (las páginas de expansiones) y 2 o 3 a
// Scrydex. Es una sonda manual, con tope, y no la llama nadie sola.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY
// (TCGGO_BASE opcional), SCRYDEX_API_KEY y SCRYDEX_TEAM_ID (opcionales).
import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import { baseDe, baseJpDe, cabeceras, urlEpisodios, urlCartasDeEpisodio, hayMasPaginas, resumirEpisodio, nombreComparable, codigoComparable, soloDigitos } from '../lib/tcggo.mjs'
import { cabecerasDe as cabecerasScrydex, urlDeSonda } from '../lib/scrydex.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const TCGDEX = 'https://api.tcgdex.net/v2'
export const MAXIMO_PAGINAS_EPISODIOS = 15
export const MAXIMO_PAGINAS_CARTAS = 4

// ── Ayudantes puros (se prueban sin red) ──

// Las expansiones más antiguas de una lista, por fecha, y cuántas no
// tienen fecha (que no entran en el orden y conviene decirlo).
export function masAntiguas(episodios, cuantas = 8) {
  const con = episodios.filter((e) => e.fecha).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
  return { total: episodios.length, sinFecha: episodios.length - con.length, primeras: con.slice(0, cuantas), ultima: con[con.length - 1] || null }
}

// La expansión suya que es nuestro set: primero por `tcggo_id` (ya
// escrito), luego por el nombre inglés exacto, luego por el código, y al
// final la única cuyo nombre contiene todas nuestras palabras.
export function episodioDelSet(set, episodios) {
  if (!set) return { por: null, episodio: null }
  const porId = set.tcggo_id ? episodios.find((e) => e.id === set.tcggo_id) : null
  if (porId) return { por: 'tcggo_id', episodio: porId }
  const nombre = nombreComparable(set.name_en || set.name)
  const porNombre = nombre ? episodios.filter((e) => nombreComparable(e.nombre) === nombre) : []
  if (porNombre.length === 1) return { por: 'nombre', episodio: porNombre[0] }
  const codigo = codigoComparable(set.tcg_online_code)
  const porCodigo = codigo ? episodios.filter((e) => codigoComparable(e.codigo) === codigo) : []
  if (porCodigo.length === 1) return { por: 'código', episodio: porCodigo[0] }
  const palabras = nombre ? nombre.split(' ') : []
  const porPalabras = palabras.length ? episodios.filter((e) => { const n = nombreComparable(e.nombre); return palabras.every((p) => n.includes(p)) }) : []
  if (porPalabras.length === 1) return { por: 'palabras', episodio: porPalabras[0] }
  return { por: null, episodio: null, candidatas: [...porNombre, ...porCodigo, ...porPalabras].slice(0, 6) }
}

// Qué trae una carta de TCGGO: lo que decide si nos sirve.
export function resumirCartaTcggo(c) {
  const cm = c?.prices?.cardmarket || {}
  const tp = c?.prices?.tcg_player || {}
  const idiomasCm = Object.keys(cm).filter((k) => /^lowest_near_mint_[A-Z]{2,3}$/.test(k) && typeof cm[k] === 'number' && cm[k] > 0).map((k) => k.replace('lowest_near_mint_', ''))
  return {
    id: c?.id ?? null, nombre: c?.name || '', numero: c?.card_number ?? null, codigo: c?.card_code_number || null, tcgid: c?.tcgid || null, tipo: c?.type || null, rareza: c?.rarity || null,
    cardmarketId: c?.cardmarket_id ?? null, tcgplayerId: c?.tcgplayer_id ?? null,
    imagen: typeof c?.image === 'string' ? c.image : (typeof c?.image?.url === 'string' ? c.image.url : null),
    cmMinimo: typeof cm.lowest_near_mint === 'number' ? cm.lowest_near_mint : null, cmIdiomas: idiomasCm,
    cmGradeadas: Array.isArray(cm.graded) ? cm.graded.length : 0,
    tpMercado: typeof tp.market_price === 'number' ? `${tp.market_price} ${tp.currency || ''}`.trim() : null,
  }
}

// Las cartas de una expansión que son la nuestra: por número exacto (las
// viejas traen DOS por número, la ilimitada y la 1.ª edición) y por nombre.
export function cartasQueCasan(cartas, { numero, nombre }) {
  const n = soloDigitos(numero)
  const nom = nombreComparable(nombre)
  const porNumero = cartas.filter((c) => c.type !== 'sealed' && soloDigitos(c.card_number ?? c.card_code_number?.split(' ').pop()) === n && n !== '')
  const porNombre = cartas.filter((c) => nom && nombreComparable(c.name) === nom)
  return { porNumero: porNumero.map(resumirCartaTcggo), porNombre: porNombre.map(resumirCartaTcggo) }
}

export function resumirTcgdex(c) {
  if (!c || typeof c !== 'object') return null
  return {
    id: c.id || null, nombre: c.name || null, set: c.set?.name || null, setId: c.set?.id || null, imagen: typeof c.image === 'string' ? c.image : null,
    ataques: Array.isArray(c.attacks) ? c.attacks.length : 0, rareza: c.rarity || null, ilustrador: c.illustrator || null, variantes: c.variants || null,
    precioCardmarket: c.pricing?.cardmarket ? Object.keys(c.pricing.cardmarket).length : 0,
  }
}

export function resumirScrydex(c) {
  if (!c || typeof c !== 'object') return null
  const precios = c.prices || c.variants?.flatMap?.((v) => v.prices || []) || []
  return {
    id: c.id || null, nombre: c.name || null, expansion: c.expansion?.name || c.expansion?.id || null, idioma: c.language_code || c.expansion?.language_code || null,
    // El nombre inglés de su traducción y la Pokédex (700): son las dos
    // fuentes de nuestro `name_en` en el japonés, y si faltan las dos la
    // carta se enseña en japonés.
    nombreIngles: c.translation?.en?.name || null, traduccion: c.translation ? Object.keys(c.translation) : [], dex: Array.isArray(c.national_pokedex_numbers) ? c.national_pokedex_numbers : null,
    imagenes: Array.isArray(c.images) ? c.images.length : 0, ataques: Array.isArray(c.attacks) ? c.attacks.length : 0,
    variantes: Array.isArray(c.variants) ? c.variants.map((v) => v.name).filter(Boolean) : [],
    precios: Array.isArray(precios) ? precios.slice(0, 6).map((p) => `${p.type || p.name || '?'} ${p.market ?? p.low ?? ''} ${p.currency || ''}`.trim()) : [],
    // Por impresión y con el estado (690): es lo que decide si la web
    // tiene precio («raw NM USD» de alguna impresión) y qué impresiones
    // existen (las que tienen precios o tiendas).
    porImpresion: Array.isArray(c.variants) ? c.variants.map((v) => ({
      nombre: v.name || '?', tiendas: Array.isArray(v.marketplaces) ? v.marketplaces.length : 0,
      precios: (Array.isArray(v.prices) ? v.prices : []).map((p) => `${p.type || '?'}${p.condition ? ` ${p.condition}` : ''}${p.grade ? ` ${p.grade}` : ''} ${p.market ?? p.low ?? ''} ${p.currency || ''}`.trim()),
    })) : [],
  }
}

// ── La sonda ──
export async function sondear({ id, mercado = 'WEST', env = process.env, fetchImpl = fetch } = {}) {
  const informe = { id, mercado, peticiones: { tcggo: 0, tcgdex: 0, scrydex: 0 }, nuestra: null, tcgdex: {}, tcggo: {}, scrydex: {} }
  const pedir = async (url, cabeceras = {}, contador = null) => {
    if (contador) informe.peticiones[contador]++
    const res = await fetchImpl(url, { headers: cabeceras })
    const texto = await res.text()
    let datos = null
    try { datos = JSON.parse(texto) } catch { /* no es JSON: se devuelve el texto */ }
    return { ok: res.ok, status: res.status, datos, texto: datos ? null : texto.slice(0, 200) }
  }

  // 1. Lo nuestro.
  let set = null
  let carta = null
  try {
    const clave = env.SUPABASE_SERVICE_ROLE_KEY
    if (!clave) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
    const cab = { apikey: clave, authorization: `Bearer ${clave}` }
    const filas = await pedir(`${SUPABASE_URL}/rest/v1/tcg_cards?select=*,tcg_sets(*)&id=eq.${encodeURIComponent(id)}&market=eq.${encodeURIComponent(mercado)}`, cab)
    carta = filas.datos?.[0] || null
    set = carta?.tcg_sets || null
    const precios = await pedir(`${SUPABASE_URL}/rest/v1/tcg_card_prices?select=*&card_id=eq.${encodeURIComponent(id)}`, cab)
    informe.nuestra = carta
      ? {
          id: carta.id, set: set?.id || carta.set_id, setNombre: set?.name || null, codigoSet: set?.tcg_online_code || null, fechaSet: set?.release_date || null, tcggoIdSet: set?.tcggo_id ?? null,
          numero: carta.local_id, nombre: carta.name, nombreEs: carta.name_es || null, nombreEn: carta.name_en || null, dex: carta.dex_ids || null, origen: carta.origen || null, detalle: carta.detalle_at ? `sí (${carta.detalle_lang || '?'})` : 'no',
          ataques: Array.isArray(carta.attacks) ? carta.attacks.length : 0,
          fotos: { tcgdex: carta.image_path || null, tcggo: carta.image_tcggo || null, scrydex: carta.image_scrydex || null },
          ids: { tcggo: carta.tcggo_id ?? null, cardmarket: carta.cm_id_product_propio ?? null, tcgplayer: carta.tp_id_product_propio ?? null },
          precio: precios.datos?.[0] ? Object.fromEntries(Object.entries(precios.datos[0]).filter(([k, v]) => v !== null && /^(cm_low|cm_avg|tp_|origen|tcggo_updated|checked_at|cm_id)/.test(k))) : null,
        }
      : { error: `No hay ninguna carta ${id} en el mercado ${mercado}` }
  } catch (e) {
    informe.nuestra = { error: String(e?.message || e).slice(0, 200) }
  }
  const setId = set?.id || String(id).replace(/-[^-]+$/, '').replace(/^scrydex-/, '')
  // El SET en sí, exista o no la carta (701): si está, si está escondido,
  // cuántas cartas tiene y con qué ids; y lo que cada función programada
  // ha apuntado de él. PINGU: «se veía el set y de repente ya no sale».
  // Sin esto, «no sale» puede ser cuatro cosas distintas.
  try {
    const clave = env.SUPABASE_SERVICE_ROLE_KEY
    const cab = { apikey: clave, authorization: `Bearer ${clave}` }
    const filas = await pedir(`${SUPABASE_URL}/rest/v1/tcg_sets?select=id,name,name_en,oculto,tcggo_id,scrydex_id,scrydex_por,release_date,card_count_total,serie_id,serie_name_en&id=eq.${encodeURIComponent(setId)}&market=eq.${encodeURIComponent(mercado)}`, cab)
    const fila = filas.datos?.[0] || null
    const cartas = await pedir(`${SUPABASE_URL}/rest/v1/tcg_cards?select=id,origen&set_id=eq.${encodeURIComponent(setId)}&market=eq.${encodeURIComponent(mercado)}&limit=500`, cab)
    const lista = Array.isArray(cartas.datos) ? cartas.datos : []
    const porOrigen = {}
    for (const c of lista) porOrigen[c.origen || 'sin origen'] = (porOrigen[c.origen || 'sin origen'] || 0) + 1
    const estados = await pedir(`${SUPABASE_URL}/rest/v1/scrydex_estado?select=clave,valor&clave=in.(scrydex_huecos,tcggo_calco_jp,tcggo_reemplazos,precios_espejo)`, cab)
    const de = (k) => (Array.isArray(estados.datos) ? estados.datos : []).find((x) => x.clave === k)?.valor || {}
    const h = de('scrydex_huecos')
    const calco = de('tcggo_calco_jp')
    const reempl = de('tcggo_reemplazos')
    informe.setNuestro = {
      fila: fila ? { ...fila } : `no hay ningún set ${setId} en el mercado ${mercado}`,
      cartas: lista.length, porOrigen, ejemplos: lista.slice(0, 3).map((c) => c.id),
      huecos: { visto: h.vistos?.[`${mercado}|${setId}`] || null, creado: Object.entries(h.creados || {}).find(([, x]) => x.set === setId)?.[1] || null, parado: h.parado || null },
      calcoJp: { hecho: Object.entries(calco.hechos || {}).filter(([, x]) => x?.set === setId).map(([ep, x]) => ({ episodio: ep, ...x })), cascaron: calco.cascarones?.vistos?.[setId] || null, planBloqueado: calco.planBloqueado || null },
      reemplazos: { hueco: reempl.huecos?.vistos?.[`${mercado}:${setId}`] || null },
      espejo: de('precios_espejo').hechos?.[setId] ? 'hecho' : null,
    }
  } catch (e) {
    informe.setNuestro = { error: String(e?.message || e).slice(0, 200) }
  }
  const numero = carta?.local_id || String(id).split('-').pop()
  const nombre = carta?.name || ''

  // 2. TCGdex.
  const idiomas = mercado === 'JP' ? ['ja', 'en'] : ['en', 'es']
  for (const lang of idiomas) {
    try {
      const r = await pedir(`${TCGDEX}/${lang}/cards/${encodeURIComponent(id)}`, { accept: 'application/json' }, 'tcgdex')
      informe.tcgdex[`carta_${lang}`] = r.ok ? resumirTcgdex(r.datos) : { status: r.status }
    } catch (e) { informe.tcgdex[`carta_${lang}`] = { error: String(e?.message || e).slice(0, 120) } }
  }
  try {
    const r = await pedir(`${TCGDEX}/${idiomas[0]}/sets/${encodeURIComponent(setId)}`, { accept: 'application/json' }, 'tcgdex')
    informe.tcgdex.set = r.ok ? { id: r.datos?.id, nombre: r.datos?.name, cartas: Array.isArray(r.datos?.cards) ? r.datos.cards.length : null, conImagen: Array.isArray(r.datos?.cards) ? r.datos.cards.filter((c) => c.image).length : null, logo: r.datos?.logo || null, fecha: r.datos?.releaseDate || null } : { status: r.status }
  } catch (e) { informe.tcgdex.set = { error: String(e?.message || e).slice(0, 120) } }

  // 3. TCGGO.
  const claveTcggo = env.TCGGO_API_KEY
  if (!claveTcggo) {
    informe.tcggo = { saltado: 'falta TCGGO_API_KEY' }
  } else {
    const { base, host } = baseDe(env)
    const cab = cabeceras(claveTcggo, host)
    const bases = { WEST: base, JP: baseJpDe(base) }
    const listas = {}
    for (const m of ['WEST', 'JP']) {
      const lista = []
      let fin = null
      try {
        for (let pagina = 1; pagina <= MAXIMO_PAGINAS_EPISODIOS; pagina++) {
          const r = await pedir(urlEpisodios(pagina, bases[m]), cab, 'tcggo')
          if (!r.ok) { fin = `TCGGO ${r.status}: ${(r.texto || JSON.stringify(r.datos || '')).slice(0, 120)}`; break }
          lista.push(...(r.datos?.data || []).map(resumirEpisodio))
          if (!hayMasPaginas(r.datos)) break
          if (pagina === MAXIMO_PAGINAS_EPISODIOS) fin = `cortado en ${MAXIMO_PAGINAS_EPISODIOS} páginas`
        }
      } catch (e) { fin = String(e?.message || e).slice(0, 120) }
      listas[m] = lista
      informe.tcggo[`expansiones_${m}`] = { ...masAntiguas(lista), fin }
    }
    // La expansión de nuestro set y la carta dentro.
    const { por, episodio, candidatas } = episodioDelSet(set || { name: setId }, listas[mercado] || [])
    informe.tcggo.expansionDelSet = episodio ? { por, ...episodio } : { por: null, candidatas: candidatas || [] }
    if (episodio) {
      const cartas = []
      let fin = null
      try {
        for (let pagina = 1; pagina <= MAXIMO_PAGINAS_CARTAS; pagina++) {
          const r = await pedir(urlCartasDeEpisodio(episodio.id, pagina, bases[mercado]), cab, 'tcggo')
          if (!r.ok) { fin = `TCGGO ${r.status}`; break }
          cartas.push(...(r.datos?.data || []))
          if (!hayMasPaginas(r.datos)) break
          if (pagina === MAXIMO_PAGINAS_CARTAS) fin = `cortado en ${MAXIMO_PAGINAS_CARTAS} páginas`
        }
      } catch (e) { fin = String(e?.message || e).slice(0, 120) }
      informe.tcggo.cartasDeLaExpansion = { total: cartas.length, fin }
      informe.tcggo.laCarta = cartasQueCasan(cartas, { numero, nombre })
    }
    // ¿Busca por nombre? Dos grafías, una página cada una.
    informe.tcggo.busqueda = {}
    for (const param of ['search', 'name']) {
      try {
        const r = await pedir(`${bases[mercado]}/cards?${param}=${encodeURIComponent(nombre || 'charizard')}&per_page=20`, cab, 'tcggo')
        informe.tcggo.busqueda[param] = r.ok ? { status: r.status, resultados: Array.isArray(r.datos?.data) ? r.datos.data.length : null, primeros: (r.datos?.data || []).slice(0, 3).map((c) => `${c.name} · ${c.card_code_number || c.card_number} · ${c.episode?.name || ''}`) } : { status: r.status, texto: (r.texto || JSON.stringify(r.datos || '')).slice(0, 100) }
      } catch (e) { informe.tcggo.busqueda[param] = { error: String(e?.message || e).slice(0, 120) } }
    }
  }

  // 4. Scrydex.
  const sc = cabecerasScrydex(env)
  if (sc.faltan) {
    informe.scrydex = { saltado: `faltan ${sc.faltan.join(', ')} en Netlify` }
  } else {
    const idiomaScrydex = mercado === 'JP' ? 'ja' : 'en'
    try {
      // Una carta nuestra escrita por Scrydex se llama `scrydex-<id suyo>`: a Scrydex se le pide el suyo.
      const r = await pedir(urlDeSonda(`${idiomaScrydex}/cards/${id.replace(/^scrydex-/, '')}`), sc.cabeceras, 'scrydex')
      informe.scrydex.carta = r.ok ? resumirScrydex(r.datos?.data || r.datos) : { status: r.status, texto: (r.texto || JSON.stringify(r.datos || '')).slice(0, 160) }
      // El LISTADO de su expansión pedido como lo pide el relleno desde la
      // 697 (`include=prices`), una carta (700): para ver si ese listado
      // trae la traducción y la Pokédex, o solo los precios.
      const expansion = (r.datos?.data || r.datos)?.expansion?.id
      if (r.ok && expansion) {
        const l = await pedir(urlDeSonda(`${idiomaScrydex}/cards`, { q: `expansion.id:${expansion}`, page_size: 1, include: 'prices' }), sc.cabeceras, 'scrydex')
        const primera = l.datos?.data?.[0]
        informe.scrydex.listadoConPrecios = l.ok ? (primera ? { id: primera.id, campos: Object.keys(primera), nombreIngles: primera.translation?.en?.name || null, dex: primera.national_pokedex_numbers || null, precios: (primera.variants || []).flatMap((v) => v.prices || []).length } : { nota: 'lista vacía' }) : { status: l.status, texto: (l.texto || JSON.stringify(l.datos || '')).slice(0, 160) }
      }
    } catch (e) { informe.scrydex.carta = { error: String(e?.message || e).slice(0, 120) } }
    try {
      const r = await pedir(urlDeSonda(`${idiomaScrydex}/expansions/${setId}`), sc.cabeceras, 'scrydex')
      informe.scrydex.expansion = r.ok ? { id: r.datos?.data?.id || r.datos?.id, nombre: r.datos?.data?.name || r.datos?.name, total: r.datos?.data?.total ?? r.datos?.total, fecha: r.datos?.data?.release_date || r.datos?.release_date } : { status: r.status, texto: (r.texto || JSON.stringify(r.datos || '')).slice(0, 160) }
    } catch (e) { informe.scrydex.expansion = { error: String(e?.message || e).slice(0, 120) } }
    if (mercado === 'JP' && set?.name_en) {
      try {
        const r = await pedir(urlDeSonda('ja/expansions', { q: `name:"${set.name_en}"`, page_size: 5 }), sc.cabeceras, 'scrydex')
        informe.scrydex.expansionPorNombre = r.ok ? (r.datos?.data || []).map((e) => ({ id: e.id, nombre: e.name, total: e.total, fecha: e.release_date })) : { status: r.status }
      } catch (e) { informe.scrydex.expansionPorNombre = { error: String(e?.message || e).slice(0, 120) } }
    }
  }
  return informe
}

export default async (req) => {
  const json = (e, c) => new Response(JSON.stringify(c), { status: e, headers: { 'content-type': 'application/json' } })
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' })
  if (!(await idDeAdmin(tokenDe(req)))) return json(401, { error: 'No autorizado.' })
  let cuerpo = {}
  try { cuerpo = await req.json() } catch { /* sin cuerpo */ }
  const id = String(cuerpo.id || '').trim()
  if (!/^[a-z0-9][a-z0-9._-]{1,40}$/i.test(id)) return json(400, { error: 'Dime el id de una carta nuestra (p. ej. base1-4).' })
  const mercado = cuerpo.mercado === 'JP' ? 'JP' : 'WEST'
  try {
    return json(200, await sondear({ id, mercado }))
  } catch (e) {
    return json(502, { error: String(e?.message || e).slice(0, 300) })
  }
}
