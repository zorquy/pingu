// «Hoy», la entrada de /admin (tanda 1119, PINGU: «el dashboard es una
// mierda»). Lo que tiene a alguien esperando, con su número en el menú; si
// las pasadas automáticas van bien; la frase de la semana (la misma del
// lunes, `js/analitica-frase.js`) y los errores de las últimas 24 horas.
// Nada de cifras de adorno: eso está en Analítica.
import { supabase } from '../../js/supabase.js'
import { escapeHtml } from '../../js/app.js'
import { PASADAS, semaforoDe } from './semaforo.js'
import { trozosDeResumen } from '../../js/analitica-frase.js'

const DIA_MS = 24 * 60 * 60 * 1000

// Lo que espera a alguien: la sección a la que lleva, la tabla, el filtro de
// «pendiente» y la columna con la fecha (la más vieja dice si urge).
export const ESPERAS = [
  { seccion: 'pending', tabla: 'guides', campo: 'review_status', valor: 'pending', fecha: 'submitted_at', uno: 'guía por revisar', varios: 'guías por revisar' },
  { seccion: 'reports', tabla: 'content_reports', campo: 'status', valor: 'pending', fecha: 'created_at', uno: 'reporte', varios: 'reportes' },
  { seccion: 'tiendas', tabla: 'tienda_solicitudes', campo: 'estado', valor: 'pendiente', fecha: 'created_at', uno: 'tienda que quiere entrar', varios: 'tiendas que quieren entrar' },
  { seccion: 'colabora', tabla: 'collab_applications', campo: 'status', valor: 'nueva', fecha: 'created_at', uno: 'persona en Colabora', varios: 'personas en Colabora' },
  { seccion: 'feedback', tabla: 'app_feedback', campo: 'status', valor: 'new', fecha: 'created_at', uno: 'sugerencia', varios: 'sugerencias' },
  { seccion: 'account-deletions', tabla: 'account_deletion_requests', campo: 'status', valor: 'pending', fecha: 'created_at', uno: 'baja pendiente', varios: 'bajas pendientes' },
]

// «Hace 3 días», para la más vieja de cada tarjeta.
export function haceCuanto(fecha, ahora = new Date()) {
  if (!fecha) return ''
  const ms = ahora - new Date(fecha)
  if (!(ms >= 0)) return ''
  const h = Math.floor(ms / 3600000)
  if (h < 1) return 'hace un rato'
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'hace un día' : `hace ${d} días`
}

// Una tarjeta. `n` null es «no se ha podido leer» (falta la tabla o el
// permiso), que no es lo mismo que cero (la regla de la 510).
export function tarjetaHtml(e, n, masVieja, ahora = new Date()) {
  if (n == null) return `<button type="button" class="hoy-tar sin-dato" data-ir="${e.seccion}"><b>—</b><span>${escapeHtml(e.varios)}</span><small>no se ha podido leer</small></button>`
  const urge = n > 0 && masVieja && ahora - new Date(masVieja) > DIA_MS
  const cuando = n > 0 ? haceCuanto(masVieja, ahora) : ''
  return `<button type="button" class="hoy-tar${n ? '' : ' cero'}${urge ? ' urge' : ''}" data-ir="${e.seccion}"><b>${n}</b><span>${escapeHtml(n === 1 ? e.uno : e.varios)}</span>${cuando ? `<small>${n === 1 ? '' : 'la más vieja, '}${escapeHtml(cuando)}</small>` : ''}</button>`
}

// Las pasadas: lo que va bien se cuenta; lo que no, se enseña.
export function semaforoHtml(filas, ahora = new Date()) {
  const de = (k) => (filas || []).find((f) => f.clave === k)
  const todas = PASADAS.map(([k, nombre]) => ({ k, nombre, ...semaforoDe(de(k), ahora) }))
  const mal = todas.filter((p) => p.luz === 'rojo' || p.luz === 'ambar')
  const bien = todas.filter((p) => p.luz === 'verde').length
  const nunca = todas.filter((p) => p.luz === 'gris').length
  const luz = (p) => `<div class="semaforo-pasada" data-luz="${p.luz}"><span class="semaforo-luz" aria-hidden="true"></span><strong>${escapeHtml(p.nombre)}</strong><small>${escapeHtml(p.motivo)}</small></div>`
  const resumen = [`${bien} al día`, mal.length ? `${mal.length} para mirar` : '', nunca ? `${nunca} sin correr nunca` : ''].filter(Boolean).join(' · ')
  return `<p class="hoy-sem-resumen" data-luz="${mal.some((p) => p.luz === 'rojo') ? 'rojo' : mal.length ? 'ambar' : 'verde'}"><span class="semaforo-luz" aria-hidden="true"></span>${escapeHtml(resumen)}</p>
    ${mal.length ? `<div class="semaforo">${mal.map(luz).join('')}</div>` : ''}
    <details class="hoy-sem-todas"><summary>Ver las ${todas.length}</summary><div class="semaforo">${todas.map(luz).join('')}</div></details>`
}

export function fraseHtml(r) {
  const trozos = trozosDeResumen(r)
  if (!trozos.length) return '<p class="admin-note">Todavía no hay nada que contar.</p>'
  return `<p class="hoy-frase">${trozos.map((t) => (t.tono ? `<span class="an-frase-${t.tono}">${escapeHtml(t.texto)}</span>` : escapeHtml(t.texto))).join('')}</p>`
}

export function erroresHtml(nuevos, enUnDia, ultimo) {
  if (enUnDia == null) return '<p class="admin-note">No se han podido leer los errores.</p>'
  if (!enUnDia) return `<p class="hoy-frase"><strong>Ninguno</strong> en las últimas 24 horas.${nuevos ? ` Quedan ${nuevos} sin mirar de antes.` : ''}</p>`
  let donde = ''
  try {
    donde = ultimo?.page_url ? new URL(ultimo.page_url, location.origin).pathname : ''
  } catch {}
  return `<p class="hoy-frase"><strong>${enUnDia}</strong> ${enUnDia === 1 ? 'nuevo' : 'nuevos'}${donde ? ` · el último en <code>${escapeHtml(donde)}</code>` : ''}${nuevos ? ` · ${nuevos} sin mirar en total` : ''}.</p>`
}

async function contar(e) {
  const [{ count, error }, { data: vieja }] = await Promise.all([
    supabase.from(e.tabla).select('*', { count: 'exact', head: true }).eq(e.campo, e.valor),
    supabase.from(e.tabla).select(e.fecha).eq(e.campo, e.valor).order(e.fecha, { ascending: true }).limit(1),
  ])
  return { n: error ? null : count || 0, masVieja: vieja?.[0]?.[e.fecha] || null }
}

// El número de cada sección en el menú. Lo ponen también las secciones al
// cargarse (con lo que ellas leen); aquí sale antes, y para las que no lo
// ponían (Tiendas, Colabora).
export function ponerContadorNav(seccion, n) {
  const boton = document.querySelector(`.admin-nav-item[data-section="${seccion}"]`)
  if (!boton) return
  boton.querySelector('.admin-nav-contador')?.remove()
  if (n > 0) boton.insertAdjacentHTML('beforeend', `<span class="admin-nav-contador">${n}</span>`)
}

export async function montarHoy({ nombre = '' } = {}) {
  const raiz = document.getElementById('section-dashboard')
  if (!raiz) return
  const hoy = new Date()
  const saludo = raiz.querySelector('#hoySaludo')
  if (saludo) saludo.textContent = nombre ? `Hola, ${nombre}` : 'Hoy'
  const fecha = raiz.querySelector('#hoyFecha')
  if (fecha) fecha.textContent = hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  raiz.addEventListener('click', (ev) => {
    const ir = ev.target.closest('[data-ir]')
    if (ir) document.querySelector(`.admin-nav-item[data-section="${ir.dataset.ir}"]`)?.click()
  })

  const tarjetas = raiz.querySelector('#hoyTarjetas')
  const esperas = Promise.all(ESPERAS.map((e) => contar(e).catch(() => ({ n: null })))).then((cuentas) => {
    ESPERAS.forEach((e, i) => ponerContadorNav(e.seccion, cuentas[i].n || 0))
    // Lo que espera, delante; lo que está a cero, detrás.
    const orden = ESPERAS.map((e, i) => [e, cuentas[i]]).sort((a, b) => (b[1].n > 0) - (a[1].n > 0))
    if (tarjetas) tarjetas.innerHTML = orden.map(([e, c]) => tarjetaHtml(e, c.n, c.masVieja, hoy)).join('')
  })

  const sem = raiz.querySelector('#hoySemaforo')
  const semaforo = supabase.from('scrydex_estado').select('clave,valor,updated_at').in('clave', PASADAS.map(([k]) => k)).then(({ data, error }) => {
    if (sem) sem.innerHTML = error ? `<p class="admin-note">No se ha podido leer el estado: ${escapeHtml(error.message)}</p>` : semaforoHtml(data, hoy)
  })

  const semana = raiz.querySelector('#hoySemana')
  const resumen = supabase.rpc('admin_analitica_resumen', { p_dias: 7 }).then(({ data, error }) => {
    if (!semana) return
    semana.innerHTML = error
      ? `<p class="admin-note">${/PGRST202|Could not find the function/i.test(`${error.code} ${error.message}`) ? 'Falta ejecutar <code>supabase-migration-1065-analitica-app.sql</code>.' : `No se ha podido leer: ${escapeHtml(error.message)}`}</p>`
      : fraseHtml(data)
  })

  const errores = raiz.querySelector('#hoyErrores')
  const desde = new Date(hoy - DIA_MS).toISOString()
  const errs = Promise.all([
    supabase.from('client_errors').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('client_errors').select('*', { count: 'exact', head: true }).gte('created_at', desde),
    supabase.from('client_errors').select('page_url, created_at').gte('created_at', desde).order('created_at', { ascending: false }).limit(1),
  ]).then(([nuevos, enUnDia, ultimo]) => {
    ponerContadorNav('errors', nuevos.count || 0)
    if (errores) errores.innerHTML = erroresHtml(nuevos.error ? 0 : nuevos.count || 0, enUnDia.error ? null : enUnDia.count || 0, ultimo.data?.[0])
  })

  await Promise.all([esperas, semaforo, resumen, errs].map((p) => p.catch(() => {})))
}
