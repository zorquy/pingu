// /admin → Usuarios (tanda 1121). Antes, una tabla con ocho botones por fila
// (Hacer admin, Moderador, Torneos, Noticias, Pro, Silenciar, Banear, Guardar
// título) y cada persona en la misma línea que su título de foro. Ahora: la
// lista con lo justo (quién, sus roles como chapas, si está silenciado o
// baneado), un buscador y chips para filtrar, y al tocar a alguien su ficha
// en un cajón: los roles como interruptores, la moderación con motivo y
// duración (migración 1121), sus logros (dar y quitar, la 1118) y su título
// del foro. «Pro» se fue (MOSTRAR_PLANES está apagado: no lo ve nadie).
import { supabase } from '../../js/supabase.js'
import { escapeHtml, avatarStyle, getInitial, profileUrl } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { icons } from '../../js/icons.js'

// Lo que se pide; las opcionales (cada una de su migración) se quitan de una
// en una si la base dice que no existen, en vez de dejar la lista en blanco.
const COLUMNAS = ['id', 'username', 'display_name', 'avatar_url', 'created_at', 'total_xp', 'level', 'is_admin', 'is_banned', 'is_muted', 'is_moderator', 'forum_title', 'forum_title_color', 'is_tournament_admin', 'is_news_writer', 'tipo', 'achievements']
const OPCIONALES = new Set(['avatar_url', 'is_moderator', 'forum_title', 'forum_title_color', 'is_tournament_admin', 'is_news_writer', 'tipo', 'achievements'])

// Los roles: qué columna, cómo se llama, qué da y qué se pregunta al darlo.
export const ROLES = [
  { col: 'is_admin', nombre: 'Equipo', chapa: 'Equipo', que: 'Entra a este panel y lo puede todo.', aviso: 'Vas a dar acceso de admin completo (guías, usuarios, reportes y más). ¿Seguro?' },
  { col: 'is_moderator', nombre: 'Moderación del foro', chapa: 'Moderación', que: 'Fija, cierra, edita y borra en el foro. No entra aquí.' },
  { col: 'is_tournament_admin', nombre: 'Organización de torneos', chapa: 'Torneos', que: 'Crea y lleva cualquier torneo de «Jugar», y de nada más: ni este panel, ni foro, ni guías. Lo único que no puede es marcar un torneo como oficial.', migracion: 'supabase-migration-torneos-organizadores.sql' },
  { col: 'is_news_writer', nombre: 'Redacción de noticias', chapa: 'Noticias', que: 'Escribe y publica noticias sin revisión. Nada más.', migracion: 'supabase-migration-redactor-noticias.sql' },
]

// Los chips de arriba: cada uno, su prueba sobre la fila (y la columna que necesita).
export const FILTROS = [
  { id: 'todos', nombre: 'Todos', es: () => true },
  { id: 'equipo', nombre: 'Equipo', col: 'is_admin', es: (u) => u.is_admin },
  { id: 'moderacion', nombre: 'Moderación', col: 'is_moderator', es: (u) => u.is_moderator },
  { id: 'torneos', nombre: 'Torneos', col: 'is_tournament_admin', es: (u) => u.is_tournament_admin },
  { id: 'noticias', nombre: 'Noticias', col: 'is_news_writer', es: (u) => u.is_news_writer },
  { id: 'silenciados', nombre: 'Silenciados', col: 'is_muted', es: (u) => u.is_muted },
  { id: 'baneados', nombre: 'Baneados', col: 'is_banned', es: (u) => u.is_banned },
  { id: 'tiendas', nombre: 'Tiendas', col: 'tipo', es: (u) => u.tipo === 'tienda' },
]

export const DURACIONES = [
  ['1', 'Un día'],
  ['7', 'Una semana'],
  ['30', 'Un mes'],
  ['', 'Hasta que se quite'],
]

// La paleta de colores para los títulos. Cerrada a propósito: el valor
// acaba en un atributo style de cada mensaje del foro, así que aquí no se
// escribe un color a mano — se elige de una lista que ya se sabe legible
// sobre el fondo del foro.
const COLORES_TITULO = [
  ['', 'Sin color'],
  ['#eab308', 'Dorado'],
  ['#f87171', 'Rojo'],
  ['#34d399', 'Verde'],
  ['#5b9cf8', 'Azul'],
  ['#a78bfa', 'Violeta'],
  ['#22d3ee', 'Cian'],
  ['#f472b6', 'Rosa'],
  ['#fb923c', 'Naranja'],
]

const POR_TANDA = 60

// Lo que busca el buscador: nombre y usuario, sin acentos ni mayúsculas.
const plano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export function filtrarUsuarios(lista, { filtro = 'todos', texto = '', orden = 'recientes' } = {}) {
  const f = FILTROS.find((x) => x.id === filtro) || FILTROS[0]
  const q = plano(texto.trim().replace(/^@/, ''))
  const salida = lista.filter((u) => f.es(u) && (!q || plano(u.display_name).includes(q) || plano(u.username).includes(q)))
  const nombre = (u) => plano(u.display_name || u.username)
  if (orden === 'xp') salida.sort((a, b) => (b.total_xp || 0) - (a.total_xp || 0))
  else if (orden === 'nombre') salida.sort((a, b) => nombre(a).localeCompare(nombre(b), 'es'))
  else salida.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  return salida
}

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const nombreDe = (u) => u.display_name || u.username || 'Sin nombre'

// Una moderación abierta, en palabras («hasta el 5 nov», «sin fecha»).
export function fraseDeModeracion(m) {
  if (!m) return ''
  const que = m.que === 'baneo' ? 'Baneo' : 'Silencio'
  const hasta = m.hasta ? `hasta el ${new Date(m.hasta).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'sin fecha de fin'
  return `${que} ${hasta}${m.motivo ? ` · «${m.motivo}»` : ''}`
}

let estado = null

async function pedirPerfiles() {
  const cols = [...COLUMNAS]
  for (let intento = 0; intento < OPCIONALES.size + 1; intento++) {
    const filas = []
    let error = null
    // Supabase corta a 1.000 filas sin avisar (la 808): por páginas.
    for (let desde = 0; desde < 50000; desde += 1000) {
      const r = await supabase.from('user_profiles').select(cols.join(', ')).order('created_at', { ascending: false }).range(desde, desde + 999)
      if (r.error) {
        error = r.error
        break
      }
      filas.push(...(r.data || []))
      if ((r.data || []).length < 1000) break
    }
    if (!error) return { filas, cols: new Set(cols) }
    const falta = cols.find((c) => OPCIONALES.has(c) && new RegExp(`\\b${c}\\b`).test(error.message || ''))
    if (!falta) throw error
    cols.splice(cols.indexOf(falta), 1)
  }
  throw new Error('no se ha podido leer user_profiles')
}

function avatar(u, t = 36) {
  return `<span class="us-avatar" style="width:${t}px;height:${t}px;font-size:${Math.round(t * 0.42)}px;${avatarStyle(u)}">${u.avatar_url ? '' : escapeHtml(getInitial(nombreDe(u)))}</span>`
}

function chapasHtml(u) {
  const roles = ROLES.filter((r) => u[r.col]).map((r) => `<span class="us-chapa">${escapeHtml(r.chapa)}</span>`)
  if (u.tipo === 'tienda') roles.push('<span class="us-chapa">Tienda</span>')
  if (u.is_banned) roles.push(`<span class="us-chapa us-mal">${icons.ban(12)} Baneado</span>`)
  else if (u.is_muted) roles.push(`<span class="us-chapa us-mal">${icons.volumeX(12)} Silenciado</span>`)
  return roles.join('')
}

function filaHtml(u) {
  return `<button type="button" class="us-fila${estado.abierto === u.id ? ' on' : ''}" data-us="${u.id}">
    ${avatar(u)}
    <span class="us-quien"><b>${escapeHtml(nombreDe(u))}</b><small>${u.username ? `@${escapeHtml(u.username)}` : ''}${u.created_at ? ` · desde el ${fecha(u.created_at)}` : ''}</small></span>
    <span class="us-chapas">${chapasHtml(u)}</span>
    <span class="us-xp">${escapeHtml(u.level || 'Novato')}<small>${(u.total_xp || 0).toLocaleString('es-ES')} XP</small></span>
  </button>`
}

function pintarLista() {
  const { caja, lista, filtro, texto, orden, cuantos } = estado
  const filtros = FILTROS.filter((f) => !f.col || estado.cols.has(f.col))
  caja.querySelector('#usChips').innerHTML = filtros
    .map((f) => {
      const n = f.id === 'todos' ? lista.length : lista.filter(f.es).length
      return `<button type="button" class="us-chip${f.id === filtro ? ' on' : ''}" aria-pressed="${f.id === filtro}" data-us-filtro="${f.id}">${escapeHtml(f.nombre)} <small>${n.toLocaleString('es-ES')}</small></button>`
    })
    .join('')
  const salen = filtrarUsuarios(lista, { filtro, texto, orden })
  const vista = salen.slice(0, cuantos)
  caja.querySelector('#usLista').innerHTML = vista.length
    ? vista.map(filaHtml).join('') + (salen.length > vista.length ? `<button type="button" class="btn-secondary us-mas" data-us-mas>Ver más (${(salen.length - vista.length).toLocaleString('es-ES')})</button>` : '')
    : '<p class="admin-note">Nadie con eso.</p>'
}

// ── La ficha ──

function interruptor(r, u) {
  const hay = estado.cols.has(r.col)
  return `<label class="us-rol${hay ? '' : ' apagado'}">
    <span><b>${escapeHtml(r.nombre)}</b><small>${hay ? escapeHtml(r.que) : `Falta ejecutar ${escapeHtml(r.migracion || 'su migración')}.`}</small></span>
    <input type="checkbox" role="switch" data-us-rol="${r.col}" ${u[r.col] ? 'checked' : ''} ${hay ? '' : 'disabled'} ${r.col === 'is_admin' && u.id === estado.yo ? 'disabled title="A ti mismo no"' : ''} />
  </label>`
}

function selectorColor(u) {
  const actual = u.forum_title_color || ''
  // Un color puesto por SQL que no esté en la paleta se enseña como opción
  // extra: si no, con solo abrir y guardar se perdería.
  const opciones = COLORES_TITULO.some(([hex]) => hex === actual) ? COLORES_TITULO : [[actual, actual], ...COLORES_TITULO]
  return `<select id="usColor" aria-label="Color del título"${actual ? ` style="color:${escapeHtml(actual)}"` : ''}>${opciones.map(([hex, n]) => `<option value="${escapeHtml(hex)}" ${hex === actual ? 'selected' : ''}${hex ? ` style="color:${escapeHtml(hex)}"` : ''}>${escapeHtml(n)}</option>`).join('')}</select>`
}

function moderacionHtml(u) {
  if (u.id === estado.yo) return '<p class="admin-note">Eres tú.</p>'
  const abiertas = (estado.moderaciones[u.id] || []).filter((m) => !m.quitada_at)
  const lineaDe = (que, activo) => {
    const m = abiertas.find((x) => x.que === que)
    if (!activo) return ''
    return `<p class="us-mod-activo">${que === 'baneo' ? icons.ban(14) : icons.volumeX(14)} ${escapeHtml(m ? fraseDeModeracion(m) : que === 'baneo' ? 'Baneado (desde antes, sin motivo ni fecha)' : 'Silenciado (desde antes, sin motivo ni fecha)')}
      <button type="button" class="btn-secondary" data-us-quitar="${que}">Quitar ${que === 'baneo' ? 'el baneo' : 'el silencio'}</button></p>`
  }
  return `${lineaDe('silencio', u.is_muted)}${lineaDe('baneo', u.is_banned)}
    <div class="us-mod-form">
      <input type="text" id="usMotivo" maxlength="300" placeholder="Motivo (lo ve el equipo)" />
      <select id="usDuracion" aria-label="Duración">${DURACIONES.map(([v, n]) => `<option value="${v}" ${v === '7' ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <div class="us-mod-botones">
        ${u.is_muted ? '' : `<button type="button" class="btn-secondary" data-us-moderar="silencio">${icons.volumeX(14)} Silenciar</button>`}
        ${u.is_banned ? '' : `<button type="button" class="btn-secondary us-peligro" data-us-moderar="baneo">${icons.ban(14)} Banear</button>`}
      </div>
    </div>
    ${estado.sinMigracion ? '<p class="av-nota">Sin <code>supabase-migration-1121-moderacion.sql</code> se silencia y se banea igual, pero sin motivo ni fecha de fin.</p>' : ''}`
}

function logrosHtml(u) {
  if (!estado.cols.has('achievements')) return '<p class="admin-note">No se pueden leer los logros.</p>'
  const tiene = new Set(u.achievements || [])
  const defs = estado.logros
  const suyos = defs.filter((d) => tiene.has(d.id))
  const otros = defs.filter((d) => !tiene.has(d.id))
  return `<div class="us-logros">${suyos.length ? suyos.map((d) => `<span class="us-logro">${escapeHtml(d.title)}<button type="button" data-us-quitar-logro="${escapeHtml(d.id)}" aria-label="Quitar ${escapeHtml(d.title)}">✕</button></span>`).join('') : '<span class="admin-note">Ninguno todavía.</span>'}</div>
    ${otros.length ? `<div class="us-dar"><select id="usLogro" aria-label="Logro">${otros.map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.title)}</option>`).join('')}</select><input type="text" id="usLogroMotivo" maxlength="200" placeholder="Por qué (le llega en el aviso)" /><button type="button" class="btn-secondary" data-us-dar-logro>Dar</button></div>` : ''}`
}

function historialHtml(u) {
  const filas = estado.moderaciones[u.id] || []
  if (!filas.length) return ''
  return `<details class="us-historial"><summary>Historial de moderación (${filas.length})</summary><ul>${filas
    .map((m) => `<li>${escapeHtml(fecha(m.created_at))} · ${m.que === 'baneo' ? 'Baneo' : 'Silencio'}${m.hasta ? ` hasta el ${escapeHtml(fecha(m.hasta))}` : ''}${m.motivo ? ` · «${escapeHtml(m.motivo)}»` : ''}${m.quitada_at ? ` · quitado el ${escapeHtml(fecha(m.quitada_at))}` : ' · <b>en vigor</b>'}</li>`)
    .join('')}</ul></details>`
}

function pintarFicha() {
  const cajon = estado.caja.querySelector('#usCajon')
  const u = estado.lista.find((x) => x.id === estado.abierto)
  estado.caja.querySelector('.us-cuerpo').classList.toggle('con-cajon', Boolean(u))
  if (!u) {
    cajon.hidden = true
    cajon.innerHTML = ''
    return
  }
  cajon.hidden = false
  cajon.innerHTML = `
    <div class="us-cajon-cab">${avatar(u, 48)}<span class="us-quien"><b>${escapeHtml(nombreDe(u))}</b><small>${u.username ? `@${escapeHtml(u.username)} · ` : ''}${escapeHtml(u.level || 'Novato')} · ${(u.total_xp || 0).toLocaleString('es-ES')} XP</small></span>
      <button type="button" class="lg-cerrar" data-us-cerrar aria-label="Cerrar">✕</button></div>
    <p class="us-meta">${[u.created_at ? `Desde el ${fecha(u.created_at)}` : '', u.tipo === 'tienda' ? 'Cuenta de tienda' : '', `<a href="${profileUrl(u)}" target="_blank" rel="noopener">Ver su perfil</a>`].filter(Boolean).join(' · ')}</p>
    <section class="us-bloque"><h3>Roles</h3>${ROLES.map((r) => interruptor(r, u)).join('')}</section>
    <section class="us-bloque"><h3>Moderación</h3>${moderacionHtml(u)}${historialHtml(u)}</section>
    <section class="us-bloque"><h3>Logros</h3>${logrosHtml(u)}</section>
    ${estado.cols.has('forum_title') ? `<section class="us-bloque"><h3>Título del foro</h3><p class="av-nota">Lo que se lee bajo su nombre en cada mensaje. Solo es reconocimiento: no da permisos.</p>
      <div class="us-titulo"><input type="text" id="usTitulo" maxlength="40" placeholder="Sin título" value="${escapeHtml(u.forum_title || '')}" />${estado.cols.has('forum_title_color') ? selectorColor(u) : ''}<button type="button" class="btn-secondary" data-us-titulo>Guardar</button></div></section>` : ''}`
}

function repintar() {
  pintarLista()
  pintarFicha()
}

async function cambiarRol(u, col, valor, input) {
  const rol = ROLES.find((r) => r.col === col)
  if (valor && rol.aviso && !confirm(rol.aviso)) {
    input.checked = false
    return
  }
  // Cambia ya y deshace si la base dice que no (la 896).
  const antes = u[col]
  u[col] = valor
  pintarLista()
  const { error } = await supabase.from('user_profiles').update({ [col]: valor }).eq('id', u.id)
  if (error) {
    u[col] = antes
    input.checked = Boolean(antes)
    pintarLista()
    showToast(/column|schema cache/i.test(error.message || '') && rol.migracion ? `Falta ejecutar ${rol.migracion}.` : `No se ha podido: ${error.message}`, 'error')
    return
  }
  showToast(`${rol.nombre}: ${valor ? 'dado' : 'quitado'}.`, 'success')
}

async function moderar(u, que) {
  const motivo = estado.caja.querySelector('#usMotivo')?.value.trim() || ''
  const dias = estado.caja.querySelector('#usDuracion')?.value || ''
  if (que === 'baneo' && !confirm(`Vas a banear a ${nombreDe(u)}: se le cierra la sesión y no puede entrar ni publicar${dias ? ` durante ${DURACIONES.find(([v]) => v === dias)[1].toLowerCase()}` : ''}. ¿Seguro?`)) return
  const col = que === 'baneo' ? 'is_banned' : 'is_muted'
  let { data, error } = await supabase.rpc('admin_moderar', { p_usuario: u.id, p_que: que, p_motivo: motivo || null, p_dias: dias ? Number(dias) : null })
  if (error && /PGRST202|Could not find the function/i.test(`${error.code} ${error.message}`)) {
    // Sin la 1121: como antes, la columna a pelo.
    estado.sinMigracion = true
    ;({ error } = await supabase.from('user_profiles').update({ [col]: true }).eq('id', u.id))
  } else if (!error) {
    ;(estado.moderaciones[u.id] ||= []).forEach((m) => { if (m.que === que && !m.quitada_at) m.quitada_at = new Date().toISOString() })
    estado.moderaciones[u.id].unshift({ que, motivo: motivo || null, hasta: data?.hasta || null, created_at: new Date().toISOString(), quitada_at: null })
  }
  if (error) return showToast(`No se ha podido: ${error.message}`, 'error')
  u[col] = true
  repintar()
  showToast(que === 'baneo' ? 'Baneado.' : 'Silenciado.', 'success')
}

async function quitarModeracion(u, que) {
  const col = que === 'baneo' ? 'is_banned' : 'is_muted'
  let { error } = await supabase.rpc('admin_moderar_quitar', { p_usuario: u.id, p_que: que })
  if (error && /PGRST202|Could not find the function/i.test(`${error.code} ${error.message}`)) {
    estado.sinMigracion = true
    ;({ error } = await supabase.from('user_profiles').update({ [col]: false }).eq('id', u.id))
  } else if (!error) {
    for (const m of estado.moderaciones[u.id] || []) if (m.que === que && !m.quitada_at) m.quitada_at = new Date().toISOString()
  }
  if (error) return showToast(`No se ha podido: ${error.message}`, 'error')
  u[col] = false
  repintar()
  showToast(que === 'baneo' ? 'Baneo quitado.' : 'Silencio quitado.', 'success')
}

async function logro(u, accion, id, motivo) {
  const { data, error } = await supabase.rpc(accion === 'dar' ? 'admin_logro_dar' : 'admin_logro_quitar', { p_usuario: u.id, p_logro: id, p_motivo: motivo || null })
  if (error) {
    const falta = /PGRST202|Could not find the function/i.test(`${error.code} ${error.message}`)
    return showToast(falta ? 'Dar y quitar logros necesita supabase-migration-1118-logros-admin.sql.' : `No se ha podido: ${error.message}`, 'error')
  }
  const def = estado.logros.find((d) => d.id === id)
  const xp = Number(def?.xp_reward) || 0
  if (!data?.ya) {
    u.achievements = accion === 'dar' ? [...(u.achievements || []), id] : (u.achievements || []).filter((x) => x !== id)
    u.total_xp = Math.max(0, (u.total_xp || 0) + (accion === 'dar' ? xp : -xp))
  }
  repintar()
  showToast(accion === 'dar' ? `«${def?.title || id}» dado.` : `«${def?.title || id}» quitado.`, 'success')
}

export async function montarUsuarios(caja) {
  if (!caja) return
  caja.innerHTML = '<p class="admin-note">Cargando…</p>'
  // Lo caducado, fuera antes de leer (si la 1121 está; si no, nada).
  await supabase.rpc('moderacion_al_dia').then(() => {}, () => {})
  const [{ data: s }, perfiles, { data: defs }, mods] = await Promise.all([
    supabase.auth.getSession(),
    pedirPerfiles().catch((e) => ({ error: e })),
    supabase.from('achievement_definitions').select('id, title, xp_reward, is_active').order('title'),
    supabase.from('moderaciones').select('user_id, que, motivo, hasta, created_at, quitada_at').order('created_at', { ascending: false }).limit(1000),
  ])
  if (perfiles.error) {
    caja.innerHTML = `<p class="admin-note admin-note-alerta">No se ha podido leer la lista: ${escapeHtml(perfiles.error.message || String(perfiles.error))}</p>`
    return
  }
  const moderaciones = {}
  for (const m of mods.data || []) (moderaciones[m.user_id] ||= []).push(m)
  estado = {
    caja,
    lista: perfiles.filas,
    cols: perfiles.cols,
    logros: defs || [],
    moderaciones,
    sinMigracion: Boolean(mods.error),
    yo: s?.session?.user?.id || null,
    filtro: 'todos',
    texto: '',
    orden: 'recientes',
    cuantos: POR_TANDA,
    abierto: null,
  }
  caja.innerHTML = `
    <div class="us-mandos">
      <input type="search" id="usBuscar" placeholder="Buscar por nombre o @usuario" aria-label="Buscar personas" />
      <select id="usOrden" aria-label="Orden"><option value="recientes">Las más nuevas</option><option value="xp">Más XP</option><option value="nombre">Por nombre</option></select>
    </div>
    <div class="us-chips" id="usChips" role="group" aria-label="Filtrar"></div>
    <div class="us-cuerpo">
      <div class="us-lista" id="usLista"></div>
      <aside class="lg-cajon us-cajon" id="usCajon" hidden></aside>
    </div>`
  repintar()

  caja.querySelector('#usBuscar').addEventListener('input', (e) => {
    estado.texto = e.target.value
    estado.cuantos = POR_TANDA
    pintarLista()
  })
  caja.querySelector('#usOrden').addEventListener('change', (e) => {
    estado.orden = e.target.value
    pintarLista()
  })
  caja.addEventListener('click', (e) => {
    const t = e.target
    const filtro = t.closest('[data-us-filtro]')
    if (filtro) {
      estado.filtro = filtro.dataset.usFiltro
      estado.cuantos = POR_TANDA
      return pintarLista()
    }
    if (t.closest('[data-us-mas]')) {
      estado.cuantos += POR_TANDA
      return pintarLista()
    }
    const fila = t.closest('[data-us]')
    if (fila) {
      estado.abierto = fila.dataset.us
      repintar()
      if (matchMedia('(max-width: 1100px)').matches) caja.querySelector('#usCajon').scrollIntoView({ block: 'start' })
      return
    }
    if (t.closest('[data-us-cerrar]')) {
      estado.abierto = null
      return repintar()
    }
    const u = estado.lista.find((x) => x.id === estado.abierto)
    if (!u) return
    const mod = t.closest('[data-us-moderar]')
    if (mod) return moderar(u, mod.dataset.usModerar)
    const quitar = t.closest('[data-us-quitar]')
    if (quitar) return quitarModeracion(u, quitar.dataset.usQuitar)
    const quitarLogro = t.closest('[data-us-quitar-logro]')
    if (quitarLogro) return logro(u, 'quitar', quitarLogro.dataset.usQuitarLogro, null)
    if (t.closest('[data-us-dar-logro]')) return logro(u, 'dar', caja.querySelector('#usLogro').value, caja.querySelector('#usLogroMotivo').value.trim())
    if (t.closest('[data-us-titulo]')) return guardarTitulo(u)
  })
  caja.addEventListener('change', (e) => {
    const rol = e.target.closest('[data-us-rol]')
    const u = estado.lista.find((x) => x.id === estado.abierto)
    if (rol && u) cambiarRol(u, rol.dataset.usRol, rol.checked, rol)
    if (e.target.id === 'usColor') e.target.style.color = e.target.value
  })
}

async function guardarTitulo(u) {
  const valor = estado.caja.querySelector('#usTitulo').value.trim()
  const cambios = { forum_title: valor || null }
  // El color solo tiene sentido CON título: un color de un título vacío
  // sería un dato huérfano esperando a confundir.
  if (estado.cols.has('forum_title_color')) cambios.forum_title_color = valor ? estado.caja.querySelector('#usColor')?.value || null : null
  const { error } = await supabase.from('user_profiles').update(cambios).eq('id', u.id)
  if (error) return showToast(`No se ha podido guardar: ${error.message}`, 'error')
  Object.assign(u, cambios)
  showToast('Título guardado.', 'success')
}
