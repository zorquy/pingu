// /tiendas, un escaparate de escaparates (tanda 1244; la agenda era de la 1236).
// PINGU: «que se vean bien las tiendas, que sea un apartado visualmente guapo,
// que muestre bien las tiendas, con toda la info».
//
// Arriba, la banda con las cifras de TODAS (`cifras`); debajo, un buscador que
// también busca por carta y los chips. Cada tienda es una tarjeta grande:
// portada y logo, nombre con su icono (1243), si está abierta ahora (de su
// horario, `estadoDeHorario`: si no se entiende, no se dice nada), ciudad,
// local u online, sus redes, cuántas cartas y cuántas de tu lista, sus cuatro
// de escaparate con precio, «Ver escaparate» y «Escribir». Las de tu lista van
// en su bloque arriba, y en medio «Recién llegado a las tiendas»
// (`tiendas_recien`). Todo de la migración 1244; sin ella, lo de la 1236 (sin
// cifras, cartas ni horario) sin nada roto. Y sin ninguna de las dos, la
// página dice que no se ha podido preguntar.
//
// Las tiendas se piden todas de una vez (como mucho 100, que hoy son pocas) y
// los chips filtran en el navegador; el texto sí va a la base, que es quien
// sabe qué cartas tiene cada una.
import { supabase } from './supabase.js'
import { escapeHtml, urlParaCss } from './html.js'
import { profileUrl } from './app.js'
import { ATRIBUTOS_DE_TIENDA } from './rangos.js'
import { icons } from './icons.js'
import { euros } from './cardmarket.js'
import { normalizeSearch } from './texto.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta } from './catalogo-series.js'
import { COLUMNAS_CARTA_DE_SET } from './mi-coleccion/columnas-set.js'
import { enlaceDeTienda } from './en-tiendas.js'
import { enlacesDeTienda, chapaDeEstado, filtrarTiendas } from './tiendas-puro.js'

const TODAS = 100
const A_LA_VISTA = 12
const RECIEN = 8
const $ = (id) => document.getElementById(id)
// Con el punto también en 1.240, como la banda del Mercado (`useGrouping`).
const miles = (n) => Number(n || 0).toLocaleString('es-ES', { useGrouping: 'always' })
const est = {
  texto: '', ciudad: '', filtro: { lista: false, local: false, online: false, abiertas: false },
  tiendas: [], total: 0, pedido: 0, vistas: A_LA_VISTA, ciudadesPuestas: false,
  cartas: new Map(), productos: new Map(), sesion: null, recien: [], recienMas: false,
}

function cartaDeEscaparateHtml(d, t) {
  const c = d.card_id ? est.cartas.get(`${d.market || 'WEST'}|${d.card_id}`) : null
  const p = d.product_id ? est.productos.get(String(d.product_id)) : null
  const nombre = c ? nombreDeCarta(c) : p?.name || ''
  const foto = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : p?.image ? `src="${escapeHtml(p.image)}" onerror="this.remove()"` : null
  const precio = d.precio != null ? `<b class="tag-precio${d.precio_antes != null ? ' tag-oferta' : ''}">${escapeHtml(euros(d.precio))}</b>` : ''
  return `<a class="tag-carta${d.product_id ? ' tag-carta-producto' : ''}" href="${escapeHtml(enlaceDeTienda(t, d.card_id))}" aria-label="${escapeHtml([nombre, d.precio != null ? euros(d.precio) : ''].filter(Boolean).join(', ') || 'Una carta de su escaparate')}">${foto ? `<img ${foto} alt="" width="245" height="342" loading="lazy" />` : ''}${precio}</a>`
}

// Una tienda, en grande. `t.precios` es false si no enseña precios (1069).
// Los cuatro sitios de cartas van SIEMPRE (1245, PINGU: «que tengan o no
// tengan más o menos información sea el mismo tamaño para todo»): lo que falta
// es un hueco del mismo tamaño, sin nada que pulsar.
const HUECO = '<span class="tag-carta tag-carta-hueco" aria-hidden="true"></span>'

export function tarjetaDeAgendaHtml(t, { sesion = null, ahora = new Date() } = {}) {
  const nombre = t.display_name || t.username || 'Tienda'
  const portada = t.banner_url ? urlParaCss(t.banner_url) : ''
  const logo = t.avatar_url ? urlParaCss(t.avatar_url) : ''
  const cartas = Number(t.cartas) || 0
  const productos = Number(t.productos) || 0
  const tuyas = Number(t.de_tu_lista) || 0
  const enlace = `${profileUrl({ ...t, tipo: 'tienda' })}${tuyas ? '?lista=1' : ''}`
  const estado = chapaDeEstado(t, ahora)
  const fuera = enlacesDeTienda(t)
  const linea = [
    t.ciudad ? `<span>${icons.mapPin(14)}${escapeHtml(t.ciudad)}</span>` : '',
    `<span>${t.con_local ? 'Con local' : 'Online'}</span>`,
    ...fuera.map((f) => `<a href="${escapeHtml(f.href)}" target="_blank" rel="noopener">${escapeHtml(f.texto)}</a>`),
  ].join('')
  const datos = [
    tuyas ? `<span class="tag-chip-dato tag-tuyas">${tuyas === 1 ? '1 de tu lista' : `${tuyas} de tu lista`}</span>` : '',
    cartas ? `<span class="tag-chip-dato">${miles(cartas)} ${cartas === 1 ? 'carta' : 'cartas'}</span>` : '',
    productos ? `<span class="tag-chip-dato">${miles(productos)} ${productos === 1 ? 'producto' : 'productos'}</span>` : '',
  ].join('') || '<span class="tag-chip-dato">Aún sin cartas a la vista</span>'
  const escaparate = (t.destacadas || []).slice(0, 4)
  // «Escribir»: a sus mensajes; sin cuenta, a registrarse y de vuelta. A sí misma, no.
  const destino = `/mensajes.html?with=${encodeURIComponent(t.user_id || '')}`
  const escribir = sesion?.user?.id === t.user_id || !t.user_id ? ''
    : `<a class="btn-secondary" href="${escapeHtml(sesion ? destino : `/auth.html?registro=1&volver=${encodeURIComponent(destino)}`)}">${icons.mail(16)}<span>Escribir</span></a>`
  return `<article class="tag-tarjeta${tuyas ? ' tuya' : ''}" data-tienda-id="${escapeHtml(t.user_id || '')}">
    <a class="tag-portada" href="${escapeHtml(enlace)}" tabindex="-1" aria-hidden="true"${portada ? ` style="background-image:url('${portada}')"` : ''}>${estado ? `<span class="tag-estado${estado.abierta ? ' abierta' : ''}">${estado.abierta ? '<i></i>' : ''}${escapeHtml(estado.texto)}</span>` : ''}</a>
    <span class="tag-logo"${logo ? ` style="background-image:url('${logo}')"` : ''} aria-hidden="true">${logo ? '' : escapeHtml(nombre.slice(0, 1).toUpperCase())}</span>
    <div class="tag-dentro">
      <a class="tag-nombre-enlace" href="${escapeHtml(enlace)}"><strong class="tag-nombre"${ATRIBUTOS_DE_TIENDA}>${escapeHtml(nombre)}</strong></a>
      <p class="tag-linea">${linea}</p>
      <p class="tag-datos">${datos}</p>
      <div class="tag-cartas">${escaparate.map((d) => cartaDeEscaparateHtml(d, t)).join('')}${HUECO.repeat(4 - escaparate.length)}</div>
      <div class="tag-botones"><a class="btn-primary" href="${escapeHtml(enlace)}">Ver escaparate</a>${escribir}</div>
    </div>
  </article>`
}

function recienHtml(r) {
  const c = r.card_id ? est.cartas.get(`${r.market || 'WEST'}|${r.card_id}`) : null
  const p = r.product_id ? est.productos.get(String(r.product_id)) : null
  const nombre = c ? nombreDeCarta(c) : p?.name || r.nombre || ''
  const foto = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : p?.image ? `src="${escapeHtml(p.image)}" onerror="this.remove()"` : null
  const tienda = r.tienda || {}
  return `<a class="tag-nov" href="${escapeHtml(enlaceDeTienda(tienda, r.card_id))}">
    <span class="tag-nov-foto${r.product_id ? ' tag-carta-producto' : ''}">${foto ? `<img ${foto} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
    <b>${escapeHtml(nombre)}</b>
    <small${ATRIBUTOS_DE_TIENDA}>${escapeHtml(tienda.display_name || tienda.username || 'Tienda')}</small>
    ${r.precio != null ? `<em>${escapeHtml(euros(r.precio))}</em>` : ''}
  </a>`
}

// Las fotos: las cartas por catálogo y los productos, de una vez.
async function completar(filas) {
  for (const market of ['WEST', 'JP']) {
    const ids = [...new Set(filas.filter((f) => f.card_id && (f.market || 'WEST') === market && !est.cartas.has(`${market}|${f.card_id}`)).map((f) => f.card_id))]
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await supabase.from('tcg_cards').select(COLUMNAS_CARTA_DE_SET).eq('market', market).in('id', ids.slice(i, i + 150))
      for (const c of data || []) est.cartas.set(`${market}|${c.id}`, c)
    }
  }
  const prod = [...new Set(filas.filter((f) => f.product_id && !est.productos.has(String(f.product_id))).map((f) => f.product_id))]
  if (prod.length) {
    const { data } = await supabase.from('tcg_products').select('id,name,image').in('id', prod)
    for (const p of data || []) est.productos.set(String(p.id), p)
  }
}

async function pedir({ mas = false } = {}) {
  const n = ++est.pedido
  const { data, error } = await supabase.rpc('tiendas_agenda', {
    // Sin acentos, como la columna de buscar de las cartas.
    p_texto: est.texto ? normalizeSearch(est.texto) : null,
    p_ciudad: null,
    p_con_local: false,
    p_de_mi_lista: false,
    p_desde: mas ? est.tiendas.length : 0,
    p_cuantas: TODAS,
  })
  if (n !== est.pedido) return
  if (error || !data) {
    $('tagRejilla').innerHTML = '<p class="tag-vacio">No hemos podido traer las tiendas. <button type="button" class="link-btn" data-tag-otra>Probar otra vez</button></p>'
    return
  }
  est.tiendas = mas ? est.tiendas.concat(data.tiendas || []) : data.tiendas || []
  est.total = Number(data.total) || 0
  if (!mas) est.vistas = A_LA_VISTA
  pintarCifras(data.cifras)
  if (!est.ciudadesPuestas) {
    est.ciudadesPuestas = true
    const ciudades = Object.entries(data.ciudades || {}).sort((a, b) => a[0].localeCompare(b[0], 'es'))
    const sel = $('tagCiudad')
    sel.insertAdjacentHTML('beforeend', ciudades.map(([c, k]) => `<option value="${escapeHtml(c)}">${escapeHtml(c)} (${k})</option>`).join(''))
    sel.hidden = ciudades.length < 2
  }
  // «Abiertas ahora» solo si alguna tiene un horario que se entiende.
  $('tiendasAgenda').querySelector('[data-tag-filtro="abiertas"]').hidden = !est.tiendas.some((t) => chapaDeEstado(t))
  await completar(est.tiendas.flatMap((t) => t.destacadas || []))
  if (n !== est.pedido) return
  pintar()
}

function pintarCifras(c) {
  const caja = $('tagCifras')
  if (!c) return
  caja.innerHTML = [[c.tiendas, c.tiendas === 1 ? 'tienda' : 'tiendas'], [c.ciudades, c.ciudades === 1 ? 'ciudad' : 'ciudades'], [c.cartas, 'cartas a la vista']]
    .map(([n, t]) => `<div><dt>${escapeHtml(t)}</dt><dd>${miles(n)}</dd></div>`).join('')
  caja.hidden = false
}

function hayFiltro() {
  return Boolean(est.texto || est.ciudad || Object.values(est.filtro).some(Boolean))
}

function pintar() {
  const ahora = new Date()
  const opciones = { sesion: est.sesion, ahora }
  const lista = filtrarTiendas(est.tiendas, est.filtro, est.ciudad, ahora)
  // Las de tu lista, en su bloque arriba; solo sin filtros (con filtros, una lista).
  const tuyas = hayFiltro() ? [] : lista.filter((t) => Number(t.de_tu_lista) > 0)
  const resto = tuyas.length ? lista.filter((t) => !(Number(t.de_tu_lista) > 0)) : lista
  $('tagTuyas').hidden = !tuyas.length
  $('tagRejillaTuyas').innerHTML = tuyas.map((t) => tarjetaDeAgendaHtml(t, opciones)).join('')
  $('tagTuyasCuenta').textContent = tuyas.length ? `${tuyas.length} ${tuyas.length === 1 ? 'tienda' : 'tiendas'}` : ''
  $('tagTituloTodas').textContent = tuyas.length ? 'Más tiendas' : hayFiltro() ? 'Las que cumplen' : 'Todas las tiendas'
  const cuantas = hayFiltro() ? lista.length : resto.length + Math.max(0, est.total - est.tiendas.length)
  $('tagCuenta').textContent = cuantas ? `${miles(cuantas)} ${cuantas === 1 ? 'tienda' : 'tiendas'}` : ''
  $('tagRejilla').innerHTML = resto.length
    ? resto.slice(0, est.vistas).map((t) => tarjetaDeAgendaHtml(t, opciones)).join('')
    : tuyas.length ? '' : `<p class="tag-vacio">${hayFiltro() ? 'Ninguna tienda cumple esto. <button type="button" class="link-btn" data-tag-limpiar>Quitar los filtros</button>' : 'Todavía no hay tiendas en PokeDoc. <a href="/para-tiendas">¿Tienes una?</a>'}</p>`
  const mas = $('tagMas')
  const quedan = resto.length - est.vistas + (hayFiltro() ? 0 : Math.max(0, est.total - est.tiendas.length))
  mas.hidden = quedan <= 0
  if (!mas.hidden) mas.textContent = 'Ver más tiendas'
  // «Recién llegado» va con la página sin filtros: con un filtro puesto, a lo que se busca.
  $('tagRecien').hidden = hayFiltro() || !est.recien.length
}

async function pedirRecien(cuantas = RECIEN) {
  const { data, error } = await supabase.rpc('tiendas_recien', { p_cuantas: cuantas })
  // Sin la migración, sin tira (y sin aviso: no hay nada que echar de menos).
  if (error || !Array.isArray(data)) return
  est.recien = data
  est.recienMas = data.length >= cuantas && cuantas < 24
  await completar(data)
  $('tagTira').innerHTML = data.map(recienHtml).join('')
  $('tagRecienMas').hidden = !est.recienMas
  $('tagRecien').hidden = hayFiltro() || !data.length
}

function ponerChips() {
  const todas = !Object.values(est.filtro).some(Boolean)
  for (const b of $('tiendasAgenda').querySelectorAll('[data-tag-filtro]')) {
    const clave = b.dataset.tagFiltro
    b.setAttribute('aria-pressed', String(clave === 'todas' ? todas : Boolean(est.filtro[clave])))
  }
}

export async function montarAgenda() {
  if (!$('tiendasAgenda')) return
  const lupa = $('tiendasAgenda').querySelector('.tag-lupa')
  if (lupa) lupa.innerHTML = icons.search(18)
  const { data } = await supabase.auth.getSession().catch(() => ({ data: null }))
  est.sesion = data?.session || null
  // «De tu lista» solo tiene sentido con cuenta.
  if (est.sesion) $('tiendasAgenda').querySelector('[data-tag-filtro="lista"]')?.removeAttribute('hidden')
  let espera = null
  $('tagBusca').addEventListener('input', (e) => {
    clearTimeout(espera)
    espera = setTimeout(() => {
      est.texto = e.target.value.trim()
      void pedir()
    }, 250)
  })
  $('tagCiudad').addEventListener('change', (e) => {
    est.ciudad = e.target.value
    est.vistas = A_LA_VISTA
    pintar()
  })
  $('tiendasAgenda').addEventListener('click', (e) => {
    const f = e.target.closest('[data-tag-filtro]')
    if (f) {
      const clave = f.dataset.tagFiltro
      if (clave === 'todas') for (const k of Object.keys(est.filtro)) est.filtro[k] = false
      else {
        est.filtro[clave] = !est.filtro[clave]
        // Con local y online no van a la vez: una tienda es una de las dos.
        if (clave === 'local' && est.filtro.local) est.filtro.online = false
        if (clave === 'online' && est.filtro.online) est.filtro.local = false
      }
      ponerChips()
      est.vistas = A_LA_VISTA
      return pintar()
    }
    if (e.target.closest('[data-tag-limpiar]')) {
      for (const k of Object.keys(est.filtro)) est.filtro[k] = false
      est.texto = ''
      est.ciudad = ''
      $('tagBusca').value = ''
      $('tagCiudad').value = ''
      ponerChips()
      return void pedir()
    }
    if (e.target.closest('[data-tag-otra]')) return void pedir()
    if (e.target.closest('#tagMas')) {
      est.vistas += A_LA_VISTA
      if (!hayFiltro() && est.vistas > est.tiendas.length && est.tiendas.length < est.total) return void pedir({ mas: true })
      return pintar()
    }
    if (e.target.closest('#tagRecienMas')) return void pedirRecien(24)
  })
  await Promise.all([pedir(), pedirRecien()])
}
