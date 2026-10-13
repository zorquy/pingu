// Las cartas japonesas que la gente tenía en sets que ya no se ven (tanda
// 824, PO3).
//
// La 810 escondió los sets japoneses que no venían de TCGGO (Scrydex,
// TCGdex) y la 811 los rehízo de TCGGO. Lo que alguien tuviera en uno de
// los viejos se quedó ahí: la línea existe, pero su set no sale en la
// estantería. Esto PROPONE adónde iría cada línea —el set de TCGGO con el
// mismo nombre inglés o, si no, el mismo código, y dentro la carta con el
// mismo número— y lo deja escrito en `scrydex_estado` (`jp_lineas_viejas`)
// para /admin. NO TOCA ninguna colección: reapuntar líneas de otra gente es
// cambiar lo que tiene, y eso lo decide PINGU mirando el informe
// (`APLICAR`, apagado).
//
// Solo lee de nuestra base (gratis) y una vez al día.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY.
import { nombreComparable, soloDigitos } from '../lib/tcggo.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'jp_lineas_viejas'
export const APLICAR = false
const TROZO = 1000

async function restReal(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...(opciones || {}),
    headers: { apikey: clave, authorization: `Bearer ${clave}`, ...(opciones ? { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' } : {}) },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}

// Supabase corta a 1.000 filas sin avisar (la 808).
async function todas(rest, ruta, clave, maxTrozos = 60) {
  const filas = []
  for (let i = 0; i < maxTrozos; i++) {
    const trozo = (await rest(`${ruta}&offset=${i * TROZO}&limit=${TROZO}`, clave)) || []
    filas.push(...trozo)
    if (trozo.length < TROZO) break
  }
  return filas
}

// El set nuevo de un set viejo: el ÚNICO a la vista con el mismo nombre
// inglés, o si no el único con el mismo código. Dos candidatos es «dudoso»,
// no uno a suertes.
export function setNuevoDe(viejo, nuevos) {
  const nombre = nombreComparable(viejo.name_en || '')
  const porNombre = nombre ? nuevos.filter((n) => nombreComparable(n.name_en || n.name || '') === nombre) : []
  if (porNombre.length === 1) return { set: porNombre[0], por: 'nombre' }
  if (porNombre.length > 1) return { dudoso: porNombre.map((n) => n.id) }
  const codigo = String(viejo.tcg_online_code || '').toUpperCase()
  const porCodigo = codigo ? nuevos.filter((n) => String(n.tcg_online_code || '').toUpperCase() === codigo) : []
  if (porCodigo.length === 1) return { set: porCodigo[0], por: 'código' }
  if (porCodigo.length > 1) return { dudoso: porCodigo.map((n) => n.id) }
  return null
}

// La carta nueva: la única del set nuevo con el mismo número.
export function cartaNuevaDe(vieja, cartasDelSet) {
  const n = soloDigitos(vieja.local_id)
  if (!n) return null
  const mismas = cartasDelSet.filter((c) => soloDigitos(c.local_id) === n)
  return mismas.length === 1 ? mismas[0] : null
}

export async function pasada({ env = process.env, restImpl = null, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: true, saltado: 'sin SUPABASE_SERVICE_ROLE_KEY' }
  const rest = restImpl || restReal
  const hoy = ahora.toISOString().slice(0, 10)
  const previo = (await rest(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`, clave).catch(() => null))?.[0]?.valor || {}
  if (previo.dia === hoy) return { ok: true, saltado: 'ya se miró hoy' }

  const viejos = await todas(rest, 'tcg_sets?market=eq.JP&oculto=is.true&select=id,name,name_en,tcg_online_code', clave)
  const nuevos = await todas(rest, 'tcg_sets?market=eq.JP&oculto=not.is.true&tcggo_id=not.is.null&select=id,name,name_en,tcg_online_code', clave)
  const viejoPorId = new Map(viejos.map((s) => [s.id, s]))
  const lineas = await todas(rest, 'user_collection?market=eq.JP&select=id,card_id', clave)
  // Las cartas de esas líneas, a trozos de 150 ids (una URL tiene límite).
  const ids = [...new Set(lineas.map((l) => l.card_id).filter(Boolean))]
  const cartas = new Map()
  for (let i = 0; i < ids.length; i += 150) {
    const trozo = ids.slice(i, i + 150).map((x) => `"${String(x).replace(/"/g, '')}"`).join(',')
    for (const c of (await rest(`tcg_cards?market=eq.JP&id=in.(${encodeURIComponent(trozo)})&select=id,set_id,local_id,name_en&limit=1000`, clave)) || []) cartas.set(c.id, c)
  }
  const huerfanas = lineas.filter((l) => viejoPorId.has(cartas.get(l.card_id)?.set_id))

  const porSet = {}
  const cartasDeSet = new Map()
  for (const l of huerfanas) {
    const vieja = cartas.get(l.card_id)
    const v = viejoPorId.get(vieja.set_id)
    const r = (porSet[v.id] ||= { nombre: v.name_en || v.name, lineas: 0, casadas: 0, destino: null, sinCarta: [], ejemplos: [] })
    r.lineas++
    const nuevo = setNuevoDe(v, nuevos)
    if (!nuevo?.set) {
      r.destino = nuevo?.dudoso ? { dudoso: nuevo.dudoso } : null
      continue
    }
    r.destino = { set: nuevo.set.id, por: nuevo.por }
    if (!cartasDeSet.has(nuevo.set.id)) cartasDeSet.set(nuevo.set.id, (await todas(rest, `tcg_cards?market=eq.JP&set_id=eq.${encodeURIComponent(nuevo.set.id)}&select=id,local_id`, clave)) || [])
    const nueva = cartaNuevaDe(vieja, cartasDeSet.get(nuevo.set.id))
    if (nueva) {
      r.casadas++
      if (r.ejemplos.length < 3) r.ejemplos.push(`${vieja.id} → ${nueva.id}`)
    } else if (r.sinCarta.length < 5) r.sinCarta.push(vieja.id)
  }
  const valor = {
    dia: hoy,
    fecha: ahora.toISOString(),
    aplicar: APLICAR,
    lineasJp: lineas.length,
    huerfanas: huerfanas.length,
    casadas: Object.values(porSet).reduce((a, x) => a + x.casadas, 0),
    porSet,
  }
  await rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: CLAVE_ESTADO, valor, updated_at: ahora.toISOString() }]) })
  return { ok: true, huerfanas: valor.huerfanas, casadas: valor.casadas, sets: Object.keys(porSet).length }
}

// Un error que vuelve como respuesta no lo lee nadie (la 655): va al estado.
export async function ejecutar({ env = process.env, restImpl = null, ahora = new Date() } = {}) {
  try {
    return await pasada({ env, restImpl, ahora })
  } catch (e) {
    const error = String(e?.message || e).slice(0, 300)
    const clave = env.SUPABASE_SERVICE_ROLE_KEY
    const rest = restImpl || restReal
    if (clave) await rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: CLAVE_ESTADO, valor: { ultimoError: { fecha: ahora.toISOString(), error } }, updated_at: ahora.toISOString() }]) }).catch(() => {})
    return { ok: false, error }
  }
}

export default async () => {
  const r = await ejecutar()
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Una vez por hora, y la pasada se sale si ya miró hoy: una lectura al día.
export const config = { schedule: '37 * * * *' }
