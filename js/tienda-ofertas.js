// LAS OFERTAS DE LA TIENDA (tanda 1250, PINGU: «en el panel de tienda, un
// apartado donde le llegan las ofertas… y también aceptar esa propuesta o
// hacerle la contraoferta, como en Vinted»). Cuatro montones: lo que te toca
// contestar, lo que espera a quien compra, lo reservado por una oferta y lo
// cerrado. Cada fila lleva sus botones, los mismos de la tarjeta de Mensajes
// (js/mensajes-oferta.js), y «Ir al chat».
//
// Y en Datos, cómo cobra la tienda (`tienda_cobros`): lo que acepta, su Bizum
// y su PayPal (los ve quien compra con la oferta aceptada) y el mínimo de las
// ofertas. Entra por `import()` desde tienda.js.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { showToast } from './toast.js'
import { euros } from './cardmarket.js'
import { icons } from './icons.js'
import { sinMigracion } from './sin-migracion.js'
import { chapaDeEstadoHtml } from './estado-chapa.js'
import { chapaDeGradeoHtml } from './gradeo-elegir.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { COLUMNAS_CARTA_DE_SET } from './mi-coleccion/columnas-set.js'
import { PAGOS_TIENDA, NOMBRE_PAGO, puntoDeOferta, totalDeOferta, margenDe } from './tiendas-puro.js'

const MONTONES = [['responder', 'Por responder'], ['esperando', 'Esperando'], ['reservadas', 'Reservadas'], ['cerradas', 'Cerradas']]
const est = { que: 'responder', datos: null, cartas: new Map(), mod: null, fotos: [], yo: null }
let caja = null

// «caduca en 46 h», «vence el 12 nov.»: lo que corre prisa, en rojo.
function plazoHtml(o) {
  if (o.estado === 'abierta' && o.caduca_at) {
    const h = Math.max(0, Math.round((new Date(o.caduca_at) - Date.now()) / 36e5))
    return `<span class="tof-plazo${h < 12 ? ' pronto' : ''}">${h < 1 ? 'caduca ya' : `caduca en ${h} h`}</span>`
  }
  if (['aceptada', 'pagada'].includes(o.estado) && o.reservada_hasta) {
    const pronto = new Date(o.reservada_hasta) - Date.now() < 864e5
    return `<span class="tof-plazo${pronto ? ' pronto' : ''}">reservada hasta el ${escapeHtml(new Date(o.reservada_hasta).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))}</span>`
  }
  return ''
}

function filaHtml(o) {
  const c = o.card_id ? est.cartas.get(o.card_id) : null
  const foto = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : null
  const punto = puntoDeOferta(o, 'tienda')
  const quien = o.comprador?.username ? `@${o.comprador.username}` : o.comprador?.nombre || 'Alguien'
  const ultimo = (o.pasos || []).at(-1)
  const que = ultimo?.quien === 'comprador' ? (ultimo.que === 'pide' ? 'te la pide a tu precio' : 'ofrece') : 'le dejas'
  const margen = o.coste != null ? margenDe(Number(o.precio), Number(o.coste)) : null
  const marca = o.gradeo ? chapaDeGradeoHtml(o.gradeo) : o.product_id ? '' : chapaDeEstadoHtml(o.estado_carta)
  const acciones = est.mod?.accionesDeOferta({ ...o, soy: 'tienda' }) || ''
  return `<article class="tof-fila msg-oft" data-oferta="${escapeHtml(o.id)}" data-clase="${punto.clase}" id="oferta-${escapeHtml(o.id)}">
    <span class="tof-foto">${foto ? `<img ${foto} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
    <div class="tof-que">
      <p class="tof-nombre"><b>${escapeHtml(o.nombre || 'Carta')}</b> ${marca}<span class="tof-idioma">${escapeHtml(String(o.idioma || '').toUpperCase())}</span>${o.unidades > 1 ? `<span class="tof-idioma">× ${o.unidades}</span>` : ''}</p>
      <p class="tof-linea"><span class="tof-chapa">${escapeHtml(punto.chapa)}</span>${escapeHtml(quien)} ${escapeHtml(que)} <b>${escapeHtml(euros(o.precio))}</b>${o.precio_tienda != null && Number(o.precio_tienda) !== Number(o.precio) ? ` · pides ${escapeHtml(euros(o.precio_tienda))}` : ''} ${plazoHtml(o)}</p>
      <p class="tof-linea tof-sub">${o.envio === 'correo' ? `Por correo (${escapeHtml(euros(o.envio_precio))})` : 'En mano'} · ${escapeHtml(NOMBRE_PAGO[o.pago] || o.pago)} · total ${escapeHtml(euros(totalDeOferta(o)))}${margen ? ` · <span class="tof-margen${margen.euros < 0 ? ' neg' : ''}">te deja ${escapeHtml(euros(margen.euros))}</span>` : ''}${o.seguimiento ? ` · seguimiento ${escapeHtml(o.seguimiento)}` : ''}</p>
      <div class="msg-oft-mas" hidden></div>
      <p class="msg-oft-error" role="alert"></p>
    </div>
    <div class="tof-botones"><div class="msg-oft-acciones">${acciones}</div><a class="btn-secondary msg-oft-btn" href="/mensajes.html?with=${escapeHtml(o.comprador_id)}">${icons.mail(16)}<span>Ir al chat</span></a></div>
  </article>`
}

async function completarCartas(filas) {
  for (const market of ['WEST', 'JP']) {
    const faltan = [...new Set(filas.filter((o) => o.card_id && (o.market || 'WEST') === market && !est.cartas.has(o.card_id)).map((o) => o.card_id))]
    if (!faltan.length) continue
    const { data } = await supabase.from('tcg_cards').select(COLUMNAS_CARTA_DE_SET).eq('market', market).in('id', faltan.slice(0, 150))
    for (const c of data || []) est.cartas.set(c.id, c)
  }
}

const VACIO = {
  responder: 'Nada por contestar. Cuando alguien te ofrezca o te pida una carta del escaparate, saldrá aquí.',
  esperando: 'Ninguna contraoferta tuya está esperando respuesta.',
  reservadas: 'Nada reservado por una oferta.',
  cerradas: 'Todavía no hay ofertas cerradas.',
}

// «Te piden fotos» (1251): lo pendiente, arriba, con «Subir fotos» (la hoja de
// frente y dorso del Stock), «Ir al chat» y «Quitar». Sin la migración, nada.
function fotosHtml() {
  if (!est.fotos.length) return ''
  return `<section class="tof-fotos" aria-label="Te piden fotos"><h3>${icons.camera(18)} Te piden fotos <small>${est.fotos.length}</small></h3>${est.fotos.map((f) => {
    const c = f.card_id ? est.cartas.get(f.card_id) : null
    const foto = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : null
    const quien = f.comprador?.username ? `@${f.comprador.username}` : f.comprador?.nombre || 'Alguien'
    const marca = f.gradeo ? chapaDeGradeoHtml(f.gradeo) : f.product_id ? '' : chapaDeEstadoHtml(f.estado)
    return `<article class="tof-fila tof-foto-fila" id="fotos-${escapeHtml(f.id)}">
      <span class="tof-foto">${foto ? `<img ${foto} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
      <div class="tof-que"><p class="tof-nombre"><b>${escapeHtml(f.nombre || 'Carta')}</b> ${marca}<span class="tof-idioma">${escapeHtml(String(f.idioma || '').toUpperCase())}</span></p><p class="tof-linea">${escapeHtml(quien)} quiere verla por delante y por detrás${f.precio != null ? ` · ${escapeHtml(euros(f.precio))}` : ''}</p></div>
      <div class="tof-botones"><button type="button" class="btn-primary msg-oft-btn" data-tof-subir="${escapeHtml(f.id)}">${icons.camera(16)}<span>Subir fotos</span></button><a class="btn-secondary msg-oft-btn" href="/mensajes.html?with=${escapeHtml(f.comprador?.id || '')}">${icons.mail(16)}<span>Ir al chat</span></a><button type="button" class="btn-secondary msg-oft-btn" data-tof-quitar="${escapeHtml(f.id)}">Quitar</button></div>
    </article>`
  }).join('')}</section>`
}

async function pedirFotos() {
  const { data, error } = await supabase.rpc('tienda_fotos_pedidas_lista')
  est.fotos = error ? [] : data || []
  await completarCartas(est.fotos)
  const caja2 = caja.querySelector('.tof-pedidas')
  if (caja2) caja2.innerHTML = fotosHtml()
  const id = location.hash.startsWith('#fotos-') ? location.hash.slice(1) : null
  const fila = id ? caja.querySelector(`#${CSS.escape(id)}`) : null
  if (fila) {
    fila.classList.add('tof-destacada')
    fila.scrollIntoView({ block: 'center' })
  }
}

async function subirFotos(id) {
  const f = est.fotos.find((x) => x.id === id)
  if (!f) return
  const m = await import('./tienda-fotos.js')
  const fotos = (await m.fotosDeStock([f.stock_id]).catch(() => null))?.get(f.stock_id) || null
  // Al subirlas, el disparador de la base las da por atendidas y avisa: aquí
  // solo se vuelve a pedir la lista al cerrar la hoja.
  m.abrirFotosDeStock({ stockId: f.stock_id, tiendaId: est.yo, nombre: f.nombre || 'la carta', detalle: [String(f.idioma || '').toUpperCase(), f.gradeo || f.estado].filter(Boolean).join(' · '), fotos, alCambiar: () => setTimeout(pedirFotos, 300) })
}

async function pedir() {
  const { data, error } = await supabase.rpc('tienda_ofertas_lista', { p_que: est.que })
  if (error) {
    caja.querySelector('.tof-lista').innerHTML = `<p class="subtext">${sinMigracion(error) ? 'Las ofertas llegan con la próxima actualización de la base. Mientras tanto, la gente te escribe por Mensajes.' : 'No se han podido traer tus ofertas. Vuelve en un rato.'}</p>`
    return
  }
  est.datos = data
  await completarCartas(data.filas || [])
  est.mod.ponerOfertas(data.filas || [], 'tienda')
  pintar()
}

function pintar() {
  const d = est.datos || { cuentas: {}, filas: [] }
  for (const b of caja.querySelectorAll('[data-tof]')) {
    const n = d.cuentas?.[b.dataset.tof]
    b.setAttribute('aria-pressed', String(b.dataset.tof === est.que))
    b.querySelector('.tof-n').textContent = n ? String(n) : ''
  }
  const filas = d.filas || []
  caja.querySelector('.tof-lista').innerHTML = filas.length ? filas.map(filaHtml).join('') : `<p class="tof-vacio">${escapeHtml(VACIO[est.que])}</p>`
  // Desde un aviso (`#oferta-<id>`): a esa fila.
  const id = location.hash.startsWith('#oferta-') ? location.hash.slice(1) : null
  const fila = id ? caja.querySelector(`#${CSS.escape(id)}`) : null
  if (fila) {
    fila.classList.add('tof-destacada')
    fila.scrollIntoView({ block: 'center' })
  }
}

export async function montarOfertas(destino) {
  caja = destino
  hojaInyectada('css/mensajes-oferta.css')
  await hojaInyectada('css/tienda-ofertas.css')
  est.mod = await import('./mensajes-oferta.js')
  caja.innerHTML = `
    <div class="tof">
      <div class="tof-cab">
        <h2>Ofertas</h2>
        <div class="tof-chips" role="group" aria-label="Qué ofertas ver">${MONTONES.map(([v, t]) => `<button type="button" class="tof-chip" data-tof="${v}" aria-pressed="${v === est.que}">${t} <span class="tof-n"></span></button>`).join('')}</div>
      </div>
      <p class="tof-ayuda">Aceptar la reserva 7 días a nombre de quien compra (sale de tu stock). Una oferta sin respuesta caduca a las 48 horas. Cómo cobras y el mínimo, en <a href="/tienda?ver=datos" data-ver="datos">Datos</a>.</p>
      <div class="tof-pedidas"></div>
      <div class="tof-lista"><div class="skeleton" style="height:120px"></div></div>
    </div>`
  est.yo = (await supabase.auth.getSession()).data?.session?.user?.id || null
  caja.addEventListener('click', async (e) => {
    const subir = e.target.closest('[data-tof-subir]')
    if (subir) return subirFotos(subir.dataset.tofSubir)
    const quitar = e.target.closest('[data-tof-quitar]')
    if (quitar) {
      quitar.disabled = true
      const { error } = await supabase.rpc('tienda_fotos_quitar', { p_id: quitar.dataset.tofQuitar })
      if (error) { quitar.disabled = false; return showToast('No se ha podido quitar.', 'error') }
      return pedirFotos()
    }
    const b = e.target.closest('[data-tof]')
    if (!b) return
    est.que = b.dataset.tof
    pedir()
  })
  est.mod.engancharOfertas(caja, { alCambiar: pedir })
  // Desde un aviso, el montón de esa oferta.
  const id = location.hash.startsWith('#oferta-') ? location.hash.slice(8) : null
  if (id) {
    const { data } = await supabase.rpc('tienda_oferta_ver', { p_oferta: id }).then((r) => r, () => ({}))
    if (data) est.que = data.estado === 'abierta' ? (data.turno === 'tienda' ? 'responder' : 'esperando') : ['aceptada', 'pagada'].includes(data.estado) ? 'reservadas' : 'cerradas'
  }
  pedir()
  pedirFotos()
}

// ── Cómo cobras ──
export async function montarCobros(destino) {
  if (!destino) return
  await hojaInyectada('css/tienda-ofertas.css')
  const { data, error } = await supabase.rpc('tienda_cobros_mios')
  if (error) {
    destino.innerHTML = ''
    return
  }
  const c = data || { pagos: PAGOS_TIENDA.map(([p]) => p) }
  const pagos = new Set(c.pagos || [])
  destino.innerHTML = `
    <h2>Cómo cobras</h2>
    <p class="subtext">Lo que aceptas cuando alguien te compra por PokeDoc. Tu Bizum y tu PayPal solo los ve quien te compra, y solo cuando aceptas su oferta.</p>
    <form class="td-form" id="tdCobrosForm" novalidate>
      <fieldset class="tof-pagos"><legend>Aceptas</legend>${PAGOS_TIENDA.map(([v, t]) => `<label class="td-check"><input type="checkbox" name="pago" value="${v}"${pagos.has(v) ? ' checked' : ''} /> <span>${t}${v === 'efectivo' ? ' (solo en mano)' : ''}</span></label>`).join('')}</fieldset>
      <label class="td-campo"><span>Tu Bizum <small>(el teléfono)</small></span><input type="text" id="tdCobroBizum" maxlength="40" inputmode="tel" value="${escapeHtml(c.bizum || '')}" placeholder="600 11 22 33" /></label>
      <label class="td-campo"><span>Tu PayPal <small>(el correo o tu enlace paypal.me)</small></span><input type="text" id="tdCobroPaypal" maxlength="120" value="${escapeHtml(c.paypal || '')}" placeholder="paypal.me/tutienda" autocapitalize="none" spellcheck="false" /></label>
      <label class="td-campo"><span>Ofertas por debajo de</span><select id="tdCobroMinimo">${[['', 'Sin mínimo: me llegan todas'], ...[90, 80, 70, 60, 50].map((n) => [String(n), `el ${n} % de mi precio, no`])].map(([v, t]) => `<option value="${v}"${String(c.minimo ?? '') === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <p class="td-error" id="tdCobrosError" role="alert"></p>
      <button type="submit" class="btn-primary">Guardar cómo cobras</button>
    </form>`
  destino.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = e.currentTarget
    const elegidos = [...f.querySelectorAll('[name="pago"]:checked')].map((x) => x.value)
    const err = f.querySelector('.td-error')
    err.textContent = ''
    if (!elegidos.length) { err.textContent = 'Elige al menos una forma de cobrar.'; return }
    const boton = f.querySelector('[type="submit"]')
    boton.disabled = true
    const minimo = f.querySelector('#tdCobroMinimo').value
    const { error: e2 } = await supabase.rpc('tienda_cobros_poner', { p_pagos: elegidos, p_bizum: f.querySelector('#tdCobroBizum').value, p_paypal: f.querySelector('#tdCobroPaypal').value, p_minimo: minimo ? Number(minimo) : null })
    boton.disabled = false
    if (e2) { err.textContent = String(e2.message || 'No se ha podido guardar.').replace(/^.*?ERROR:\s*/, ''); return }
    showToast('Guardado: así cobras.', 'success')
  })
}
