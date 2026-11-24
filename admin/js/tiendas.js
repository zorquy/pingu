// /admin → Tiendas (tanda 1067): las solicitudes de /tiendas. Y debajo (1245),
// las cuentas de tienda con su «De pruebas» (`admin_tienda_de_pruebas`). Y
// desde la 1429, los PLANES de cada una (`admin_tienda_plan`) y el cartel
// para dejar en las mesas de las tiendas en una feria.
//
// «Aceptar» y «Rechazar» van por la función de Netlify `tienda-decidir`,
// que decide en la base (`tienda_decidir`, solo el equipo) y manda el
// correo. Si el correo no sale, se dice por qué y se enseña el enlace para
// mandarlo a mano: la solicitud ya está decidida igual.
import { supabase } from '../../js/supabase.js'
import { escapeHtml, getSession } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { cuentaDeSolicitudes, invitacionCaducada as caducada } from '../../js/tiendas-puro.js'
import { PLANES, estadoDelPlan, nombreDePlan, precioTexto, fechaLarga } from '../../js/tienda-plan-puro.js'

const $ = (id) => document.getElementById(id)
const TAMANOS = { poca: 'menos de 1.000 cartas', media: 'entre 1.000 y 10.000 cartas', mucha: 'más de 10.000 cartas' }
let filas = []
let viendo = 'pendiente'
let iniciado = false

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function tarjeta(f) {
  const datos = [f.ciudad || 'sin local', f.email, f.web, f.instagram && `@${f.instagram}`, TAMANOS[f.tamano]].filter(Boolean).map(escapeHtml).join(' · ')
  const estado = {
    pendiente: `Pidió acceso el ${fecha(f.created_at)}`,
    aceptada: caducada(f) ? `Aceptada el ${fecha(f.decidida_el)} · la invitación caducó el ${fecha(f.caduca)}` : `Aceptada el ${fecha(f.decidida_el)} · la invitación vale hasta el ${fecha(f.caduca)}`,
    usada: `Creó su cuenta el ${fecha(f.usada_el)}`,
    rechazada: `Rechazada el ${fecha(f.decidida_el)}`,
  }[f.estado]
  const botones = {
    pendiente: `<button class="btn-primary" data-tienda-aceptar="${escapeHtml(f.id)}">Aceptar</button>
      <button class="btn-secondary" data-tienda-rechazar="${escapeHtml(f.id)}">Rechazar</button>`,
    aceptada: `<button class="btn-secondary" data-tienda-aceptar="${escapeHtml(f.id)}">Reenviar la invitación</button>`,
    rechazada: `<button class="btn-secondary" data-tienda-aceptar="${escapeHtml(f.id)}">Aceptar al final</button>`,
    usada: '',
  }[f.estado]
  return `<div class="admin-card" style="margin-bottom: 12px;" data-tienda-fila="${escapeHtml(f.id)}">
    <h3 style="margin: 0 0 4px;">${escapeHtml(f.nombre)}${f.contacto ? ` <span class="subtext">· ${escapeHtml(f.contacto)}</span>` : ''}</h3>
    <p class="admin-note" style="margin: 0;">${datos}</p>
    <p class="admin-note" style="margin: 4px 0 0;">${escapeHtml(estado)}</p>
    ${botones ? `<div class="foro-admin-fila" style="margin-top: 10px;">${botones}</div>` : ''}
  </div>`
}

function pintar() {
  const c = cuentaDeSolicitudes(filas)
  $('tiendasResumen').innerHTML = [
    [c.pendiente, 'Pendientes', 'esperando respuesta'],
    [c.aceptada, 'Aceptadas', 'con la invitación enviada'],
    [c.usada, 'Con cuenta', 'tiendas dentro'],
    [c.rechazada, 'Rechazadas', ''],
  ]
    .map(([n, t, nota]) => `<div class="admin-card"><div class="value" style="font-size:28px;font-weight:800;color:var(--navy);">${n}</div><div>${t}</div>${nota ? `<div style="font-size:11.5px;color:var(--text-mid);margin-top:4px;">${nota}</div>` : ''}</div>`)
    .join('')
  for (const b of document.querySelectorAll('[data-tiendas-ver]')) {
    const si = b.dataset.tiendasVer === viendo
    b.classList.toggle('activa', si)
    b.setAttribute('aria-pressed', String(si))
  }
  const lista = filas.filter((f) => f.estado === viendo)
  $('tiendasLista').innerHTML = lista.length
    ? lista.map(tarjeta).join('')
    : `<p class="admin-note">${viendo === 'pendiente' ? 'Ninguna tienda esperando.' : 'Ninguna.'}</p>`
}

// Las cuentas de tienda y cuál es de pruebas. Sin la migración 1245 la
// columna no existe: se dice, no se pinta un interruptor que no guardaría.
async function cargarCuentas() {
  const caja = $('tiendasCuentas')
  if (!caja) return
  const [{ data: perfiles, error: e1 }, { data: marcas, error: e2 }] = await Promise.all([
    supabase.from('user_profiles').select('id, username, display_name').eq('tipo', 'tienda').order('display_name'),
    supabase.from('tiendas').select('user_id, de_pruebas'),
  ])
  if (e1) {
    caja.innerHTML = `<p class="admin-note admin-note-alerta">No se pueden leer: ${escapeHtml(e1.message)}.</p>`
    return
  }
  if (e2) {
    caja.innerHTML = `<p class="admin-note admin-note-alerta">Falta ejecutar <code>supabase-migration-1245-tienda-de-pruebas.sql</code> para poder marcar una tienda de pruebas.</p>`
    return
  }
  const dePruebas = new Set((marcas || []).filter((m) => m.de_pruebas).map((m) => m.user_id))
  caja.innerHTML = (perfiles || []).length
    ? perfiles.map((p) => `<label class="admin-card" style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px; min-height: 44px; cursor: pointer;">
        <input type="checkbox" data-tienda-pruebas="${escapeHtml(p.id)}" ${dePruebas.has(p.id) ? 'checked' : ''}>
        <span><strong>${escapeHtml(p.display_name || p.username || 'Sin nombre')}</strong> <span class="subtext">@${escapeHtml(p.username || '')}</span></span>
        <span class="subtext" style="margin-left: auto;">De pruebas</span>
      </label>`).join('')
    : '<p class="admin-note">Ninguna cuenta de tienda todavía.</p>'
}

// Cambia ya y deshace si la base dice que no (896).
async function marcarDePruebas(caja) {
  const si = caja.checked
  const { error } = await supabase.rpc('admin_tienda_de_pruebas', { p_tienda: caja.dataset.tiendaPruebas, p_si: si })
  if (error) {
    caja.checked = !si
    showToast(`No se ha podido: ${error.message}`, 'error')
    return
  }
  showToast(si ? 'Ya no la ve nadie más que ella.' : 'Vuelve a verse en la web.', 'success')
}

async function cargar() {
  const { data, error } = await supabase.from('tienda_solicitudes').select('*').order('created_at', { ascending: false })
  if (error) {
    $('tiendasResumen').innerHTML = ''
    $('tiendasLista').innerHTML = `<p class="admin-note admin-note-alerta">No se puede leer: ${escapeHtml(error.message)}.
      Si dice que no existe la tabla, falta ejecutar <code>supabase-migration-1067-tiendas.sql</code>.</p>`
    return
  }
  filas = data || []
  pintar()
}

// El resultado va en el aviso de arriba y no en la tarjeta: al decidir, la
// solicitud cambia de pestaña y su tarjeta deja de verse.
function avisar(r, nombre) {
  const caja = $('tiendasAviso')
  if (!caja) return
  if (!r) {
    caja.innerHTML = ''
    return
  }
  const que = r.estado === 'aceptada' ? `${escapeHtml(nombre)}: aceptada` : `${escapeHtml(nombre)}: rechazada`
  caja.innerHTML = `<div class="admin-card">
    <p style="margin: 0;"><strong>${que}.</strong> ${r.correo === 'enviado' ? `Correo enviado a ${escapeHtml(r.email)}.` : `<span class="admin-note-alerta">El correo no ha salido: ${escapeHtml(String(r.motivo || 'sin motivo').replace(/\.$/, ''))}.</span>`}</p>
    ${r.enlace ? `<p class="admin-note" style="margin: 8px 0 0;">El enlace, por si quieres mandarlo tú: <code>${escapeHtml(r.enlace)}</code> <button class="btn-secondary" data-tienda-copiar="${escapeHtml(r.enlace)}">Copiar</button></p>` : ''}
  </div>`
}

async function decidir(id, aceptar, boton) {
  boton.disabled = true
  const session = await getSession()
  let r
  try {
    const res = await fetch('/.netlify/functions/tienda-decidir', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ id, aceptar }),
    })
    r = await res.json()
  } catch (e) {
    r = { ok: false, motivo: String(e?.message || e) }
  }
  boton.disabled = false
  if (!r.ok) {
    showToast(`No se ha podido: ${r.motivo || 'sin motivo'}`, 'error')
    return
  }
  const nombre = filas.find((f) => f.id === id)?.nombre || 'La tienda'
  showToast(r.correo === 'enviado' ? `Hecho. Correo enviado a ${r.email}.` : 'Hecho, pero el correo no ha salido.', r.correo === 'enviado' ? 'success' : 'error')
  if (r.estado) viendo = r.estado
  await cargar()
  avisar(r, nombre)
}

// ── Los planes (1429) ──
let planes = []
const DIA = 864e5
const dia = (d) => (d ? new Date(d).toLocaleDateString('sv') : '')

async function cargarPlanes() {
  const caja = $('tiendasPlanes')
  if (!caja) return
  const [{ data: perfiles, error: e1 }, { data: filasPlan, error: e2 }] = await Promise.all([
    supabase.from('user_profiles').select('id, username, display_name').eq('tipo', 'tienda').order('display_name'),
    supabase.from('tienda_planes').select('tienda_id, plan, prueba_hasta, pagado_hasta, fundadora, se_queda, se_queda_at, nota'),
  ])
  if (e1) return (caja.innerHTML = `<p class="admin-note admin-note-alerta">No se pueden leer: ${escapeHtml(e1.message)}.</p>`)
  if (e2) return (caja.innerHTML = '<p class="admin-note admin-note-alerta">Falta ejecutar <code>supabase-migration-1429-planes-de-tienda.sql</code> para poner los planes.</p>')
  const porId = new Map((filasPlan || []).map((f) => [f.tienda_id, f]))
  planes = (perfiles || []).map((p) => {
    const f = porId.get(p.id) || null
    // El plan que vale hoy, con la misma regla que la base (`tienda_plan_de`).
    const ahora = new Date()
    const vale = !f ? 'tienda_mas' : f.prueba_hasta && new Date(f.prueba_hasta) > ahora ? 'tienda_mas' : f.pagado_hasta && new Date(f.pagado_hasta) > ahora ? f.plan : 'gratis'
    return { perfil: p, fila: f, estado: estadoDelPlan({ ...(f || {}), plan: vale }) }
  })
  pintarPlanes()
}

function pintarPlanes() {
  const caja = $('tiendasPlanes')
  if (!planes.length) return (caja.innerHTML = '<p class="admin-note">Ninguna cuenta de tienda todavía.</p>')
  const n = (f) => planes.filter(f).length
  const pagando = planes.filter((p) => p.estado.pagando)
  const mes = pagando.reduce((s, p) => s + (PLANES[p.estado.plan]?.[p.estado.fundadora ? 'fundadora' : 'mes'] || 0), 0)
  caja.innerHTML = `<div class="admin-stats-grid">
      <div class="admin-card"><b class="tdpa-num">${planes.length}</b><span>tiendas</span></div>
      <div class="admin-card"><b class="tdpa-num">${n((p) => p.estado.enPrueba)}</b><span>en prueba · ${n((p) => p.estado.enPrueba && p.fila?.se_queda)} dicen que se quedan</span></div>
      <div class="admin-card"><b class="tdpa-num">${pagando.length}</b><span>pagando · ${mes} €/mes</span></div>
      <div class="admin-card"><b class="tdpa-num">${n((p) => p.estado.plan === 'gratis')}</b><span>en Gratis</span></div>
    </div>
    <div class="tdpa-lista">${planes.map(filaDePlan).join('')}</div>`
}

function filaDePlan({ perfil: p, fila: f, estado: e }) {
  const id = escapeHtml(p.id)
  const ahora = e.enPrueba ? `Prueba de Tienda+ hasta el ${fechaLarga(e.pruebaHasta)} (${e.dias} días)`
    : e.pagando ? `${nombreDePlan(e.plan)} pagado hasta el ${fechaLarga(e.pagadoHasta)} · ${precioTexto(e.plan, e.fundadora)}`
      : e.acabo ? `Gratis · la prueba acabó el ${fechaLarga(e.pruebaHasta)}` : 'Gratis'
  const quiere = f?.se_queda ? `Dice que se queda con ${nombreDePlan(f.se_queda)} (${precioTexto(f.se_queda, e.fundadora)})` : 'No ha dicho nada'
  return `<div class="admin-card tdpa-fila" data-tdpa="${id}">
    <div class="tdpa-quien"><strong>${escapeHtml(p.display_name || p.username || 'Sin nombre')}</strong> <span class="subtext">@${escapeHtml(p.username || '')}</span>
      <span class="tdpa-chapa tdpa-${escapeHtml(e.plan)}">${escapeHtml(nombreDePlan(e.plan))}</span>${e.fundadora ? '<span class="tdpa-chapa tdpa-fund">Fundadora</span>' : ''}</div>
    <p class="tdpa-ahora">${escapeHtml(ahora)} · <span class="${f?.se_queda ? 'tdpa-quiere' : ''}">${escapeHtml(quiere)}</span></p>
    <div class="tdpa-mandos">
      <label class="av-campo"><span class="av-eti">Plan pagado</span><select data-tdpa-plan>${['puesto', 'tienda', 'tienda_mas'].map((v) => `<option value="${v}"${(f?.plan || 'tienda') === v ? ' selected' : ''}>${escapeHtml(PLANES[v].nombre)}</option>`).join('')}</select></label>
      <label class="av-campo"><span class="av-eti">Pagado hasta</span><input type="date" data-tdpa-hasta value="${dia(f?.pagado_hasta)}" /></label>
      <label class="av-campo"><span class="av-eti">Nota</span><input type="text" maxlength="300" data-tdpa-nota value="${escapeHtml(f?.nota || '')}" placeholder="Ko-fi, Bizum, lo que sea" /></label>
      <label class="tdpa-check"><input type="checkbox" data-tdpa-fund${e.fundadora ? ' checked' : ''} /> Fundadora</label>
      <button type="button" class="btn-primary" data-tdpa-accion="guardar">Guardar</button>
      <button type="button" class="btn-secondary" data-tdpa-accion="mas30">+30 días de prueba</button>
      <button type="button" class="btn-secondary" data-tdpa-accion="gratis">Pasar a Gratis</button>
    </div>
  </div>`
}

async function accionDePlan(boton) {
  const fila = boton.closest('[data-tdpa]')
  const id = fila.dataset.tdpa
  const actual = planes.find((p) => p.perfil.id === id)
  const accion = boton.dataset.tdpaAccion
  let cambios
  if (accion === 'guardar') {
    const hasta = fila.querySelector('[data-tdpa-hasta]').value
    cambios = {
      plan: fila.querySelector('[data-tdpa-plan]').value,
      // El día que se pone es el último pagado: hasta el final de ese día.
      pagado_hasta: hasta ? new Date(`${hasta}T23:59:59`).toISOString() : null,
      fundadora: fila.querySelector('[data-tdpa-fund]').checked,
      nota: fila.querySelector('[data-tdpa-nota]').value,
    }
  } else if (accion === 'mas30') {
    const desde = Math.max(Date.now(), actual?.fila?.prueba_hasta ? new Date(actual.fila.prueba_hasta).getTime() : 0)
    cambios = { prueba_hasta: new Date(desde + 30 * DIA).toISOString() }
  } else if (accion === 'gratis') {
    cambios = { prueba_hasta: new Date().toISOString(), pagado_hasta: null }
  } else return
  boton.disabled = true
  const { error } = await supabase.rpc('admin_tienda_plan', { p_tienda: id, p_cambios: cambios })
  boton.disabled = false
  if (error) return showToast(`No se ha podido: ${error.message}`, 'error')
  showToast(accion === 'mas30' ? 'Treinta días más de prueba.' : accion === 'gratis' ? 'Ahora está en Gratis.' : 'Guardado.', 'success')
  cargarPlanes().catch(() => {})
}

export function iniciarTiendas() {
  if (iniciado) return
  iniciado = true
  $('tiendasFiltro')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tiendas-ver]')
    if (!b) return
    viendo = b.dataset.tiendasVer
    pintar()
  })
  $('tiendasAviso')?.addEventListener('click', (e) => {
    const copiar = e.target.closest('[data-tienda-copiar]')
    if (copiar) navigator.clipboard?.writeText(copiar.dataset.tiendaCopiar).then(() => showToast('Copiado.', 'success'), () => {})
  })
  $('tiendasLista')?.addEventListener('click', (e) => {
    const si = e.target.closest('[data-tienda-aceptar]')
    if (si) return decidir(si.dataset.tiendaAceptar, true, si)
    const no = e.target.closest('[data-tienda-rechazar]')
    if (no) return decidir(no.dataset.tiendaRechazar, false, no)
  })
  $('tiendasCuentas')?.addEventListener('change', (e) => {
    const caja = e.target.closest('[data-tienda-pruebas]')
    if (caja) marcarDePruebas(caja)
  })
  $('tiendasPlanes')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tdpa-accion]')
    if (b) accionDePlan(b)
  })
  $('tiendasCartel')?.addEventListener('click', () => {
    import('../../js/cartel-modo-evento.js').then((m) => m.abrirCartel({ tipo: 'tiendas' })).catch(() => showToast('No se ha podido abrir el cartel.', 'error'))
  })
  cargar().catch(() => {})
  cargarCuentas().catch(() => {})
  cargarPlanes().catch(() => {})
}
