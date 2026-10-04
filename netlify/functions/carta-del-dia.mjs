// La carta del día de «¿Qué carta es?» (tanda 570).
//
// La elige la PRIMERA petición de cada día y la deja en `carta_del_dia`
// para que todo el mundo vea la misma. No se puede elegir en el
// navegador: el catálogo crece cada hora y una semilla sobre «cuántas
// hay» daría una carta distinta según el momento. Y la semilla sale de
// la fecha (js/carta-del-dia.js), así que dos servidores que lleguen a la
// vez eligen la misma y el `on conflict do nothing` deja una sola fila.
//
// Patrón inyectable, como las demás: `pedir` y `guardar` se cambian en
// las pruebas por un doble, y lo que se prueba es la elección y el orden
// de las llamadas.
import { indiceDelDia, numeroDelDia } from '../../js/carta-del-dia.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

// Las que pueden salir: occidentales, Pokémon (no entrenadores ni
// energías: no hay nada que adivinar en un Caramelo Raro), con foto y con
// rareza. Ordenadas por id para que «la número N» sea siempre la misma.
export const FILTRO_ELEGIBLES = 'market=eq.WEST&category=eq.Pokemon&rarity=not.is.null&or=(image_path.not.is.null,image_scrydex.not.is.null)'
// Con `rarity_en` al lado de `rarity`, que es la regla de la 523.
export const COLUMNAS_CARTA = 'id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,rarity,rarity_en,types,illustrator,hp,tcg_sets(name,name_en,tcg_online_code,serie_id,release_date)'

export const hoyUTC = () => new Date().toISOString().slice(0, 10)

// Segundos hasta la medianoche UTC: lo que puede vivir la respuesta en
// caché, porque mañana es otra carta.
export function segundosHastaManana(ahora = new Date()) {
  const manana = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + 1)
  return Math.max(60, Math.floor((manana - ahora.getTime()) / 1000))
}

async function rest(ruta, clave, { metodo = 'GET', cuerpo = null, cabeceras = {} } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    method: metodo,
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      ...(cuerpo ? { 'content-type': 'application/json' } : {}),
      ...cabeceras,
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const rango = res.headers.get('content-range') || ''
  const datos = metodo === 'GET' ? await res.json() : null
  return { datos, total: Number(rango.split('/')[1]) || null }
}

// La lógica, con sus dos puertas inyectables:
//   pedir(ruta, { cabeceras }) → { datos, total }
//   guardar(ruta, fila)        → inserta ignorando duplicados
export async function elegirCartaDelDia({ dia, pedir, guardar }) {
  const guardada = (await pedir(`carta_del_dia?select=card_id&day=eq.${dia}&limit=1`)).datos
  let cardId = guardada?.[0]?.card_id || null
  if (!cardId) {
    const { total } = await pedir(`tcg_cards?select=id&${FILTRO_ELEGIBLES}&limit=1`, { cabeceras: { prefer: 'count=exact' } })
    if (!total) return { error: 'No hay cartas elegibles.' }
    const i = indiceDelDia(dia, total)
    const elegida = (await pedir(`tcg_cards?select=id&${FILTRO_ELEGIBLES}&order=id.asc&limit=1&offset=${i}`)).datos
    cardId = elegida?.[0]?.id || null
    if (!cardId) return { error: 'No se ha podido elegir la carta.' }
    await guardar('carta_del_dia', { day: dia, card_id: cardId })
    // Si otro llegó primero, manda la suya (que con la misma semilla es
    // la misma, salvo que el catálogo cambiara entre las dos cuentas).
    const otra = (await pedir(`carta_del_dia?select=card_id&day=eq.${dia}&limit=1`)).datos
    cardId = otra?.[0]?.card_id || cardId
  }
  const carta = (await pedir(`tcg_cards?select=${COLUMNAS_CARTA}&id=eq.${encodeURIComponent(cardId)}&market=eq.WEST&limit=1`)).datos?.[0]
  if (!carta) return { error: 'La carta del día no está en el catálogo.' }
  // Y la de AYER, por su nombre (tanda 572): «ayer era Gastly» es lo que
  // hace que quien no jugó ayer vuelva mañana. Si no la hay, nada.
  let ayer = null
  try {
    const [y, m, d] = dia.split('-').map(Number)
    const diaAyer = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
    const fila = (await pedir(`carta_del_dia?select=card_id&day=eq.${diaAyer}&limit=1`)).datos?.[0]
    if (fila?.card_id) {
      const c = (await pedir(`tcg_cards?select=id,name,name_es,local_id,tcg_sets(name,name_en)&id=eq.${encodeURIComponent(fila.card_id)}&market=eq.WEST&limit=1`)).datos?.[0]
      if (c) ayer = { id: c.id, name: c.name, name_es: c.name_es, local_id: c.local_id, tcg_sets: c.tcg_sets }
    }
  } catch {
    // sin ayer
  }
  return { dia, numero: numeroDelDia(dia), carta, ayer }
}

export default async () => {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return Response.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
  const dia = hoyUTC()
  try {
    const r = await elegirCartaDelDia({
      dia,
      pedir: (ruta, o = {}) => rest(ruta, clave, o),
      guardar: (tabla, fila) => rest(tabla, clave, { metodo: 'POST', cuerpo: [fila], cabeceras: { prefer: 'resolution=ignore-duplicates,return=minimal' } }),
    })
    if (r.error) return Response.json(r, { status: 503, headers: { 'cache-control': 'no-store' } })
    return Response.json(r, { headers: { 'cache-control': `public, max-age=${segundosHastaManana()}` } })
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 200) }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
