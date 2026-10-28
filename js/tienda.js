// /tienda: el panel de una tienda (tanda 1067; el stock llega en la 1068).
//
// Cuatro caras según quién lo abre, y quien lo decide es la base (el tipo
// de cuenta no se lo pone nadie a sí mismo):
//   · sin sesión          → entrar con la cuenta de la tienda
//   · una cuenta tienda   → su panel
//   · el equipo           → qué es esto y dónde se aceptan tiendas
//   · cualquier otra      → «Esto aún no está abierto»
import { supabase } from './supabase.js'
import { getSession, getProfile, profileUrl, getInitial, avatarStyle, signOut } from './app.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { caraDelPanel, primerosPasos } from './tiendas-puro.js'

const $ = (id) => document.getElementById(id)
const CARAS = ['tdCargando', 'tdCerrado', 'tdEntrar', 'tdEquipo', 'tdPanel']
const PESTANAS = ['hoy', 'stock', 'ventas', 'escaparate', 'datos']

for (const el of document.querySelectorAll('[data-icono]')) el.innerHTML = icons[el.dataset.icono]?.(28) || ''

function cara(id) {
  for (const c of CARAS) $(c)?.classList.toggle('hidden', c !== id)
}

// El stock (1068) entra por `import()` la primera vez que se abre.
let stockMontado = null
function montarStockSiToca(v) {
  if (v !== 'stock' || stockMontado) return stockMontado
  stockMontado = import('./tienda-stock.js')
    .then((m) => { m.montarStock($('tdStock'), { perfil }); return m })
    .catch(() => { stockMontado = null; $('tdStock').innerHTML = '<p class="subtext">No se ha podido abrir el stock. Recarga la página.</p>' })
  return stockMontado
}

// Hoy (1073), igual: sus cifras.
let hoyMontado = false
function montarHoySiToca(v) {
  if (v !== 'hoy' || hoyMontado) return
  hoyMontado = true
  import('./tienda-hoy.js')
    .then(({ montarHoy }) => montarHoy($('tdHoy')))
    .catch(() => { hoyMontado = false; $('tdHoy').innerHTML = '<p class="subtext">No se han podido traer tus cifras. Recarga la página.</p>' })
}

// Un aviso de Hoy lleva al Stock con su filtro puesto.
function stockFiltrado(clave) {
  pestana('stock')
  Promise.all([stockMontado, import('./tienda-hoy.js')]).then(([m, h]) => m?.filtrarStock(h.FILTROS_DE_AVISO[clave] || {}))
}

// Las ventas (1072), igual: por `import()` la primera vez.
let ventasMontadas = false
function montarVentasSiToca(v) {
  if (v !== 'ventas' || ventasMontadas) return
  ventasMontadas = true
  import('./tienda-ventas.js')
    .then(({ montarVentas }) => montarVentas($('tdVentas'), { perfil }))
    .catch(() => { ventasMontadas = false; $('tdVentas').innerHTML = '<p class="subtext">No se han podido abrir tus ventas. Recarga la página.</p>' })
}

// VENDER (1072): la hoja, desde el botón de arriba, la barra del móvil,
// Ventas o el stock. Al vender, quien pinta stock o ventas se repinta.
function abrirVender(filas = []) {
  import('./tienda-vender.js')
    .then(({ abrirVender }) => abrirVender({ filas, alTerminar: () => document.dispatchEvent(new CustomEvent('pokedoc:tienda-vendida')) }))
    .catch(() => showToast('No se ha podido abrir Vender. Recarga la página.', 'error'))
}
document.addEventListener('pokedoc:tienda-vender', (e) => abrirVender(e.detail || []))

// La lupa de arriba (1071): al Stock, con el cursor en su buscador.
function buscarEnStock() {
  pestana('stock')
  Promise.resolve(stockMontado).then(() => document.querySelector('[data-tds-q]')?.focus())
}

// El escaparate (1069): el QR de su perfil, para el mostrador. Con la
// dirección de pokedoc.es aunque se abra desde otra: el cartel se imprime.
let qrMontado = false
async function montarEscaparateSiToca(v) {
  if (v !== 'escaparate' || qrMontado || !perfil?.username) return
  qrMontado = true
  const url = `https://pokedoc.es/usuario/${encodeURIComponent(perfil.username)}`
  const { svgQR } = await import('./qr.js')
  // El QR lleva `utm_source=qr`: Hoy cuenta aparte las visitas que llegan de él (1073).
  $('tdQr').innerHTML = svgQR(`${url}?utm_source=qr`, { tam: 220 })
  $('tdEnlace').textContent = url.replace('https://', '')
  $('tdCartelNombre').textContent = perfil.display_name || perfil.username
}

function pestana(cual) {
  const v = PESTANAS.includes(cual) ? cual : 'hoy'
  montarStockSiToca(v)
  montarVentasSiToca(v)
  montarHoySiToca(v)
  montarEscaparateSiToca(v).catch(() => {})
  for (const b of document.querySelectorAll('[data-td]')) {
    b.setAttribute('aria-selected', String(b.dataset.td === v))
    b.classList.toggle('activa', b.dataset.td === v)
  }
  for (const h of document.querySelectorAll('[data-td-hoja]')) h.classList.toggle('hidden', h.dataset.tdHoja !== v)
  const url = new URL(location.href)
  if (v === 'hoy') url.searchParams.delete('ver')
  else url.searchParams.set('ver', v)
  url.searchParams.delete('buscar')
  url.searchParams.delete('vender')
  url.searchParams.delete('filtro')
  history.replaceState(null, '', url)
  // Las barras de la tienda (js/tienda-marco.js) marcan la misma.
  document.dispatchEvent(new CustomEvent('pokedoc:tienda-ver', { detail: v }))
}

let tienda = null
let perfil = null

let lineas = 0
// El QR impreso o descargado, en este navegador (1073).
const claveQr = () => `pd-tienda-qr-${perfil?.id}`
const qrHecho = () => { try { return localStorage.getItem(claveQr()) === '1' } catch { return false } }
function apuntarQr() {
  try { localStorage.setItem(claveQr(), '1') } catch {}
  pintarPasos()
}
function pintarPasos() {
  const pasos = primerosPasos(tienda, { lineas, qr: qrHecho() })
  // Hechos todos, sobran (1073): Hoy ya tiene sus cifras.
  $('tdPasosCaja').classList.toggle('hidden', pasos.every((p) => p.hecho))
  $('tdPasos').innerHTML = pasos
    .map((p) => `<li class="${p.hecho ? 'hecho' : ''}">
      <span class="td-paso-marca" aria-hidden="true">${p.hecho ? '&#10003;' : ''}</span>
      <span><strong>${p.texto}</strong>${p.nota ? `<small>${p.nota}</small>` : ''}</span>
      ${p.ir && !p.hecho ? `<button type="button" class="btn-secondary" data-td-ir="${p.ir}">Hacerlo</button>` : ''}
    </li>`)
    .join('')
}

function pintarCabecera() {
  $('tdNombre').textContent = perfil.display_name || perfil.username || 'Tu tienda'
  $('tdDonde').textContent = [tienda?.ciudad, tienda?.direccion].filter(Boolean).join(' · ') || 'Sin dirección todavía'
  const logo = $('tdLogo')
  logo.textContent = getInitial(perfil.display_name || perfil.username || 'T')
  if (perfil.avatar_url) logo.setAttribute('style', avatarStyle(perfil))
  for (const a of [$('tdVerPerfil'), $('tdVerPerfil2')]) if (a) a.href = profileUrl(perfil)
}

function pintarDatos() {
  $('tdDatoNombre').value = perfil.display_name || ''
  $('tdDatoCiudad').value = tienda?.ciudad || ''
  $('tdDatoDireccion').value = tienda?.direccion || ''
  $('tdDatoHorario').value = tienda?.horario || ''
  $('tdDatoWeb').value = tienda?.web || ''
  $('tdDatoPrecio').checked = tienda?.precio_visible !== false
  $('tdCuentaEmail').textContent = correo || ''
}

let correo = ''

async function arrancar() {
  const sesion = await getSession()
  perfil = sesion ? await getProfile(sesion.user.id) : null
  correo = sesion?.user?.email || ''
  const toca = caraDelPanel({ sesion, perfil })
  if (toca !== 'tdPanel') return cara(toca)

  const { data } = await supabase.from('tiendas').select('*').eq('user_id', sesion.user.id).maybeSingle()
  tienda = data || null
  // Cuántas líneas tiene el stock, para el paso de «Meter tu stock». Sin la
  // migración 1068 la tabla no existe: se queda en cero, que es la verdad.
  const { count } = await supabase.from('tienda_stock').select('id', { count: 'exact', head: true }).then((r) => r, () => ({}))
  lineas = count || 0
  pintarCabecera()
  pintarPasos()
  pintarDatos()
  cara('tdPanel')
  const params = new URLSearchParams(location.search)
  if (params.has('buscar')) buscarEnStock()
  else if (params.get('ver') === 'stock' && params.get('filtro')) stockFiltrado(params.get('filtro'))
  else pestana(params.get('ver'))
  if (params.has('vender')) abrirVender()
}

// Las secciones de las barras y de la hoja «Tú» llevan `data-ver`: dentro del
// panel cambian de pestaña sin recargar (1071).
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-ver]')
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return
  if ($('tdPanel')?.classList.contains('hidden')) return
  if (new URL(a.href, location.href).pathname.replace(/\.html$/, '') !== '/tienda') return
  e.preventDefault()
  $('navUserDropdown')?.classList.add('hidden')
  if (a.dataset.ver === 'vender') return abrirVender()
  if (a.dataset.filtro) stockFiltrado(a.dataset.filtro)
  else if (a.hasAttribute('data-buscar')) buscarEnStock()
  else pestana(a.dataset.ver)
  window.scrollTo({ top: 0 })
})

$('tdPestanas')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-td]')
  if (b) pestana(b.dataset.td)
})
$('tdPasos')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-td-ir]')
  if (b) pestana(b.dataset.tdIr)
})

$('tdCopiar')?.addEventListener('click', () => {
  const url = `https://${$('tdEnlace').textContent}`
  navigator.clipboard?.writeText(url).then(() => showToast('Enlace copiado.', 'success'), () => showToast(url))
})
// Imprimir solo el cartel: la clase la lee la hoja de impresión de tienda.css.
$('tdImprimir')?.addEventListener('click', () => {
  document.documentElement.classList.add('td-imprimiendo')
  apuntarQr()
  window.print()
  setTimeout(() => document.documentElement.classList.remove('td-imprimiendo'), 500)
})
$('tdBajarQr')?.addEventListener('click', () => {
  const svg = $('tdQr').innerHTML
  if (!svg) return
  apuntarQr()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  a.download = `qr-${perfil.username}.svg`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
})

// Guardar los datos: cambia ya, confirma después y deshace si falla (896).
$('tdDatos')?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const error = $('tdDatosError')
  error.textContent = ''
  const nombre = $('tdDatoNombre').value.trim()
  if (nombre.length < 2) {
    error.textContent = 'Escribe el nombre de la tienda.'
    return
  }
  const antes = { tienda: { ...tienda }, nombre: perfil.display_name }
  const nuevos = {
    ciudad: $('tdDatoCiudad').value.trim() || null,
    direccion: $('tdDatoDireccion').value.trim() || null,
    horario: $('tdDatoHorario').value.trim() || null,
    web: $('tdDatoWeb').value.trim() || null,
    precio_visible: $('tdDatoPrecio').checked,
    updated_at: new Date().toISOString(),
  }
  tienda = { ...tienda, ...nuevos }
  perfil.display_name = nombre
  pintarCabecera()
  pintarPasos()
  const boton = $('tdDatosGuardar')
  boton.disabled = true
  const [r1, r2] = await Promise.all([
    supabase.from('tiendas').update(nuevos).eq('user_id', perfil.id).select('user_id'),
    antes.nombre === nombre ? { error: null } : supabase.from('user_profiles').update({ display_name: nombre }).eq('id', perfil.id),
  ])
  boton.disabled = false
  // Un update que la política no deja pasar no da error: vuelve vacío (510).
  const fallo = r1.error || r2.error || !(r1.data && r1.data.length)
  if (fallo) {
    tienda = antes.tienda
    perfil.display_name = antes.nombre
    pintarCabecera()
    pintarPasos()
    pintarDatos()
    error.textContent = 'No se ha podido guardar. Inténtalo de nuevo.'
    return
  }
  getProfile(perfil.id, { fresco: true }).catch(() => {})
  showToast('Guardado.', 'success')
})

// La cuenta (1071): una tienda no tiene /ajustes, así que la contraseña se
// cambia desde aquí, con el enlace por correo de siempre.
$('tdCuentaClave')?.addEventListener('click', async (e) => {
  const boton = e.currentTarget
  boton.disabled = true
  const { error } = await supabase.auth.resetPasswordForEmail(correo, { redirectTo: `${location.origin}/reset-password.html` })
  boton.disabled = false
  showToast(error ? 'No se ha podido mandar el correo. Inténtalo en unos minutos.' : `Te hemos mandado un enlace a ${correo} para cambiarla.`, error ? 'error' : 'success')
})
$('tdCuentaSalir')?.addEventListener('click', () => signOut())

arrancar().catch(() => cara('tdCerrado'))
