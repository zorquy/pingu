// /ajustes (868): cómo funciona tu cuenta. Hasta la 867 todo esto vivía
// dentro de «Editar perfil», mezclado con cómo te ven los demás: un
// formulario de doce apartados con veinticinco casillas de avisos. Aquí
// cada cosa tiene su apartado y se guarda al tocarla; «Editar perfil» se
// queda con lo que se ve (nombre, foto, bio, firma, logro).
//
// En el PC, la lista a la izquierda y el apartado a la derecha; en el
// móvil, la lista, y cada apartado es una pantalla con «‹ Ajustes» (la
// pieza de la 857). La dirección lleva el apartado (`?ver=avisos`), así que
// «Ajustes» del menú y los enlaces de los correos llegan al sitio.
import { supabase } from './supabase.js'
import { escapeHtml, requireAuth, passwordStrengthError } from './app.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { NOTIFICATION_TYPES, EMAIL_TYPES, EMAIL_TYPES_EQUIPO } from './notifications.js'
import { GRUPOS_CAMPANITA, GRUPOS_CORREO, gruposDe, estaActivo, conGrupo } from './avisos-prefs.js'

const APARTADOS = [
  { id: 'avisos', nombre: 'Avisos', sub: 'Campanita, correo y push', icono: 'bell' },
  { id: 'cuenta', nombre: 'Cuenta', sub: 'Correo, contraseña, cumpleaños, Play! Pokémon', icono: 'user' },
  { id: 'privacidad', nombre: 'Privacidad', sub: 'Tu actividad en Comunidad', icono: 'eye' },
  { id: 'apariencia', nombre: 'Apariencia', sub: 'Tema claro, oscuro o el del sistema', icono: 'palette' },
  { id: 'datos', nombre: 'Tus datos', sub: 'Exportar e importar la colección', icono: 'upload' },
  { id: 'invitar', nombre: 'Invitar a un amigo', sub: 'Tu enlace de invitación', icono: 'users' },
  { id: 'borrar', nombre: 'Borrar mi cuenta', sub: '', icono: 'trash', peligro: true },
]

let session = null
let perfil = null

// El mismo corte que css/ajustes.css: por debajo, la lista y cada apartado
// son dos pantallas.
const enMovil = () => window.matchMedia('(max-width: 900px)').matches
const verPedida = () => new URLSearchParams(location.search).get('ver') || ''
const apartadoDe = (id) => APARTADOS.find((a) => a.id === id)

// Guardar una columna del perfil al tocar su mando. Si una columna aún no
// existe (la web desplegada antes de su migración), se dice, no se calla.
async function guardar(campos) {
  const { error } = await supabase.from('user_profiles').update(campos).eq('id', session.user.id)
  if (error) {
    showToast('No se ha podido guardar: ' + error.message)
    return false
  }
  perfil = { ...perfil, ...campos }
  return true
}

const interruptor = ({ id, texto, detalle = '', activo, disabled = false }) =>
  `<label class="aj-interruptor"><span>${escapeHtml(texto)}${detalle ? `<small>${escapeHtml(detalle)}</small>` : ''}</span><input type="checkbox" role="switch" data-interruptor="${escapeHtml(id)}" ${activo ? 'checked' : ''} ${disabled ? 'disabled' : ''}></label>`

// ── Avisos: tres canales, los mismos grupos ──
function avisosHtml() {
  return `
    <h2>Avisos</h2>
    <p>De qué te avisamos y por dónde. Se guarda al tocar cada uno.</p>
    <div class="seg aj-canales" role="tablist" aria-label="Canal">
      <button type="button" class="seg-btn" data-canal="campanita" aria-pressed="true">${icons.bell(16)} En la campanita</button>
      <button type="button" class="seg-btn" data-canal="correo" aria-pressed="false">${icons.mail(16)} Por correo</button>
      <button type="button" class="seg-btn" data-canal="push" aria-pressed="false">${icons.zap(16)} Push</button>
    </div>
    <div id="ajCanal"></div>`
}

function montarAvisos(panel) {
  const caja = panel.querySelector('#ajCanal')
  const pintar = (canal) => {
    for (const b of panel.querySelectorAll('[data-canal]')) b.setAttribute('aria-pressed', String(b.dataset.canal === canal))
    if (canal === 'push') return pintarPush(caja)
    const columna = canal === 'correo' ? 'notification_email_disabled' : 'notification_prefs_disabled'
    const tipos = canal === 'correo' ? { ...EMAIL_TYPES, ...(perfil?.is_admin ? EMAIL_TYPES_EQUIPO : {}) } : NOTIFICATION_TYPES
    const grupos = gruposDe(tipos, canal === 'correo' ? GRUPOS_CORREO : GRUPOS_CAMPANITA)
    caja.innerHTML =
      (canal === 'correo' ? `<p class="aj-nota">Solo te escribimos cuando alguien se dirige a ti directamente. Aunque lo desactives, lo seguirás viendo al entrar en la web.</p>` : '') +
      `<div class="aj-filas">${grupos.map((g) => interruptor({ id: g.id, texto: g.titulo, activo: estaActivo(g, perfil?.[columna]) })).join('')}</div>`
    for (const input of caja.querySelectorAll('[data-interruptor]')) {
      input.addEventListener('change', async () => {
        const g = grupos.find((x) => x.id === input.dataset.interruptor)
        input.disabled = true
        const ok = await guardar({ [columna]: conGrupo(perfil?.[columna], g, input.checked) })
        if (!ok) input.checked = !input.checked
        input.disabled = false
      })
    }
  }
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-canal]')
    if (b) pintar(b.dataset.canal)
  })
  pintar('campanita')
}

// El interruptor de push, con su estado real. Suscribirse pide permiso al
// navegador y escribe su propia fila: no es una columna del perfil, y
// manda solo en el navegador donde lo toques.
async function pintarPush(caja) {
  caja.innerHTML = `<p class="aj-nota">Los avisos de la campanita, en el escritorio o el móvil aunque PokeDoc esté cerrado. Se activa POR dispositivo: este interruptor manda solo en el navegador donde lo toques.</p><div class="aj-filas" id="ajPushZona"><p class="subtext">Comprobando este navegador…</p></div>`
  const zona = caja.querySelector('#ajPushZona')
  try {
    const push = await import('./push.js')
    const pintarZona = async () => {
      const { soportado, permiso, suscrito } = await push.estadoPush()
      if (!soportado) {
        zona.innerHTML = `<p class="subtext">Este navegador no soporta notificaciones push.</p>`
        return
      }
      if (permiso === 'denied' && !suscrito) {
        zona.innerHTML = `<p class="subtext">Las notificaciones están bloqueadas para PokeDoc en los ajustes del navegador. Desbloquéalas ahí y vuelve.</p>`
        return
      }
      zona.innerHTML = interruptor({ id: 'push', texto: 'Avisos en este dispositivo', detalle: suscrito ? 'Activados en este navegador' : 'Desactivados en este navegador', activo: suscrito })
      zona.querySelector('[data-interruptor="push"]').addEventListener('change', async (e) => {
        e.target.disabled = true
        const r = suscrito ? await push.desactivarPush() : await push.activarPush(session.user.id)
        if (r.ok) showToast(suscrito ? 'Avisos desactivados en este dispositivo.' : '¡Hecho! Te avisaremos por aquí.', 'success')
        else showToast(r.motivo || 'No se ha podido cambiar.')
        await pintarZona()
      })
    }
    await pintarZona()
  } catch {
    zona.innerHTML = `<p class="subtext">No se ha podido comprobar el estado de los avisos.</p>`
  }
}

// ── Cuenta ──
function cuentaHtml() {
  return `
    <h2>Cuenta</h2>
    <div class="aj-dato"><span>Correo de acceso<br><strong>${escapeHtml(session.user.email || '')}</strong></span></div>
    <h3>Cambiar la contraseña</h3>
    <form class="aj-form" id="ajContrasena">
      <input type="password" id="ajNuevaContrasena" autocomplete="new-password" placeholder="Contraseña nueva" minlength="8" required />
      <button type="submit" class="btn-primary">Cambiar la contraseña</button>
    </form>
    <h3>Cumpleaños <span class="subtext">(opcional)</span></h3>
    <div class="aj-form">
      <input type="date" id="ajCumple" value="${escapeHtml(perfil?.birthday || '')}" aria-label="Cumpleaños" />
      <p class="aj-nota">Si lo pones, el día señalado el foro te felicita en «El foro en números». Bórralo cuando quieras.</p>
    </div>
    <h3>Play! Pokémon <span class="subtext">(privado)</span></h3>
    <p class="aj-nota">Para que la decklist oficial del constructor salga ya rellena. Esto no se ve en tu perfil: solo lo ves tú.</p>
    <form class="aj-form" id="ajPlay">
      <label for="ajPlayerId" class="subtext">Player ID</label>
      <input id="ajPlayerId" type="text" inputmode="numeric" maxlength="14" autocomplete="off" placeholder="Por ejemplo, 1234567" disabled />
      <label for="ajPlayNombre" class="subtext">Nombre y apellidos (como en la decklist)</label>
      <input id="ajPlayNombre" type="text" maxlength="80" autocomplete="name" disabled />
      <label for="ajPlayNacimiento" class="subtext">Fecha de nacimiento (la pide la decklist)</label>
      <input id="ajPlayNacimiento" type="date" min="1900-01-01" disabled />
      <p class="aj-nota" id="ajPlayAviso" role="status">Cargando…</p>
      <button type="submit" class="btn-primary" id="ajPlayGuardar" disabled>Guardar</button>
    </form>`
}

function montarCuenta(panel) {
  panel.querySelector('#ajContrasena').addEventListener('submit', async (e) => {
    e.preventDefault()
    const campo = panel.querySelector('#ajNuevaContrasena')
    const mal = passwordStrengthError(campo.value)
    if (mal) return showToast(mal)
    const { error } = await supabase.auth.updateUser({ password: campo.value })
    if (error) return showToast('No se ha podido cambiar: ' + error.message)
    campo.value = ''
    showToast('Contraseña cambiada.', 'success')
  })
  // El cumpleaños es opcional: vacío = quitarlo (null).
  panel.querySelector('#ajCumple').addEventListener('change', async (e) => {
    if (await guardar({ birthday: e.target.value || null })) showToast(e.target.value ? 'Cumpleaños guardado.' : 'Cumpleaños quitado.', 'success')
  })
  // Play! Pokémon (834), de su tabla PRIVADA: se lee aparte y se guarda
  // aparte, para que si falta su migración el resto se guarde igual.
  ;(async () => {
    const { leerDatosPlay, guardarDatosPlay, MIGRACION_PLAY } = await import('./play-pokemon.js')
    const play = await leerDatosPlay(session.user.id)
    const aviso = panel.querySelector('#ajPlayAviso')
    if (play.estado !== 'ok') {
      aviso.textContent = play.estado === 'falta' ? `Todavía no se puede guardar: falta ejecutar ${MIGRACION_PLAY}.` : 'No se ha podido leer lo que tenías guardado. Vuelve en un rato.'
      return
    }
    const f = play.fila
    for (const [id, valor] of [['ajPlayerId', f.player_id], ['ajPlayNombre', f.player_name], ['ajPlayNacimiento', f.birth_date]]) {
      const campo = panel.querySelector(`#${id}`)
      campo.value = valor || ''
      campo.disabled = false
    }
    panel.querySelector('#ajPlayGuardar').disabled = false
    aviso.textContent = ''
    panel.querySelector('#ajPlay').addEventListener('submit', async (e) => {
      e.preventDefault()
      const errorPlay = await guardarDatosPlay(session.user.id, {
        playerId: panel.querySelector('#ajPlayerId').value.trim(),
        nombre: panel.querySelector('#ajPlayNombre').value.trim(),
        nacimiento: panel.querySelector('#ajPlayNacimiento').value,
      })
      showToast(errorPlay ? 'No se ha podido guardar: ' + errorPlay.message : 'Datos de Play! Pokémon guardados.', errorPlay ? 'error' : 'success')
    })
  })()
}

// ── Privacidad ──
const privacidadHtml = () => `
    <h2>Privacidad</h2>
    <div class="aj-filas">
      ${interruptor({ id: 'hide_activity', texto: 'No mostrar mi actividad en Comunidad', detalle: 'Lo que leas y los cursos que hagas dejan de aparecer en el hilo de actividad y de ser visibles para el resto.', activo: Boolean(perfil?.hide_activity) })}
    </div>`

function montarPrivacidad(panel) {
  panel.querySelector('[data-interruptor="hide_activity"]').addEventListener('change', async (e) => {
    if (!(await guardar({ hide_activity: e.target.checked }))) e.target.checked = !e.target.checked
  })
}

// ── Apariencia ──
function temaGuardado() {
  try { return localStorage.getItem('pokedoc-theme') || 'auto' } catch { return 'auto' }
}
const aparienciaHtml = () => `
    <h2>Apariencia</h2>
    <h3>Tema</h3>
    <div class="seg aj-tema" role="group" aria-label="Tema">
      ${[['light', icons.sun(16), 'Claro'], ['dark', icons.moon(16), 'Oscuro'], ['auto', icons.settings(16), 'El del sistema']]
        .map(([v, ic, t]) => `<button type="button" class="seg-btn" data-tema="${v}" aria-pressed="${temaGuardado() === v}">${ic}<span>${t}</span></button>`).join('')}
    </div>`

function montarApariencia(panel) {
  panel.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tema]')
    if (!b) return
    const { aplicarTema } = await import('./menu-tu.js')
    try {
      const { conOla } = await import('./theme.js')
      conOla({ currentTarget: b }, () => aplicarTema(b.dataset.tema))
    } catch {
      aplicarTema(b.dataset.tema)
    }
    for (const x of panel.querySelectorAll('[data-tema]')) x.setAttribute('aria-pressed', String(x === b))
  })
}

// ── Tus datos ──
const datosHtml = () => `
    <h2>Tus datos</h2>
    <p>Tu colección es tuya: te la llevas en un CSV, y traes la que tengas en otra app.</p>
    <div class="aj-dato"><span>Exportar mi colección<br><small class="subtext">Un CSV con todas tus cartas, desde el Panel de Mi colección.</small></span><a class="btn-secondary" href="/mi-coleccion">Ir al Panel</a></div>
    <div class="aj-dato"><span>Importar un CSV<br><small class="subtext">De Collectr, Dex o cualquier hoja con el formato de PokeDoc.</small></span><a class="btn-secondary" href="/mi-coleccion?importar=1">Importar</a></div>`

// ── Invitar a un amigo ──
// Tu enlace personal (/r/<usuario>) y cuánta gente ha llegado con él. Quien
// se registre con tu enlace te cuenta como invitado en cuanto termina su
// onboarding, y los trofeos de Embajador llegan solos.
function invitarHtml() {
  if (!perfil?.username) return `<h2>Invitar a un amigo</h2><p>Ponte un nombre de usuario en <a href="/perfil">tu perfil</a> y tendrás tu enlace de invitación.</p>`
  const enlace = `${window.location.origin}/r/${encodeURIComponent(perfil.username)}`
  return `
    <h2>Invitar a un amigo</h2>
    <p>Comparte tu enlace: quien se una con él y tú os lleváis trofeos y XP.<span id="ajTraidos"></span></p>
    <div class="aj-dato"><span><code id="ajEnlaceInvitar">${escapeHtml(enlace)}</code></span><button type="button" class="btn-secondary" id="ajCopiarInvitar">Copiar</button></div>`
}

async function montarInvitar(panel) {
  const btn = panel.querySelector('#ajCopiarInvitar')
  if (!btn) return
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(panel.querySelector('#ajEnlaceInvitar').textContent)
      showToast('Enlace copiado. ¡A repartirlo!', 'success')
    } catch {
      showToast('No se ha podido copiar. Selecciónalo a mano.')
    }
  })
  try {
    const { count, error } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('referred_by', session.user.id)
    const hueco = panel.querySelector('#ajTraidos')
    if (!error && hueco) hueco.textContent = ` Has traído a ${count || 0} ${count === 1 ? 'persona' : 'personas'}.`
  } catch {}
}

// ── Borrar mi cuenta ──
const borrarHtml = () => `
    <h2>Borrar mi cuenta</h2>
    <p>Se borra tu cuenta y tus datos. No es al instante: el equipo lo revisa y lo confirma a mano.</p>
    <p class="aj-nota" id="ajBorrarEstado"></p>
    <button type="button" class="btn-outline aj-borrar hidden" id="ajBorrar">Solicitar el borrado de mi cuenta</button>`

async function montarBorrar(panel) {
  const btn = panel.querySelector('#ajBorrar')
  const estado = panel.querySelector('#ajBorrarEstado')
  const pintar = async () => {
    const { data } = await supabase.from('account_deletion_requests').select('status').eq('user_id', session.user.id).eq('status', 'pending').maybeSingle()
    btn.classList.toggle('hidden', Boolean(data))
    estado.textContent = data ? 'Ya tienes una solicitud de borrado pendiente de revisión.' : ''
  }
  await pintar()
  btn.addEventListener('click', async () => {
    if (!confirm('Vas a solicitar el borrado de tu cuenta y de tus datos. No se borra al instante — el equipo lo revisa y lo confirma a mano. ¿Continuar?')) return
    const { error } = await supabase.from('account_deletion_requests').insert({ user_id: session.user.id, status: 'pending' })
    showToast(error ? 'No se pudo enviar la solicitud: ' + error.message : 'Solicitud enviada. Te confirmaremos cuando esté procesada.', error ? 'error' : 'success')
    if (!error) await pintar()
  })
}

const SECCIONES = {
  avisos: [avisosHtml, montarAvisos],
  cuenta: [cuentaHtml, montarCuenta],
  privacidad: [privacidadHtml, montarPrivacidad],
  apariencia: [aparienciaHtml, montarApariencia],
  datos: [datosHtml, () => {}],
  invitar: [invitarHtml, montarInvitar],
  borrar: [borrarHtml, montarBorrar],
}

function pintarLista(actual) {
  document.getElementById('ajLista').innerHTML = APARTADOS.map(
    (a) => `<a href="/ajustes?ver=${a.id}" data-ver="${a.id}"${a.peligro ? ' class="aj-peligro"' : ''}${a.id === actual ? ' aria-current="page"' : ''}>${icons[a.icono]?.(18) || ''}<span class="aj-texto">${escapeHtml(a.nombre)}${a.sub ? `<span class="aj-sub">${escapeHtml(a.sub)}</span>` : ''}</span></a>`
  ).join('')
}

function pintar() {
  const pedida = verPedida()
  // En el PC siempre hay un apartado abierto (Avisos); en el móvil, sin
  // `?ver=`, se ve la lista.
  const ver = apartadoDe(pedida) ? pedida : enMovil() ? '' : 'avisos'
  document.body.dataset.aj = ver ? 'seccion' : 'lista'
  pintarLista(ver)
  const migas = document.getElementById('ajMigas')
  const panel = document.getElementById('ajPanel')
  if (!ver) {
    migas.innerHTML = ''
    panel.innerHTML = ''
    document.title = 'Ajustes — PokeDoc'
    return
  }
  const a = apartadoDe(ver)
  migas.innerHTML = `<a href="/">Inicio</a> <span>›</span> <a href="/ajustes">Ajustes</a> <span>›</span> <span>${escapeHtml(a.nombre)}</span>`
  document.title = `${a.nombre} · Ajustes — PokeDoc`
  const [html, montar] = SECCIONES[ver]
  panel.innerHTML = html()
  montar(panel)
}

async function init() {
  session = await requireAuth()
  if (!session) return
  const { data } = await supabase.from('user_profiles').select('*').eq('id', session.user.id).single()
  perfil = data
  pintar()
  // La lista y las migas navegan sin recargar: en el móvil «atrás» vuelve
  // a la lista (una entrada por apartado); en el PC se sustituye.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('#ajLista a[data-ver], #ajMigas a[href="/ajustes"]')
    if (!a || e.metaKey || e.ctrlKey) return
    e.preventDefault()
    const url = new URL(a.href, location.href)
    if (enMovil()) history.pushState(null, '', url)
    else history.replaceState(null, '', url)
    pintar()
    window.scrollTo({ top: 0 })
  })
  window.addEventListener('popstate', pintar)
}

init()
