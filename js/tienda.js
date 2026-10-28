// /tienda: el panel de una tienda (tanda 1067; el stock llega en la 1068).
//
// Cuatro caras según quién lo abre, y quien lo decide es la base (el tipo
// de cuenta no se lo pone nadie a sí mismo):
//   · sin sesión          → entrar con la cuenta de la tienda
//   · una cuenta tienda   → su panel
//   · el equipo           → qué es esto y dónde se aceptan tiendas
//   · cualquier otra      → «Esto aún no está abierto»
import { supabase } from './supabase.js'
import { getSession, getProfile, profileUrl, getInitial, avatarStyle } from './app.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { caraDelPanel, primerosPasos } from './tiendas-puro.js'

const $ = (id) => document.getElementById(id)
const CARAS = ['tdCargando', 'tdCerrado', 'tdEntrar', 'tdEquipo', 'tdPanel']
const PESTANAS = ['hoy', 'stock', 'escaparate', 'datos']

for (const el of document.querySelectorAll('[data-icono]')) el.innerHTML = icons[el.dataset.icono]?.(28) || ''

function cara(id) {
  for (const c of CARAS) $(c)?.classList.toggle('hidden', c !== id)
}

// El stock (1068) entra por `import()` la primera vez que se abre.
let stockMontado = false
function montarStockSiToca(v) {
  if (v !== 'stock' || stockMontado) return
  stockMontado = true
  import('./tienda-stock.js')
    .then(({ montarStock }) => montarStock($('tdStock'), { perfil }))
    .catch(() => { stockMontado = false; $('tdStock').innerHTML = '<p class="subtext">No se ha podido abrir el stock. Recarga la página.</p>' })
}

function pestana(cual) {
  const v = PESTANAS.includes(cual) ? cual : 'hoy'
  montarStockSiToca(v)
  for (const b of document.querySelectorAll('[data-td]')) {
    b.setAttribute('aria-selected', String(b.dataset.td === v))
    b.classList.toggle('activa', b.dataset.td === v)
  }
  for (const h of document.querySelectorAll('[data-td-hoja]')) h.classList.toggle('hidden', h.dataset.tdHoja !== v)
  const url = new URL(location.href)
  if (v === 'hoy') url.searchParams.delete('ver')
  else url.searchParams.set('ver', v)
  history.replaceState(null, '', url)
}

let tienda = null
let perfil = null

let lineas = 0
function pintarPasos() {
  $('tdPasos').innerHTML = primerosPasos(tienda, { lineas })
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
}

async function arrancar() {
  const sesion = await getSession()
  perfil = sesion ? await getProfile(sesion.user.id) : null
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
  pestana(new URLSearchParams(location.search).get('ver'))
}

$('tdPestanas')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-td]')
  if (b) pestana(b.dataset.td)
})
$('tdPasos')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-td-ir]')
  if (b) pestana(b.dataset.tdIr)
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

arrancar().catch(() => cara('tdCerrado'))
