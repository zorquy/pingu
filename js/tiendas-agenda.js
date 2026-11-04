// La agenda de tiendas, arriba de /tiendas (tanda 1236). PINGU: «que tú
// vayas a una tienda desde aquí para entrar a su perfil, una agenda de
// tiendas». Cada tienda con su portada, su logo, su ciudad, cuántas cartas
// enseña y cuántas de tu lista tiene (las de tu lista primero). Lo cuenta la
// base (`tiendas_agenda`, migración 1236); sin ella, la agenda se esconde y
// la página es la de pedir acceso, como antes.
import { supabase } from './supabase.js'
import { escapeHtml, urlParaCss } from './html.js'
import { profileUrl } from './app.js'

const POR_PAGINA = 24
const $ = (id) => document.getElementById(id)
// Con el punto también en 1.240, como la banda del Mercado (`useGrouping`).
const miles = (n) => Number(n || 0).toLocaleString('es-ES', { useGrouping: 'always' })
const est = { texto: '', ciudad: '', local: false, lista: false, tiendas: [], total: 0, pedido: 0, ciudadesPuestas: false }

// Una tienda en la agenda. Pura, para la prueba.
export function tarjetaDeAgendaHtml(t) {
  const nombre = t.display_name || t.username || 'Tienda'
  const portada = t.banner_url ? urlParaCss(t.banner_url) : ''
  const logo = t.avatar_url ? urlParaCss(t.avatar_url) : ''
  const cartas = Number(t.cartas) || 0
  const productos = Number(t.productos) || 0
  const tuyas = Number(t.de_tu_lista) || 0
  const lo = [cartas ? `${miles(cartas)} ${cartas === 1 ? 'carta' : 'cartas'}` : '', productos ? `${miles(productos)} ${productos === 1 ? 'producto' : 'productos'}` : ''].filter(Boolean).join(' · ')
  const donde = [t.ciudad, t.con_local ? 'Con local' : null].filter(Boolean).join(' · ')
  const enlace = `${profileUrl(t)}${tuyas ? '?lista=1' : ''}`
  return `<a class="tag-tarjeta" href="${escapeHtml(enlace)}">
    <span class="tag-portada"${portada ? ` style="background-image:url('${portada}')"` : ''}></span>
    <span class="tag-dentro">
      <span class="tag-logo"${logo ? ` style="background-image:url('${logo}')"` : ''}>${logo ? '' : escapeHtml(nombre.slice(0, 1).toUpperCase())}</span>
      <strong class="tag-nombre">${escapeHtml(nombre)}</strong>
      ${donde ? `<small class="tag-donde">${escapeHtml(donde)}</small>` : ''}
      <span class="tag-cuentas">${lo ? `<span class="tag-chip-dato">${escapeHtml(lo)}</span>` : '<span class="tag-chip-dato">Aún sin cartas a la vista</span>'}${tuyas ? `<span class="tag-chip-dato tag-tuyas">${tuyas === 1 ? '1 de tu lista' : `${tuyas} de tu lista`}</span>` : ''}</span>
    </span>
  </a>`
}

async function pedir({ mas = false } = {}) {
  const n = ++est.pedido
  const { data, error } = await supabase.rpc('tiendas_agenda', {
    p_texto: est.texto || null,
    p_ciudad: est.ciudad || null,
    p_con_local: est.local,
    p_de_mi_lista: est.lista,
    p_desde: mas ? est.tiendas.length : 0,
    p_cuantas: POR_PAGINA,
  })
  if (n !== est.pedido) return
  // Sin la migración (o sin respuesta), nada de agenda: no es «no hay tiendas».
  if (error || !data) {
    $('tiendasAgenda')?.setAttribute('hidden', '')
    $('tagLema')?.setAttribute('hidden', '')
    return
  }
  est.tiendas = mas ? est.tiendas.concat(data.tiendas || []) : data.tiendas || []
  est.total = Number(data.total) || 0
  if (!est.ciudadesPuestas) {
    est.ciudadesPuestas = true
    const ciudades = Object.entries(data.ciudades || {}).sort((a, b) => a[0].localeCompare(b[0], 'es'))
    const sel = $('tagCiudad')
    if (sel) {
      sel.insertAdjacentHTML('beforeend', ciudades.map(([c, k]) => `<option value="${escapeHtml(c)}">${escapeHtml(c)} (${k})</option>`).join(''))
      sel.hidden = ciudades.length < 2
    }
  }
  pintar()
}

function pintar() {
  const rejilla = $('tagRejilla')
  const filtrado = est.texto || est.ciudad || est.local || est.lista
  $('tagCuenta').textContent = est.total ? `${miles(est.total)} ${est.total === 1 ? 'tienda' : 'tiendas'}` : ''
  rejilla.innerHTML = est.tiendas.length
    ? est.tiendas.map(tarjetaDeAgendaHtml).join('')
    : `<p class="tag-vacio">${filtrado ? 'Ninguna tienda cumple esto. <button type="button" class="link-btn" data-tag-limpiar>Quitar los filtros</button>' : 'Todavía no hay tiendas en PokeDoc. Si tienes una, pide tu cuenta aquí abajo.'}</p>`
  const mas = $('tagMas')
  mas.hidden = est.tiendas.length >= est.total
  if (!mas.hidden) mas.textContent = `Ver ${Math.min(POR_PAGINA, est.total - est.tiendas.length)} tiendas más`
}

export async function montarAgenda() {
  if (!$('tiendasAgenda')) return
  // «De tu lista» solo tiene sentido con cuenta.
  const { data } = await supabase.auth.getSession().catch(() => ({ data: null }))
  if (data?.session) $('tiendasAgenda').querySelector('[data-tag-filtro="lista"]')?.removeAttribute('hidden')
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
    void pedir()
  })
  $('tiendasAgenda').addEventListener('click', (e) => {
    const f = e.target.closest('[data-tag-filtro]')
    if (f) {
      const clave = f.dataset.tagFiltro
      est[clave] = !est[clave]
      f.setAttribute('aria-pressed', String(est[clave]))
      return void pedir()
    }
    if (e.target.closest('[data-tag-limpiar]')) {
      Object.assign(est, { texto: '', ciudad: '', local: false, lista: false })
      $('tagBusca').value = ''
      $('tagCiudad').value = ''
      $('tiendasAgenda').querySelectorAll('[data-tag-filtro]').forEach((b) => b.setAttribute('aria-pressed', 'false'))
      return void pedir()
    }
    if (e.target.closest('#tagMas')) return void pedir({ mas: true })
  })
  await pedir()
}
