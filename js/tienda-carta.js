// UNA CARTA DE UNA TIENDA, EN SU POP-UP (tanda 1249, PINGU: «debería abrirte la
// tienda en general… con el pop-up de esa carta», y en una tienda el pop-up es
// para COMPRAR, no «Añadir a mi colección»). Lo abre el escaparate
// (js/perfil-tienda.js) al tocar una carta y al llegar con `?carta=` (de «Me
// interesa», «En tiendas», /tiendas o el QR de una etiqueta).
//
// Enseña lo que la tienda tiene de ESA carta: cada línea (idioma, estado o
// gradeo, versión) es una opción, con su precio, cuántas quedan, sus fotos de
// verdad y su SKU. De la tienda nunca sale el coste: las filas son las de
// `tienda_escaparate`.
//
// Y COMPRAR (1250): el precio de la tienda puesto y editable («Pedir por 40
// €» o, si lo bajas, «Ofrecer 35 €»), en mano o por correo (la tabla de los
// cambios) y cómo pagar (lo que acepta la tienda, `tienda_condiciones`). Lo
// manda `tienda_oferta_enviar`, y el trato se sigue en Mensajes. Sin la
// migración, «Me interesa» abre la conversación con la carta, como en la 1080.
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
import { supabase } from './supabase.js'
import { showToast } from './toast.js'
import { sinMigracion } from './sin-migracion.js'
import { envioAutomatico } from './cambio-propuesta-puro.js'
import { PAGOS_TIENDA, NOMBRE_PAGO, minimoDeOferta, queEsLaOferta, totalDeOferta, puntoDeOferta } from './tiendas-puro.js'

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
      est.compra = compraDe(linea())
      return pintar()
    }
    const seg = e.target.closest('[data-ptc-envio], [data-ptc-pago]')
    if (seg && !seg.disabled) {
      if (seg.dataset.ptcEnvio) est.compra.envio = seg.dataset.ptcEnvio
      if (seg.dataset.ptcPago) est.compra.pago = seg.dataset.ptcPago
      // En efectivo, solo en mano (lo exige la base).
      if (est.compra.envio === 'correo' && est.compra.pago === 'efectivo') est.compra.pago = pagosDe().find((p) => p !== 'efectivo') || 'efectivo'
      return pintarCompra()
    }
    if (e.target.closest('[data-ptc="enviar"]')) return enviar(e.target.closest('[data-ptc="enviar"]'))
    if (e.target.closest('[data-ptc="pedir-fotos"]')) return pedirFotos(e.target.closest('[data-ptc="pedir-fotos"]'))
    if (e.target.closest('[data-ptc="fotos"]')) {
      const f = linea()
      verFotosDeStock({ nombre: nombre(), detalle: detalleDe(f), fotos: est.fotos?.get?.(f.id) })
    }
  })
  // El precio se escribe: se repinta lo que depende de él, sin perder el foco.
  dlg.addEventListener('input', (e) => {
    if (e.target.id === 'ptcPrecio') { est.compra.precio = e.target.value; pintarCompra({ sinCampo: true }) }
    if (e.target.id === 'ptcUnidades') { est.compra.unidades = Number(e.target.value) || 1; pintarCompra({ sinCampo: true }) }
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
  if (!n) return pedirFotosHtml(f)
  const mini = (lado) => (fotos[lado] ? `<img src="${escapeHtml(urlDeFotoDeTienda(fotos[lado]))}" alt="" width="48" height="67" loading="lazy" />` : '')
  return `<button type="button" class="ptc-fotos" data-ptc="fotos">${mini('frente')}${mini('dorso')}<span>${n === 2 ? 'Fotos de esta carta' : 'Foto de esta carta'}</span></button>`
}

// «Pedir fotos» (1251, PINGU: «un botón… para pedir fotos»): a una copia sin
// fotos de verdad. A la tienda le llega en su pestaña Ofertas y en la
// conversación; al subirlas, a ti te avisan. Sin la migración, no se ofrece.
function pedirFotosHtml(f) {
  if (est.previa || est.propia || f.product_id || !est.fotosPedibles) return ''
  if (!est.sesion) return `<a class="ptc-fotos ptc-pedir" href="/auth.html?registro=1&volver=${encodeURIComponent(volverAqui())}">${icons.camera(18)}<span>Pedir fotos</span></a>`
  if (est.pedidas.has(f.id)) return `<p class="ptc-fotos ptc-pedidas">${icons.clock(16)}<span>Fotos pedidas: te avisamos cuando las suba</span></p>`
  return `<button type="button" class="ptc-fotos ptc-pedir" data-ptc="pedir-fotos">${icons.camera(18)}<span>Pedir fotos de esta carta</span></button>`
}

async function pedirFotos(boton) {
  const f = linea()
  boton.disabled = true
  const { data, error } = await supabase.rpc('tienda_pedir_fotos', { p_stock: f.id })
  if (error) {
    boton.disabled = false
    return showToast(String(error.message || 'No se han podido pedir.').replace(/^.*?ERROR:\s*/, ''), 'error')
  }
  if (data?.ya_tiene) {
    showToast('Ya tiene fotos: recarga para verlas.', 'info')
  } else {
    est.pedidas.add(f.id)
    showToast(`Se las has pedido a ${est.nombreTienda}. Te avisamos cuando las suba.`, 'success')
  }
  pintar()
}

// ── Comprar (1250) ──
const pagosDe = () => (est.condiciones?.pagos?.length ? est.condiciones.pagos : PAGOS_TIENDA.map(([p]) => p))
const pide = (f) => (est.sinPrecios || f.precio == null ? null : Number(f.precio))
const enMensajes = () => `/mensajes.html?with=${encodeURIComponent(est.tienda.id)}`
const volverAqui = () => `${location.pathname}${location.search}`
const numero = (v) => Number(String(v ?? '').replace(',', '.'))
const dosDecimales = (n) => (Number.isFinite(n) ? n.toFixed(2) : '')

// Lo que se va a pagar con lo escrito ahora: precio, unidades, envío y total.
function cuenta(f) {
  const precio = Math.round(numero(est.compra.precio) * 100) / 100
  const unidades = Math.min(Math.max(1, est.compra.unidades || 1), Number(f.unidades) || 1)
  const envio = est.compra.envio === 'correo' && precio > 0 ? envioAutomatico(precio * unidades, unidades) : null
  return { precio, unidades, envio, total: precio > 0 ? totalDeOferta({ precio, unidades, envio_precio: envio?.precio || 0 }) : null, que: queEsLaOferta(precio, pide(f)), minimo: minimoDeOferta(pide(f), est.condiciones?.minimo) }
}

// Lo que ya tienes con esta copia: una oferta viva o aceptada.
function vivaHtml(o) {
  const punto = puntoDeOferta(o, 'comprador')
  return `<div class="ptc-viva" data-clase="${punto.clase}"><span class="ptc-viva-chapa">${escapeHtml(punto.chapa)}</span><span class="ptc-viva-texto"><b>${escapeHtml(euros(o.precio))}</b>${o.unidades > 1 ? ` × ${o.unidades}` : ''} · ${escapeHtml(punto.frase)}</span><a class="link-btn" href="${escapeHtml(enMensajes())}">Verla en Mensajes</a></div>`
}

function compraHtml(f) {
  const viva = est.vivas.get(f.id)
  if (viva && viva.estado !== 'abierta') return vivaHtml(viva)
  const sinCuenta = !est.sesion
  const pagos = pagosDe()
  const tope = Math.min(Number(f.unidades) || 1, 10)
  return `${viva ? vivaHtml(viva) : ''}
    <div class="ptc-compra">
      <label class="ptc-campo" for="ptcPrecio"><span>${viva ? 'Otra oferta' : 'Tu precio'}</span>
        <span class="ptc-input"><input type="text" inputmode="decimal" id="ptcPrecio" value="${escapeHtml(String(est.compra.precio ?? ''))}" autocomplete="off" aria-describedby="ptcAviso" /><span aria-hidden="true">€</span></span>
        ${tope > 1 ? `<span class="ptc-uds"><select id="ptcUnidades" aria-label="Cuántas">${Array.from({ length: tope }, (_, i) => `<option value="${i + 1}"${i + 1 === est.compra.unidades ? ' selected' : ''}>× ${i + 1}</option>`).join('')}</select></span>` : ''}
      </label>
      <p class="ptc-aviso" id="ptcAviso"></p>
      <div class="ptc-seg" role="group" aria-label="Entrega">
        <button type="button" data-ptc-envio="mano" aria-pressed="${est.compra.envio === 'mano'}">En mano</button>
        <button type="button" data-ptc-envio="correo" aria-pressed="${est.compra.envio === 'correo'}">Por correo <small class="ptc-envio-precio"></small></button>
      </div>
      <div class="ptc-seg" role="group" aria-label="Pago">${pagos.map((p) => `<button type="button" data-ptc-pago="${p}" aria-pressed="${est.compra.pago === p}"${p === 'efectivo' && est.compra.envio === 'correo' ? ' disabled title="En efectivo, solo en mano"' : ''}>${escapeHtml(NOMBRE_PAGO[p] || p)}</button>`).join('')}</div>
      <p class="ptc-total"><span>Total</span><b></b></p>
    </div>
    <p class="ptc-error" role="alert"></p>
    <div class="ptc-acciones">
      ${sinCuenta
        ? `<a class="btn-primary" href="/auth.html?registro=1&volver=${encodeURIComponent(volverAqui())}">Crea tu cuenta para comprar</a>`
        : '<button type="button" class="btn-primary" data-ptc="enviar"></button>'}
      <a class="btn-secondary" href="${escapeHtml(sinCuenta ? `/auth.html?registro=1&volver=${encodeURIComponent(`/mensajes.html?with=${est.tienda.id}&carta=${f.id}`)}` : `/mensajes.html?with=${encodeURIComponent(est.tienda.id)}&carta=${encodeURIComponent(f.id)}`)}">${icons.mail(16)}<span>Escribir</span></a>
    </div>
    <p class="ptc-nota-trato">La tienda acepta, te contraoferta o la rechaza; lo verás en Mensajes. Si acepta, te la reserva 7 días.</p>`
}

// Lo que cambia al escribir o tocar: el aviso, el envío, el total y el botón.
function pintarCompra({ sinCampo = false } = {}) {
  const f = linea()
  if (!sinCampo) {
    const caja = dlg.querySelector('.ptc-trato')
    if (caja) caja.innerHTML = compraHtml(f)
  }
  const c = cuenta(f)
  const aviso = dlg.querySelector('.ptc-aviso')
  if (!aviso) return
  const precioMal = !(c.precio > 0)
  const bajoMinimo = !precioMal && c.minimo != null && c.precio < c.minimo
  aviso.textContent = precioMal ? 'Escribe cuánto ofreces.' : bajoMinimo ? `Esta tienda no mira ofertas por debajo de ${euros(c.minimo)}.` : c.que === 'ofrece' && pide(f) != null ? `Es una oferta: la tienda pide ${euros(pide(f))} y puede contraofertar.` : ''
  aviso.dataset.mal = String(precioMal || bajoMinimo)
  const envio = dlg.querySelector('.ptc-envio-precio')
  if (envio) envio.textContent = c.envio ? `· ${euros(c.envio.precio)}` : est.compra.envio === 'correo' ? '' : ''
  const total = dlg.querySelector('.ptc-total b')
  if (total) total.textContent = c.total != null ? `${euros(c.total)}${c.envio ? ` (con envío)` : ''}` : '—'
  const boton = dlg.querySelector('[data-ptc="enviar"]')
  if (boton) {
    boton.disabled = precioMal || bajoMinimo || est.enviando
    boton.textContent = est.enviando ? 'Enviando…' : precioMal ? 'Pon un precio' : c.que === 'pide' ? `Pedir por ${euros(c.precio)}` : `Ofrecer ${euros(c.precio)}`
  }
}

async function enviar(boton) {
  const f = linea()
  const c = cuenta(f)
  if (!(c.precio > 0) || est.enviando) return
  est.enviando = true
  pintarCompra({ sinCampo: true })
  const { data, error } = await supabase.rpc('tienda_oferta_enviar', { p_stock: f.id, p_precio: c.precio, p_envio: est.compra.envio, p_pago: est.compra.pago, p_unidades: c.unidades })
  est.enviando = false
  if (error) {
    pintarCompra({ sinCampo: true })
    const e = dlg.querySelector('.ptc-error')
    if (e) e.textContent = sinMigracion(error) ? 'Comprar todavía no está listo. Escríbele a la tienda mientras tanto.' : String(error.message || 'No se ha podido enviar.').replace(/^.*?ERROR:\s*/, '')
    boton?.focus()
    return
  }
  est.vivas.set(f.id, { id: data.id, estado: 'abierta', turno: 'tienda', precio: data.precio, unidades: c.unidades })
  showToast(data.que === 'pide' ? `Se lo has pedido a ${est.nombreTienda}.` : `Oferta enviada a ${est.nombreTienda}.`, 'success', { accion: { texto: 'Ver en Mensajes', alPulsar: () => { location.href = enMensajes() } } })
  pintar()
}

function accionesHtml(f) {
  if (est.previa) return '<p class="ptc-nota">Así lo ve quien entra en tu escaparate.</p>'
  if (est.propia) return '<p class="ptc-nota">Es tuya: se cambia desde tu Stock.</p>'
  // Sin la migración 1250 (o si la tienda no contesta), lo de la 1080.
  if (!est.condiciones) {
    const destino = `/mensajes.html?with=${encodeURIComponent(est.tienda.id)}&carta=${encodeURIComponent(f.id)}`
    const href = est.sesion ? destino : `/auth.html?registro=1&volver=${encodeURIComponent(destino)}`
    return `<div class="ptc-acciones"><a class="btn-primary" href="${escapeHtml(href)}">${icons.mail(18)}<span>Me interesa</span></a></div>`
  }
  return `<div class="ptc-trato">${compraHtml(f)}</div>`
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
  pintarCompra({ sinCampo: true })
}

// Lo que se ofrece de entrada para una copia: su precio (o lo de tu oferta viva).
function compraDe(f) {
  const viva = est.vivas.get(f.id)
  const pagos = pagosDe()
  return {
    precio: viva ? dosDecimales(Number(viva.precio)) : pide(f) != null ? dosDecimales(pide(f)) : '',
    unidades: viva?.unidades || 1,
    envio: est.compra?.envio || 'mano',
    pago: pagos.includes(est.compra?.pago) ? est.compra.pago : pagos[0],
  }
}

// Las condiciones de la tienda y lo que ya le has ofrecido de estas copias.
async function prepararCompra() {
  est.pedidas = new Set()
  if (est.previa || est.propia) return
  const [cond, mias, pedidas] = await Promise.all([
    supabase.rpc('tienda_condiciones', { p_tienda: est.tienda.id }).then((r) => (r.error ? null : r.data), () => null),
    est.sesion
      ? supabase.from('tienda_ofertas').select('id,stock_id,estado,turno,precio,unidades,envio,seguimiento').eq('comprador_id', est.sesion.user.id).in('stock_id', est.lineas.map((l) => l.id)).in('estado', ['abierta', 'aceptada', 'pagada']).then((r) => (r.error ? [] : r.data || []), () => [])
      : Promise.resolve([]),
    // Las fotos que ya pediste (1251). Si la tabla no existe (sin la
    // migración), «Pedir fotos» no se ofrece.
    est.sesion
      ? supabase.from('tienda_fotos_pedidas').select('stock_id').eq('comprador_id', est.sesion.user.id).is('atendida_at', null).in('stock_id', est.lineas.map((l) => l.id)).then((r) => (r.error ? null : r.data || []), () => null)
      : Promise.resolve([]),
  ])
  est.condiciones = cond
  est.vivas = new Map(mias.map((o) => [o.stock_id, o]))
  // Sin cuenta no se puede mirar la tabla: se ofrece si la base ya sabe de ofertas.
  est.fotosPedibles = est.sesion ? pedidas !== null : cond !== null
  est.pedidas = new Set((pedidas || []).map((x) => x.stock_id))
}

// `lineas`: las de la tienda con esa carta (o el producto), ya pedidas.
// `elegida`: la que se abre (la que se tocó, o la del enlace).
export async function abrirCartaDeTienda({ tienda, nombreTienda, sesion = null, previa = false, carta = null, producto = null, lineas, elegida = null, fotos = null, sinPrecios = false, alCerrar = null }) {
  if (!lineas?.length) return false
  await hojaInyectada('css/tienda-carta.css')
  dialogo()
  est = { tienda, nombreTienda, sesion, previa, propia: sesion?.user?.id === tienda.id, carta, producto, lineas, elegida: elegida || lineas[0].id, fotos, sinPrecios, alCerrar, condiciones: null, vivas: new Map(), compra: null, enviando: false }
  await prepararCompra()
  est.compra = compraDe(linea())
  pintar()
  if (!dlg.open) dlg.showModal()
  return true
}
