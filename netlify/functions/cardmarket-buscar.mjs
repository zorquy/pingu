// «Buscar en Cardmarket» de /admin → Colecciones → una carta (tanda 1159).
//
// Descarga el catálogo abierto de Cardmarket y su guía de precios (los dos
// ficheros del día, sin clave) y busca por nombre; lo puro está en
// netlify/lib/cardmarket-buscar.mjs. Los ficheros se quedan en memoria
// mientras la función siga caliente (seis horas como mucho: Cardmarket los
// rehace una vez al día), así que buscar diez cartas seguidas los baja una
// vez. Solo para administradores: son ~30 MB por descarga y una URL de
// función es pública.
import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import { URL_PRODUCTOS, buscar, mapaDeGuia } from '../lib/cardmarket-buscar.mjs'
import { URL_GUIA } from '../lib/cardmarket-catalogo.mjs'

const VIDA_MS = 6 * 3600 * 1000
let memoria = null // { cuando, productos, guia }

// Una función que contesta a una persona tiene diez segundos: el catálogo
// es lo que hace falta y la guía (el precio) solo ayuda, así que si la guía
// no ha llegado poco después que el catálogo, se contesta sin precio y la
// guía se queda bajando para la búsqueda siguiente.
const ESPERA_GUIA_MS = 2500

async function bajar(fetchImpl, ahora) {
  if (memoria && ahora - memoria.cuando < VIDA_MS) {
    if (!memoria.guia && memoria.guiaEnCamino) memoria.guia = await Promise.race([memoria.guiaEnCamino, new Promise((r) => setTimeout(() => r(null), 50))])
    return memoria
  }
  const pedir = (url, que) => fetchImpl(url, { headers: { accept: 'application/json' } }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${que} de Cardmarket ${r.status}`))))
  const guiaEnCamino = pedir(URL_GUIA, 'guía').then((j) => mapaDeGuia(j?.priceGuides)).catch(() => null)
  const productos = await pedir(URL_PRODUCTOS, 'catálogo')
  if (!Array.isArray(productos?.products)) throw new Error('El catálogo de Cardmarket no trae `products`')
  const guia = await Promise.race([guiaEnCamino, new Promise((r) => setTimeout(() => r(null), ESPERA_GUIA_MS))])
  memoria = { cuando: ahora, productos: productos.products, guia, guiaEnCamino, creado: productos.createdAt || null }
  return memoria
}

export function olvidar() { memoria = null }

export async function responder(req, { fetchImpl = fetch, esAdmin = (t) => idDeAdmin(t, fetchImpl), ahora = Date.now() } = {}) {
  const json = (estado, cuerpo) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
  if (!(await esAdmin(tokenDe(req)))) return json(401, { ok: false, error: 'Solo para administradores.' })
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80)
  if (!q) return json(400, { ok: false, error: 'Escribe un nombre.' })
  const cerca = (url.searchParams.get('cerca') || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200)
  let datos
  try {
    datos = await bajar(fetchImpl, ahora)
  } catch (e) {
    return json(502, { ok: false, error: `No se ha podido bajar el catálogo de Cardmarket: ${String(e?.message || e).slice(0, 160)}` })
  }
  const r = buscar(datos.productos, q, { cerca, guia: datos.guia })
  return json(200, { ok: true, ...r, conPrecio: !!datos.guia, catalogo: datos.creado })
}

export default (req) => responder(req)
