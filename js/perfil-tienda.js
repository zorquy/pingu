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
import { urlParaCss } from './html.js'
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
import { enlaceAMapa, enlacesDeTienda } from './tiendas-puro.js'
import { icons } from './icons.js'
import { chapaDeGradeoHtml } from './gradeo-elegir.js'
import { chapaDeEstadoHtml } from './estado-chapa.js'
import { banderaHtml } from './precio-vista.js'
import { fotosDeStock, verFotosDeStock, cuantasFotos } from './tienda-fotos.js'
import { ATRIBUTOS_DE_TIENDA } from './rangos.js'

const POR_PAGINA = 60
const COLUMNAS = COLUMNAS_CARTA_DE_SET.replace('tcg_sets(tcg_online_code,serie_id,release_date)', 'tcg_sets(name,name_en,tcg_online_code,serie_id,release_date,oculto)')
const NOMBRE_IDIOMA = Object.fromEntries(IDIOMAS.map((i) => [i.id, i.nombre]))

const est = { tienda: null, datos: null, perfil: null, sesion: null, filtros: {}, orden: 'recientes', filas: [], total: 0, tiras: [], cartas: new Map(), productos: new Map(), fotos: new Map(), pedido: 0 }

// Las tiras de arriba (1079, y las ofertas de la 1082): lo que la tienda
// destaca, lo rebajado y lo que acaba de entrar. Solo en «Todo» sin buscar
// nada: con un filtro puesto, lo que se busca es la lista.
const TIRAS = [
  ['destacadas', 'Destacadas'],
  ['ofertas', 'En oferta'],
  ['nuevas', 'Novedades'],
]
const sinFiltros = () => !Object.keys(est.filtros).length
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
  if (!mas) {
    // Sin la migración 1079 la respuesta no trae las cuentas: sin tiras.
    const tocan = sinFiltros() ? TIRAS.filter(([clave]) => Number(data[clave]) > 0) : []
    const tiras = await Promise.all(tocan.map(([clave, titulo]) =>
      supabase.rpc('tienda_escaparate', { p_tienda: est.perfil.id, p_filtros: { seccion: clave }, p_orden: 'recientes', p_desde: 0, p_cuantas: 12 })
        .then(({ data: t }) => ({ clave, titulo, total: Number(data[clave]) || 0, filas: t?.filas || [] }), () => null)))
    if (n !== est.pedido) return
    est.tiras = tiras.filter((t) => t?.filas.length)
  }
  await completar(est.filas.concat(...est.tiras.map((t) => t.filas)))
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
  // Las fotos de las copias (1235): sin la migración, ninguna (y sin aviso:
  // para quien mira, no hay nada que echar de menos).
  const sinFotos = filas.filter((f) => f.card_id && f.id && !est.fotos.has(f.id)).map((f) => f.id)
  if (sinFotos.length) {
    const m = await fotosDeStock(sinFotos)
    for (const id of sinFotos) est.fotos.set(id, m?.get(id) || null)
  }
  const prod = [...new Set(filas.filter((f) => f.product_id && !est.productos.has(String(f.product_id))).map((f) => f.product_id))]
  if (prod.length) {
    const { data } = await supabase.from('tcg_products').select('id,name,image').in('id', prod)
    for (const p of data || []) est.productos.set(String(p.id), p)
  }
}

// «Me interesa» (1080) abre su pop-up desde la 1249 (js/tienda-carta.js), que
// es donde se ve lo que tiene la tienda de esa carta y desde donde se le
// escribe. Ni en la previa ni a sí misma.
function interesaHtml(f) {
  if (est.previa || est.sesion?.user?.id === est.perfil.id) return ''
  return `<button type="button" class="pt-interesa" data-pt-abrir="${escapeHtml(f.id)}">${icons.mail(14)}<span>Me interesa</span></button>`
}

// «Ver fotos» (1235): la copia de verdad, por delante y por detrás.
function fotosVerHtml(f) {
  const n = cuantasFotos(est.fotos.get(f.id))
  return n ? `<button type="button" class="tdf-chapa-ver" data-pt-fotos="${escapeHtml(f.id)}">${icons.camera(14)}<span>Ver ${n === 2 ? 'las fotos' : 'la foto'}</span></button>` : ''
}

function baldosaHtml(f) {
  const c = f.card_id ? est.cartas.get(f.card_id) : null
  const p = f.product_id ? est.productos.get(String(f.product_id)) : null
  const nombre = c ? nombreDeCarta(c) : p?.name || f.nombre || ''
  const foto = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : p?.image ? `src="${escapeHtml(p.image)}" onerror="this.remove()"` : null
  const href = c ? rutaDeCarta(c) : f.product_id ? rutaDeProducto({ id: f.product_id }) : null
  // Una gradeada lleva su etiqueta sobre la foto y no dice estado (1234).
  // El idioma con su bandera (1263, PINGU: «el estado se ve con iconos… el
  // idioma no se ve con banderas»): bandera + sigla, como en el resto de la web.
  const idioma = f.product_id || !f.idioma ? '' : `<span class="pt-idioma">${banderaHtml(f.idioma)}${escapeHtml(String(f.idioma).toUpperCase())}</span>`
  const detalle = f.product_id ? 'Sellado' : f.variante && f.variante !== 'normal' ? nombreDeVariante(f.variante) : ''
  const trozos = [detalle, f.unidades > 1 ? `${f.unidades} uds.` : ''].filter(Boolean).join(' · ')
  const resto = trozos ? `${idioma ? ' · ' : ''}${trozos}` : ''
  // Una oferta (1082): el precio rebajado, el de siempre tachado y cuánto baja.
  const antes = f.precio_antes != null && f.precio != null && Number(f.precio_antes) > Number(f.precio) ? Number(f.precio_antes) : null
  const baja = antes ? Math.round((1 - Number(f.precio) / antes) * 100) : 0
  const precio = est.datos?.precios === false ? '<span class="pt-pregunta">Pregunta el precio</span>' : f.precio == null ? '<span class="pt-pregunta">Sin precio</span>' : `${antes ? `<s class="pt-antes">${escapeHtml(euros(antes))}</s> ` : ''}${escapeHtml(euros(f.precio))}`
  const chapas = [
    antes && baja > 0 ? `<span class="pt-chapa-foto pt-chapa-oferta">−${baja} %</span>` : f.precio_antes != null ? '<span class="pt-chapa-foto pt-chapa-oferta">Oferta</span>' : '',
    f.nueva ? '<span class="pt-chapa-foto pt-chapa-nueva">Nueva</span>' : '',
  ].join('')
  return `<article class="pt-carta${f.de_tu_lista ? ' tuya' : ''}${antes ? ' pt-oferta' : ''}">
    <a class="pt-foto${f.product_id ? ' pt-foto-producto' : ''}" href="${escapeHtml(href || '#')}" data-pt-abrir="${escapeHtml(f.id)}"${c ? ` data-marca-carta="${escapeHtml(c.id)}"` : ''} aria-label="${escapeHtml(nombre)}">${foto ? `<img ${foto} alt="" width="245" height="342" loading="lazy" />` : ''}${chapas ? `<span class="pt-chapas-foto">${chapas}</span>` : ''}${f.gradeo && !f.product_id ? chapaDeGradeoHtml(f.gradeo, { clase: 'chapa-gradeo-foto' }) : ''}${f.de_tu_lista ? `<span class="pt-tuya" title="De tu lista">${ICONOS_COLECCION.corazon(14)}</span>` : ''}</a>
    <span class="pt-precio">${precio}</span>
    <span class="pt-nombre">${escapeHtml(nombre)}</span>
    <span class="pt-detalle">${f.product_id || f.gradeo ? '' : chapaDeEstadoHtml(f.estado)}${idioma}${escapeHtml(resto)}</span>
    ${fotosVerHtml(f)}
    ${interesaHtml(f)}
  </article>`
}

function pintar() {
  const d = est.datos || {}
  const tuyas = Number(d.de_tu_lista) || 0
  $('.pt-tuyas').innerHTML = est.sesion && tuyas
    ? `<span class="pt-tuyas-icono" aria-hidden="true">${ICONOS_COLECCION.corazon(16)}</span><span><strong>Tiene ${tuyas === 1 ? '1 carta' : `${tuyas} cartas`} de tu lista</strong> «La quiero», en tu idioma.</span>${est.filtros.de_tu_lista ? '' : '<button type="button" class="link-btn" data-pt-ver="tuyas">Verlas</button>'}`
    : ''
  $('.pt-tuyas').hidden = !(est.sesion && tuyas)
  const f = est.filtros
  for (const b of caja.querySelectorAll('[data-pt-ver]')) {
    const v = b.dataset.ptVer
    const si = (v === 'tuyas' && f.de_tu_lista) || (v === 'sellado' && f.catalogo?.[0] === 'sellado') || (v === f.seccion) || (v === 'todo' && !f.de_tu_lista && !f.catalogo && !f.seccion)
    if (b.classList.contains('seg-btn')) {
      b.classList.toggle('activa', Boolean(si))
      b.setAttribute('aria-pressed', String(Boolean(si)))
    }
  }
  const segTuyas = $('.seg [data-pt-ver="tuyas"]')
  if (segTuyas) segTuyas.hidden = !est.sesion
  const segSellado = $('.seg [data-pt-ver="sellado"]')
  if (segSellado) segSellado.hidden = !(d.facetas?.catalogo?.sellado > 0)
  for (const [clave] of TIRAS) {
    const b = $(`.seg [data-pt-ver="${clave}"]`)
    if (b) b.hidden = !(Number(d[clave]) > 0) && f.seccion !== clave
  }
  $('.pt-tiras').innerHTML = sinFiltros() ? est.tiras.map((t) => `<section class="pt-tira" aria-label="${escapeHtml(t.titulo)}">
      <div class="pt-tira-cab"><h2>${t.clave === 'destacadas' ? icons.star(18) : ''}${escapeHtml(t.titulo)}</h2>${t.total > t.filas.length || t.clave !== 'destacadas' ? `<button type="button" class="link-btn" data-pt-ver="${t.clave}">Ver ${t.total === 1 ? 'la' : `las ${t.total}`}</button>` : ''}</div>
      <div class="pt-tira-fila">${t.filas.map(baldosaHtml).join('')}</div>
    </section>`).join('') : ''
  $('.pt-todo-titulo').hidden = !(sinFiltros() && est.tiras.length)
  const idiomas = Object.keys(d.facetas?.idioma || {})
  const sel = $('[data-pt-idioma]')
  if (sel && sel.options.length <= 1) sel.innerHTML = `<option value="">Todos los idiomas</option>${idiomas.map((i) => `<option value="${i}">${escapeHtml(NOMBRE_IDIOMA[i] || i)}</option>`).join('')}`
  if (sel) sel.hidden = idiomas.length < 2
  const enEsc = $('[data-pt-en-escaparate]')
  if (enEsc) enEsc.textContent = Number(d.en_escaparate || 0).toLocaleString('es-ES')
  $('.pt-cuenta').textContent = `${est.total.toLocaleString('es-ES')} ${est.total === 1 ? 'cosa' : 'cosas'}${est.total !== d.en_escaparate ? ` de ${Number(d.en_escaparate || 0).toLocaleString('es-ES')}` : ''}`
  const rejilla = $('.pt-rejilla')
  rejilla.innerHTML = est.filas.length
    ? est.filas.map(baldosaHtml).join('') + (est.filas.length < est.total ? `<button type="button" class="btn-secondary pt-mas" data-pt-mas>Ver más</button>` : '')
    : `<p class="pt-vacio">${Object.keys(est.filtros).length ? 'Nada con estos filtros.' : 'Esta tienda todavía no enseña nada.'}</p>`
  import('./marcas-carta.js').then((m) => m.marcarCartas($('.pt-stock'))).catch(() => {})
}

// La cabecera (1069; ancha y más visual desde la 1078, PINGU: «¿por qué se
// ve tan vertical?… que sea más visual, puedes ancharlo»): una banda con el
// logo, el nombre, lo que tiene en el escaparate y quién le sigue, y los
// botones; debajo, sus datos como chapas con su icono. En el móvil, en poco
// alto (1040).
function cabeceraHtml() {
  const p = est.perfil
  const t = est.tienda || {}
  const nombre = p.display_name || p.username || 'Tienda'
  const mapa = enlaceAMapa(t.direccion, t.ciudad)
  const propia = est.sesion?.user?.id === p.id
  const ICONO = { web: icons.link(16), instagram: icons.camera(16) }
  const datos = [
    t.direccion ? `<div><dt>${icons.pin(16)}<span class="sr-only">Dirección</span></dt><dd>${escapeHtml(t.direccion)}${t.ciudad ? `, ${escapeHtml(t.ciudad)}` : ''}</dd></div>` : '',
    t.horario ? `<div><dt>${icons.clock(16)}<span class="sr-only">Horario</span></dt><dd>${escapeHtml(t.horario)}</dd></div>` : '',
    ...enlacesDeTienda(t).map((e) => `<div><dt>${ICONO[e.tipo]}<span class="sr-only">${e.tipo === 'web' ? 'Web' : 'Instagram'}</span></dt><dd><a href="${escapeHtml(e.href)}" target="_blank" rel="noopener nofollow">${escapeHtml(e.texto)}</a></dd></div>`),
  ].filter(Boolean).join('')
  const botones = est.previa
    ? ''
    : `<div class="pt-botones">
        ${propia ? '<a class="btn-primary" href="/tienda">Mi panel</a>' : est.sesion ? `<a class="btn-primary" href="/mensajes.html?with=${escapeHtml(p.id)}">${icons.mail(18)}<span>Escribir</span></a>` : `<a class="btn-primary" href="/auth.html?registro=1&volver=${encodeURIComponent(location.pathname + location.search)}">${icons.mail(18)}<span>Escribir</span></a>`}
        ${propia ? '' : '<button type="button" class="btn-secondary" data-pt-seguir hidden>Seguir</button>'}
        ${mapa ? `<a class="btn-secondary pt-llegar" href="${escapeHtml(mapa)}" target="_blank" rel="noopener" aria-label="Cómo llegar">${icons.pin(18)}<span>Cómo llegar</span></a>` : ''}
      </div>`
  const portada = urlParaCss(p.banner_url)
  return `
    ${portada ? `<div class="pt-portada" style="background-image:url('${portada}')" role="img" aria-label="Portada de ${escapeHtml(nombre)}"></div>` : ''}
    <header class="pt-cab${portada ? ' pt-cab-portada' : ''}">
      <div class="pt-quien">
        <span class="pt-logo" style="${p.avatar_url ? avatarStyle(p) : ''}">${p.avatar_url ? '' : escapeHtml(getInitial(nombre))}</span>
        <span class="pt-quien-texto"><span class="pt-chapa">Tienda</span><h1${ATRIBUTOS_DE_TIENDA}>${escapeHtml(nombre)}</h1><small>@${escapeHtml(p.username || '')}${t.ciudad ? ` · ${escapeHtml(t.ciudad)}` : ''}</small></span>
      </div>
      <dl class="pt-cifras">
        <div><dt>En el escaparate</dt><dd data-pt-en-escaparate>—</dd></div>
        <div><dt>Le siguen</dt><dd data-pt-seguidores>—</dd></div>
      </dl>
      ${botones}
      ${datos ? `<dl class="pt-datos">${datos}</dl>` : ''}
    </header>
    <section class="pt-stock" aria-label="El stock de la tienda">
      <div class="pt-tuyas" role="status" hidden></div>
      <div class="pt-barra">
        <div class="seg" role="group" aria-label="Qué ver">
          <button type="button" class="seg-btn activa" aria-pressed="true" data-pt-ver="todo">Todo</button>
          <button type="button" class="seg-btn" aria-pressed="false" data-pt-ver="tuyas" hidden>De tu lista</button>
          <button type="button" class="seg-btn" aria-pressed="false" data-pt-ver="destacadas" hidden>Destacadas</button>
          <button type="button" class="seg-btn" aria-pressed="false" data-pt-ver="ofertas" hidden>Ofertas</button>
          <button type="button" class="seg-btn" aria-pressed="false" data-pt-ver="nuevas" hidden>Novedades</button>
          <button type="button" class="seg-btn" aria-pressed="false" data-pt-ver="sellado" hidden>Sellado</button>
        </div>
        <input type="search" class="pt-busca" data-pt-q placeholder="Busca en la tienda" aria-label="Buscar en la tienda" />
        <select class="pt-select" data-pt-idioma aria-label="Idioma" hidden><option value="">Todos los idiomas</option></select>
        <select class="pt-select" data-pt-orden aria-label="Orden">
          <option value="recientes">Lo último</option>
          <option value="precio_asc">Más baratas</option>
          <option value="precio_desc">Más caras</option>
          <option value="nombre">Nombre</option>
        </select>
        <span class="pt-cuenta"></span>
      </div>
      <div class="pt-tiras"></div>
      <h2 class="pt-todo-titulo" hidden>Todo el stock</h2>
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

// `previa` (1078): el mismo escaparate dentro de /tienda → Escaparate, para
// que la tienda vea lo que ve la gente; sin botones y sin contar su visita.
export async function montarPerfilTienda(destino, perfil, sesion, { previa = false } = {}) {
  await hojaInyectada('css/perfil-tienda.css')
  hojaInyectada('css/tienda-fotos.css')
  // Las banderas de los idiomas (.pv-bandera) viven en cardmarket.css (1263).
  hojaInyectada('css/cardmarket.css')
  caja = destino
  est.perfil = perfil
  est.sesion = sesion
  est.previa = previa
  // `instagram` llega con la 1074; sin ella, pedirla tumba la consulta entera
  // (42703, la 624), así que se vuelve a pedir sin.
  const columnas = 'ciudad,direccion,horario,web,precio_visible'
  let r = await supabase.from('tiendas').select(`${columnas},instagram`).eq('user_id', perfil.id).maybeSingle()
  if (r.error?.code === '42703') r = await supabase.from('tiendas').select(columnas).eq('user_id', perfil.id).maybeSingle()
  est.tienda = r.data || {}
  // Desde el Mercado o «En tiendas» (`?lista=1`): ya con lo de tu lista.
  const params = new URLSearchParams(location.search)
  if (sesion && params.get('lista') === '1') est.filtros.de_tu_lista = true
  // Y con `?carta=` (de «Me interesa», «En tiendas», /tiendas o una etiqueta):
  // la tienda ENTERA con el pop-up de esa carta encima (1249, PINGU: «debería
  // abrirte la tienda en general»; antes se filtraba a «solo esa»). `linea`
  // dice cuál de sus copias.
  est.abrir = params.get('carta') ? { carta: params.get('carta'), linea: params.get('linea') } : null
  // El QR de una etiqueta (1253), /s/<tienda>/<SKU> → `?sku=`: si quien escanea
  // es la propia tienda, a esa línea de su stock; si no, la carta aquí.
  const sku = params.get('sku')
  if (sku && !previa) {
    if (sesion?.user?.id === perfil.id) {
      location.replace(`/tienda?ver=stock&sku=${encodeURIComponent(sku)}`)
      return
    }
    est.abrir = { sku }
  }
  if (!previa) contarVisita(perfil, sesion, params.get('utm_source') === 'qr' || !!sku)
  // Lo apartado que caducó vuelve al escaparate (1092): caduca cuando alguien
  // mira, que es cuando importa. Sin la migración, no hace nada.
  if (!previa) supabase.rpc('tienda_reservas_al_dia', { p_tienda: perfil.id }).then(() => {}, () => {})
  caja.classList.add('pt')
  caja.classList.toggle('pt-previa', previa)
  caja.innerHTML = cabeceraHtml()
  caja.addEventListener('click', (e) => {
    const fotos = e.target.closest('[data-pt-fotos]')
    if (fotos) {
      const f = todas().find((x) => x.id === fotos.dataset.ptFotos)
      const c = f?.card_id ? est.cartas.get(f.card_id) : null
      if (f) verFotosDeStock({ nombre: c ? nombreDeCarta(c) : f.nombre || '', detalle: [String(f.idioma || '').toUpperCase(), f.gradeo || f.estado].filter(Boolean).join(' · '), fotos: est.fotos.get(f.id) })
      return
    }
    const abrir = e.target.closest('[data-pt-abrir]')
    if (abrir && !(e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
      const f = todas().find((x) => x.id === abrir.dataset.ptAbrir)
      if (f) {
        // Antes que el oyente de app.js (1043), que la abriría en la ficha de
        // la colección: en una tienda, la carta se abre para comprarla.
        e.preventDefault()
        abrirLinea(f).catch(() => { if (abrir.href) location.href = abrir.href })
        return
      }
    }
    const ver = e.target.closest('[data-pt-ver]')
    if (ver) {
      const f = { ...est.filtros }
      delete f.de_tu_lista
      delete f.catalogo
      delete f.carta
      delete f.seccion
      if (ver.dataset.ptVer === 'tuyas') f.de_tu_lista = true
      if (ver.dataset.ptVer === 'sellado') f.catalogo = ['sellado']
      if (TIRAS.some(([clave]) => clave === ver.dataset.ptVer)) f.seccion = ver.dataset.ptVer
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
  pedir().then(abrirDelEnlace).catch(() => {})
  seguir().catch(() => {})
}

const todas = () => est.filas.concat(...est.tiras.map((t) => t.filas))

// Las copias que tiene la tienda de una carta (o la línea, si es un producto):
// las de `tienda_escaparate`, así que nunca el coste ni lo oculto.
async function lineasDe(f) {
  const filtro = f.card_id ? { carta: f.card_id } : { id: f.id }
  const { data, error } = await supabase.rpc('tienda_escaparate', { p_tienda: est.perfil.id, p_filtros: filtro, p_orden: 'precio_asc', p_desde: 0, p_cuantas: 40 })
  if (error) throw error
  const lineas = data?.filas || []
  await completar(lineas)
  return lineas
}

// La dirección dice qué carta está abierta (para compartirla o volver con el
// botón de atrás del navegador), salvo en la previa, que vive en /tienda.
function ponerEnLaDireccion(f) {
  if (est.previa) return
  const u = new URL(location.href)
  if (f) {
    if (f.card_id) u.searchParams.set('carta', f.card_id)
    else u.searchParams.delete('carta')
    u.searchParams.set('linea', f.id)
  } else {
    u.searchParams.delete('carta')
    u.searchParams.delete('linea')
  }
  u.searchParams.delete('sku')
  history.replaceState(history.state, '', u.pathname + u.search + u.hash)
}

async function abrirLinea(f, lineas = null) {
  const ls = lineas || (await lineasDe(f))
  const elegida = ls.find((l) => l.id === f.id) || ls[0]
  if (!elegida) return false
  const m = await import('./tienda-carta.js')
  ponerEnLaDireccion(elegida)
  return m.abrirCartaDeTienda({
    tienda: est.perfil,
    nombreTienda: est.perfil.display_name || est.perfil.username || 'Tienda',
    sesion: est.sesion,
    previa: est.previa,
    carta: elegida.card_id ? est.cartas.get(elegida.card_id) || null : null,
    producto: elegida.product_id ? est.productos.get(String(elegida.product_id)) || null : null,
    lineas: ls,
    elegida: elegida.id,
    fotos: est.fotos,
    sinPrecios: est.datos?.precios === false,
    alCerrar: () => ponerEnLaDireccion(null),
  })
}

// Al llegar con `?carta=`: el pop-up de esa carta, y si ya no la tiene, se dice.
async function abrirDelEnlace() {
  let pedida = est.abrir
  est.abrir = null
  if (!pedida) return
  // Por SKU (1253): la primera copia que enseña el escaparate con ese SKU.
  if (pedida.sku) {
    const { data } = await supabase.rpc('tienda_sku_buscar', { p_tienda: est.perfil.id, p_sku: pedida.sku }).then((r) => r, () => ({ data: null }))
    const f = Array.isArray(data) ? data[0] : null
    if (!f) {
      showToast('Esa carta ya no está en esta tienda. Mira lo que tiene.', 'info')
      return ponerEnLaDireccion(null)
    }
    if (!f.card_id) {
      const ls = await lineasDe({ id: f.id }).catch(() => [])
      return ls.length ? abrirLinea(ls[0], ls) : ponerEnLaDireccion(null)
    }
    pedida = { carta: f.card_id, linea: f.id }
  }
  const ls = await lineasDe({ card_id: pedida.carta }).catch(() => [])
  if (!ls.length) {
    showToast('Esa carta ya no está en esta tienda. Mira lo que tiene.', 'info')
    return ponerEnLaDireccion(null)
  }
  const f = ls.find((l) => l.id === pedida.linea) || ls[0]
  await abrirLinea(f, ls)
}
