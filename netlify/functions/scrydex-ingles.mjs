import { createHash } from 'node:crypto'
import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import {
  cabecerasDe, urlDeSonda, emparejarSets, CAMPOS_SUYOS,
  urlDeCartaScrydex, urlDeLogoScrydex, esRelleno, conclusion,
} from '../lib/scrydex.mjs'

// ¿Tapa Scrydex los huecos del catálogo OCCIDENTAL? (tanda 503)
//
// Es la mitad del motivo para pagar los 29 $ y es lo único que la
// evaluación de COWORK no midió: ellos midieron el japonés carta a carta y
// del inglés solo contaron expansiones. Nuestros huecos occidentales son
// **1.351 cartas sin foto** de 21.476 y **63 sets sin logo** de 210.
//
// ── POR QUÉ ESTO CUESTA TRES CRÉDITOS Y NO TRESCIENTOS ──
//
// Porque su URL de imagen es DERIVABLE y las imágenes no gastan créditos.
// Lo único que se le pide a la API es su lista de expansiones inglesas
// (224, de cien en cien: tres peticiones). Con eso se emparejan los sets
// por hechos, y el resto —¿existe el fichero?— se mide gratis.
//
// Y esa es además la pregunta correcta. «¿Lo lista su API?» y «¿existe el
// escaneo?» son dos cosas distintas: con TCGdex resultó que la API callaba
// 3.579 ficheros que sí estaban. Aquí se mira el fichero.
//
// ── LA TRAMPA QUE HACE FALSO EL RESULTADO SI SE OLVIDA ──
//
// `images.scrydex.com` contesta **200 con una imagen de relleno** para
// cualquier identificador que no exista. Sin comparar la huella, esta
// sonda diría «el 100 %» mire lo que mire. Por eso se bajan los primeros
// bytes de cada fichero y se comparan con la del relleno.
//
// VARIABLES DE ENTORNO: SCRYDEX_API_KEY, SCRYDEX_TEAM_ID,
// SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const CARTAS = 40
const LOGOS = 25
const A_LA_VEZ = 6
const BYTES = 1500
const ESPERA_MS = 8000

async function rest(ruta, clave) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: clave, authorization: `Bearer ${clave}` },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 160)}`)
  return res.json()
}

// La huella de un fichero: el SHA-1 de sus primeros bytes. Se piden solo
// esos con un `Range`, que basta para distinguir el relleno y evita
// descargarse quince mil imágenes enteras.
async function huellaDe(url, fetchImpl) {
  const corte = new AbortController()
  const t = setTimeout(() => corte.abort(), ESPERA_MS)
  try {
    const res = await fetchImpl(url, { headers: { range: `bytes=0-${BYTES - 1}` }, signal: corte.signal })
    if (!res.ok && res.status !== 206) return { estado: res.status, huella: null }
    const buf = Buffer.from(await res.arrayBuffer())
    return { estado: res.status, huella: createHash('sha1').update(buf.subarray(0, BYTES)).digest('hex') }
  } catch (e) {
    return { estado: 0, huella: null, error: String(e?.message || e).slice(0, 80) }
  } finally {
    clearTimeout(t)
  }
}

async function enTandas(cosas, cuantas, hacer) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(cuantas, cosas.length) }, async () => {
    while (i < cosas.length) await hacer(cosas[i++])
  }))
}

// Sus expansiones inglesas, paginadas. Es lo ÚNICO que gasta créditos.
async function expansionesInglesas(cabeceras, fetchImpl) {
  const fuera = []
  for (let pagina = 1; pagina <= 5; pagina++) {
    const url = urlDeSonda('en/expansions', { page: pagina, page_size: 100 })
    const res = await fetchImpl(url, { headers: cabeceras })
    if (!res.ok) throw new Error(`Scrydex ${res.status} al pedir sus expansiones`)
    const j = await res.json()
    const lote = Array.isArray(j?.data) ? j.data : []
    fuera.push(...lote)
    if (fuera.length >= (j?.total_count || 0) || lote.length === 0) break
  }
  return fuera
}

export async function procesar({ env = process.env, fetchImpl = fetch, restImpl = null } = {}) {
  const { cabeceras, faltan } = cabecerasDe(env)
  if (faltan) return { estado: 500, cuerpo: { error: `Faltan en Netlify: ${faltan.join(' y ')}.` } }
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { estado: 500, cuerpo: { error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' } }
  const pedir = restImpl || ((ruta) => rest(ruta, clave))

  // NUESTROS huecos. Los sets sin logo y una muestra de cartas sin foto,
  // con el set que las cobija: sin él no hay con qué emparejar.
  const COLS = 'id,name,release_date,card_count_official,card_count_total,tcg_online_code'
  const [setsSinLogo, cartasSinFoto, todosLosSets] = await Promise.all([
    pedir(`tcg_sets?select=${COLS}&market=eq.WEST&logo_path=is.null&limit=${LOGOS}`),
    pedir(`tcg_cards?select=id,local_id,name,set_id&market=eq.WEST&image_path=is.null&limit=${CARTAS}`),
    pedir(`tcg_sets?select=${COLS}&market=eq.WEST&limit=400`),
  ])

  let suyas = []
  try {
    suyas = await expansionesInglesas(cabeceras, fetchImpl)
  } catch (e) {
    return { estado: 502, cuerpo: { error: String(e?.message || e).slice(0, 200) } }
  }

  // Emparejar TODOS nuestros sets con los suyos: hace falta para las
  // cartas, que vienen con su `set_id` y nada más.
  const { pares, ambiguos, sueltos } = emparejarSets(todosLosSets, suyas, { suyos: CAMPOS_SUYOS })
  const suyoDe = new Map(pares.map((p) => [p.nuestro.id, p.suyo.id]))

  // ── Los logos ──
  const logos = { pedidas: 0, conEscaneo: 0, relleno: 0, fallos: 0, sinPareja: [], ejemplos: [] }
  const conPareja = setsSinLogo.filter((s) => suyoDe.has(s.id))
  logos.sinPareja = setsSinLogo.filter((s) => !suyoDe.has(s.id)).map((s) => s.id)
  await enTandas(conPareja, A_LA_VEZ, async (s) => {
    const url = urlDeLogoScrydex(suyoDe.get(s.id))
    if (!url) return void logos.fallos++
    logos.pedidas++
    const { estado, huella } = await huellaDe(url, fetchImpl)
    if (!huella) logos.fallos++
    else if (esRelleno(huella, 'logo')) logos.relleno++
    else {
      logos.conEscaneo++
      if (logos.ejemplos.length < 4) logos.ejemplos.push(`${s.id} → ${url} (HTTP ${estado})`)
    }
  })

  // ── Los escaneos ──
  const cartas = { pedidas: 0, conEscaneo: 0, relleno: 0, fallos: 0, sinPareja: [], ejemplos: [] }
  const cartasConPareja = cartasSinFoto.filter((c) => suyoDe.has(c.set_id))
  cartas.sinPareja = [...new Set(cartasSinFoto.filter((c) => !suyoDe.has(c.set_id)).map((c) => c.set_id))]
  await enTandas(cartasConPareja, A_LA_VEZ, async (c) => {
    const url = urlDeCartaScrydex(suyoDe.get(c.set_id), c.local_id)
    if (!url) return void cartas.fallos++
    cartas.pedidas++
    const { estado, huella } = await huellaDe(url, fetchImpl)
    if (!huella) cartas.fallos++
    else if (esRelleno(huella, 'carta')) cartas.relleno++
    else {
      cartas.conEscaneo++
      if (cartas.ejemplos.length < 4) cartas.ejemplos.push(`${c.id} «${c.name}» → ${url} (HTTP ${estado})`)
    }
  })

  return {
    estado: 200,
    cuerpo: {
      creditos: '3 (solo su lista de expansiones; las imágenes no gastan)',
      susExpansiones: suyas.length,
      emparejados: `${pares.length} de nuestros ${todosLosSets.length} sets occidentales`,
      ambiguos: ambiguos.length,
      sinEmparejar: sueltos.length,
      logos: { ...conclusion(logos), sinPareja: logos.sinPareja, ejemplos: logos.ejemplos },
      cartas: { ...conclusion(cartas), sinPareja: cartas.sinPareja, ejemplos: cartas.ejemplos },
    },
  }
}

export default async (req) => {
  const json = (e, c) => new Response(JSON.stringify(c), { status: e, headers: { 'content-type': 'application/json' } })
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' })
  if (!(await idDeAdmin(tokenDe(req)))) return json(401, { error: 'No autorizado.' })
  const r = await procesar()
  return json(r.estado, r.cuerpo)
}
