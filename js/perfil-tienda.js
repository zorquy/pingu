// El perfil de una TIENDA (tanda 1069): su escaparate. PINGU: «que no
// muestre el perfil clásico… sino simplemente su inventario». Lo monta
// usuario.js cuando el perfil es de tipo «tienda», y entra por `import()`:
// quien mira a una persona no lo baja.
//
// A la izquierda, quién es y dónde está (escribir, cómo llegar, seguir); a
// la derecha, su stock con precios (`tienda_escaparate`: lo visible, nunca
// el coste) y arriba lo que tiene de TU lista. La carta abre su pop-up de
// siempre (un enlace a /carta, la 1043) y lleva sus marcas (la 943).
import { supabase } from './supabase.js'
import { escapeHtml, getInitial, avatarStyle, getProfile, profileUrl } from './app.js'
import { hojaInyectada } from './hoja.js'
import { showToast } from './toast.js'
import { createNotification } from './notifications.js'
import { euros, IDIOMAS } from './cardmarket.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { rutaDeCarta } from './carta-ruta.js'
import { rutaDeProducto } from './productos.js'
import { nombreDeVariante } from './mi-coleccion/variantes.js'
import { COLUMNAS_CARTA_DE_SET } from './mi-coleccion/columnas-set.js'
import { ICONOS_COLECCION } from './mi-coleccion/iconos.js'
import { enlaceAMapa } from './tiendas-puro.js'

const POR_PAGINA = 60
const COLUMNAS = COLUMNAS_CARTA_DE_SET.replace('tcg_sets(tcg_online_code,serie_id,release_date)', 'tcg_sets(name,name_en,tcg_online_code,serie_id,release_date,oculto)')
const NOMBRE_IDIOMA = Object.fromEntries(IDIOMAS.map((i) => [i.id, i.nombre]))

const est = { tienda: null, datos: null, perfil: null, sesion: null, filtros: {}, orden: 'recientes', filas: [], total: 0, cartas: new Map(), productos: new Map(), pedido: 0 }
let caja = null
const $ = (sel) => caja.querySelector(sel)

async function pedir({ mas = false } = {}) {
  const n = ++est.pedido
  const { data, error } = await supabase.rpc('tienda_escaparate', { p_tienda: est.perfil.id, p_filtros: est.filtros, p_orden: est.orden, p_desde: mas ? est.filas.length : 0, p_cuantas: POR_PAGINA })
  if (n !== est.pedido) return
  if (error || !data) {
    $('.pt-rejilla').innerHTML = `<p class="pt-vacio">${error ? 'El escaparate no se puede ver ahora mismo. Vuelve en un rato.' : 'Esta tienda todavía no enseña nada.'}</p>`
    return
  }
  est.datos = data
  est.filas = mas ? est.filas.concat(data.filas || []) : data.filas || []
  est.total = data.total || 0
  await completar(est.filas)
  if (n !== est.pedido) return
  pintar()
}

async function completar(filas) {
  for (const market of ['WEST', 'JP']) {
    const ids = [...new Set(filas.filter((f) => f.card_id && (f.market || 'WEST') === market && !est.cartas.has(f.card_id)).map((f) => f.card_id))]
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await supabase.from('tcg_cards').select(COLUMNAS).eq('market', market).in('id', ids.slice(i, i + 150))
      for (const c of data || []) est.cartas.set(c.id, c)
    }
  }
  const prod = [...new Set(filas.filter((f) => f.product_id && !est.productos.has(String(f.product_id))).map((f) => f.product_id))]
  if (prod.length) {
    const { data } = await supabase.from('tcg_products').select('id,name,image').in('id', prod)
    for (const p of data || []) est.productos.set(String(p.id), p)
  }
}

function baldosaHtml(f) {
  const c = f.card_id ? est.cartas.get(f.card_id) : null
  const p = f.product_id ? est.productos.get(String(f.product_id)) : null
  const nombre = c ? nombreDeCarta(c) : p?.name || f.nombre || ''
  const foto = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : p?.image ? `src="${escapeHtml(p.image)}" onerror="this.remove()"` : null
  const href = c ? rutaDeCarta(c) : f.product_id ? rutaDeProducto({ id: f.product_id }) : null
  const detalle = f.product_id ? 'Sellado' : [String(f.idioma || '').toUpperCase(), f.estado, f.variante && f.variante !== 'normal' ? nombreDeVariante(f.variante) : null, f.gradeo].filter(Boolean).join(' · ')
  const precio = est.datos?.precios === false ? '<span class="pt-pregunta">Pregunta en la tienda</span>' : f.precio == null ? '<span class="pt-pregunta">Sin precio</span>' : escapeHtml(euros(f.precio))
  return `<article class="pt-carta${f.de_tu_lista ? ' tuya' : ''}">
    <a class="pt-foto${f.product_id ? ' pt-foto-producto' : ''}" href="${escapeHtml(href || '#')}"${c ? ` data-marca-carta="${escapeHtml(c.id)}"` : ''} aria-label="${escapeHtml(nombre)}">${foto ? `<img ${foto} alt="" width="245" height="342" loading="lazy" />` : ''}${f.de_tu_lista ? `<span class="pt-tuya" title="De tu lista">${ICONOS_COLECCION.corazon(14)}</span>` : ''}</a>
    <span class="pt-precio">${precio}</span>
    <span class="pt-nombre">${escapeHtml(nombre)}</span>
    <span class="pt-detalle">${escapeHtml(detalle)}${f.unidades > 1 ? ` · ${f.unidades} uds.` : ''}</span>
  </article>`
}

function pintar() {
  const d = est.datos || {}
  const tuyas = Number(d.de_tu_lista) || 0
  $('.pt-tuyas').innerHTML = est.sesion && tuyas
    ? `<span class="pt-tuyas-icono" aria-hidden="true">${ICONOS_COLECCION.corazon(16)}</span><span><strong>Tiene ${tuyas === 1 ? '1 carta' : `${tuyas} cartas`} de tu lista</strong> «La quiero», en tu idioma.</span>${est.filtros.de_tu_lista ? '' : '<button type="button" class="link-btn" data-pt-ver="tuyas">Verlas</button>'}`
    : ''
  $('.pt-tuyas').hidden = !(est.sesion && tuyas)
  for (const b of caja.querySelectorAll('[data-pt-ver]')) {
    const si = (b.dataset.ptVer === 'tuyas' && est.filtros.de_tu_lista) || (b.dataset.ptVer === 'sellado' && est.filtros.catalogo?.[0] === 'sellado') || (b.dataset.ptVer === 'todo' && !est.filtros.de_tu_lista && !est.filtros.catalogo)
    if (b.classList.contains('seg-btn')) {
      b.classList.toggle('activa', si)
      b.setAttribute('aria-pressed', String(si))
    }
  }
  const segTuyas = $('.seg [data-pt-ver="tuyas"]')
  if (segTuyas) segTuyas.hidden = !est.sesion
  const segSellado = $('.seg [data-pt-ver="sellado"]')
  if (segSellado) segSellado.hidden = !(d.facetas?.catalogo?.sellado > 0)
  const idiomas = Object.keys(d.facetas?.idioma || {})
  const sel = $('[data-pt-idioma]')
  if (sel && sel.options.length <= 1) sel.innerHTML = `<option value="">Todos los idiomas</option>${idiomas.map((i) => `<option value="${i}">${escapeHtml(NOMBRE_IDIOMA[i] || i)}</option>`).join('')}`
  if (sel) sel.hidden = idiomas.length < 2
  $('.pt-solo').hidden = !est.filtros.carta
  $('.pt-cuenta').textContent = `${est.total.toLocaleString('es-ES')} ${est.total === 1 ? 'cosa' : 'cosas'}${est.total !== d.en_escaparate ? ` de ${Number(d.en_escaparate || 0).toLocaleString('es-ES')}` : ''}`
  $('.pt-rejilla').innerHTML = est.filas.length
    ? est.filas.map(baldosaHtml).join('') + (est.filas.length < est.total ? `<button type="button" class="btn-secondary pt-mas" data-pt-mas>Ver más</button>` : '')
    : `<p class="pt-vacio">${Object.keys(est.filtros).length ? 'Nada con estos filtros.' : 'Esta tienda todavía no enseña nada.'}</p>`
  import('./marcas-carta.js').then((m) => m.marcarCartas($('.pt-rejilla'))).catch(() => {})
}

function cabeceraHtml() {
  const p = est.perfil
  const t = est.tienda || {}
  const nombre = p.display_name || p.username || 'Tienda'
  const mapa = enlaceAMapa(t.direccion, t.ciudad)
  const propia = est.sesion?.user?.id === p.id
  return `
    <aside class="pt-lado">
      <div class="pt-quien">
        <span class="pt-logo" style="${p.avatar_url ? avatarStyle(p) : ''}">${p.avatar_url ? '' : escapeHtml(getInitial(nombre))}</span>
        <span><span class="pt-chapa">Tienda</span><h1>${escapeHtml(nombre)}</h1><small>@${escapeHtml(p.username || '')}${t.ciudad ? ` · ${escapeHtml(t.ciudad)}` : ''}</small></span>
      </div>
      <div class="pt-botones">
        ${propia ? '<a class="btn-primary" href="/tienda">Mi panel</a>' : est.sesion ? `<a class="btn-primary" href="/mensajes.html?with=${escapeHtml(p.id)}">Escribir</a>` : `<a class="btn-primary" href="/auth.html?registro=1&volver=${encodeURIComponent(location.pathname + location.search)}">Escribir</a>`}
        ${mapa ? `<a class="btn-secondary" href="${escapeHtml(mapa)}" target="_blank" rel="noopener">Cómo llegar</a>` : ''}
        ${propia ? '' : '<button type="button" class="btn-secondary" data-pt-seguir hidden>Seguir</button>'}
      </div>
      <dl class="pt-datos">
        ${t.direccion ? `<div><dt>Dirección</dt><dd>${escapeHtml(t.direccion)}${t.ciudad ? `, ${escapeHtml(t.ciudad)}` : ''}</dd></div>` : ''}
        ${t.horario ? `<div><dt>Horario</dt><dd>${escapeHtml(t.horario)}</dd></div>` : ''}
        ${t.web ? `<div><dt>Web</dt><dd>${escapeHtml(t.web)}</dd></div>` : ''}
        <div><dt>Le siguen</dt><dd data-pt-seguidores>—</dd></div>
      </dl>
    </aside>
    <section class="pt-stock" aria-label="El stock de la tienda">
      <div class="pt-tuyas" role="status" hidden></div>
      <p class="pt-solo" hidden>Solo la carta que buscabas. <button type="button" class="link-btn" data-pt-ver="todo">Ver todo el stock</button></p>
      <div class="pt-barra">
        <div class="seg" role="group" aria-label="Qué ver">
          <button type="button" class="seg-btn activa" aria-pressed="true" data-pt-ver="todo">Todo</button>
          <button type="button" class="seg-btn" aria-pressed="false" data-pt-ver="tuyas" hidden>De tu lista</button>
          <button type="button" class="seg-btn" aria-pressed="false" data-pt-ver="sellado" hidden>Sellado</button>
        </div>
        <input type="search" class="pt-busca" data-pt-q placeholder="Buscar en la tienda…" aria-label="Buscar en la tienda" />
        <select class="pt-select" data-pt-idioma aria-label="Idioma" hidden><option value="">Todos los idiomas</option></select>
        <select class="pt-select" data-pt-orden aria-label="Orden">
          <option value="recientes">Lo último</option>
          <option value="precio_asc">Más baratas</option>
          <option value="precio_desc">Más caras</option>
          <option value="nombre">Nombre</option>
        </select>
        <span class="pt-cuenta"></span>
      </div>
      <div class="pt-rejilla"><div class="skeleton" style="height:240px"></div></div>
    </section>`
}

async function seguir() {
  const btn = $('[data-pt-seguir]')
  const cuenta = $('[data-pt-seguidores]')
  const { count } = await supabase.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', est.perfil.id)
  if (cuenta) cuenta.textContent = String(count ?? 0)
  if (!btn || !est.sesion) return
  const { data } = await supabase.from('user_follows').select('follower_id').eq('follower_id', est.sesion.user.id).eq('following_id', est.perfil.id).maybeSingle()
  let sigo = !!data
  const pinta = () => {
    btn.textContent = sigo ? 'Dejar de seguir' : 'Seguir'
    btn.hidden = false
  }
  pinta()
  // Cambia ya, confirma después, deshace si falla (la 896).
  btn.onclick = async () => {
    const antes = sigo
    sigo = !antes
    pinta()
    if (cuenta) cuenta.textContent = String(Math.max(0, (Number(cuenta.textContent) || 0) + (sigo ? 1 : -1)))
    const { error } = antes
      ? await supabase.from('user_follows').delete().eq('follower_id', est.sesion.user.id).eq('following_id', est.perfil.id)
      : await supabase.from('user_follows').insert({ follower_id: est.sesion.user.id, following_id: est.perfil.id })
    if (error) {
      sigo = antes
      pinta()
      if (cuenta) cuenta.textContent = String(Math.max(0, (Number(cuenta.textContent) || 0) + (sigo ? 1 : -1)))
      return showToast('No se ha podido guardar.', 'error')
    }
    if (!antes) {
      const yo = await getProfile(est.sesion.user.id)
      createNotification({ recipientId: est.perfil.id, actorId: est.sesion.user.id, type: 'new_follower', title: 'Nuevo seguidor', body: yo?.display_name || yo?.username || 'Alguien', link: yo ? profileUrl(yo) : '/usuarios.html' }).catch(() => {})
    }
  }
}

// Las visitas al escaparate (1073), para el Hoy de la tienda: una por
// navegador y día (recargar no suma), sin la propia tienda y sin quién mira
// (la base solo guarda cuántas por día).
function contarVisita(perfil, sesion, qr) {
  if (sesion?.user?.id === perfil.id) return
  const clave = `pd-visto-tienda-${perfil.id}`
  const hoy = new Date().toLocaleDateString('sv')
  try {
    if (localStorage.getItem(clave) === hoy) return
    localStorage.setItem(clave, hoy)
  } catch {}
  supabase.rpc('tienda_contar_visita', { p_tienda: perfil.id, p_qr: qr }).then(() => {}, () => {})
}

export async function montarPerfilTienda(destino, perfil, sesion) {
  await hojaInyectada('css/perfil-tienda.css')
  caja = destino
  est.perfil = perfil
  est.sesion = sesion
  const { data } = await supabase.from('tiendas').select('ciudad,direccion,horario,web,precio_visible').eq('user_id', perfil.id).maybeSingle()
  est.tienda = data || {}
  // Desde el Mercado o «En tiendas» (`?lista=1`): ya con lo de tu lista.
  const params = new URLSearchParams(location.search)
  if (sesion && params.get('lista') === '1') est.filtros.de_tu_lista = true
  // Y desde «En tiendas» de una carta (`?carta=`): solo esa, con la salida a todo.
  if (params.get('carta')) est.filtros.carta = params.get('carta')
  contarVisita(perfil, sesion, params.get('utm_source') === 'qr')
  caja.classList.add('pt')
  caja.innerHTML = cabeceraHtml()
  caja.addEventListener('click', (e) => {
    const ver = e.target.closest('[data-pt-ver]')
    if (ver) {
      const f = { ...est.filtros }
      delete f.de_tu_lista
      delete f.catalogo
      delete f.carta
      if (ver.dataset.ptVer === 'tuyas') f.de_tu_lista = true
      if (ver.dataset.ptVer === 'sellado') f.catalogo = ['sellado']
      est.filtros = f
      return pedir()
    }
    if (e.target.closest('[data-pt-mas]')) return pedir({ mas: true })
  })
  let espera = null
  caja.addEventListener('input', (e) => {
    if (!e.target.matches('[data-pt-q]')) return
    clearTimeout(espera)
    espera = setTimeout(() => {
      const q = e.target.value.trim()
      const f = { ...est.filtros }
      if (q) f.q = q
      else delete f.q
      est.filtros = f
      pedir()
    }, 300)
  })
  caja.addEventListener('change', (e) => {
    if (e.target.matches('[data-pt-orden]')) {
      est.orden = e.target.value
      pedir()
    }
    if (e.target.matches('[data-pt-idioma]')) {
      const f = { ...est.filtros }
      if (e.target.value) f.idioma = [e.target.value]
      else delete f.idioma
      est.filtros = f
      pedir()
    }
  })
  pedir()
  seguir().catch(() => {})
}
