import { cabecerasDe, urlDeSonda, idSinIdioma, fecha, clave } from '../lib/scrydex.mjs'

// TRAER sus sets japoneses, no retocar los nuestros (tanda 540).
//
// PINGU, con las capturas de Scrydex delante: «quiero que calques toda la
// base de datos de sets y de cartas de Scrydex y mostremos eso. Estamos
// pagando Scrydex y Scrydex es lo mandante».
//
// Y el diagnóstico es correcto. Hasta ahora el japonés era el catálogo de
// TCGdex con Scrydex retocándolo por encima, y eso llega a medias POR
// CONSTRUCCIÓN:
//
//   · 186 sets nuestros contra 231 suyos.
//   · 68 de los nuestros no tienen NI UNA CARTA (es un agujero de TCGdex,
//     medido en la 486).
//   · El retoque solo toca lo que EMPAREJA, así que lo que no empareja se
//     queda en kanji y sin logo para siempre.
//
// ── LO QUE HACE, Y LO QUE NO ──
//
// INSERTA las expansiones suyas que no están reclamadas por ninguna
// nuestra, con SU id (`mf_ja`), su logo, su símbolo, su nombre japonés, su
// nombre occidental y su fecha.
//
// NO BORRA NADA. Ni un set ni una carta: lo que ya hay se queda, y lo que
// no teníamos aparece. Borrar el catálogo japonés viejo es una decisión
// aparte —hay gente que puede tener cartas japonesas guardadas apuntando a
// esos identificadores— y esa la toma PINGU, no yo.
//
// Y NO INSERTA un set suyo que ya esté emparejado con uno nuestro: esos
// siguen siendo los nuestros y se enriquecen como hasta ahora, que si no
// saldrían DOS filas de la misma colección.
//
// ── EL CERROJO QUE IMPIDE DUPLICAR ──
//
// Un set suyo se salta si alguno de los nuestros ya lo reclama
// (`scrydex_id`) o si su identificador, quitándole el idioma, es el de uno
// nuestro sin distinguir mayúsculas (`SV1a` ↔ `sv1a_ja`, la lección de la
// 486). Lo que quede fuera de esas dos redes se inserta: con 231 suyos y
// 186 nuestros, duplicar una colección es el único error que aquí se
// paga caro, porque sale en la cara de la biblioteca.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const MERCADO = 'JP'
const IDIOMA = 'ja'
const CLAVE_ESTADO = 'importar-jp'
// Netlify mata la función a los 30 segundos.
const MS_DE_MARGEN = 20_000
// Sus 231 expansiones en páginas de 100: 3 créditos la pasada entera.
const POR_PAGINA = 100
const PAGINAS_MAXIMAS = 8

async function rest(ruta, clave_, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...(opciones || {}),
    headers: {
      apikey: clave_,
      authorization: `Bearer ${clave_}`,
      ...(opciones ? { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return opciones ? null : res.json()
}

// La fila de un set suyo, tal cual, para insertarla como nuestra.
//
// `name` es `not null` y es el nombre JAPONÉS: ese es el nombre de verdad
// del set y es con lo que se cruza. El occidental va al lado, en `name_en`,
// y es el que se ENSEÑA (tanda 532).
// La ERA, que ellos dan por NOMBRE y nosotros agrupamos por
// IDENTIFICADOR: el desplegable de eras y el agrupado de la estantería
// miran `serie_id`, así que un set sin él se cae de los dos —y eso fue
// justo lo que pasó con los primeros importados—.
//
// El identificador sale del nombre, en minúsculas y con guiones. No es
// inventarse un dato: es la MISMA serie escrita de forma comparable, y
// dos sets de «Mega Evolution» caen en la misma caja porque su nombre es
// el mismo. El nombre que se ENSEÑA sigue siendo el suyo (`serie_name_en`).
export function serieDeSuSet(suyo) {
  const s = String(suyo?.series || '').trim().toLowerCase()
  if (!s) return null
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || null
}

export function filaDeSetSuyo(suyo) {
  const n = String(suyo?.name || '').trim()
  return {
    id: suyo.id,
    market: MERCADO,
    name: n || suyo.id,
    name_en: suyo?.translation?.en?.name || null,
    serie_id: serieDeSuSet(suyo),
    serie_name_en: suyo?.series || null,
    logo_scrydex: typeof suyo?.logo === 'string' && /^https:\/\//.test(suyo.logo) ? suyo.logo : null,
    symbol_scrydex: typeof suyo?.symbol === 'string' && /^https:\/\//.test(suyo.symbol) ? suyo.symbol : null,
    release_date: fecha(suyo?.release_date),
    tcg_online_code: suyo?.code || null,
    card_count_official: Number.isFinite(Number(suyo?.printed_total)) ? Number(suyo.printed_total) : null,
    card_count_total: Number.isFinite(Number(suyo?.total)) ? Number(suyo.total) : null,
    scrydex_id: suyo.id,
    scrydex_por: 'importado de Scrydex',
  }
}

// ¿Lo tenemos ya, con otro nombre o con el suyo?
export function yaLoTenemos(suyo, nuestros) {
  const suId = clave(suyo?.id)
  const suIdSinIdioma = clave(idSinIdioma(suyo?.id))
  return (nuestros || []).some((n) => {
    if (clave(n?.scrydex_id) === suId) return true
    const mio = clave(n?.id)
    return mio && (mio === suId || mio === suIdSinIdioma)
  })
}

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, escribirImpl = null,
  estadoImpl = null, guardarEstadoImpl = null, reloj = () => Date.now(),
} = {}) {
  const { cabeceras, faltan } = cabecerasDe(env)
  if (faltan) return { estado: 500, cuerpo: { error: `Faltan en Netlify: ${faltan.join(' y ')}.` } }
  const llave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!llave) return { estado: 500, cuerpo: { error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' } }
  const arranque = reloj()
  const quedaTiempo = () => reloj() - arranque < MS_DE_MARGEN

  const pedir = restImpl || ((ruta) => rest(ruta, llave))
  const guardar = escribirImpl || ((filas) => rest('tcg_sets', llave, { method: 'POST', body: JSON.stringify(filas) }))
  const leerEstado = estadoImpl || (async () => {
    const f = await pedir(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`)
    return f?.[0]?.valor || {}
  })
  const guardarEstado = guardarEstadoImpl || ((valor) => rest('scrydex_estado', llave, {
    method: 'POST',
    body: JSON.stringify([{ clave: CLAVE_ESTADO, valor, updated_at: new Date().toISOString() }]),
  }))

  // ── El freno: ¿avanzó la última? (la lección de la 538) ──
  const estado = await leerEstado()
  const horas = estado?.cuando ? (Date.now() - Date.parse(estado.cuando)) / 3_600_000 : Infinity
  const avanzo = Number(estado?.insertados) > 0
  if (horas < 20 && !avanzo) {
    return { estado: 200, cuerpo: { creditos: 0, porque: `ya se miró hace ${horas.toFixed(1)} h y no quedaba nada que traer` } }
  }

  const nuestros = await pedir(`tcg_sets?select=id,scrydex_id&market=eq.${MERCADO}&limit=600`)

  const suyas = []
  for (let pagina = 1; pagina <= PAGINAS_MAXIMAS && quedaTiempo(); pagina++) {
    const res = await fetchImpl(urlDeSonda(`${IDIOMA}/expansions`, { page: pagina, page_size: POR_PAGINA }), { headers: cabeceras })
    if (!res.ok) return { estado: 502, cuerpo: { error: `Scrydex ${res.status} al pedir sus expansiones japonesas` } }
    const j = await res.json()
    const lote = Array.isArray(j?.data) ? j.data : []
    suyas.push(...lote)
    if (!lote.length || suyas.length >= (Number(j?.total_count) || 0)) break
  }

  const nuevas = suyas.filter((s) => s?.id && !yaLoTenemos(s, nuestros))
  // Sin duplicados dentro de la misma sentencia: Postgres corta con «ON
  // CONFLICT DO UPDATE command cannot affect row a second time» (la
  // lección del catálogo chino, tanda 333).
  const vistos = new Set()
  const filas = []
  for (const s of nuevas) {
    const k = clave(s.id)
    if (vistos.has(k)) continue
    vistos.add(k)
    filas.push(filaDeSetSuyo(s))
  }

  if (filas.length) await guardar(filas)

  const valor = {
    cuando: new Date().toISOString(),
    susExpansiones: suyas.length,
    nuestrosAntes: (nuestros || []).length,
    insertados: filas.length,
    ejemplos: filas.slice(0, 10).map((f) => `${f.id} — ${f.name_en || f.name}`),
  }
  await guardarEstado(valor)
  return { estado: 200, cuerpo: { creditos: Math.ceil(suyas.length / POR_PAGINA), ...valor } }
}

export default async () => {
  try {
    const r = await procesar()
    return new Response(JSON.stringify(r.cuerpo), { status: r.estado, headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const config = { schedule: '*/10 * * * *' }
