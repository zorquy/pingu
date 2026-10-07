// LA CARTA AL PASAR EL RATÓN (724, D4 de la lista). El nombre de una carta
// en una guía o en un hilo es un enlace a su ficha, y para verla había que
// entrar. Ahora, al posar el ratón encima un momento, sale una tarjetita
// con la foto, el precio, la tendencia y si la tienes —como la de las
// personas (`hovercard.js`), que es quien engancha esta—.
//
// Solo de ratón (en el móvil, tocar ya lleva a la ficha) y solo en los
// enlaces de TEXTO: uno que ya enseña la foto de la carta (una rejilla, un
// resultado) no necesita que se la enseñen otra vez.
import { supabase } from './supabase.js'
import { escapeHtml, getSession } from './app.js'
import { hojaInyectada } from './hoja.js'
import { candidatosDeRuta } from './carta-ruta.js'
import { cadenaDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { precioDeFila, valorDe, euros } from './cardmarket.js'

const cache = new Map()
let tarjeta = null
let abrirEn = null
let cerrarEn = null

export function esEnlaceDeCarta(a) {
  const ruta = a?.getAttribute?.('href') || ''
  return /^\/carta\/[^/?#]+/.test(ruta) && !a.querySelector('img') && !a.closest('.vista-carta')
}

// Lo que sube o baja la carta frente a su media: «tendencia» de
// Cardmarket contra el mínimo, en tanto por ciento. Sin las dos, nada.
export function tendenciaDe(precio) {
  const desde = precio?.desde
  const tend = precio?.tendencia
  if (!desde || !tend) return null
  const pct = Math.round(((tend - desde) / desde) * 100)
  return Math.abs(pct) < 1 ? 0 : pct
}

async function datosDe(ruta) {
  if (cache.has(ruta)) return cache.get(ruta)
  const ids = candidatosDeRuta(ruta)
  const promesa = (async () => {
    if (!ids.length) return null
    const { data } = await supabase
      .from('tcg_cards')
      .select('id, market, set_id, local_id, name, name_es, name_en, image_path, image_tcggo, tcg_sets(name, name_en)')
      .eq('market', 'WEST')
      .in('id', ids)
    // Del candidato más probable al menos (`candidatosDeRuta` ya los da así).
    const carta = ids.map((id) => (data || []).find((c) => c.id === id)).find(Boolean)
    if (!carta) return null
    const sesion = await getSession().catch(() => null)
    const [{ data: precio }, mias] = await Promise.all([
      supabase.from('tcg_card_prices').select('*').eq('card_id', carta.id).maybeSingle(),
      sesion ? supabase.from('user_collection').select('cantidad').eq('user_id', sesion.user.id).eq('card_id', carta.id) : Promise.resolve({ data: null }),
    ])
    const p = precioDeFila(precio)
    // `null` si no hay cuenta (no se sabe), un número si la hay.
    const tengo = mias.data ? mias.data.reduce((n, l) => n + (Number(l.cantidad) || 0), 0) : null
    return { carta, valor: valorDe(p, 'es'), tendencia: tendenciaDe(p), tengo }
  })()
  cache.set(ruta, promesa)
  return promesa
}

function cerrar() {
  clearTimeout(abrirEn)
  cerrarEn = setTimeout(() => {
    tarjeta?.remove()
    tarjeta = null
  }, 200)
}

async function abrir(enlace) {
  const ruta = new URL(enlace.href, location.href).pathname
  const d = await datosDe(ruta)
  if (!d || !enlace.isConnected || !enlace.matches(':hover')) return
  hojaInyectada('css/buscador.css')
  tarjeta?.remove()
  const { carta, valor, tendencia, tengo } = d
  const foto = cadenaDeEscaneo(carta)[0]
  const flecha = tendencia == null ? '' : tendencia > 0 ? ` · <span class="vista-carta-sube">sube un ${tendencia} %</span>` : tendencia < 0 ? ` · <span class="vista-carta-baja">baja un ${-tendencia} %</span>` : ' · estable'
  tarjeta = document.createElement('div')
  tarjeta.className = 'vista-carta'
  tarjeta.setAttribute('role', 'tooltip')
  tarjeta.innerHTML = `
    ${foto ? `<img src="${escapeHtml(foto)}" alt="" width="96" height="134" loading="lazy">` : ''}
    <div class="vista-carta-datos">
      <b>${escapeHtml(nombreDeCarta(carta))}</b>
      <small>${escapeHtml(nombreDeSet(carta.tcg_sets) || carta.set_id)} · ${escapeHtml(carta.local_id)}</small>
      <span class="vista-carta-precio">${valor ? `Desde <b>${escapeHtml(euros(valor))}</b>${flecha}` : 'Sin precio'}</span>
      ${tengo == null ? '' : `<span class="vista-carta-tengo${tengo ? ' si' : ''}">${tengo ? `La tienes (${tengo})` : 'No la tienes'}</span>`}
    </div>`
  document.body.appendChild(tarjeta)
  const caja = enlace.getBoundingClientRect()
  const ancho = tarjeta.offsetWidth || 300
  tarjeta.style.left = `${Math.max(8, Math.min(window.innerWidth - ancho - 8, caja.left + window.scrollX))}px`
  tarjeta.style.top = `${caja.bottom + window.scrollY + 6}px`
  tarjeta.addEventListener('mouseenter', () => clearTimeout(cerrarEn))
  tarjeta.addEventListener('mouseleave', cerrar)
}

export function engancharVistaDeCartas() {
  if (!window.matchMedia('(hover: hover)').matches) return
  document.addEventListener('mouseover', (e) => {
    const enlace = e.target.closest?.('a[href]')
    if (!enlace || !esEnlaceDeCarta(enlace)) return
    clearTimeout(abrirEn)
    clearTimeout(cerrarEn)
    abrirEn = setTimeout(() => abrir(enlace).catch(() => {}), 350)
  })
  document.addEventListener('mouseout', (e) => {
    const enlace = e.target.closest?.('a[href]')
    if (enlace && esEnlaceDeCarta(enlace)) cerrar()
  })
}
