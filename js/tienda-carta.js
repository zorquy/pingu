// UNA CARTA DE UNA TIENDA, EN SU POP-UP (tanda 1249, PINGU: «debería abrirte la
// tienda en general… con el pop-up de esa carta», y en una tienda el pop-up es
// para COMPRAR, no «Añadir a mi colección»). Lo abre el escaparate
// (js/perfil-tienda.js) al tocar una carta y al llegar con `?carta=` (de «Me
// interesa», «En tiendas», /tiendas o el QR de una etiqueta).
//
// Enseña lo que la tienda tiene de ESA carta: cada línea (idioma, estado o
// gradeo, versión) es una opción, con su precio, cuántas quedan, sus fotos de
// verdad y su SKU. De la tienda nunca sale el coste: las filas son las de
// `tienda_escaparate`. El trato (precio que ofreces, envío, pago) llega en la
// 1250 dentro de este mismo pop-up; hasta entonces, «Me interesa» abre la
// conversación con la carta dentro, como en la 1080.
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { euros, IDIOMAS } from './cardmarket.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { rutaDeCarta } from './carta-ruta.js'
import { rutaDeProducto } from './productos.js'
import { nombreDeVariante } from './mi-coleccion/variantes.js'
import { chapaDeGradeoHtml } from './gradeo-elegir.js'
import { chapaDeEstadoHtml } from './estado-chapa.js'
import { banderaHtml } from './precio-vista.js'
import { icons } from './icons.js'
import { skuDe } from './tiendas-puro.js'
import { urlDeFotoDeTienda, verFotosDeStock, cuantasFotos } from './tienda-fotos.js'

const NOMBRE_IDIOMA = Object.fromEntries(IDIOMAS.map((i) => [i.id, i.nombre]))
let dlg = null
let est = null

function dialogo() {
  if (dlg) return dlg
  document.body.insertAdjacentHTML('beforeend', `
    <dialog class="ptc" id="ptcDialogo" aria-labelledby="ptcTitulo">
      <button type="button" class="ptc-cerrar" data-ptc="cerrar" aria-label="Cerrar">${icons.x(18)}</button>
      <div class="ptc-cuerpo"></div>
    </dialog>`)
  dlg = document.getElementById('ptcDialogo')
  dlg.addEventListener('click', (e) => {
    // Un toque en el velo (fuera de la caja) cierra, como en los demás pop-ups.
    if (e.target === dlg || e.target.closest('[data-ptc="cerrar"]')) return dlg.close()
    const op = e.target.closest('[data-ptc-linea]')
    if (op) {
      est.elegida = op.dataset.ptcLinea
      return pintar()
    }
    if (e.target.closest('[data-ptc="fotos"]')) {
      const f = linea()
      verFotosDeStock({ nombre: nombre(), detalle: detalleDe(f), fotos: est.fotos?.get?.(f.id) })
    }
  })
  dlg.addEventListener('close', () => est?.alCerrar?.())
  return dlg
}

const linea = () => est.lineas.find((l) => l.id === est.elegida) || est.lineas[0]
const nombre = () => (est.carta ? nombreDeCarta(est.carta) : est.producto?.name || linea()?.nombre || '')
const detalleDe = (f) => [NOMBRE_IDIOMA[f.idioma] || String(f.idioma || '').toUpperCase(), f.gradeo || (f.product_id ? 'Sellado' : f.estado), f.variante && f.variante !== 'normal' ? nombreDeVariante(f.variante) : null].filter(Boolean).join(' · ')

function precioHtml(f) {
  if (est.sinPrecios) return '<p class="ptc-precio ptc-precio-pregunta">Pregunta el precio a la tienda</p>'
  if (f.precio == null) return '<p class="ptc-precio ptc-precio-pregunta">Sin precio: pregúntalo</p>'
  const antes = f.precio_antes != null && Number(f.precio_antes) > Number(f.precio) ? Number(f.precio_antes) : null
  const baja = antes ? Math.round((1 - Number(f.precio) / antes) * 100) : 0
  const hasta = antes && f.oferta_hasta ? ` · hasta el ${new Date(f.oferta_hasta).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''
  return `<p class="ptc-precio"><b>${escapeHtml(euros(f.precio))}</b>${antes ? `<s>${escapeHtml(euros(antes))}</s><span class="ptc-rebaja">−${baja} %${escapeHtml(hasta)}</span>` : ''}</p>`
}

// Una opción por línea: la bandera, el estado (o la cápsula), la versión y su precio.
function opcionHtml(f) {
  const marca = f.gradeo ? chapaDeGradeoHtml(f.gradeo) : f.product_id ? '' : chapaDeEstadoHtml(f.estado)
  const version = f.variante && f.variante !== 'normal' ? `<span class="ptc-op-version">${escapeHtml(nombreDeVariante(f.variante))}</span>` : ''
  const precio = est.sinPrecios || f.precio == null ? '' : `<b>${escapeHtml(euros(f.precio))}</b>`
  return `<button type="button" class="ptc-op" data-ptc-linea="${escapeHtml(f.id)}" aria-pressed="${f.id === linea().id}">${banderaHtml(f.idioma || 'es')}<span class="ptc-op-idioma">${escapeHtml(String(f.idioma || '').toUpperCase())}</span>${marca}${version}${precio}</button>`
}

function fotosHtml(f) {
  const fotos = est.fotos?.get?.(f.id)
  const n = cuantasFotos(fotos)
  if (!n) return ''
  const mini = (lado) => (fotos[lado] ? `<img src="${escapeHtml(urlDeFotoDeTienda(fotos[lado]))}" alt="" width="48" height="67" loading="lazy" />` : '')
  return `<button type="button" class="ptc-fotos" data-ptc="fotos">${mini('frente')}${mini('dorso')}<span>${n === 2 ? 'Fotos de esta carta' : 'Foto de esta carta'}</span></button>`
}

function accionesHtml(f) {
  if (est.previa) return '<p class="ptc-nota">Así lo ve quien entra en tu escaparate.</p>'
  if (est.propia) return '<p class="ptc-nota">Es tuya: se cambia desde tu Stock.</p>'
  const destino = `/mensajes.html?with=${encodeURIComponent(est.tienda.id)}&carta=${encodeURIComponent(f.id)}`
  const href = est.sesion ? destino : `/auth.html?registro=1&volver=${encodeURIComponent(destino)}`
  return `<div class="ptc-acciones"><a class="btn-primary" href="${escapeHtml(href)}">${icons.mail(18)}<span>Me interesa</span></a></div>`
}

function pintar() {
  const f = linea()
  const c = est.carta
  const p = est.producto
  const foto = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : p?.image ? `src="${escapeHtml(p.image)}" onerror="this.remove()"` : null
  const set = c ? [nombreDeSet(c.tcg_sets), c.local_id].filter(Boolean).join(' · ') : 'Producto sellado'
  const ficha = c ? rutaDeCarta(c) : f.product_id ? rutaDeProducto({ id: f.product_id }) : null
  const chapas = [
    f.gradeo ? chapaDeGradeoHtml(f.gradeo) : f.product_id ? '' : chapaDeEstadoHtml(f.estado),
    `<span class="ptc-chip">${banderaHtml(f.idioma || 'es')}${escapeHtml(NOMBRE_IDIOMA[f.idioma] || String(f.idioma || '').toUpperCase())}</span>`,
    f.variante && f.variante !== 'normal' ? `<span class="ptc-chip">${escapeHtml(nombreDeVariante(f.variante))}</span>` : '',
    `<span class="ptc-chip">${Number(f.unidades) === 1 ? 'Queda 1' : `Quedan ${Number(f.unidades) || 0}`}</span>`,
  ].join('')
  dlg.querySelector('.ptc-cuerpo').innerHTML = `
    <div class="ptc-izq${p && !c ? ' ptc-producto' : ''}">
      <div class="ptc-foto">${foto ? `<img ${foto} alt="" width="245" height="342" />` : ''}</div>
      ${fotosHtml(f)}
    </div>
    <div class="ptc-der">
      <p class="ptc-tienda">${icons.store(14)}<span>${escapeHtml(est.nombreTienda)}</span></p>
      <h2 id="ptcTitulo">${escapeHtml(nombre())}</h2>
      <p class="ptc-set">${escapeHtml(set)}</p>
      ${est.lineas.length > 1 ? `<div class="ptc-ops" role="group" aria-label="Las que tiene">${est.lineas.map(opcionHtml).join('')}</div>` : ''}
      <div class="ptc-chapas">${chapas}</div>
      ${precioHtml(f)}
      <p class="ptc-sku">SKU <span>${escapeHtml(skuDe(f, c?.tcg_sets?.tcg_online_code))}</span></p>
      ${accionesHtml(f)}
      ${ficha ? `<a class="ptc-ficha" href="${escapeHtml(ficha)}" data-ficha-completa>Ficha completa de la ${c ? 'carta' : 'producto'}</a>` : ''}
    </div>`
}

// `lineas`: las de la tienda con esa carta (o el producto), ya pedidas.
// `elegida`: la que se abre (la que se tocó, o la del enlace).
export async function abrirCartaDeTienda({ tienda, nombreTienda, sesion = null, previa = false, carta = null, producto = null, lineas, elegida = null, fotos = null, sinPrecios = false, alCerrar = null }) {
  if (!lineas?.length) return false
  await hojaInyectada('css/tienda-carta.css')
  dialogo()
  est = { tienda, nombreTienda, sesion, previa, propia: sesion?.user?.id === tienda.id, carta, producto, lineas, elegida: elegida || lineas[0].id, fotos, sinPrecios, alCerrar }
  pintar()
  if (!dlg.open) dlg.showModal()
  return true
}
