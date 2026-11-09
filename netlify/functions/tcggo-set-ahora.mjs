// «Actualizar desde TCGGO», de /admin → Colecciones → un set (tanda 1275).
//
// PINGU, con Delta Reign recién salida: «en TCGGO el set ya está… con
// precios, y tiene productos y todo. ¿Puedes desarrollar un botón en el
// admin, en la parte de colecciones, que traiga de TCGGO todo lo relacionado
// con el set? Sería como una actu manual». Las pasadas programadas lo hacen
// solas, pero cada una a su ritmo (emparejar cada hora, el catálogo una vez
// por semana, los precios una vez al día) y una función programada no se
// puede llamar por su URL (la 589). Esto hace las MISMAS pasadas para UNA
// expansión, al momento y aunque ya estén hechas hoy:
//
//   1. emparejar: qué expansión de TCGGO es y el id de Cardmarket de cada
//      carta (solo el occidental: el japonés lo casa el catálogo);
//   2. cartas: las que falten, con su foto y su número (y si el set estaba
//      escondido y ya tiene cartas, se enseña);
//   3. precios: los de cada carta por idioma (de ahí salen los idiomas del
//      set) y la fila del set: logo, fecha, cuántas cartas y lo que vale;
//   4. productos: los sellados de esa expansión.
//
// Un paso por llamada, que el panel encadena: los cuatro juntos no caben en
// el tiempo de una función. Cada paso cuenta en el tope diario de su pasada y
// para en un 429/403 como ella. Al acabar vacía la copia de la CDN (`sets`)
// para que la web lo enseñe ya. Solo para administradores, por POST.
import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import { purgarEtiquetas } from '../lib/purgar.mjs'
import { ETIQUETA_CACHE } from './sets.mjs'
import { procesar as emparejar, CLAVE_ESTADO as CLAVE_PARES } from './tcggo-emparejar.mjs'
import { procesar as catalogo, CLAVE_ESTADO as CLAVE_CATALOGO } from './tcggo-catalogo.mjs'
import { procesar as precios } from './tcggo-precios.mjs'
import { procesar as productos } from './tcggo-productos.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const PASOS = ['emparejar', 'cartas', 'precios', 'productos']

async function rest(ruta, clave) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, { headers: { apikey: clave, authorization: `Bearer ${clave}` } })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}

// Qué expansión de TCGGO es el set. En el occidental manda el emparejador
// cuando casó algo; si no (una que se casó vacía, como Delta Reign), la
// fila; y si tampoco, lo que el emparejador eligiera aunque fuera sin pares.
// En el japonés, la fila o el mapa del catálogo.
export function episodioDelSet(set, mercado, pares, catalogoEstado) {
  const fila = Number(set?.tcggo_id)
  const deFila = Number.isInteger(fila) && fila > 0 ? fila : null
  if (mercado === 'JP') {
    if (deFila) return deFila
    for (const [id, sets] of Object.entries(catalogoEstado?.setsPorEpisodio?.JP || {})) if (Array.isArray(sets) && sets.includes(set.id)) return Number(id)
    return null
  }
  const h = pares?.hechos?.[set?.id]
  const delPar = h && !h.sospechoso && Number.isInteger(h.episodio) ? h.episodio : null
  if (delPar && Number(h.pares) > 0) return delPar
  return deFila || delPar
}

export async function actualizarSet(req, {
  env = process.env, fetchImpl = fetch, esAdmin = (t) => idDeAdmin(t, fetchImpl), restImpl = null,
  emparejarImpl = emparejar, catalogoImpl = catalogo, preciosImpl = precios, productosImpl = productos, purgarImpl = purgarEtiquetas,
} = {}) {
  const json = (estado, cuerpo) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Método no permitido' })
  if (!(await esAdmin(tokenDe(req)))) return json(401, { ok: false, error: 'Solo para administradores.' })
  const cuerpo = await req.json().catch(() => ({}))
  const setId = String(cuerpo?.set || '').trim().slice(0, 80)
  const mercado = cuerpo?.mercado === 'JP' ? 'JP' : 'WEST'
  const paso = PASOS.includes(cuerpo?.paso) ? cuerpo.paso : null
  if (!setId || !paso) return json(400, { ok: false, error: 'Falta el set o el paso.' })
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return json(500, { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' })
  if (!env.TCGGO_API_KEY) return json(200, { ok: true, paso, saltado: 'falta TCGGO_API_KEY en Netlify' })
  const pedir = restImpl || ((ruta) => rest(ruta, clave))
  const estadoDe = async (k) => (await pedir(`scrydex_estado?select=valor&clave=eq.${k}&limit=1`))?.[0]?.valor || {}

  let set
  try {
    set = (await pedir(`tcg_sets?select=id,name,name_en,tcggo_id,oculto&market=eq.${mercado}&id=eq.${encodeURIComponent(setId)}&limit=1`))?.[0]
  } catch (e) {
    return json(502, { ok: false, paso, error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` })
  }
  if (!set) return json(404, { ok: false, paso, error: 'Ese set no está en la tabla.' })

  try {
    if (paso === 'emparejar') {
      // El japonés no tiene emparejador: lo casa el paso de las cartas.
      if (mercado === 'JP') return json(200, { ok: true, paso, nota: 'el japonés se casa al traer las cartas' })
      const r = await emparejarImpl({ env, fetchImpl, mercado, soloSets: [set.id], peticiones: 20 })
      const c = r?.cuerpo || {}
      if (r?.estado !== 200) return json(502, { ok: false, paso, error: c.error || `el emparejador contestó ${r?.estado}` })
      const turno = (c.esteTurno || []).find((x) => String(x.set) === String(set.id)) || null
      return json(200, { ok: true, paso, sigue: Boolean(c.quedanIds?.length) && !c.parado, parado: c.parado || null, turno })
    }
    const pares = mercado === 'WEST' ? await estadoDe(CLAVE_PARES) : null
    const catEstado = mercado === 'JP' ? await estadoDe(CLAVE_CATALOGO) : null
    const episodio = episodioDelSet(set, mercado, pares, catEstado)
    if (!episodio) return json(200, { ok: false, paso, error: 'No se sabe qué expansión de TCGGO es este set: no casó al emparejar y su fila no lleva su id de TCGGO.' })
    const solo = { mercado, id: episodio, set: set.id, nombre: set.name_en || set.name || '' }
    if (paso === 'cartas') {
      const r = await catalogoImpl({ env, fetchImpl, soloEpisodio: solo, peticiones: 20 })
      if (r?.ok === false) return json(502, { ok: false, paso, episodio, error: r.error })
      const turno = (r?.esteTurno || []).find((x) => x.episodio === episodio && x.mercado === mercado) || null
      return json(200, { ok: true, paso, episodio, saltado: r?.saltado || null, parado: r?.parado || null, sigue: !turno && !r?.parado && !r?.saltado, turno })
    }
    if (paso === 'precios') {
      const r = await preciosImpl({ env, fetchImpl, soloEpisodio: solo, peticiones: 20 })
      if (r?.ok === false) return json(502, { ok: false, paso, episodio, error: r.error })
      const hecha = (r?.hechasAhora || []).find((h) => h.episodio === episodio && h.mercado === mercado) || null
      const sigue = !r?.solo?.terminada && !r?.parado && !r?.saltado && !(r?.saltadasSinCm || []).includes(episodio)
      return json(200, { ok: true, paso, episodio, saltado: r?.saltado || null, parado: r?.parado || null, sigue, hecha, sinCm: (r?.saltadasSinCm || []).includes(episodio), filaDelSet: r?.solo?.filaDelSet || null })
    }
    // productos: el último paso; después, que la web lo enseñe ya.
    const r = await productosImpl({ env, fetchImpl, soloExpansion: { id: episodio, mercado } })
    const web = await purgarImpl([ETIQUETA_CACHE], { env, fetchImpl }).catch((e) => ({ ok: false, error: String(e?.message || e) }))
    if (r?.error) return json(502, { ok: false, paso, episodio, error: r.error, web })
    return json(200, { ok: true, paso, episodio, saltado: r?.saltado || r?.parado || null, productos: Number(r?.productos) || 0, web })
  } catch (e) {
    return json(502, { ok: false, paso, error: String(e?.message || e).slice(0, 300) })
  }
}

export default (req) => actualizarSet(req)
