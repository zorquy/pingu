// /tienda: el panel de una tienda (tanda 1067; el stock llega en la 1068).
//
// Cuatro caras según quién lo abre, y quien lo decide es la base (el tipo
// de cuenta no se lo pone nadie a sí mismo):
//   · sin sesión          → entrar con la cuenta de la tienda
//   · una cuenta tienda   → su panel
//   · el equipo           → qué es esto y dónde se aceptan tiendas
//   · cualquier otra      → «Esto aún no está abierto»
import { supabase } from './supabase.js'
import { getSession, getProfile, profileUrl, getInitial, avatarStyle, signOut, uploadProfileImage } from './app.js'
import { urlParaCss } from './html.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { caraDelPanel, instagramDe } from './tiendas-puro.js'

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

// El Panel (1073; «Hoy» hasta la 1074), igual: sus cifras.
let hoyMontado = false
function montarHoySiToca(v) {
  if (v !== 'hoy' || hoyMontado) return
  hoyMontado = true
  import('./tienda-hoy.js')
    .then(({ montarHoy }) => montarHoy($('tdHoy')))
    .catch(() => { hoyMontado = false; $('tdHoy').innerHTML = '<p class="subtext">No se han podido traer tus cifras. Recarga la página.</p>' })
}

// Un aviso del Panel lleva al Stock con su filtro puesto.
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
  // El QR lleva `utm_source=qr`: el Panel cuenta aparte las visitas que llegan de él (1073).
  $('tdQr').innerHTML = svgQR(`${url}?utm_source=qr`, { tam: 220 })
  $('tdEnlace').textContent = url.replace('https://', '')
  for (const b of document.querySelectorAll('[data-icono-esc]')) if (!b.querySelector('svg')) b.insertAdjacentHTML('afterbegin', icons[b.dataset.iconoEsc]?.(20) || '')
  $('tdCartelNombre').textContent = perfil.display_name || perfil.username
  // Y debajo, el escaparate de verdad (1078): lo mismo que ve la gente.
  const sesion = await getSession()
  import('./perfil-tienda.js')
    .then((m) => m.montarPerfilTienda($('tdEscaparatePrevia'), perfil, sesion, { previa: true }))
    .catch(() => { $('tdEscaparatePrevia').innerHTML = '<p class="subtext">No se ha podido enseñar tu escaparate. Ábrelo con «Abrirlo como lo ve la gente».</p>' })
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
  // La cabecera solo en el Panel (1078): la pinta el CSS con esto.
  $('tdPanel').dataset.tab = v
  // Y en <html>, para lo de fuera del panel (la lupa de arriba, 1086).
  document.documentElement.dataset.tdVer = v
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

function pintarCabecera() {
  $('tdNombre').textContent = perfil.display_name || perfil.username || 'Tu tienda'
  const hora = new Date().getHours()
  $('tdSaludo').textContent = hora < 6 ? 'Buenas noches' : hora < 13 ? 'Buenos días' : hora < 21 ? 'Buenas tardes' : 'Buenas noches'
  // Sin local no hay dirección, y no falta nada (1074, PINGU: «no hace falta
  // que sea una tienda física»): entonces, su @.
  $('tdDonde').textContent = [tienda?.ciudad, tienda?.direccion].filter(Boolean).join(' · ') || (perfil.username ? `@${perfil.username}` : '')
  for (const logo of [$('tdLogo'), $('tdLogoDatos')]) {
    if (!logo) continue
    logo.textContent = perfil.avatar_url ? '' : getInitial(perfil.display_name || perfil.username || 'T')
    logo.setAttribute('style', avatarStyle(perfil))
  }
  pintarPortada()
  const ojo = document.querySelector('[data-icono-eye]')
  if (ojo && !ojo.innerHTML) ojo.innerHTML = icons.eye(18)
  if ($('tdVerPerfil2')) $('tdVerPerfil2').href = profileUrl(perfil)
}

function pintarPortada() {
  const caja = $('tdPortada')
  if (!caja) return
  const url = urlParaCss(perfil.banner_url)
  caja.style.backgroundImage = url ? `url('${url}')` : ''
  caja.classList.toggle('td-portada-vacia', !url)
  $('tdCambiarPortada').textContent = url ? 'Cambiar la portada' : 'Poner una portada'
  $('tdQuitarPortada').classList.toggle('hidden', !url)
}

function pintarDatos() {
  $('tdDatoNombre').value = perfil.display_name || ''
  $('tdDatoCiudad').value = tienda?.ciudad || ''
  $('tdDatoDireccion').value = tienda?.direccion || ''
  $('tdDatoHorario').value = tienda?.horario || ''
  // Lo que se escribió antes de la 1074 en «Web o Instagram» se reparte: un
  // @ o un enlace de Instagram es su Instagram.
  // Sin la migración 1074 la fila no trae `instagram`: el campo no se ofrece
  // (guardarlo fallaría entero, 42703) y la web se queda como estaba.
  const conIg = Boolean(tienda) && 'instagram' in tienda
  const ig = conIg ? tienda.instagram || instagramDe(tienda.web) : null
  $('tdDatoWeb').value = conIg && instagramDe(tienda.web) ? '' : tienda?.web || ''
  $('tdDatoInstagram').value = ig ? `@${ig}` : ''
  $('tdDatoInstagram').closest('label').classList.toggle('hidden', Boolean(tienda) && !conIg)
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
  pintarCabecera()
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

// Compartir el enlace (1088): la hoja del sistema; sin ella, se copia.
$('tdCompartir')?.addEventListener('click', async () => {
  const url = `https://${$('tdEnlace').textContent}`
  if (navigator.share) {
    try { await navigator.share({ title: perfil?.display_name || 'Mi tienda en PokeDoc', url }) } catch {}
    return
  }
  navigator.clipboard?.writeText(url).then(() => showToast('Enlace copiado.', 'success'), () => showToast(url))
})
$('tdCopiar')?.addEventListener('click', () => {
  const url = `https://${$('tdEnlace').textContent}`
  navigator.clipboard?.writeText(url).then(() => showToast('Enlace copiado.', 'success'), () => showToast(url))
})
// Imprimir solo el cartel: la clase la lee la hoja de impresión de tienda.css.
$('tdImprimir')?.addEventListener('click', () => {
  document.documentElement.classList.add('td-imprimiendo')
  window.print()
  setTimeout(() => document.documentElement.classList.remove('td-imprimiendo'), 500)
})
$('tdBajarQr')?.addEventListener('click', () => {
  const svg = $('tdQr').innerHTML
  if (!svg) return
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
  if (tienda && 'instagram' in tienda) {
    const escrito = $('tdDatoInstagram').value.trim()
    const ig = instagramDe(/^@|instagram\.com/i.test(escrito) ? escrito : `@${escrito}`)
    if (escrito && !ig) {
      error.textContent = 'Ese Instagram no parece un usuario: escribe solo tu @.'
      return
    }
    nuevos.instagram = ig
    // Lo que era Instagram en «Web» (antes de la 1074) ya no va ahí.
    if (instagramDe(nuevos.web)) nuevos.web = null
  }
  tienda = { ...tienda, ...nuevos }
  perfil.display_name = nombre
  pintarCabecera()
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
    pintarDatos()
    error.textContent = 'No se ha podido guardar. Inténtalo de nuevo.'
    return
  }
  getProfile(perfil.id, { fresco: true }).catch(() => {})
  showToast('Guardado.', 'success')
})

// El logo y la portada (1079): se comprimen en el navegador (la 891: una foto
// de móvil son megas), suben como las de una persona y se pintan ya; si la
// base no lo guarda, vuelve lo de antes.
async function subirImagen(fichero, tipo) {
  if (!fichero) return
  const campo = tipo === 'avatar' ? 'avatar_url' : 'banner_url'
  const antes = perfil[campo]
  const local = URL.createObjectURL(fichero)
  perfil[campo] = local
  pintarCabecera()
  try {
    const { comprimirImagen, extensionDe } = await import('./imagen-comprimir.js')
    const { blob, tipo: mime } = await comprimirImagen(fichero, { ladoMax: tipo === 'avatar' ? 512 : 1600 })
    const archivo = new File([blob], `${tipo}.${extensionDe(mime)}`, { type: mime })
    const url = await uploadProfileImage(perfil.id, archivo, tipo)
    const { data, error } = await supabase.from('user_profiles').update({ [campo]: url }).eq('id', perfil.id).select(campo)
    if (error || !data?.length) throw error || new Error('sin fila')
    perfil[campo] = data[0][campo]
    pintarCabecera()
    getProfile(perfil.id, { fresco: true }).catch(() => {})
    showToast(tipo === 'avatar' ? 'Logo cambiado.' : 'Portada puesta.', 'success')
  } catch (e) {
    perfil[campo] = antes
    pintarCabecera()
    showToast(e?.message?.includes('imagen') ? e.message : 'No se ha podido subir. Prueba con otra imagen.', 'error')
  } finally {
    URL.revokeObjectURL(local)
  }
}
$('tdCambiarLogo')?.addEventListener('click', () => $('tdLogoFichero').click())
$('tdCambiarPortada')?.addEventListener('click', () => $('tdPortadaFichero').click())
$('tdLogoFichero')?.addEventListener('change', (e) => { subirImagen(e.target.files?.[0], 'avatar'); e.target.value = '' })
$('tdPortadaFichero')?.addEventListener('change', (e) => { subirImagen(e.target.files?.[0], 'banner'); e.target.value = '' })
$('tdQuitarPortada')?.addEventListener('click', async () => {
  const antes = perfil.banner_url
  perfil.banner_url = null
  pintarCabecera()
  const { data, error } = await supabase.from('user_profiles').update({ banner_url: null }).eq('id', perfil.id).select('id')
  if (error || !data?.length) {
    perfil.banner_url = antes
    pintarCabecera()
    return showToast('No se ha podido quitar.', 'error')
  }
  getProfile(perfil.id, { fresco: true }).catch(() => {})
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
