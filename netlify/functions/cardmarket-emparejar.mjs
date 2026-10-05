// Emparejar nuestras cartas con los productos de Cardmarket (tanda 587).
//
// Lo llama /admin → Cartas, «Emparejar con Cardmarket». ENSAYO EN SECO por
// defecto: devuelve qué haría, set a set, y solo escribe si `escribir`
// viene a true (el panel pide confirmación con el número delante). Lo que
// escribe es `tcg_cards.cm_id_product_propio` (+ `cm_por`), por la función
// `cardmarket_guardar_pares` de la migración.
//
// ── POR QUÉ VA POR TANDAS Y SE LLAMA VARIAS VECES ──
//
// Una función de Netlify se mata a los pocos segundos. Bajar el catálogo
// de Cardmarket (13 MB) cuesta ~2 s y cada set pide sus cartas a nuestra
// base (~0,2 s): 220 sets no caben en una llamada. Así que cada llamada
// empieza en `desde` (el índice del set), hace los que le dé tiempo y
// devuelve `siguienteDesde`; el panel encadena llamadas hasta que vuelve
// null. El catálogo se baja en cada llamada: es la parte fija y es barata.
//
// ── LO QUE NO SE ESCRIBE ──
//
// Un set cuya expansión no se decide con claridad (dos candidatas a menos
// de 15 puntos) no se toca; una carta sin par no se toca; y un set cuya
// alineación casa menos de la mitad de sus cartas por orden se apunta como
// sospechoso y no se escribe, aunque tenga pares: la expansión
// probablemente no es esa. Mejor sin par que con el equivocado — un par
// malo es exactamente el fallo que venimos a arreglar.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY.
import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import { URL_PRODUCTOS, porExpansion, expansionDeSet, emparejarSet } from '../lib/cardmarket-catalogo.mjs'
import { ID_DE_POCKET } from '../../js/catalogo-series.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const MS_DE_MARGEN = 7_500
// Por debajo de esto la expansión elegida no se cree (ver arriba).
export const CONFIANZA_MINIMA = 0.5

async function rest(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...(opciones || {}),
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      ...(opciones ? { 'content-type': 'application/json' } : {}),
      ...(opciones?.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, guardarImpl = null, reloj = () => Date.now(),
  mercado = 'WEST', escribir = false, desde = 0, productos = null,
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { estado: 500, cuerpo: { error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' } }
  const arranque = reloj()
  const quedaTiempo = () => reloj() - arranque < MS_DE_MARGEN
  const pedir = restImpl || ((ruta) => rest(ruta, clave))
  const guardar = guardarImpl || ((pares) => rest('rpc/cardmarket_guardar_pares', clave, { method: 'POST', body: JSON.stringify({ p_pares: pares, p_market: mercado }) }))

  // El catálogo de Cardmarket, entero.
  let catalogo = productos
  if (!catalogo) {
    const res = await fetchImpl(URL_PRODUCTOS, { headers: { accept: 'application/json' } })
    if (!res.ok) return { estado: 502, cuerpo: { error: `Cardmarket ${res.status} al bajar el catálogo de productos.` } }
    const j = await res.json()
    catalogo = Array.isArray(j?.products) ? j.products : null
    if (!catalogo) return { estado: 502, cuerpo: { error: 'El catálogo de Cardmarket no trae `products`.' } }
  }
  const expansiones = porExpansion(catalogo)

  // Nuestros sets, sin TCG Pocket, en orden estable.
  let sets
  try {
    sets = await pedir(`tcg_sets?select=id,name,name_en,card_count_total&market=eq.${mercado}&order=id&limit=1000`)
  } catch (e) {
    return { estado: 502, cuerpo: { error: String(e?.message || e).slice(0, 200) } }
  }
  sets = (sets || []).filter((s) => !ID_DE_POCKET.test(String(s.id)))

  const informe = []
  const aEscribir = []
  let i = Math.max(0, Number(desde) || 0)
  for (; i < sets.length && quedaTiempo(); i++) {
    const set = sets[i]
    let cartas
    try {
      cartas = await pedir(`tcg_cards?select=id,local_id,name,attacks,cm_id_product_propio&market=eq.${mercado}&set_id=eq.${encodeURIComponent(set.id)}&limit=2000`)
    } catch (e) {
      const m = String(e?.message || e)
      if (/cm_id_product_propio|42703/.test(m)) {
        return { estado: 409, cuerpo: { error: 'Falta la migración supabase-migration-cardmarket-propio.sql. Ejecútala y vuelve.', detalle: m.slice(0, 200) } }
      }
      informe.push({ set: set.id, nombre: set.name, error: m.slice(0, 160) })
      continue
    }
    if (!cartas?.length) {
      informe.push({ set: set.id, nombre: set.name, cartas: 0, porque: 'sin cartas en nuestro catálogo' })
      continue
    }
    const { elegida, candidatas } = expansionDeSet(cartas, expansiones)
    if (!elegida) {
      informe.push({ set: set.id, nombre: set.name, cartas: cartas.length, candidatas, porque: candidatas.length ? 'ninguna expansión suya se lleva claramente' : 'ningún nombre en común con nada suyo' })
      continue
    }
    const r = emparejarSet(cartas, expansiones.get(elegida))
    const sospechoso = r.confianza < CONFIANZA_MINIMA
    const yaIguales = r.pares.filter((p) => cartas.find((c) => c.id === p.id)?.cm_id_product_propio === p.idProduct).length
    const fila = {
      set: set.id,
      nombre: set.name,
      cartas: cartas.length,
      idExpansion: elegida,
      puntos: candidatas[0]?.puntos,
      pares: r.pares.length,
      porOrden: r.pares.filter((p) => p.por === 'orden').length,
      porNombre: r.pares.length - r.pares.filter((p) => p.por === 'orden').length,
      sinPar: r.sinPar.length,
      ejemplosSinPar: r.sinPar.slice(0, 4).map((s) => `${s.numero} ${s.nombre}: ${s.porque}`),
      sobran: r.sobran,
      confianza: Math.round(r.confianza * 100) / 100,
      yaIguales,
      ...(sospechoso ? { SOSPECHOSO: `solo el ${Math.round(r.confianza * 100)} % casa por orden: no se escribe` } : {}),
    }
    informe.push(fila)
    if (!sospechoso) {
      for (const p of r.pares) {
        const carta = cartas.find((c) => c.id === p.id)
        if (carta && carta.cm_id_product_propio !== p.idProduct) aEscribir.push({ id: p.id, id_product: p.idProduct, por: p.por })
      }
    }
  }

  let escritas = 0
  if (escribir && aEscribir.length) {
    for (let k = 0; k < aEscribir.length; k += 500) {
      const n = await guardar(aEscribir.slice(k, k + 500))
      escritas += Number(n) || 0
    }
  }

  return {
    estado: 200,
    cuerpo: {
      ensayoEnSeco: !escribir,
      susProductos: catalogo.length,
      susExpansiones: expansiones.size,
      nuestrosSets: sets.length,
      desde: Math.max(0, Number(desde) || 0),
      siguienteDesde: i < sets.length ? i : null,
      setsMirados: informe.length,
      setsConPar: informe.filter((f) => f.idExpansion && !f.SOSPECHOSO).length,
      setsSinExpansion: informe.filter((f) => !f.idExpansion && !f.error).length,
      setsSospechosos: informe.filter((f) => f.SOSPECHOSO).length,
      cartasConPar: informe.reduce((n, f) => n + (f.SOSPECHOSO ? 0 : f.pares || 0), 0),
      cartasSinPar: informe.reduce((n, f) => n + (f.sinPar || 0), 0),
      aEscribir: aEscribir.length,
      escritas,
      informe,
    },
  }
}

export default async (req) => {
  const json = (e, c) => new Response(JSON.stringify(c), { status: e, headers: { 'content-type': 'application/json' } })
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' })
  if (!(await idDeAdmin(tokenDe(req)))) return json(401, { error: 'No autorizado.' })
  let cuerpo = {}
  try { cuerpo = await req.json() } catch { cuerpo = {} }
  try {
    const r = await procesar({ mercado: cuerpo.mercado || 'WEST', escribir: cuerpo.escribir === true, desde: cuerpo.desde || 0 })
    return json(r.estado, r.cuerpo)
  } catch (e) {
    return json(502, { error: String(e?.message || e).slice(0, 300) })
  }
}
