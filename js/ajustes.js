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
import { escapeHtml, requireAuth, passwordStrengthError, profileUrl } from './app.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { hojaInyectada } from './hoja.js'
import { NOTIFICATION_TYPES, EMAIL_TYPES, EMAIL_TYPES_EQUIPO } from './notifications.js'
import { estaActivo, conGrupo, seccionesDeAvisos, estadoDeSeccion, tiposEn } from './avisos-prefs.js'
import { FIESTAS_CON_DECORACION } from './fiestas-puro.js'
import { LLAVE_SIN_GLOSARIO, glosarioApagado } from './glosario-ajuste.js'

const APARTADOS = [
  { id: 'avisos', nombre: 'Avisos', sub: 'Campanita, correo y push', icono: 'bell' },
  { id: 'cuenta', nombre: 'Cuenta', sub: 'Correo, contraseña, cumpleaños, Play! Pokémon', icono: 'user' },
  { id: 'direccion', nombre: 'Envío y pagos', sub: 'Tu dirección, tu Bizum y tu PayPal', icono: 'package' },
  { id: 'seguridad', nombre: 'Seguridad', sub: 'Doble factor y sesiones abiertas', icono: 'shield' },
  { id: 'privacidad', nombre: 'Privacidad', sub: 'Tu actividad en Comunidad', icono: 'eye' },
  { id: 'apariencia', nombre: 'Apariencia', sub: 'Tema, letra, contraste y fiestas', icono: 'palette' },
  { id: 'datos', nombre: 'Tus datos', sub: 'Descargar todo, exportar e importar', icono: 'upload' },
  { id: 'calendario', nombre: 'Calendario', sub: 'Tus torneos y eventos en el calendario del móvil', icono: 'calendar' },
  { id: 'instalar', nombre: 'Instalar PokeDoc', sub: 'Como una app, en el móvil o el ordenador', icono: 'home' },
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

// ── Avisos (1149, C1 de «Cuatro pantallas más») ──
// En el PC, una TABLA: una fila por cosa que te puede pasar, agrupadas por
// sección, y una columna por canal (campanita y correo), con el interruptor
// de toda la sección en su cabecera. El push va encima: no es por tipo, es
// un interruptor por dispositivo que manda lo de la campanita. En el móvil
// no cabe la tabla: los tres canales arriba, como antes, y las secciones
// plegadas con «3 de 4» y su interruptor. Lo que se guarda no cambia: las
// mismas dos columnas de tipos apagados (SCHEMA 1149).
function avisosHtml() {
  return `
    <h2>Avisos</h2>
    <p>De qué te avisamos y por dónde. Se guarda al tocar cada uno.</p>
    <div class="aj-push-pc" id="ajAvisosPush"></div>
    <div class="seg aj-canales" role="tablist" aria-label="Canal">
      <button type="button" class="seg-btn" data-canal="campanita" aria-pressed="true">${icons.bell(16)} En la campanita</button>
      <button type="button" class="seg-btn" data-canal="correo" aria-pressed="false">${icons.mail(16)} Por correo</button>
      <button type="button" class="seg-btn" data-canal="push" aria-pressed="false">${icons.zap(16)} Push</button>
    </div>
    <div id="ajCanal"></div>`
}

const COLUMNA_DE = { campanita: 'notification_prefs_disabled', correo: 'notification_email_disabled' }
const NOMBRE_DE_CANAL = { campanita: 'Campanita', correo: 'Correo' }

function montarAvisos(panel) {
  const caja = panel.querySelector('#ajCanal')
  const tiposDe = () => ({ campanita: NOTIFICATION_TYPES, correo: { ...EMAIL_TYPES, ...(perfil?.is_admin ? EMAIL_TYPES_EQUIPO : {}) } })
  const secciones = seccionesDeAvisos(tiposDe())
  const abiertas = new Set()
  let canal = 'campanita'
  let modo = null

  const sw = (atributos, puesto, rotulo) => `<input type="checkbox" role="switch" class="aj-sw" ${atributos} ${puesto === 'si' || puesto === true ? 'checked' : ''} ${puesto === 'medias' ? 'data-medias' : ''} aria-label="${escapeHtml(rotulo)}">`
  const activoEn = (fila, c) => estaActivo({ tipos: tiposEn(fila, tiposDe()[c]) }, perfil?.[COLUMNA_DE[c]])

  function tabla() {
    const canales = ['campanita', 'correo']
    return `<div class="aj-tabla" role="table" aria-label="Avisos por canal">
      <div class="aj-tabla-fila aj-tabla-cab" role="row"><span role="columnheader">Aviso</span>${canales.map((c) => `<span role="columnheader">${icons[c === 'correo' ? 'mail' : 'bell'](15)} ${NOMBRE_DE_CANAL[c]}</span>`).join('')}</div>
      ${secciones.map((s) => `
        <div class="aj-tabla-fila aj-tabla-seccion" role="row"><b role="rowheader">${escapeHtml(s.titulo)}</b>${canales.map((c) => {
          const e = estadoDeSeccion(s, tiposDe()[c], perfil?.[COLUMNA_DE[c]])
          return `<span role="cell">${e ? sw(`data-seccion="${s.id}" data-canal-de="${c}"`, e, `${s.titulo}: ${NOMBRE_DE_CANAL[c]}, todo`) : ''}</span>`
        }).join('')}</div>
        ${s.filas.map((f) => `<div class="aj-tabla-fila" role="row"><span role="rowheader">${escapeHtml(f.titulo)}</span>${canales.map((c) => `<span role="cell">${tiposEn(f, tiposDe()[c]).length ? sw(`data-interruptor="${f.id}" data-canal-de="${c}"`, activoEn(f, c), `${f.titulo}: ${NOMBRE_DE_CANAL[c]}`) : '<span class="aj-sin" title="No llega por aquí">—</span>'}</span>`).join('')}</div>`).join('')}`).join('')}
    </div>`
  }

  function lista(c) {
    const tipos = tiposDe()[c]
    return (c === 'correo' ? `<p class="aj-nota">Solo te escribimos cuando alguien se dirige a ti directamente. Aunque lo desactives, lo seguirás viendo al entrar en la web.</p>` : '') +
      `<div class="aj-grupos">${secciones.map((s) => {
        const filas = s.filas.filter((f) => tiposEn(f, tipos).length)
        if (!filas.length) return ''
        const puestas = filas.filter((f) => activoEn(f, c)).length
        const abierta = abiertas.has(s.id)
        return `<div class="aj-grupo${abierta ? ' abierta' : ''}">
          <div class="aj-grupo-cab"><button type="button" class="aj-grupo-abrir" data-abrir="${s.id}" aria-expanded="${abierta}"><b>${escapeHtml(s.titulo)}</b><small>${puestas} de ${filas.length}</small>${icons.chevronRight(16)}</button>${sw(`data-seccion="${s.id}" data-canal-de="${c}"`, estadoDeSeccion(s, tipos, perfil?.[COLUMNA_DE[c]]), `${s.titulo}, todo`)}</div>
          <div class="aj-filas" ${abierta ? '' : 'hidden'}>${filas.map((f) => `<label class="aj-interruptor"><span>${escapeHtml(f.titulo)}</span>${sw(`data-interruptor="${f.id}" data-canal-de="${c}"`, activoEn(f, c), f.titulo)}</label>`).join('')}</div>
        </div>`
      }).join('')}</div>`
  }

  function pintar() {
    modo = enMovil() ? 'movil' : 'pc'
    panel.classList.toggle('aj-avisos-pc', modo === 'pc')
    for (const b of panel.querySelectorAll('[data-canal]')) b.setAttribute('aria-pressed', String(b.dataset.canal === canal))
    if (modo === 'movil' && canal === 'push') return pintarPush(caja)
    caja.innerHTML = modo === 'pc' ? tabla() : lista(canal)
    // «A medias» no es un atributo de HTML: se pone a mano.
    for (const i of caja.querySelectorAll('[data-medias]')) i.indeterminate = true
  }
  // El push del PC, una vez (pide al navegador; no se repinta con la tabla).
  let pushPintado = false
  const pintarPushPc = () => {
    if (pushPintado || enMovil()) return
    pushPintado = true
    pintarPush(panel.querySelector('#ajAvisosPush'))
  }

  // Cambia YA, confirma después y vuelve si la base dice que no (896).
  async function poner(c, tipos, activo) {
    const col = COLUMNA_DE[c]
    const antes = perfil?.[col] || []
    const nuevo = conGrupo(antes, { tipos }, activo)
    perfil = { ...perfil, [col]: nuevo }
    pintar()
    const ok = await guardar({ [col]: nuevo })
    if (!ok) {
      perfil = { ...perfil, [col]: antes }
      pintar()
    }
  }

  caja.addEventListener('change', (e) => {
    const i = e.target.closest('input[data-canal-de]')
    if (!i) return
    const c = i.dataset.canalDe
    if (i.dataset.seccion) {
      const s = secciones.find((x) => x.id === i.dataset.seccion)
      return void poner(c, s.filas.flatMap((f) => tiposEn(f, tiposDe()[c])), i.checked)
    }
    const f = secciones.flatMap((x) => x.filas).find((x) => x.id === i.dataset.interruptor)
    if (f) poner(c, tiposEn(f, tiposDe()[c]), i.checked)
  })
  caja.addEventListener('click', (e) => {
    const b = e.target.closest('[data-abrir]')
    if (!b) return
    abiertas.has(b.dataset.abrir) ? abiertas.delete(b.dataset.abrir) : abiertas.add(b.dataset.abrir)
    pintar()
  })
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-canal]')
    if (!b || !caja.isConnected) return
    canal = b.dataset.canal
    pintar()
  })
  window.matchMedia('(max-width: 900px)').addEventListener('change', () => {
    if (!caja.isConnected) return
    pintar()
    pintarPushPc()
  })
  pintar()
  pintarPushPc()
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
      zona.innerHTML = interruptor({ id: 'push', texto: 'Avisos en este dispositivo', detalle: suscrito ? 'Activados en este navegador' : 'Desactivados en este navegador', activo: suscrito }) +
        (suscrito ? '<div class="aj-push-prueba"><button type="button" class="btn-secondary" id="ajPushProbar">Enviarme un aviso de prueba</button><p class="aj-nota" id="ajPushProbarTexto" aria-live="polite"></p></div>' : '')
      // Con los avisos puestos, este dispositivo se vuelve a dar de alta
      // (993): si su fila se perdió, el interruptor decía «Activados» igual.
      if (suscrito) push.sincronizarPush(session.user.id).catch(() => {})
      zona.querySelector('#ajPushProbar')?.addEventListener('click', async (e) => {
        const b = e.currentTarget
        const texto = zona.querySelector('#ajPushProbarTexto')
        b.disabled = true
        texto.textContent = 'Enviando…'
        await push.sincronizarPush(session.user.id).catch(() => {})
        const r = await push.probarPush()
        texto.textContent = r.ok ? `Enviado${r.dispositivos > 1 ? ` a tus ${r.dispositivos} dispositivos` : ''}. Si en unos segundos no te sale, mira que el móvil deje mostrar notificaciones de PokeDoc.` : r.motivo
        b.disabled = false
      })
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
      <input type="date" id="ajCumple" value="" aria-label="Cumpleaños" disabled />
      <p class="aj-nota">Si lo pones, el día señalado el foro te felicita en «El foro en números». Solo se ve el día y el mes, nunca el año. Bórralo cuando quieras.</p>
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
  // El cumpleaños es opcional: vacío = quitarlo. Desde la 1304 la fecha
  // entera va en su tabla privada (js/cumple.js); en público, solo día y mes.
  ;(async () => {
    const campo = panel.querySelector('#ajCumple')
    const { leerCumple, guardarCumple } = await import('./cumple.js')
    const { fecha, privado } = await leerCumple(supabase, session.user.id, perfil)
    campo.value = fecha
    campo.disabled = false
    campo.addEventListener('change', async (e) => {
      const error = await guardarCumple(supabase, session.user.id, e.target.value, privado)
      if (error) return showToast('No se ha podido guardar: ' + error.message)
      showToast(e.target.value ? 'Cumpleaños guardado.' : 'Cumpleaños quitado.', 'success')
    })
  })().catch(() => {})
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

// ── Dirección de envío (1102) ──
// La de los cambios por correo: solo la ves tú, y la otra persona de un
// trato por correo que hayáis aceptado (una copia en ese trato).
const direccionHtml = () => `
    <h2>Envío y pagos</h2>
    <h3>Dirección de envío</h3>
    <p class="aj-nota">Para los cambios y las ventas por correo: sale ya puesta al aceptar un trato. No sale en tu perfil ni en los mensajes; solo la ve quien te manda cartas en un trato por correo aceptado, y solo para ese trato.</p>
    <div id="ajDireccion"><p class="aj-nota">Cargando…</p></div>
    <h3>Para cobrar</h3>
    <p class="aj-nota">Cuando te paguen un trato por Bizum o PayPal, sale ya puesto. Solo lo ve quien te paga, en ese trato.</p>
    <div id="ajCobro"><p class="aj-nota">Cargando…</p></div>`

async function montarDireccion(panel) {
  hojaInyectada('css/cambio-propuesta.css')
  const { miDireccion, guardarMiDireccion, borrarMiDireccion, camposHtml, MIGRACION_DIRECCION } = await import('./cambio-direccion.js')
  const { validarDireccion } = await import('./cambio-propuesta-puro.js')
  const caja = panel.querySelector('#ajDireccion')
  const pintarla = (fila) => {
    caja.innerHTML = `<form class="aj-form aj-direccion" id="ajDirForm" novalidate>${camposHtml(fila || {})}
      <p class="cp-dir-error" id="ajDirError" role="alert" hidden></p>
      <div class="aj-dir-botones"><button type="submit" class="btn-primary">Guardar</button>${fila ? '<button type="button" class="btn-secondary" id="ajDirBorrar">Borrarla</button>' : ''}</div></form>`
    caja.querySelector('#ajDirForm').addEventListener('submit', async (e) => {
      e.preventDefault()
      const crudo = {}
      for (const i of caja.querySelectorAll('[data-dir]')) crudo[i.dataset.dir] = i.value
      const { dir, error } = validarDireccion(crudo)
      const aviso = caja.querySelector('#ajDirError')
      aviso.textContent = error || ''
      aviso.hidden = !error
      if (error) return
      const err = await guardarMiDireccion(session.user.id, dir)
      showToast(err ? 'No se ha podido guardar: ' + err.message : 'Dirección guardada.', err ? 'error' : 'success')
      if (!err) pintarla(dir)
    })
    caja.querySelector('#ajDirBorrar')?.addEventListener('click', async (e) => {
      // Dos toques: no hay vuelta atrás.
      if (!e.currentTarget.dataset.seguro) {
        e.currentTarget.dataset.seguro = '1'
        e.currentTarget.textContent = 'Pulsa otra vez para borrarla'
        return
      }
      const err = await borrarMiDireccion(session.user.id)
      showToast(err ? 'No se ha podido borrar: ' + err.message : 'Dirección borrada.', err ? 'error' : 'success')
      if (!err) pintarla(null)
    })
  }
  void montarCobro(panel)
  const fila = await miDireccion(session.user.id)
  if (fila === undefined) {
    caja.innerHTML = `<p class="aj-nota">Todavía no se puede guardar: falta ejecutar ${escapeHtml(MIGRACION_DIRECCION)}.</p>`
    return
  }
  pintarla(fila)
}

// Tu Bizum y tu PayPal (1107): los dos opcionales; vacío es quitarlo.
async function montarCobro(panel) {
  const { miCobro, guardarMiCobro, MIGRACION_COBRO } = await import('./cambio-direccion.js')
  const { validarCobro, COMOS_CON_DATO, datoBonito } = await import('./cambio-propuesta-puro.js')
  const caja = panel.querySelector('#ajCobro')
  const fila = await miCobro(session.user.id)
  if (fila === undefined) {
    caja.innerHTML = `<p class="aj-nota">Todavía no se puede guardar: falta ejecutar ${escapeHtml(MIGRACION_COBRO)}.</p>`
    return
  }
  caja.innerHTML = `<form class="aj-form aj-direccion" id="ajCobroForm" novalidate><div class="cp-campos">${Object.entries(COMOS_CON_DATO).map(([id, c]) => `<label class="cp-campo cp-campo-nombre"><span>${escapeHtml(c.campo)} <small>(opcional)</small></span><input type="${c.tipo}" data-cobro-ajuste="${id}" maxlength="120" autocomplete="${c.auto}" placeholder="${escapeHtml(c.ejemplo)}" value="${escapeHtml(id === 'bizum' ? datoBonito('bizum', fila?.bizum) : fila?.[id] || '')}"></label>`).join('')}</div>
    <p class="cp-dir-error" id="ajCobroError" role="alert" hidden></p>
    <div class="aj-dir-botones"><button type="submit" class="btn-primary">Guardar</button></div></form>`
  caja.querySelector('#ajCobroForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const campos = {}
    const errores = []
    for (const i of caja.querySelectorAll('[data-cobro-ajuste]')) {
      const como = i.dataset.cobroAjuste
      if (!i.value.trim()) { campos[como] = null; continue }
      const { dato, error } = validarCobro(como, i.value)
      if (error) errores.push(error)
      campos[como] = dato
    }
    const aviso = caja.querySelector('#ajCobroError')
    aviso.textContent = errores.join(' ')
    aviso.hidden = !errores.length
    if (errores.length) return
    const err = await guardarMiCobro(session.user.id, campos)
    showToast(err ? 'No se ha podido guardar: ' + err.message : 'Guardado.', err ? 'error' : 'success')
  })
}

// ── Privacidad ──
const privacidadHtml = () => `
    <h2>Privacidad</h2>
    <div class="aj-filas">
      ${interruptor({ id: 'hide_activity', texto: 'No mostrar mi actividad en Comunidad', detalle: 'Lo que leas y los cursos que hagas dejan de aparecer en el hilo de actividad y de ser visibles para el resto.', activo: Boolean(perfil?.hide_activity) })}
      ${interruptor({ id: 'coleccion_publica', texto: 'Mi colección es pública', detalle: 'Cualquiera con el enlace puede ver tus cartas y lo que valen. Privada, solo la ves tú. Desde Mi colección se copia el enlace.', activo: Boolean(perfil?.coleccion_publica) })}
    </div>
    <h3>Lo que ve alguien sin cuenta</h3>
    <p class="aj-nota">Tu nombre, tu foto, tu nivel y tus logros, tus temas y guías y, si es pública, tu colección. Nunca tu cumpleaños con el año, tus guardados, quién te invitó ni tus datos de envío o de pago.</p>
    ${perfil?.id ? `<a class="btn-secondary" href="${profileUrl(perfil)}${perfil.username ? '?' : '&'}como=desconocido" data-ver-desconocido>${icons.eye(16)} Ver mi perfil como un desconocido</a>` : ''}`

function montarPrivacidad(panel) {
  panel.querySelector('[data-interruptor="hide_activity"]').addEventListener('change', async (e) => {
    if (!(await guardar({ hide_activity: e.target.checked }))) e.target.checked = !e.target.checked
  })
  // Antes vivía en el Panel de Mi colección (1015, L7).
  panel.querySelector('[data-interruptor="coleccion_publica"]').addEventListener('change', async (e) => {
    if (!(await guardar({ coleccion_publica: e.target.checked }))) e.target.checked = !e.target.checked
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
    </div>
    <h3>Letra</h3>
    <div class="seg aj-letra" role="group" aria-label="Tamaño de la letra">
      ${[['', 'Normal', 'aj-aa-1'], ['grande', 'Grande', 'aj-aa-2'], ['muy-grande', 'Muy grande', 'aj-aa-3']]
        .map(([v, t, c]) => `<button type="button" class="seg-btn" data-letra="${v}" aria-pressed="${letraGuardada() === v}"><span class="${c}" aria-hidden="true">Aa</span><span>${t}</span></button>`).join('')}
    </div>
    ${interruptor({ id: 'contraste', texto: 'Más contraste', detalle: 'Los textos grises y los bordes, más marcados.', activo: contrasteGuardado() })}
    <p class="aj-vista-letra" aria-hidden="true">Así se verá: <b>Lugia V</b> · 212,40 € · <span class="subtext">hace 2 h</span></p>
    <h3>Fiestas</h3>
    ${interruptor({ id: 'decoracion', texto: 'Decoración de las fiestas', detalle: 'Halloween, Navidad… La web se viste sola en las fechas señaladas.', activo: conDecoracion() })}
    <h3>Lectura</h3>
    ${interruptor({ id: 'glosario', texto: 'Definiciones del glosario', detalle: 'En guías y en el foro, las palabras del glosario salen subrayadas y te dicen qué significan. Quítalo si ya te las sabes.', activo: !glosarioApagado() })}`

// La letra y el contraste (1324, D5): en este navegador, y los aplica la
// cabecera de cada página antes del primer pintado (como el tema).
function letraGuardada() {
  try { const l = localStorage.getItem('pd-letra'); return l === 'grande' || l === 'muy-grande' ? l : '' } catch { return '' }
}
function contrasteGuardado() {
  try { return localStorage.getItem('pd-contraste') === '1' } catch { return false }
}

// La decoración de las fiestas (1286): apagarla es `pd-sin-<fiesta>` en este
// navegador, la misma llave que «Quitar la decoración» del pop-up.
function conDecoracion() {
  try { return FIESTAS_CON_DECORACION.every((f) => localStorage.getItem(`pd-sin-${f}`) !== '1') } catch { return true }
}

function montarApariencia(panel) {
  panel.querySelector('.aj-letra')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-letra]')
    if (!b) return
    const v = b.dataset.letra
    try { if (v) localStorage.setItem('pd-letra', v); else localStorage.removeItem('pd-letra') } catch {}
    if (v) document.documentElement.dataset.letra = v
    else delete document.documentElement.dataset.letra
    for (const x of panel.querySelectorAll('[data-letra]')) x.setAttribute('aria-pressed', String(x === b))
  })
  panel.querySelector('[data-interruptor="contraste"]')?.addEventListener('change', (e) => {
    try { if (e.target.checked) localStorage.setItem('pd-contraste', '1'); else localStorage.removeItem('pd-contraste') } catch {}
    if (e.target.checked) document.documentElement.dataset.contraste = '1'
    else delete document.documentElement.dataset.contraste
  })
  panel.querySelector('[data-interruptor="glosario"]')?.addEventListener('change', (e) => {
    try {
      if (e.target.checked) localStorage.removeItem(LLAVE_SIN_GLOSARIO)
      else localStorage.setItem(LLAVE_SIN_GLOSARIO, '1')
    } catch { /* sin almacenamiento: no se puede recordar */ }
  })
  panel.querySelector('[data-interruptor="decoracion"]')?.addEventListener('change', (e) => {
    try {
      for (const f of FIESTAS_CON_DECORACION) {
        if (e.target.checked) localStorage.removeItem(`pd-sin-${f}`)
        else localStorage.setItem(`pd-sin-${f}`, '1')
      }
    } catch { /* sin almacenamiento: no se puede recordar */ }
    // Si hoy hay fiesta, se ve al momento.
    if (document.documentElement.dataset.temporada || e.target.checked) location.reload()
  })
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
    <p>Lo tuyo es tuyo: te lo llevas entero cuando quieras, y traes tu colección de otra app.</p>
    <div class="aj-dato"><span>Descargar todo<br><small class="subtext" id="ajDescargaEstado">Un ZIP con tu cuenta, tu perfil, tu colección (también en CSV), deseos, mazos, partidas, temas, mensajes que enviaste, tratos y avisos. Se hace en tu navegador.</small></span><button type="button" class="btn-primary" id="ajDescargar">Descargar</button></div>
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
    <p>Comparte tu enlace: quien se una con él y tú os lleváis logros y XP.<span id="ajTraidos"></span></p>
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
    const { misInvitados } = await import('./perfil-privado.js')
    const { total: count, error } = await misInvitados(supabase, session.user.id)
    const hueco = panel.querySelector('#ajTraidos')
    if (!error && count != null && hueco) hueco.textContent = ` Has traído a ${count || 0} ${count === 1 ? 'persona' : 'personas'}.`
  } catch {}
}

// ── Tus datos: descargar todo (1314) ──
function montarDatos(panel) {
  const btn = panel.querySelector('#ajDescargar')
  const estado = panel.querySelector('#ajDescargaEstado')
  btn?.addEventListener('click', async () => {
    btn.disabled = true
    const antes = estado.textContent
    try {
      const { prepararMisDatos } = await import('./mis-datos.js')
      const { bytes, resumen } = await prepararMisDatos(supabase, session.user.id, (t) => { estado.textContent = t })
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `pokedoc-${perfil?.username || 'mis-datos'}-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.append(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      estado.textContent = `Listo: ${resumen.leidas.length} cosas tuyas en el ZIP.`
    } catch (e) {
      estado.textContent = antes
      showToast('No se ha podido preparar la descarga: ' + (e?.message || e), 'error')
    } finally {
      btn.disabled = false
    }
  })
}

// ── Borrar mi cuenta (1314) ──
// Tres pasos (por qué, qué se borra y qué queda, escribir tu usuario) y 14
// días para arrepentirse. Lo hace la base (`cuenta_pedir_borrado`, migración
// 1314); sin la migración, la solicitud de siempre para el equipo.
const fechaLarga = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
const borrarHtml = () => `
    <h2>Borrar mi cuenta</h2>
    <div id="ajBorrarCaja"><p class="aj-nota">Cargando…</p></div>`

async function montarBorrar(panel) {
  const caja = panel.querySelector('#ajBorrarCaja')
  const usuario = perfil?.username || ''
  let paso = 1
  let motivo = ''
  const pintarPendiente = (r) => {
    caja.innerHTML = r.borrar_at
      ? `<div class="aj-borrar-aviso"><p><strong>Tu cuenta se borrará el ${escapeHtml(fechaLarga(r.borrar_at))}.</strong></p><p>Hasta entonces todo sigue igual. Si cambias de idea, cancélalo aquí.</p><button type="button" class="btn-primary" id="ajBorrarCancelar">Cancelar el borrado</button></div>`
      : `<div class="aj-borrar-aviso"><p><strong>Tu solicitud de borrado está pendiente.</strong></p><p>Es una cuenta de tienda: el equipo la revisa para que sus ventas cuadren y te escribe.</p><button type="button" class="btn-secondary" id="ajBorrarCancelar">Cancelar la solicitud</button></div>`
    caja.querySelector('#ajBorrarCancelar').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true
      const { error } = await supabase.rpc('cuenta_cancelar_borrado')
      showToast(error ? 'No se ha podido cancelar: ' + error.message : 'Cancelado. Tu cuenta sigue aquí.', error ? 'error' : 'success')
      await pintar()
    })
  }
  const pintarPaso = () => {
    const pasos = `<ol class="aj-pasos" aria-label="Paso ${paso} de 3">${[1, 2, 3].map((n) => `<li${n === paso ? ' aria-current="step"' : ''}${n < paso ? ' class="hecho"' : ''}>${n}</li>`).join('')}</ol>`
    if (paso === 1) {
      caja.innerHTML = `${pasos}<p>¿Por qué te vas? (no hace falta, pero nos ayuda)</p>
        <textarea class="aj-campo" id="ajBorrarMotivo" rows="3" maxlength="500" placeholder="Opcional">${escapeHtml(motivo)}</textarea>
        <p class="aj-nota">¿Prefieres llevarte antes tus cosas? <a href="/ajustes?ver=datos">Descarga tus datos</a>.</p>
        <div class="aj-borrar-botones"><button type="button" class="btn-secondary aj-borrar" id="ajBorrarSig">Siguiente</button></div>`
    } else if (paso === 2) {
      caja.innerHTML = `${pasos}
        <div class="aj-borrar-lista"><p><strong>Esto se borra</strong></p><p>Tu perfil (nombre, foto, bio), tu colección, deseos, álbumes, mazos y partidas, tus mensajes privados, tus direcciones y cobros guardados, tus avisos y a quién sigues.</p></div>
        <div class="aj-borrar-lista"><p><strong>Esto queda, sin tu nombre</strong></p><p>Tus temas y respuestas del foro y los tratos cerrados: la otra persona y el foro los necesitan. Saldrán como «Usuario borrado».</p></div>
        <div class="aj-borrar-lista"><p><strong>Puedes volver atrás</strong></p><p>Se borra dentro de 14 días. Hasta entonces, entrando lo cancelas.</p></div>
        <div class="aj-borrar-botones"><button type="button" class="btn-secondary" id="ajBorrarAtras">Atrás</button><button type="button" class="btn-secondary aj-borrar" id="ajBorrarSig">Siguiente</button></div>`
    } else {
      caja.innerHTML = `${pasos}<p>Para confirmarlo, escribe tu nombre de usuario: <strong>${escapeHtml(usuario)}</strong></p>
        <input class="aj-campo" id="ajBorrarUsuario" autocomplete="off" autocapitalize="none" spellcheck="false" />
        <div class="aj-borrar-botones"><button type="button" class="btn-secondary" id="ajBorrarAtras">Atrás</button><button type="button" class="btn-primary aj-borrar-ya" id="ajBorrarYa" disabled>Borrar mi cuenta</button></div>`
      const campo = caja.querySelector('#ajBorrarUsuario')
      const ya = caja.querySelector('#ajBorrarYa')
      campo.addEventListener('input', () => { ya.disabled = campo.value.trim().toLowerCase() !== usuario.toLowerCase() })
      ya.addEventListener('click', async () => {
        ya.disabled = true
        const r = await supabase.rpc('cuenta_pedir_borrado', { p_motivo: motivo || null })
        if (r.error && /cuenta_pedir_borrado|PGRST202|42883/.test(`${r.error.message} ${r.error.code}`)) {
          // Sin la migración 1314: la solicitud de antes, para el equipo.
          const { error } = await supabase.from('account_deletion_requests').insert({ user_id: session.user.id, status: 'pending', reason: motivo || null })
          showToast(error ? 'No se ha podido enviar: ' + error.message : 'Solicitud enviada. El equipo la confirmará.', error ? 'error' : 'success')
        } else if (r.error) {
          showToast('No se ha podido pedir el borrado: ' + r.error.message, 'error')
        } else {
          showToast(r.data ? `Hecho. Tu cuenta se borrará el ${fechaLarga(r.data)}.` : 'Hecho. El equipo revisará tu tienda.', 'success')
        }
        await pintar()
      })
    }
    caja.querySelector('#ajBorrarAtras')?.addEventListener('click', () => { paso--; pintarPaso() })
    caja.querySelector('#ajBorrarSig')?.addEventListener('click', () => {
      if (paso === 1) motivo = caja.querySelector('#ajBorrarMotivo').value.trim()
      paso++
      pintarPaso()
    })
  }
  const pintar = async () => {
    const r = await supabase.rpc('cuenta_borrado_pendiente')
    let pendiente = !r.error && (Array.isArray(r.data) ? r.data[0] : r.data)
    if (r.error) {
      // Sin la migración: la tabla de siempre.
      const { data } = await supabase.from('account_deletion_requests').select('created_at').eq('user_id', session.user.id).eq('status', 'pending').maybeSingle()
      pendiente = data ? { borrar_at: null } : null
    }
    if (pendiente) return pintarPendiente(pendiente)
    paso = 1
    pintarPaso()
  }
  await pintar()
}

const SECCIONES = {
  avisos: [avisosHtml, montarAvisos],
  cuenta: [cuentaHtml, montarCuenta],
  direccion: [direccionHtml, montarDireccion],
  // Seguridad (1307) entra por import(): solo la baja quien la abre.
  seguridad: [() => '<h2>Seguridad</h2><p class="aj-nota">Cargando…</p>', (panel) => import('./ajustes-seguridad.js').then((m) => { panel.innerHTML = m.seguridadHtml(); m.montarSeguridad(panel) }).catch(() => { panel.innerHTML = '<h2>Seguridad</h2><p class="aj-nota">No se ha podido cargar. Recarga la página.</p>' })],
  privacidad: [privacidadHtml, montarPrivacidad],
  apariencia: [aparienciaHtml, montarApariencia],
  datos: [datosHtml, montarDatos],
  // Calendario (1321): js/ajustes-calendario.js, solo para quien lo abre.
  calendario: [() => '<h2>Calendario</h2><p class="aj-nota">Cargando…</p>', (panel) => import('./ajustes-calendario.js').then((m) => m.montarCalendario(panel)).catch(() => { panel.innerHTML = '<h2>Calendario</h2><p class="aj-nota">No se ha podido cargar. Recarga la página.</p>' })],
  // Instalar (1317): js/ajustes-instalar.js, que solo baja quien lo abre.
  instalar: [() => '<h2>Instalar PokeDoc</h2><p class="aj-nota">Cargando…</p>', (panel) => import('./ajustes-instalar.js').then((m) => { panel.innerHTML = m.instalarHtml(); m.montarInstalarEnAjustes(panel) }).catch(() => { panel.innerHTML = '<h2>Instalar PokeDoc</h2><p class="aj-nota">No se ha podido cargar. Recarga la página.</p>' })],
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
  panel.classList.remove('aj-avisos-pc')
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
