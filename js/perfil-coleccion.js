// ── «Colección de @usuario» en el perfil (tanda 944) ──
//
// PINGU: «tú cuando entras al perfil de alguien no ves su colección…
// debajo de la vitrina, un título que sea "Colección de" y el arroba de
// ese usuario, y que salgan las cartas, y que le dé a "Ver más" y me abra
// una página con su colección, con búsqueda, con filtros, con todo, igual
// que Mi colección pero pública».
//
// La página entera ya existía: /mi-coleccion?u=<usuario> enseña la de otro
// si la tiene pública (la de la tanda 386), con sus pestañas y sus filtros.
// Lo que faltaba era la puerta: aquí va una fila con lo último que ha
// añadido y «Ver su colección». Quien decide qué se ve es la RLS de
// `user_collection` (`coleccion_es_publica`): si es privada, la consulta
// vuelve vacía y aquí no sale nada de nada. En tu perfil sale siempre, y
// si la tuya es privada lo dice y deja hacerla pública.
//
// Entra por `import()` desde usuario.js y perfil.js.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { rutaDeCarta } from './carta-ruta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { urlDeColeccion } from './perfil-cifras.js'

// Cuántas salen en la fila. Las líneas se piden de más porque una carta
// puede tener varias (idiomas, versiones) y en la fila sale una vez.
export const EN_LA_FILA = 18
const LINEAS = 80

const n = (v) => Number(v).toLocaleString('es-ES', { useGrouping: 'always' })

// Puro: de las líneas (lo más nuevo primero), las cartas distintas en ese
// orden, hasta `tope`.
export function ultimasDistintas(lineas = [], tope = EN_LA_FILA) {
  const vistas = new Set()
  const fuera = []
  for (const l of lineas) {
    const k = `${l.market || 'WEST'}|${l.card_id}`
    if (vistas.has(k)) continue
    vistas.add(k)
    fuera.push(l)
    if (fuera.length >= tope) break
  }
  return fuera
}


// Puro: el título. «Colección de @dani» (PINGU), o «Tu colección».
export const tituloDeColeccion = ({ username, propia }) => (propia ? 'Tu colección' : `Colección de @${username}`)

async function leer(userId) {
  const [lineas, cuenta] = await Promise.all([
    supabase.from('user_collection').select('card_id,market,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(LINEAS),
    supabase.from('user_collection').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ])
  if (lineas.error) throw lineas.error
  const filas = ultimasDistintas(lineas.data || [])
  if (!filas.length) return { cartas: [], total: cuenta.count ?? 0 }
  const { cartasPorClaves, claveDeCarta } = await import('./mi-coleccion/datos.js')
  const mapa = await cartasPorClaves(filas).catch(() => new Map())
  const cartas = filas.map((f) => mapa.get(claveDeCarta(f.card_id, f.market || 'WEST'))).filter(Boolean)
  return { cartas, total: cuenta.error ? null : cuenta.count ?? null }
}

function cartaHtml(c) {
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const nombre = nombreDeCarta(c)
  return `<li class="pcol-carta">
    <a class="pcol-foto" href="${escapeHtml(rutaDeCarta(c))}" data-marca-carta="${escapeHtml(c.id)}" title="${escapeHtml(`${nombre} · ${nombreDeSet(c.tcg_sets) || c.set_id || ''}`)}">
      <span class="pcol-sinfoto">${escapeHtml(nombre)}</span>
      ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy">` : ''}
    </a>
    <span class="pcol-nombre">${escapeHtml(nombre)}</span>
  </li>`
}

// Puro (sin las cartas pintadas): la cabecera con el título y cuántas, y
// «Ver su colección». El botón va suelto y no dentro de la cabecera: en el
// PC se coloca a su derecha y en el móvil debajo de la fila (la rejilla de
// `.perfil-coleccion`), sin duplicarlo.
export function cabeceraHtml({ username, propia, total }) {
  const cuantas = typeof total === 'number' && total > 0 ? `${n(total)} ${total === 1 ? 'carta' : 'cartas'}` : ''
  return `<div class="pcol-cab">
      <h2 class="section-title">${escapeHtml(tituloDeColeccion({ username, propia }))}</h2>
      ${cuantas ? `<span class="pcol-cuantas">${escapeHtml(cuantas)}</span>` : ''}
    </div>
    <a class="btn-secondary pcol-ver" href="${escapeHtml(propia ? '/mi-coleccion?ver=cartas' : urlDeColeccion(username))}">${propia ? 'Ver tu colección' : 'Ver su colección'}</a>`
}

// La pinta y devuelve si ha salido algo (para que la pestaña sepa si
// enseñarse). `perfil`: { id, username, coleccion_publica }.
export async function pintarColeccionDe(caja, perfil, { propia = false, avisar = () => {} } = {}) {
  if (!caja || !perfil?.id) return false
  // La de otro, solo si la tiene pública: sin esto la RLS devolvería vacío
  // igual, pero así no se pregunta nada.
  if (!propia && !perfil.coleccion_publica) {
    caja.hidden = true
    return false
  }
  let r
  try {
    r = await leer(perfil.id)
  } catch {
    // No se ha podido preguntar: en la de otro no se enseña nada (no es «no
    // tiene cartas»); en la tuya tampoco, que ya está Mi colección.
    caja.hidden = true
    return false
  }
  if (!r.cartas.length) {
    caja.hidden = true
    return false
  }
  await hojaInyectada('css/perfil-coleccion.css')
  const privada = propia && !perfil.coleccion_publica
  caja.innerHTML = `${cabeceraHtml({ username: perfil.username, propia, total: r.total })}
    <ul class="pcol-fila">${r.cartas.map(cartaHtml).join('')}</ul>
    ${privada ? `<p class="pcol-privada">Solo la ves tú: los demás no ven tu colección. <button type="button" class="link-btn" data-pcol-publica>Hacerla pública</button></p>` : ''}`
  caja.hidden = false
  // Lo que tú tienes y quieres de la suya (943); en la tuya, todo es tuyo.
  if (!propia) import('./marcas-carta.js').then((m) => m.marcarCartas(caja)).catch(() => {})
  caja.querySelector('[data-pcol-publica]')?.addEventListener('click', async (e) => {
    const b = e.currentTarget
    b.disabled = true
    try {
      const { ponerPublica } = await import('./mi-coleccion/datos.js')
      perfil.coleccion_publica = await ponerPublica(perfil.id, true)
      b.closest('.pcol-privada')?.remove()
      avisar('Tu colección ya es pública: sale en tu perfil.', 'success')
    } catch (err) {
      b.disabled = false
      avisar(err?.message || 'No se ha podido cambiar.', 'error')
    }
  })
  return true
}
