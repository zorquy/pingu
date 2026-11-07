// UNA COMPRA A UNA TIENDA, EN LA CONVERSACIÓN (tanda 1250, PINGU: «que tú lo
// veas solamente en los mensajes privados… como se hace en Vinted»). Cada paso
// de `tienda_oferta_*` deja un mensaje con el adjunto
// `{ tipo: 'oferta_tienda', oferta, evento }`; el ÚLTIMO de cada oferta se
// pinta como la tarjeta viva (la carta, los pasos, en qué punto está y lo que
// te toca hacer) y los de antes como una línea con lo que pasó.
//
// La oferta se lee con `tienda_oferta_ver`, que ya decide qué ve cada uno: a
// quien compra, el Bizum o el PayPal solo cuando está aceptada; a la tienda,
// su coste para el margen. Entra por `import()` desde mensajes.js solo si hay
// alguna oferta en el hilo.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { euros } from './cardmarket.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta } from './catalogo-series.js'
import { COLUMNAS_CARTA_DE_SET } from './mi-coleccion/columnas-set.js'
import { nombreDeVariante } from './mi-coleccion/variantes.js'
import { chapaDeEstadoHtml } from './estado-chapa.js'
import { chapaDeGradeoHtml } from './gradeo-elegir.js'
import { hojaInyectada } from './hoja.js'
import { NOMBRE_PAGO, puntoDeOferta, textoDePaso, totalDeOferta, margenDe } from './tiendas-puro.js'
import { icons } from './icons.js'

const ofertas = new Map()
const cartas = new Map()
const productos = new Map()

// El título de cada paso, para la línea de los mensajes de antes.
export const TITULO_DE_OFERTA = {
  oferta_nueva: 'Oferta de compra',
  oferta_otra: 'Nueva oferta',
  oferta_contraoferta: 'Contraoferta',
  oferta_aceptada: 'Oferta aceptada',
  oferta_rechazada: 'Oferta rechazada',
  oferta_retirada: 'Oferta retirada',
  oferta_pagada: 'Pago recibido',
  oferta_hecha: 'Venta hecha',
  oferta_cancelada: 'Venta cancelada',
}

export async function cargarOfertas(ids) {
  hojaInyectada('css/mensajes-oferta.css')
  const unicos = [...new Set(ids)]
  const leidas = await Promise.all(unicos.map((id) => supabase.rpc('tienda_oferta_ver', { p_oferta: id }).then((r) => (r.error ? null : r.data), () => null)))
  unicos.forEach((id, i) => (leidas[i] ? ofertas.set(id, leidas[i]) : ofertas.delete(id)))
  // La foto y el nombre, del catálogo (no del adjunto, que lo escribe quien manda).
  const vivas = leidas.filter(Boolean)
  for (const market of ['WEST', 'JP']) {
    const faltan = [...new Set(vivas.filter((o) => o.card_id && (o.market || 'WEST') === market && !cartas.has(o.card_id)).map((o) => o.card_id))]
    if (faltan.length) {
      const { data } = await supabase.from('tcg_cards').select(COLUMNAS_CARTA_DE_SET).eq('market', market).in('id', faltan.slice(0, 100))
      for (const c of data || []) cartas.set(c.id, c)
    }
  }
  const prod = [...new Set(vivas.filter((o) => o.product_id && !productos.has(String(o.product_id))).map((o) => o.product_id))]
  if (prod.length) {
    const { data } = await supabase.from('tcg_products').select('id,name,image').in('id', prod.slice(0, 100))
    for (const p of data || []) productos.set(String(p.id), p)
  }
}

const boton = (accion, texto, clase = 'btn-secondary') => `<button type="button" class="${clase} msg-oft-btn" data-oferta-accion="${accion}">${texto}</button>`

export function accionesDeOferta(o) {
  const yo = o.soy
  if (o.estado === 'abierta' && o.turno === yo) {
    return yo === 'tienda'
      ? `${boton('aceptar', `Aceptar ${escapeHtml(euros(o.precio))}`, 'btn-primary')}${boton('contra', 'Contraoferta')}${boton('rechazar', 'Rechazar')}`
      : `${boton('aceptar', `Aceptar ${escapeHtml(euros(o.precio))}`, 'btn-primary')}${boton('contra', 'Ofrecer otro')}${boton('retirar', 'Retirar')}`
  }
  if (o.estado === 'abierta') return yo === 'comprador' ? boton('retirar', 'Retirar mi oferta') : ''
  if (yo === 'tienda' && (o.estado === 'aceptada' || o.estado === 'pagada')) {
    return `${o.estado === 'aceptada' ? boton('pagada', 'Ya me ha pagado', 'btn-primary') : ''}${boton('hecha', o.envio === 'correo' ? 'La he enviado' : 'Entregada', o.estado === 'pagada' ? 'btn-primary' : 'btn-secondary')}${boton('alargar', '+7 días')}${boton('cancelar', 'Cancelar venta')}`
  }
  return ''
}

// Lo que paga quien compra y cómo, con el Bizum o el PayPal cuando toca.
function cobroHtml(o) {
  if (o.soy !== 'comprador' || !['aceptada', 'pagada'].includes(o.estado)) return ''
  const total = euros(totalDeOferta(o))
  if (o.pago === 'efectivo') return `<p class="msg-oft-cobro">Págale <b>${escapeHtml(total)}</b> en efectivo al recogerla.</p>`
  if (!o.cobro) return `<p class="msg-oft-cobro">Págale <b>${escapeHtml(total)}</b> por ${escapeHtml(NOMBRE_PAGO[o.pago] || o.pago)}: pídele los datos por aquí.</p>`
  return `<p class="msg-oft-cobro">Págale <b>${escapeHtml(total)}</b> por ${escapeHtml(NOMBRE_PAGO[o.pago])}: <span class="msg-oft-dato">${escapeHtml(o.cobro)}</span> <button type="button" class="link-btn" data-oferta-copiar="${escapeHtml(o.cobro)}">Copiar</button></p>`
}

function tarjetaHtml(o) {
  const c = o.card_id ? cartas.get(o.card_id) : null
  const p = o.product_id ? productos.get(String(o.product_id)) : null
  const nombre = c ? nombreDeCarta(c) : p?.name || 'Carta'
  const foto = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : p?.image ? `src="${escapeHtml(p.image)}" onerror="this.remove()"` : null
  const punto = puntoDeOferta(o, o.soy)
  const nombres = { soy: o.soy, nombreTienda: o.tienda?.nombre || 'La tienda', nombreComprador: o.comprador?.nombre || 'Quien compra' }
  const marca = o.gradeo ? chapaDeGradeoHtml(o.gradeo) : o.product_id ? '' : chapaDeEstadoHtml(o.estado_carta)
  const envio = o.envio === 'correo' ? `Por correo · ${euros(o.envio_precio)}` : 'En mano'
  const margen = o.soy === 'tienda' && o.coste != null ? margenDe(Number(o.precio), Number(o.coste)) : null
  return `<div class="msg-oft" data-oferta="${escapeHtml(o.id)}" data-clase="${punto.clase}">
    <div class="msg-oft-cab">
      <span class="msg-oft-foto${o.product_id ? ' msg-oft-producto' : ''}">${foto ? `<img ${foto} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
      <span class="msg-oft-que">
        <small>${o.soy === 'tienda' ? `Te quiere comprar ${escapeHtml(o.comprador?.nombre || '')}` : `Compra en ${escapeHtml(o.tienda?.nombre || 'la tienda')}`}</small>
        <b>${escapeHtml(nombre)}</b>
        <span class="msg-oft-chapas">${marca}<span>${escapeHtml(String(o.idioma || '').toUpperCase())}</span>${o.variante && o.variante !== 'normal' ? `<span>${escapeHtml(nombreDeVariante(o.variante))}</span>` : ''}${o.unidades > 1 ? `<span>× ${o.unidades}</span>` : ''}</span>
      </span>
      <span class="msg-oft-chapa">${escapeHtml(punto.chapa)}</span>
    </div>
    <ol class="msg-oft-pasos">${(o.pasos || []).map((x) => `<li>${escapeHtml(textoDePaso(x, nombres))}</li>`).join('')}</ol>
    <p class="msg-oft-resumen"><b>${escapeHtml(euros(o.precio))}</b>${o.unidades > 1 ? ` × ${o.unidades}` : ''} · ${escapeHtml(envio)} · ${escapeHtml(NOMBRE_PAGO[o.pago] || o.pago)} · Total ${escapeHtml(euros(totalDeOferta(o)))}${margen ? ` <span class="msg-oft-margen">· te deja ${escapeHtml(euros(margen.euros))}</span>` : ''}</p>
    ${punto.frase ? `<p class="msg-oft-frase">${escapeHtml(punto.frase)}</p>` : ''}
    ${cobroHtml(o)}
    <div class="msg-oft-acciones">${accionesDeOferta(o)}</div>
    <div class="msg-oft-mas" hidden></div>
    <p class="msg-oft-error" role="alert"></p>
  </div>`
}

// El panel de la tienda (1250, js/tienda-ofertas.js) trae las suyas de
// `tienda_ofertas_lista` y usa los mismos botones: las deja aquí.
export function ponerOfertas(filas, soy = 'tienda') {
  for (const o of filas) ofertas.set(o.id, { ...o, soy })
}

// «Pedir fotos» (1251): una línea con lo que pasó y, a quien le toca, su botón:
// a la tienda «Subir fotos» (la hoja de frente y dorso de siempre) y a quien
// las pidió «Ver las fotos».
export function fotosTiendaHtml(m, a, { mia }) {
  hojaInyectada('css/mensajes-oferta.css')
  const pedidas = a.evento === 'fotos_pedidas'
  const titulo = pedidas ? (mia ? 'Pediste fotos' : 'Te piden fotos') : mia ? 'Subiste las fotos' : 'Ya están las fotos'
  const boton = mia ? '' : pedidas ? `<button type="button" class="btn-secondary msg-oft-btn" data-fotos-subir="${escapeHtml(a.stock_id)}">${icons.camera(16)}<span>Subir fotos</span></button>` : `<button type="button" class="btn-secondary msg-oft-btn" data-fotos-ver="${escapeHtml(a.stock_id)}">${icons.camera(16)}<span>Ver las fotos</span></button>`
  return `<div class="msg-oft-linea msg-oft-fotos"><b>${escapeHtml(titulo)}</b><small>${escapeHtml(String(m.body || ''))}</small>${boton}</div>`
}

// `ultima`: este mensaje es el último de su oferta (va la tarjeta entera).
export function ofertaHtml(m, ot, { ultima }) {
  const o = ofertas.get(ot.oferta)
  if (ultima && o) return tarjetaHtml(o)
  return `<div class="msg-oft-linea"><b>${escapeHtml(TITULO_DE_OFERTA[ot.evento] || 'Oferta de compra')}</b><small>${escapeHtml(String(m.body || ''))}</small></div>`
}

// Lo que piden dos pasos (contraofertar con un precio, enviar con seguimiento
// o cancelar) se abre debajo de los botones, sin `prompt()`.
function abrirMas(tarjeta, accion, o) {
  const mas = tarjeta.querySelector('.msg-oft-mas')
  const campo = (id, etiqueta, valor, tipo = 'text') => `<label class="msg-oft-campo" for="${id}"><span>${etiqueta}</span><input id="${id}" type="${tipo}" ${tipo === 'text' ? '' : ''}value="${escapeHtml(valor)}" autocomplete="off" /></label>`
  if (accion === 'contra') {
    mas.innerHTML = `${campo(`oftPrecio-${o.id}`, o.soy === 'tienda' ? 'Tu precio (€)' : 'Tu oferta (€)', Number(o.precio).toFixed(2))}${o.soy === 'tienda' && o.coste != null ? `<small class="msg-oft-coste">Te costó ${escapeHtml(euros(o.coste))}</small>` : ''}${boton('contra-ok', 'Enviar', 'btn-primary')}`
  } else if (accion === 'hecha') {
    mas.innerHTML = `${campo(`oftSeg-${o.id}`, 'Número de seguimiento (si lo tiene)', o.seguimiento || '')}${boton('hecha-ok', 'Hecho: la he enviado', 'btn-primary')}`
  } else if (accion === 'cancelar') {
    mas.innerHTML = `<p class="msg-oft-frase">La carta vuelve a tu stock y se le avisa.</p>${boton('cancelar-ok', 'Sí, cancelar la venta', 'btn-secondary msg-oft-peligro')}`
  }
  mas.hidden = false
  mas.querySelector('input')?.focus()
}

const RPC = {
  aceptar: (o) => ['tienda_oferta_responder', { p_oferta: o.id, p_accion: 'aceptar' }],
  rechazar: (o) => ['tienda_oferta_responder', { p_oferta: o.id, p_accion: 'rechazar' }],
  retirar: (o) => ['tienda_oferta_responder', { p_oferta: o.id, p_accion: 'retirar' }],
  'contra-ok': (o, t) => ['tienda_oferta_responder', { p_oferta: o.id, p_accion: 'contraoferta', p_precio: Number(String(t.querySelector('.msg-oft-mas input')?.value || '').replace(',', '.')) }],
  pagada: (o) => ['tienda_oferta_paso', { p_oferta: o.id, p_paso: 'pagada' }],
  'hecha-ok': (o, t) => ['tienda_oferta_paso', { p_oferta: o.id, p_paso: 'hecha', p_seguimiento: t.querySelector('.msg-oft-mas input')?.value || null }],
  alargar: (o) => ['tienda_oferta_paso', { p_oferta: o.id, p_paso: 'alargar' }],
  'cancelar-ok': (o) => ['tienda_oferta_paso', { p_oferta: o.id, p_paso: 'cancelar' }],
}
const HECHO = { aceptar: 'Aceptada: queda reservada 7 días.', rechazar: 'Rechazada.', retirar: 'Oferta retirada.', 'contra-ok': 'Contraoferta enviada.', pagada: 'Apuntado: ya te ha pagado.', 'hecha-ok': '¡Venta hecha!', alargar: 'Reserva alargada 7 días.', 'cancelar-ok': 'Venta cancelada: la carta vuelve a tu stock.' }

// Un oyente para todo el hilo: los botones de las tarjetas. `alCambiar`
// vuelve a pedir el hilo (el paso deja su mensaje y la tarjeta se mueve).
export function engancharOfertas(raiz, { alCambiar, miId = null }) {
  raiz.addEventListener('click', async (e) => {
    const subir = e.target.closest('[data-fotos-subir]')
    const ver = e.target.closest('[data-fotos-ver]')
    if (subir || ver) {
      // Nunca en silencio (1264, PINGU: «le doy a Ver las fotos y no hace
      // nada»): si el módulo, la consulta o las fotos no llegan, se dice.
      const boton = subir || ver
      const id = boton.dataset.fotosSubir || boton.dataset.fotosVer
      boton.disabled = true
      try {
        const m = await import('./tienda-fotos.js')
        const mapa = await m.fotosDeStock([id]).catch(() => null)
        const fotos = mapa?.get(id) || null
        if (subir) return m.abrirFotosDeStock({ stockId: id, tiendaId: miId, nombre: 'la carta que te piden', fotos, alCambiar: () => alCambiar?.() })
        if (!mapa) return showToast('No se han podido cargar las fotos. Prueba otra vez en un momento.', 'error')
        if (!fotos) return showToast('Esa copia ya no tiene fotos a la vista: puede que la tienda las haya quitado. Pregúntale por aquí.', 'info')
        return m.verFotosDeStock({ nombre: 'La carta', detalle: '', fotos })
      } catch (err) {
        const { recargarSiDesajuste } = await import('./error-log.js')
        if (!recargarSiDesajuste(err)) showToast('No se han podido abrir las fotos. Prueba otra vez.', 'error')
      } finally {
        boton.disabled = false
      }
      return
    }
    const copiar = e.target.closest('[data-oferta-copiar]')
    if (copiar) {
      navigator.clipboard?.writeText(copiar.dataset.ofertaCopiar).then(() => showToast('Copiado.', 'success'), () => {})
      return
    }
    const b = e.target.closest('[data-oferta-accion]')
    if (!b) return
    const tarjeta = b.closest('[data-oferta]')
    const o = ofertas.get(tarjeta?.dataset.oferta)
    if (!o) return
    const accion = b.dataset.ofertaAccion
    if (accion === 'contra' || accion === 'cancelar' || (accion === 'hecha' && o.envio === 'correo')) return abrirMas(tarjeta, accion, o)
    const [nombre, args] = (RPC[accion] || RPC[`${accion}-ok`])(o, tarjeta)
    const error = tarjeta.querySelector('.msg-oft-error')
    if (accion === 'contra-ok' && !(args.p_precio > 0)) { error.textContent = 'Escribe un precio.'; return }
    for (const x of tarjeta.querySelectorAll('button')) x.disabled = true
    const { error: e2 } = await supabase.rpc(nombre, args)
    if (e2) {
      for (const x of tarjeta.querySelectorAll('button')) x.disabled = false
      error.textContent = String(e2.message || 'No se ha podido.').replace(/^.*?ERROR:\s*/, '')
      return
    }
    showToast(HECHO[accion] || HECHO[`${accion}-ok`] || 'Hecho.', 'success')
    await alCambiar?.()
  })
}
