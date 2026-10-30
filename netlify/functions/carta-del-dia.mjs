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
import { ID_DE_POCKET } from '../../js/catalogo-series.js'
import { numeroLibre, diaLibre } from '../../js/retos-libre.js'
import { fotoContesta, revisarDePeticion, CABECERAS_REVISADO } from '../lib/fotos-reto.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

// Las que pueden salir: occidentales, Pokémon (no entrenadores ni
// energías: no hay nada que adivinar en un Caramelo Raro), con foto y con
// rareza. Ordenadas por id para que «la número N» sea siempre la misma.
// Y SIN TCG Pocket (tanda 573): sus sets son A1, A2b, B1… y la carta del
// día tiene que ser del TCG de verdad. La misma regla que `esDelTCG`.
export const FILTRO_ELEGIBLES = `market=eq.WEST&category=eq.Pokemon&rarity=not.is.null&or=(image_path.not.is.null,image_scrydex.not.is.null)&set_id=not.imatch.${encodeURIComponent(ID_DE_POCKET.source)}`
// Con `rarity_en` al lado de `rarity`, que es la regla de la 523.
// Y `dex_ids` (835): el «casi» del nombre es la misma familia evolutiva.
export const COLUMNAS_CARTA = 'id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,rarity,rarity_en,types,illustrator,hp,dex_ids,tcg_sets(name,name_en,tcg_online_code,serie_id,release_date)'

export const hoyUTC = () => new Date().toISOString().slice(0, 10)

// La partida libre de la dirección (`?libre=N`), o null.
export function libreDePeticion(req) {
  try {
    return numeroLibre(new URL(req.url).searchParams.get('libre'))
  } catch {
    return null
  }
}

// Una partida libre no cambia con el día: la CDN la guarda un día entero y
// repetirla no cuesta una función (988).
export const CABECERAS_LIBRE = { 'cache-control': 'public, max-age=3600', 'netlify-cdn-cache-control': 'public, durable, max-age=86400' }

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
// Con `libre` (988, «Jugar otra vez»), la carta de una partida libre: la
// misma cuenta con el día de esa partida, sin leer ni escribir la del día.
export async function elegirCartaDelDia({ dia, pedir, guardar, actualizar = null, libre = null, revisar = false, probar }) {
  if (libre) dia = diaLibre(libre)
  // La de su sitio en la lista o, si no tiene foto de verdad (1111), la
  // siguiente que la tenga (hasta ocho más allá). `lejos` empieza en la otra
  // punta de la lista: para cambiar la de un día que ya se ha jugado.
  const elegirId = async ({ lejos = false, fuera = null } = {}) => {
    const { total } = await pedir(`tcg_cards?select=id&${FILTRO_ELEGIBLES}&limit=1`, { cabeceras: { prefer: 'count=exact' } })
    if (!total) return { error: 'No hay cartas elegibles.' }
    const i = (indiceDelDia(dia, total) + (lejos ? Math.floor(total / 2) : 0)) % total
    for (let k = 0; k < Math.min(9, total); k++) {
      const c = (await pedir(`tcg_cards?select=${COLUMNAS_CARTA}&${FILTRO_ELEGIBLES}&order=id.asc&limit=1&offset=${(i + k) % total}`)).datos?.[0]
      if (!c?.id || c.id === fuera) continue
      if ((await fotoContesta(c, { probar })) !== false) return { id: c.id }
    }
    return { error: 'No se ha podido elegir la carta.' }
  }
  const guardada = libre ? null : (await pedir(`carta_del_dia?select=card_id&day=eq.${dia}&limit=1`)).datos
  let cardId = guardada?.[0]?.card_id || null
  let quedanSinFoto = []
  if (cardId && revisar && actualizar) {
    // Revisada (1111): si la del día no tiene foto, es otra.
    const c = (await pedir(`tcg_cards?select=${COLUMNAS_CARTA}&id=eq.${encodeURIComponent(cardId)}&market=eq.WEST&limit=1`)).datos?.[0]
    if (!c || (await fotoContesta(c, { probar })) === false) {
      const otra = await elegirId({ lejos: true, fuera: cardId })
      if (!otra.id) quedanSinFoto = [cardId]
      if (otra.id) {
        cardId = otra.id
        await actualizar('carta_del_dia', `day=eq.${dia}`, { card_id: cardId })
      }
    }
  }
  if (!cardId && libre) {
    const e = await elegirId()
    if (e.error) return e
    cardId = e.id
  }
  if (!cardId) {
    const e = await elegirId()
    if (e.error) return e
    cardId = e.id
    await guardar('carta_del_dia', { day: dia, card_id: cardId })
    // Si otro llegó primero, manda la suya (que con la misma semilla es
    // la misma, salvo que el catálogo cambiara entre las dos cuentas).
    const otra = (await pedir(`carta_del_dia?select=card_id&day=eq.${dia}&limit=1`)).datos
    cardId = otra?.[0]?.card_id || cardId
  }
  const carta = (await pedir(`tcg_cards?select=${COLUMNAS_CARTA}&id=eq.${encodeURIComponent(cardId)}&market=eq.WEST&limit=1`)).datos?.[0]
  if (!carta) return { error: 'La carta del día no está en el catálogo.' }
  if (libre) return { dia, libre, carta, ayer: null }
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
  return { dia, numero: numeroDelDia(dia), carta, ayer, ...(revisar ? { sinFoto: quedanSinFoto } : {}) }
}

export default async (req) => {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return Response.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
  const dia = hoyUTC()
  const libre = libreDePeticion(req)
  const revisar = !libre && revisarDePeticion(req)
  try {
    const r = await elegirCartaDelDia({
      dia,
      libre,
      pedir: (ruta, o = {}) => rest(ruta, clave, o),
      guardar: (tabla, fila) => rest(tabla, clave, { metodo: 'POST', cuerpo: [fila], cabeceras: { prefer: 'resolution=ignore-duplicates,return=minimal' } }),
      actualizar: (tabla, filtro, cambios) => rest(`${tabla}?${filtro}`, clave, { metodo: 'PATCH', cuerpo: cambios, cabeceras: { prefer: 'return=minimal' } }),
      revisar,
    })
    if (r.error) return Response.json(r, { status: 503, headers: { 'cache-control': 'no-store' } })
    return Response.json(r, { headers: libre ? CABECERAS_LIBRE : revisar ? CABECERAS_REVISADO : { 'cache-control': `public, max-age=${segundosHastaManana()}` } })
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 200) }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
