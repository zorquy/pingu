// /mensajes: la bandeja y cada conversación (tanda 891: fotos, días,
// «visto», no leídos y el cuadro de escribir pegado abajo). Lo puro vive
// en js/mensajes-puro.js; las fotos en js/mensajes-adjuntos.js.
import { supabase } from './supabase.js'
import { escapeHtml, getInitial, requireAuth, profileUrl, avatarStyle } from './app.js'
import {
  listConversations,
  loadThreadMessages,
  markConversationRead,
  sendMessage,
  deleteMessage,
  getOtherParticipant,
  otherLastReadAt,
  findOrCreateConversation,
  isParticipant,
  miFilaDeConversacion,
  ponerEnConversacion,
  reaccionesDe,
  reaccionar,
} from './messages.js'
import { reportButtonHtml, wireReportButtons } from './report.js'
import { icons } from './icons.js'
import { conVueltaAtras, terminoParaFiltro } from './busqueda.js'
import { perfilesMencionados, enlazarMenciones, porNombre } from './menciones.js'
import { atributosDeRango } from './rangos.js'
import { showToast } from './toast.js'
import { agruparPorDia, horaDe, ultimoVisto, resumenDeUltimo, adjuntosDe, cartasDe, propuestaDe, cabenAdjuntos, enterEnvia, MAX_FOTOS, estaArchivada, REACCIONES_MENSAJE, reaccionesDeMensaje, citaDe } from './mensajes-puro.js'

const root = document.getElementById('messagesRoot')
const params = new URLSearchParams(window.location.search)

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d`
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const enPC = () => window.matchMedia('(min-width: 1100px)').matches
// Enter envía solo con ratón y teclado de verdad (la decisión 1 de la 891).
const conRaton = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

// ── La bandeja ──

// Una fila de la lista; `actual` marca la conversación abierta (789, PA13).
function filaDeConversacion(c, miId, actual = null) {
  const p = c.otherProfile
  const name = p?.display_name || p?.username || 'Usuario'
  const ultimo = resumenDeUltimo(c.lastMessage, c.lastMessage?.sender_id === miId)
  // El doble check verde (891): lo último es tuyo y ya lo ha leído.
  const vistoMio = !!c.lastMessage && c.lastMessage.sender_id === miId && c.otroLeyoHasta && new Date(c.otroLeyoHasta) >= new Date(c.lastMessage.created_at)
  return `
      <a class="msg-fila${c.conversationId === actual ? ' activa' : ''}${c.noLeidos ? ' noleida' : ''}" href="/mensajes.html?c=${c.conversationId}"${c.conversationId === actual ? ' aria-current="page"' : ''} data-nombre="${escapeHtml(name.toLowerCase())}">
        <span class="mini-avatar msg-fila-avatar" style="${avatarStyle(p)}"${p?.id ? ` data-en-linea="${escapeHtml(p.id)}"` : ''}>${p?.avatar_url ? '' : getInitial(name)}</span>
        <span class="msg-fila-cuerpo">
          <span class="msg-fila-nombre"><strong>${escapeHtml(name)}</strong>${c.fijadaAt ? `<i class="msg-fijada" title="Fijada">${icons.pin(13)}</i>` : ''}${c.lastMessage ? `<time>${timeAgo(c.lastMessage.created_at)}</time>` : ''}</span>
          <span class="msg-fila-ultimo">${vistoMio ? `<i class="msg-check">${icons.checkCircle(13)}</i>` : ''}${ultimo.foto ? `<i class="msg-foto-ico">${icons.image(13)}</i>` : ''}<span>${escapeHtml(ultimo.texto)}</span></span>
        </span>
        ${c.noLeidos ? `<span class="msg-noleidos" aria-label="${c.noLeidos} sin leer">${c.noLeidos > 99 ? '99+' : c.noLeidos}</span>` : ''}
      </a>`
}

// Más de diez conversaciones: un buscador que filtra por nombre, aquí
// mismo, sin consulta.
function buscadorHtml(cuantas) {
  if (cuantas < 10) return ''
  return `<div class="search-input-wrap msg-buscar"><input type="search" enterkeyhint="search" class="search-input" id="msgBuscar" placeholder="Buscar conversación" aria-label="Buscar conversación" /></div>`
}
function engancharBuscador(caja) {
  const campo = caja.querySelector('#msgBuscar')
  if (!campo) return
  campo.addEventListener('input', () => {
    const q = campo.value.trim().toLowerCase()
    caja.querySelectorAll('.msg-fila').forEach((f) => {
      f.hidden = !!q && !f.dataset.nombre.includes(q)
    })
  })
}

// El punto verde de quien está en línea (1140), por `import()`.
const marcarEnLineaEn = (raiz) => import('./en-linea.js').then((m) => m.marcarEnLinea(raiz)).catch(() => null)

// Las archivadas (1141) van al final, plegadas; vuelven solas a la lista
// cuando llega un mensaje nuevo (`estaArchivada`).
function listaHtml(list, miId, actual) {
  if (!list.length) return '<p class="subtext msg-vacio">Todavía no tienes conversaciones.</p>'
  const archivadas = list.filter(estaArchivada)
  const vivas = list.filter((c) => !estaArchivada(c))
  return `${vivas.map((c) => filaDeConversacion(c, miId, actual)).join('')}${
    archivadas.length
      ? `<details class="msg-archivadas"${archivadas.some((c) => c.conversationId === actual) ? ' open' : ''}><summary>${icons.folder(14)} Archivadas (${archivadas.length})</summary>${archivadas.map((c) => filaDeConversacion(c, miId, actual)).join('')}</details>`
      : ''
  }`
}

// La lista de la izquierda en el PC, al lado de lo que esté abierto.
async function pintarListaLateral(session, actual) {
  const caja = document.getElementById('msgLista')
  if (!caja || !enPC()) return
  const list = await listConversations(session.user.id).catch(() => [])
  caja.innerHTML = `<div class="msg-lista-cabeza"><h2>Mensajes</h2><a class="btn-secondary" href="/mensajes.html?new=1">${icons.edit(14)} Nueva</a></div>${buscadorHtml(list.length)}<div class="msg-filas">${listaHtml(list, session.user.id, actual)}</div>`
  engancharBuscador(caja)
  marcarEnLineaEn(caja)
  caja.classList.remove('hidden')
  document.querySelector('.msg-dos')?.classList.add('con-lista')
}

async function renderInbox(session) {
  // En el PC la lista ya está a la izquierda: a la derecha, a elegir.
  if (enPC()) {
    await pintarListaLateral(session, null)
    root.innerHTML = `<p class="empty-state">Elige una conversación de la lista o empieza una nueva.<br><a class="btn-primary" href="/mensajes.html?new=1">Nueva conversación</a></p>`
    return
  }
  root.innerHTML = `
    <div class="msg-lista-cabeza msg-lista-cabeza-movil">
      <h1>Mensajes</h1>
      <a class="btn-secondary" href="/mensajes.html?new=1">${icons.edit(14)} Nueva</a>
    </div>
    <div id="inboxList"><div class="skeleton msg-esqueleto"></div><div class="skeleton msg-esqueleto"></div></div>`

  const list = await listConversations(session.user.id)
  const listEl = document.getElementById('inboxList')
  listEl.innerHTML =
    list.length === 0
      ? `<p class="empty-state">Todavía no tienes conversaciones. Escríbele a alguien desde su perfil o empieza una aquí.<br><a class="btn-primary" href="/mensajes.html?new=1">Nueva conversación</a></p>`
      : `${buscadorHtml(list.length)}<div class="msg-filas">${listaHtml(list, session.user.id)}</div>`
  engancharBuscador(listEl)
  marcarEnLineaEn(listEl)
}

async function renderNewConversation(session) {
  root.innerHTML = `
    <div class="page-header cabecera-pagina msg-nueva-cabecera">
      <h1>Nueva conversación</h1>
      <p><a href="/mensajes.html">← Volver a mensajes</a></p>
    </div>
    <div class="search-input-wrap"><input type="text" id="newMsgSearch" class="search-input" placeholder="Buscar por nombre de usuario…" /></div>
    <div id="newMsgResults"></div>`

  document.getElementById('newMsgSearch').addEventListener('input', async (e) => {
    const q = e.target.value.trim()
    const resultsEl = document.getElementById('newMsgResults')
    if (!q) {
      resultsEl.innerHTML = ''
      return
    }
    // Buscar "jesus" tiene que encontrar a "Jesús": se compara contra la
    // columna plegada, y si la migración de acentos todavía no está
    // puesta se busca como antes (ver js/busqueda.js).
    const base = () =>
      // sin rango: la búsqueda para empezar una conversación; al pulsar se
      // abre el hilo, no el perfil (tanda 386).
      supabase.from('user_profiles').select('id, username, display_name, avatar_url').neq('id', session.user.id)
    const { data } = await conVueltaAtras(
      () => base().ilike('search_norm', `%${terminoParaFiltro(q)}%`).limit(10),
      () => base().or(`display_name.ilike.%${q}%,username.ilike.%${q}%`).limit(10)
    )
    const results = data || []
    resultsEl.innerHTML =
      results.length === 0
        ? `<p class="empty-state">Nadie coincide con esa búsqueda.</p>`
        : results
            .map((p) => {
              const name = p.display_name || p.username || 'Usuario'
              return `
        <button type="button" class="msg-fila msg-fila-boton" data-user-id="${p.id}">
          <span class="mini-avatar msg-fila-avatar" style="${avatarStyle(p)}">${p.avatar_url ? '' : getInitial(name)}</span>
          <strong>${escapeHtml(name)}</strong>
        </button>`
            })
            .join('')

    let starting = false
    resultsEl.querySelectorAll('[data-user-id]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (starting) return
        starting = true
        const conversationId = await findOrCreateConversation(session.user.id, btn.dataset.userId)
        window.location.href = `/mensajes.html?c=${conversationId}`
      })
    )
  })
}

// ── El hilo ──

function fotosHtml(adjuntos, urls) {
  const lista = adjuntos.filter((a) => urls.get(a.ruta))
  if (!lista.length) return ''
  return `<span class="msg-fotos" data-n="${lista.length}">${lista
    .map((a) => {
      // El hueco se reserva con las medidas guardadas al subir (la norma de
      // las imágenes); una foto vieja sin medidas va cuadrada.
      const medidas = a.w && a.h ? ` width="${Number(a.w)}" height="${Number(a.h)}" style="aspect-ratio:${Number(a.w)}/${Number(a.h)}"` : ''
      return `<img src="${escapeHtml(urls.get(a.ruta))}" alt="Foto adjunta" loading="lazy" decoding="async"${medidas} />`
    })
    .join('')}</span>`
}

// El icono de la tarjeta de un cambio: la dirección lleva su paquete (1102)
// y lo enviado, el avión de papel (1103); los datos de pago, las monedas (1107).
const ICONO_DE_EVENTO = { cambio_direccion: icons.package, cambio_enviado: icons.send, cambio_cobro: icons.coins }

// La cita de una respuesta (1141): tocarla lleva al mensaje original.
const citaHtml = (cita) =>
  cita ? `<a class="msg-cita" href="#msg-${escapeHtml(cita.id)}" data-ir-mensaje="${escapeHtml(cita.id)}"><b>${escapeHtml(cita.quien)}</b><span>${escapeHtml(cita.que)}</span></a>` : ''

// Las reacciones de un mensaje (1141): en uno ajeno se pulsan (la tuya
// resaltada; pulsarla la quita); en el tuyo solo se cuentan.
function reaccionesHtml(m, reac, mia) {
  if (!reac?.cuentas.length) return ''
  return `<span class="msg-reacciones">${reac.cuentas
    .map(({ kind, n }) => {
      const [, icono, nombre] = REACCIONES_MENSAJE.find(([k]) => k === kind)
      const dentro = `${icons[icono](12)}${n > 1 ? `<b>${n}</b>` : ''}<span class="sr-only">${nombre}</span>`
      return mia
        ? `<span class="msg-reaccion">${dentro}</span>`
        : `<button type="button" class="msg-reaccion${reac.mia === kind ? ' mia' : ''}" data-reaccion="${escapeHtml(m.id)}" data-kind="${kind}" aria-pressed="${reac.mia === kind}">${dentro}</button>`
    })
    .join('')}</span>`
}

function burbujaHtml(m, { mia, mencionados, urls, visto, miId, carta, cita = null, reac = null, con1141 = false }) {
  if (m.deleted_at) {
    return `<div class="msg-burbuja msg-eliminado${mia ? ' mia' : ''}" data-id="${m.id}" id="msg-${m.id}">Mensaje eliminado</div>`
  }
  const texto = String(m.body || '').trim()
  const fotos = fotosHtml(adjuntosDe(m), urls)
  // Las cartas de «Me interesa» (1080), con su módulo ya cargado.
  const cartas = carta ? cartasDe(m).map((a) => carta.cartaHtml(a, { miId, mia })).join('') : ''
  // El mensaje de un cambio (1101): una tarjeta con su título y el botón.
  const prop = propuestaDe(m)
  const propuesta = prop
    ? `<div class="msg-propuesta" data-evento="${escapeHtml(prop.evento)}">
        <span class="msg-propuesta-icono" aria-hidden="true">${(ICONO_DE_EVENTO[prop.evento] || icons.refreshCw)(16)}</span>
        <span class="msg-propuesta-texto"><b>${escapeHtml(prop.titulo)}</b><small>${escapeHtml(prop.texto)}</small></span>
        <a class="btn-secondary msg-propuesta-ver" href="${escapeHtml(prop.enlace)}">Ver propuesta</a>
      </div>`
    : ''
  return `
    <div class="msg-burbuja${mia ? ' mia' : ''}${m.seguido ? ' seguida' : ''}${fotos && !texto ? ' solo-fotos' : ''}${cartas ? ' con-carta' : ''}${propuesta ? ' con-propuesta' : ''}${reac?.cuentas.length ? ' con-reacciones' : ''}" data-id="${m.id}" id="msg-${m.id}">
      ${citaHtml(cita)}
      ${cartas}
      ${propuesta}
      ${fotos}
      ${texto && !propuesta ? `<p>${enlazarMenciones(escapeHtml(texto), mencionados)}</p>` : ''}
      ${reaccionesHtml(m, reac, mia)}
      <span class="msg-meta">
        ${con1141 ? `<button type="button" class="msg-accion" data-responder="${m.id}" aria-label="Responder a este mensaje" title="Responder">${icons.quote(13)}</button>` : ''}
        ${con1141 && !mia ? `<button type="button" class="msg-accion" data-reaccionar="${m.id}" aria-label="Reaccionar" title="Reaccionar" aria-haspopup="true">${icons.smile(13)}</button>` : ''}
        <time datetime="${escapeHtml(m.created_at)}" title="${new Date(m.created_at).toLocaleString('es-ES')}">${horaDe(m.created_at)}</time>
        ${mia ? `<button type="button" class="msg-borrar" data-delete-msg="${m.id}" aria-label="Eliminar mensaje" title="Eliminar">${icons.trash(13)}</button>` : reportButtonHtml('private_message', m.id)}
      </span>
    </div>
    ${visto ? `<span class="msg-visto">${icons.checkCircle(12)} Visto${visto === true ? '' : ` ${visto}`}</span>` : ''}`
}

async function renderThread(session, conversationId) {
  const miId = session.user.id
  const [amIParticipant, otherProfile, miFila] = await Promise.all([isParticipant(conversationId, miId), getOtherParticipant(conversationId, miId), miFilaDeConversacion(conversationId, miId).catch(() => null)])
  // Responder, reaccionar, fijar y archivar (1141) llegan con su migración:
  // la fila propia trae `fijada_at` si está.
  const con1141 = !!miFila && 'fijada_at' in miFila
  let fila1141 = miFila
  if (!amIParticipant || !otherProfile) {
    root.innerHTML = `<p class="empty-state">No se encontró esa conversación.<br><a href="/mensajes.html">← Volver a mensajes</a></p>`
    return
  }

  await markConversationRead(conversationId, miId)
  void pintarListaLateral(session, conversationId)

  const name = otherProfile.display_name || otherProfile.username || 'Usuario'
  document.title = `${name} — Mensajes — PokeDoc`
  root.innerHTML = `
    <div class="msg-hilo">
      <div class="msg-cabecera">
        <a class="msg-atras" href="/mensajes.html" aria-label="Volver a mensajes">‹</a>
        <a class="mini-avatar msg-cabecera-avatar" href="${profileUrl(otherProfile)}" style="${avatarStyle(otherProfile)}" data-en-linea="${escapeHtml(otherProfile.id)}">${otherProfile.avatar_url ? '' : getInitial(name)}</a>
        <div class="msg-cabecera-quien">
          <h1 class="msg-cabecera-nombre"><a href="${profileUrl(otherProfile)}"${atributosDeRango(otherProfile, 'color:var(--text)')}>${escapeHtml(name)}</a></h1>
          <span class="msg-estado" id="msgEstado" aria-live="polite"></span>
        </div>
        <a class="msg-ver-perfil" href="${profileUrl(otherProfile)}">Ver perfil</a>
        ${con1141 ? `<div class="msg-mas-caja"><button type="button" class="msg-mas" id="msgMas" aria-label="Más opciones" aria-haspopup="true" aria-expanded="false">${icons.moreHorizontal(18)}</button><div class="msg-mas-menu" id="msgMasMenu" hidden></div></div>` : ''}
      </div>
      <div class="msg-scroll" id="msgScroll">
        <div class="msg-cambio" id="msgCambio"></div>
        <div id="msgPropuestas" hidden aria-live="polite"></div>
        <section class="perfil-cruce hidden" id="msgCruce" aria-live="polite"></section>
        <div class="msg-mensajes" id="threadMessages" aria-live="polite"><div class="skeleton msg-esqueleto"></div></div>
      </div>
      <button type="button" class="msg-nuevos hidden" id="msgNuevos">${icons.arrowDown(14)} <span>1 nuevo</span></button>
      <form class="msg-compositor" id="msgCompositor">
        <div class="msg-respondiendo" id="msgRespondiendo" hidden></div>
        <div id="msgCartaPendiente" hidden></div>
        <div class="msg-adjuntos" id="msgAdjuntos" hidden></div>
        <div class="msg-linea">
          <button type="button" class="msg-clip" id="msgClip" aria-label="Adjuntar una carta o una foto" title="Adjuntar">${icons.paperclip(18)}</button>
          <textarea id="msgBody" class="msg-caja" rows="1" placeholder="Escribe un mensaje…" aria-label="Mensaje"></textarea>
          <button type="submit" class="msg-enviar" id="btnSendMsg" aria-label="Enviar" title="Enviar">${icons.send(18)}</button>
        </div>
        <input type="file" id="msgFotos" accept="image/*" multiple hidden />
        <input type="file" id="msgCamara" accept="image/*" capture="environment" hidden />
      </form>
      <dialog class="msg-hoja" id="msgHoja" aria-label="Adjuntar">
        <div class="msg-hoja-tirador"></div>
        <button type="button" class="msg-hoja-opcion" data-hoja="carta"><span class="msg-hoja-ico">${icons.cards(18)}</span><span>Una carta<small>De tu colección o del catálogo, con su precio</small></span></button>
        <button type="button" class="msg-hoja-opcion" data-hoja="galeria"><span class="msg-hoja-ico">${icons.image(18)}</span><span>Una foto<small>Hasta ${MAX_FOTOS} fotos por mensaje</small></span></button>
        <button type="button" class="msg-hoja-opcion" data-hoja="camara"><span class="msg-hoja-ico">${icons.camera(18)}</span><span>Hacer una foto<small>Abre la cámara</small></span></button>
        <button type="button" class="btn-secondary msg-hoja-cerrar" data-hoja="cerrar">Cancelar</button>
      </dialog>
      <dialog class="msg-dialogo" id="msgDialogoBorrar" aria-label="Eliminar mensaje">
        <p><strong>¿Eliminar este mensaje?</strong></p>
        <p class="subtext">Se quita para los dos y queda «Mensaje eliminado» en su sitio.</p>
        <div class="msg-dialogo-botones"><button type="button" class="btn-secondary" data-borrar="no">Cancelar</button><button type="button" class="btn-primary msg-btn-peligro" data-borrar="si">Eliminar</button></div>
      </dialog>
      <div class="msg-arrastre" id="msgArrastre" hidden>${icons.image(22)} Suelta la imagen para adjuntarla</div>
    </div>`

  // «Cambio hecho» (795, NU4): solo si la migración está; si no, nada.
  import('./cambio-boton.js').then((m) => m.pintarBotonDeCambio(document.getElementById('msgCambio'), miId, otherProfile.id, name)).catch(() => {})
  // Las propuestas de cambio con esta persona (942): las vivas, con sus
  // botones, y «Proponer un cambio». Si la migración no está, nada.
  import('./cambio-propuesta.js').then((m) => m.pintarPropuestasCon(document.getElementById('msgPropuestas'), { sesion: session, otro: otherProfile })).catch(() => {})
  // Lo que os podéis cambiar, encima de la conversación (798, PA13): solo si hay algo.
  import('./cruce-persona.js').then((m) => m.pintarCruce(document.getElementById('msgCruce'), otherProfile, session, { soloSiHay: true })).catch(() => {})

  // EN LÍNEA Y «ESCRIBIENDO…» (1140), debajo del nombre. Lo primero sale del
  // latido de siempre (en-linea.js); lo segundo, de un canal de difusión que
  // no escribe en la base y se apaga solo a los cinco segundos sin señal.
  const elEstado = document.getElementById('msgEstado')
  let otroEnLinea = false
  let escribeHasta = 0
  let apagarEscribe = null
  const pintarEstado = () => {
    const escribe = Date.now() < escribeHasta
    elEstado.textContent = escribe ? 'escribiendo…' : otroEnLinea ? 'En línea' : ''
    elEstado.className = `msg-estado${escribe ? ' escribiendo' : otroEnLinea ? ' en-linea' : ''}`
  }
  marcarEnLineaEn(root.querySelector('.msg-cabecera')).then((ids) => {
    otroEnLinea = !!ids?.includes(otherProfile.id)
    pintarEstado()
  })

  const el = document.getElementById('threadMessages')
  const caja = document.getElementById('msgBody')
  const form = document.getElementById('msgCompositor')
  const btn = document.getElementById('btnSendMsg')
  const pastillaNuevos = document.getElementById('msgNuevos')

  // Las fotos de los mensajes van por direcciones firmadas (el cubo es
  // privado); el módulo se baja al pintar el primer hilo, no antes.
  let adjuntosMod = null
  const adjuntos = async () => (adjuntosMod ||= await import('./mensajes-adjuntos.js'))
  // Y las cartas de «Me interesa» (1080), igual: solo si hay alguna.
  let cartaMod = null
  const cartaM = async () => (cartaMod ||= await import('./mensajes-carta.js'))
  let ultimos = []

  // ── El hilo ocupa la pantalla y los mensajes hacen scroll DENTRO (891b) ──
  // PINGU: «se abre así, queda raro»: la página bajaba hasta el pie y el
  // cuadro de escribir se quedaba a media pantalla con el hueco debajo. La
  // altura se mide contra la ventana VISUAL (con el teclado abierto el
  // iPhone la encoge) y se descuenta lo que la barra de abajo tape.
  const hilo = root.querySelector('.msg-hilo')
  const scroller = document.getElementById('msgScroll')
  document.body.classList.add('msg-hilo-abierto')
  function medirHilo() {
    const vv = window.visualViewport
    const altoVentana = vv ? vv.height : window.innerHeight
    const arriba = hilo.getBoundingClientRect().top + window.scrollY - (vv ? vv.offsetTop : 0)
    const barra = document.querySelector('body > .bm')
    let abajo = 0
    if (barra && getComputedStyle(barra).display !== 'none') {
      const r = barra.getBoundingClientRect()
      abajo = Math.max(0, Math.min(r.bottom, altoVentana) - r.top)
    }
    const alto = Math.max(320, Math.floor(altoVentana - arriba - abajo - 8))
    hilo.style.setProperty('--msg-alto', `${alto}px`)
  }
  window.scrollTo(0, 0)
  medirHilo()
  window.addEventListener('resize', medirHilo)
  window.visualViewport?.addEventListener('resize', () => { medirHilo(); bajarAlFinal() })
  // La barra del móvil llega por `import()` y cambia el relleno de arriba
  // de la página (704): el hilo se vuelve a medir cuando el <html> cambia
  // de clases y un par de veces más por si acaso, que una medida tomada
  // antes de tiempo deja un hueco de 50 px entre el cuadro y la barra.
  new MutationObserver(() => { medirHilo(); bajarAlFinal() }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  for (const ms of [250, 1000]) setTimeout(() => { medirHilo(); bajarAlFinal() }, ms)

  const cercaDelFinal = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 160
  const bajarAlFinal = (suave = false) => {
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: suave ? 'smooth' : 'auto' })
    pastillaNuevos.classList.add('hidden')
  }
  pastillaNuevos.addEventListener('click', () => bajarAlFinal(true))
  scroller.addEventListener('scroll', () => { if (cercaDelFinal()) pastillaNuevos.classList.add('hidden') }, { passive: true })

  let ultimoIdPintado = null
  let primeraPintada = true
  let pintando = false
  // Lo último que se pintó, para repintar sin volver a preguntar (una
  // reacción cambia YA y confirma después, 896), y las reacciones (1141):
  // null = sin la migración o sin poder preguntar, y entonces no se ofrecen.
  let pintado = null
  let reacciones = null
  const nombreDe = (id) => (id === miId ? 'Tú' : name)
  function pintarHilo() {
    if (!pintado) return
    const { messages, mencionados, urls, vistoId, otroLeyoHasta } = pintado
    const porId = new Map(messages.map((m) => [m.id, m]))
    el.innerHTML =
      messages.length === 0
        ? `<p class="empty-state">Todavía no hay mensajes. ¡Escribe el primero!</p>`
        : agruparPorDia(messages)
            .map(
              (dia) => `<div class="msg-dia"><span>${escapeHtml(dia.etiqueta)}</span></div>${dia.mensajes
                .map((m) =>
                  burbujaHtml(m, {
                    mia: m.sender_id === miId,
                    mencionados,
                    urls,
                    visto: m.id === vistoId ? horaDe(otroLeyoHasta) : null,
                    miId,
                    carta: cartaMod,
                    cita: m.reply_to_id ? citaDe(porId.get(m.reply_to_id), nombreDe) : null,
                    reac: reacciones ? reaccionesDeMensaje(reacciones, m.id, miId) : null,
                    con1141,
                  })
                )
                .join('')}`
            )
            .join('')
    el.querySelectorAll('[data-delete-msg]').forEach((b) => b.addEventListener('click', () => pedirBorrar(b.dataset.deleteMsg, messages)))
    wireReportButtons(el, session)
  }
  async function refreshMessages() {
    if (pintando) return
    pintando = true
    try {
      const [messages, otroLeyoHasta, reac] = await Promise.all([loadThreadMessages(conversationId), otherLastReadAt(conversationId, miId), con1141 ? reaccionesDe(conversationId) : null])
      reacciones = reac
      // Los @nombre de la conversación se enlazan al perfil, pero AQUÍ NO
      // SE AVISA A NADIE: mencionar a alguien en una conversación privada
      // no puede mandarle un aviso de un mensaje que no puede leer.
      const [mencionados, urls] = await Promise.all([
        perfilesMencionados(messages.map((m) => escapeHtml(m.body || '')).join(' ')).then(porNombre),
        (async () => {
          const todas = messages.flatMap(adjuntosDe)
          if (!todas.length) return new Map()
          return (await adjuntos()).urlsDeAdjuntos(todas).catch(() => new Map())
        })(),
        (async () => {
          const cartas = messages.flatMap(cartasDe)
          if (cartas.length) await (await cartaM()).completar(cartas).catch(() => {})
        })(),
      ])
      ultimos = messages
      const vistoId = ultimoVisto(messages, miId, otroLeyoHasta)
      const estabaAbajo = primeraPintada || cercaDelFinal()
      const nuevoAjeno = messages.length && messages[messages.length - 1].id !== ultimoIdPintado && messages[messages.length - 1].sender_id !== miId && ultimoIdPintado !== null
      // Lo que estaba escribiendo ya ha llegado: fuera el «escribiendo…».
      if (nuevoAjeno) {
        escribeHasta = 0
        otroEnLinea = true
        pintarEstado()
      }
      pintado = { messages, mencionados, urls, vistoId, otroLeyoHasta }
      pintarHilo()
      ultimoIdPintado = messages.length ? messages[messages.length - 1].id : null
      if (estabaAbajo) bajarAlFinal()
      else if (nuevoAjeno) {
        pastillaNuevos.querySelector('span').textContent = '1 nuevo'
        pastillaNuevos.classList.remove('hidden')
      }
      // Lo que llega mientras tienes el hilo abierto ya está leído.
      if (!primeraPintada && nuevoAjeno && estabaAbajo) markConversationRead(conversationId, miId).catch(() => {})
      primeraPintada = false
    } finally {
      pintando = false
    }
  }

  // ── Borrar, con el diálogo de la casa (no el `confirm()` del navegador) ──
  const dlgBorrar = document.getElementById('msgDialogoBorrar')
  function pedirBorrar(id, messages) {
    dlgBorrar.showModal()
    const cerrar = () => {
      dlgBorrar.close()
      dlgBorrar.querySelectorAll('[data-borrar]').forEach((b) => (b.onclick = null))
    }
    dlgBorrar.querySelector('[data-borrar="no"]').onclick = cerrar
    dlgBorrar.querySelector('[data-borrar="si"]').onclick = async () => {
      cerrar()
      const m = messages.find((x) => x.id === id)
      try {
        // Primero las fotos del cubo, después la fila: si lo de después
        // falla queda un mensaje sin fotos, que es mejor que fotos sin
        // mensaje que nadie puede borrar.
        const fotos = adjuntosDe(m)
        if (fotos.length) await (await adjuntos()).borrarAdjuntos(fotos).catch(() => {})
        await deleteMessage(id)
        await refreshMessages()
      } catch (err) {
        showToast(`No se ha podido eliminar: ${err?.message || err}`)
      }
    }
  }

  // ── RESPONDER A UN MENSAJE (1141) ──
  // El botón de la cita en cada burbuja, o deslizarla a la derecha en el
  // móvil. La respuesta lleva arriba la cita, y tocarla lleva al original.
  let respondiendoA = null
  const barraRespuesta = document.getElementById('msgRespondiendo')
  function dejarRespuesta() {
    respondiendoA = null
    barraRespuesta.hidden = true
    barraRespuesta.innerHTML = ''
  }
  function empezarRespuesta(id) {
    const m = pintado?.messages.find((x) => x.id === id)
    if (!m || m.deleted_at) return
    const c = citaDe(m, nombreDe)
    respondiendoA = id
    barraRespuesta.hidden = false
    barraRespuesta.innerHTML = `<span class="msg-respondiendo-texto">${icons.quote(14)}<span><b>Respondiendo a ${escapeHtml(c.quien === 'Tú' ? 'tu mensaje' : c.quien)}</b><small>${escapeHtml(c.que)}</small></span></span><button type="button" class="msg-respondiendo-quitar" data-no-responder aria-label="No responder a ese mensaje">×</button>`
    caja.focus()
  }
  barraRespuesta.addEventListener('click', (e) => {
    if (e.target.closest('[data-no-responder]')) dejarRespuesta()
  })
  function irAlMensaje(id) {
    const b = document.getElementById(`msg-${id}`)
    if (!b) return
    b.scrollIntoView({ block: 'center', behavior: 'smooth' })
    b.classList.remove('msg-destello')
    void b.offsetWidth
    b.classList.add('msg-destello')
    setTimeout(() => b.classList.remove('msg-destello'), 1600)
  }

  // ── REACCIONES (1141): las cuatro del foro, una por persona ──
  let selector = null
  const cerrarSelector = () => {
    selector?.remove()
    selector = null
  }
  function abrirSelector(id, boton) {
    cerrarSelector()
    const mia = reaccionesDeMensaje(reacciones, id, miId).mia
    selector = document.createElement('div')
    selector.className = 'msg-selector'
    selector.setAttribute('role', 'menu')
    selector.innerHTML = REACCIONES_MENSAJE.map(([kind, icono, nombre]) => `<button type="button" role="menuitem" class="msg-selector-opcion${mia === kind ? ' mia' : ''}" data-elegir-reaccion="${kind}" data-para="${escapeHtml(id)}" aria-label="${nombre}" title="${nombre}">${icons[icono](18)}</button>`).join('')
    boton.closest('.msg-burbuja').appendChild(selector)
    selector.querySelector('button')?.focus()
  }
  async function cambiarReaccion(messageId, kind) {
    if (!reacciones) return
    const antes = reacciones
    const actual = reaccionesDeMensaje(reacciones, messageId, miId).mia
    const nuevo = kind === actual ? null : kind
    reacciones = reacciones.filter((r) => !(r.message_id === messageId && r.user_id === miId)).concat(nuevo ? [{ message_id: messageId, user_id: miId, kind: nuevo }] : [])
    pintarHilo()
    try {
      await reaccionar({ messageId, conversationId, myId: miId, kind: nuevo, actual })
    } catch {
      reacciones = antes
      pintarHilo()
      showToast('No se ha podido guardar la reacción.', 'error')
    }
  }
  el.addEventListener('click', (e) => {
    const ir = e.target.closest('[data-ir-mensaje]')
    if (ir) {
      e.preventDefault()
      return irAlMensaje(ir.dataset.irMensaje)
    }
    const resp = e.target.closest('[data-responder]')
    if (resp) return empezarRespuesta(resp.dataset.responder)
    const abrir = e.target.closest('[data-reaccionar]')
    if (abrir) return selector?.querySelector(`[data-para="${CSS.escape(abrir.dataset.reaccionar)}"]`) ? cerrarSelector() : abrirSelector(abrir.dataset.reaccionar, abrir)
    const elegida = e.target.closest('[data-elegir-reaccion]')
    if (elegida) {
      cerrarSelector()
      return cambiarReaccion(elegida.dataset.para, elegida.dataset.elegirReaccion)
    }
    const chip = e.target.closest('[data-reaccion]')
    if (chip) return cambiarReaccion(chip.dataset.reaccion, chip.dataset.kind)
  })
  document.addEventListener('click', (e) => {
    if (selector && !e.target.closest('.msg-selector, [data-reaccionar]')) cerrarSelector()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarSelector()
  })
  // Deslizar a la derecha para responder (el móvil): a partir de 60 px. Si
  // el dedo va más en vertical, es un scroll y se suelta.
  let toque = null
  el.addEventListener('touchstart', (e) => {
    const b = con1141 && e.target.closest('.msg-burbuja:not(.msg-eliminado)')
    if (!b || e.touches.length !== 1) return
    toque = { b, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0 }
  }, { passive: true })
  el.addEventListener('touchmove', (e) => {
    if (!toque) return
    const dx = e.touches[0].clientX - toque.x
    const dy = e.touches[0].clientY - toque.y
    if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) {
      toque.b.style.transform = ''
      toque = null
      return
    }
    toque.dx = Math.max(0, Math.min(dx, 80))
    toque.b.style.transform = toque.dx ? `translateX(${toque.dx}px)` : ''
  }, { passive: true })
  const soltarToque = () => {
    if (!toque) return
    const { b, dx } = toque
    b.style.transform = ''
    toque = null
    if (dx >= 60) empezarRespuesta(b.dataset.id)
  }
  el.addEventListener('touchend', soltarToque)
  el.addEventListener('touchcancel', soltarToque)

  // ── FIJAR Y ARCHIVAR (1141): en el «⋯» de la cabecera ──
  if (con1141) {
    const botonMas = document.getElementById('msgMas')
    const menuMas = document.getElementById('msgMasMenu')
    const pintarMenu = () => {
      menuMas.innerHTML = `<button type="button" data-poner="fijar">${icons.pin(16)} ${fila1141?.fijada_at ? 'Quitar de fijadas' : 'Fijar arriba'}</button><button type="button" data-poner="archivar">${icons.folder(16)} ${fila1141?.archivada_at ? 'Sacar de archivadas' : 'Archivar'}</button>`
    }
    const cerrarMenu = () => {
      menuMas.hidden = true
      botonMas.setAttribute('aria-expanded', 'false')
    }
    botonMas.addEventListener('click', () => {
      pintarMenu()
      const abrir = menuMas.hidden
      menuMas.hidden = !abrir
      botonMas.setAttribute('aria-expanded', String(abrir))
    })
    menuMas.addEventListener('click', async (e) => {
      const que = e.target.closest('[data-poner]')?.dataset.poner
      if (!que) return
      cerrarMenu()
      const si = que === 'fijar' ? !fila1141?.fijada_at : !fila1141?.archivada_at
      const antes = fila1141
      try {
        fila1141 = { ...fila1141, ...(await ponerEnConversacion(conversationId, miId, que, si)) }
        showToast(que === 'fijar' ? (si ? 'Fijada arriba de tus mensajes.' : 'Ya no está fijada.') : si ? 'Archivada. Vuelve sola a la lista si te escriben.' : 'Ha vuelto a tu lista.', 'success')
        void pintarListaLateral(session, conversationId)
      } catch {
        fila1141 = antes
        showToast('No se ha podido guardar.', 'error')
      }
    })
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.msg-mas-caja')) cerrarMenu()
    })
  }

  await refreshMessages()

  // «Vender esta carta» (1080): la tienda vende desde la conversación.
  el.addEventListener('click', async (e) => {
    // «Apartar» (1092): para quien escribe, con su cuenta.
    const ap = e.target.closest('[data-apartar-carta]')
    if (ap) {
      const adjunto = ultimos.flatMap(cartasDe).find((a) => a.stock_id === ap.dataset.apartarCarta)
      return (await cartaM()).apartarDesdeMensaje(ap.dataset.apartarCarta, adjunto, otherProfile).catch(() => showToast('No se ha podido abrir Apartar.', 'error'))
    }
    const b = e.target.closest('[data-vender-carta]')
    if (!b) return
    const adjunto = ultimos.flatMap(cartasDe).find((a) => a.stock_id === b.dataset.venderCarta)
    ;(await cartaM()).venderDesdeMensaje(b.dataset.venderCarta, adjunto).catch(() => showToast('No se ha podido abrir Vender.', 'error'))
  })

  // «Me interesa» (1080): `?carta=` deja puesta en el cuadro la carta del
  // escaparate por la que se pregunta; se manda con el mensaje.
  const cajaCarta = document.getElementById('msgCartaPendiente')
  let cartaPendiente = null
  const pintarCartaPendiente = () => {
    cajaCarta.hidden = !cartaPendiente
    cajaCarta.innerHTML = cartaPendiente && cartaMod ? cartaMod.cartaHtml(cartaPendiente, { pendiente: true }) : ''
  }
  cajaCarta.addEventListener('click', (e) => {
    if (!e.target.closest('[data-quitar-carta]')) return
    cartaPendiente = null
    pintarCartaPendiente()
  })
  if (params.get('carta')) {
    cartaM()
      .then((m) => m.prepararCarta(otherProfile.id, params.get('carta')))
      .then((a) => {
        if (!a) return showToast('Esa carta ya no está en su escaparate.')
        cartaPendiente = a
        pintarCartaPendiente()
        if (!caja.value.trim()) {
          caja.value = '¡Hola! Me interesa esta carta. ¿La tienes todavía?'
          ajustarAlto()
        }
        bajarAlFinal()
      })
      .catch(() => {})
  }

  import('./mencion-autocompletar.js')
    .then((m) => m.engancharAutocompletarMenciones(caja))
    .catch(() => {})

  // ── El borrador de un cambio (tanda 376) ──
  // `?texto=` deja el mensaje ESCRITO, nunca enviado: lo usa el tablón de
  // cambios para redactar «he visto que das estas cartas…». Solo si la
  // caja está vacía, y se quita de la dirección enseguida.
  const borrador = params.get('texto')
  if (borrador) {
    if (!caja.value.trim()) {
      caja.value = borrador.slice(0, 4000)
      caja.focus()
      caja.setSelectionRange(caja.value.length, caja.value.length)
    }
    const url = new URL(location.href)
    url.searchParams.delete('texto')
    history.replaceState(null, '', url)
  }

  // ── El cuadro crece con el texto (hasta seis líneas) ──
  const ajustarAlto = () => {
    caja.style.height = 'auto'
    caja.style.height = `${Math.min(caja.scrollHeight, 160)}px`
  }
  caja.addEventListener('input', ajustarAlto)
  ajustarAlto()
  caja.addEventListener('focus', () => setTimeout(() => bajarAlFinal(), 300))

  // ── Las fotos pendientes de enviar ──
  const pendientes = [] // { fichero, url }
  const cajaAdjuntos = document.getElementById('msgAdjuntos')
  function pintarPendientes() {
    cajaAdjuntos.hidden = pendientes.length === 0
    cajaAdjuntos.innerHTML = pendientes
      .map(
        (p, i) => `<span class="msg-adjunto"><img src="${p.url}" alt="" width="56" height="56" loading="lazy" /><button type="button" class="msg-adjunto-quitar" data-quitar="${i}" aria-label="Quitar esta foto">×</button><small>${Math.round(p.fichero.size / 1024)} KB</small></span>`
      )
      .join('')
    cajaAdjuntos.querySelectorAll('[data-quitar]').forEach((b) =>
      b.addEventListener('click', () => {
        const [quitada] = pendientes.splice(Number(b.dataset.quitar), 1)
        if (quitada) URL.revokeObjectURL(quitada.url)
        pintarPendientes()
      })
    )
  }
  function anadirFicheros(lista) {
    // Una carta de «Me interesa» ocupa un hueco de los cuatro de un mensaje.
    const { aceptados, rechazados } = cabenAdjuntos(pendientes, [...(lista || [])], { max: MAX_FOTOS - (cartaPendiente ? 1 : 0) })
    for (const f of aceptados) pendientes.push({ fichero: f, url: URL.createObjectURL(f) })
    if (rechazados.length) showToast(`${rechazados.length === 1 ? 'Una foto se queda fuera' : `${rechazados.length} fotos se quedan fuera`}: ${rechazados[0].motivo}.`)
    pintarPendientes()
    caja.focus()
  }
  const entradaFotos = document.getElementById('msgFotos')
  const entradaCamara = document.getElementById('msgCamara')
  for (const entrada of [entradaFotos, entradaCamara]) {
    entrada.addEventListener('change', () => {
      anadirFicheros(entrada.files)
      entrada.value = ''
    })
  }
  // El clip abre la hoja: una carta (1140), una foto o, con el dedo, la
  // cámara (705). Con ratón la cámara no se ofrece: no hay.
  const hoja = document.getElementById('msgHoja')
  document.getElementById('msgClip').addEventListener('click', () => {
    hoja.querySelector('[data-hoja="camara"]').hidden = conRaton()
    hoja.showModal()
  })
  hoja.addEventListener('click', (e) => {
    const que = e.target.closest('[data-hoja]')?.dataset.hoja
    if (!que && e.target === hoja) hoja.close()
    if (!que) return
    hoja.close()
    if (que === 'camara') entradaCamara.click()
    else if (que === 'galeria') entradaFotos.click()
    else if (que === 'carta') mandarCarta()
  })
  // «Una carta» (1140): se queda en el cuadro como la de «Me interesa» y sale
  // con el mensaje. Una carta ocupa uno de los cuatro huecos de adjuntos.
  async function mandarCarta() {
    if (pendientes.length >= MAX_FOTOS) return showToast(`Un mensaje lleva como mucho ${MAX_FOTOS} adjuntos.`)
    try {
      const [{ elegirCarta }, mod] = await Promise.all([import('./mensajes-carta-elegir.js'), cartaM()])
      const elegida = await elegirCarta({ miId })
      if (!elegida) return
      await mod.completar([elegida]).catch(() => {})
      cartaPendiente = elegida
      pintarCartaPendiente()
      bajarAlFinal()
      caja.focus()
    } catch {
      showToast('No se ha podido abrir el buscador de cartas.', 'error')
    }
  }
  // Pegar una imagen en el cuadro (Ctrl+V desde una captura).
  caja.addEventListener('paste', (e) => {
    const ficheros = [...(e.clipboardData?.files || [])].filter((f) => /^image\//.test(f.type))
    if (!ficheros.length) return
    e.preventDefault()
    anadirFicheros(ficheros)
  })
  // Arrastrar al hilo.
  const velo = document.getElementById('msgArrastre')
  let contador = 0
  root.addEventListener('dragenter', (e) => {
    if (![...(e.dataTransfer?.types || [])].includes('Files')) return
    contador++
    velo.hidden = false
  })
  root.addEventListener('dragleave', () => {
    contador = Math.max(0, contador - 1)
    if (!contador) velo.hidden = true
  })
  root.addEventListener('dragover', (e) => {
    if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault()
  })
  root.addEventListener('drop', (e) => {
    contador = 0
    velo.hidden = true
    const ficheros = [...(e.dataTransfer?.files || [])].filter((f) => /^image\//.test(f.type))
    if (!ficheros.length) return
    e.preventDefault()
    anadirFicheros(ficheros)
  })

  // ── Enviar ──
  let sending = false
  async function enviar() {
    if (sending) return
    const body = caja.value.trim()
    if (!body && !pendientes.length && !cartaPendiente) return
    sending = true
    btn.disabled = true
    form.classList.add('enviando')
    try {
      let subidas = []
      if (pendientes.length) {
        subidas = await (await adjuntos()).subirAdjuntos(
          conversationId,
          pendientes.map((p) => p.fichero),
          { alProgresar: (n, de) => (btn.title = `Subiendo ${n} de ${de}…`) }
        )
      }
      await sendMessage(conversationId, miId, body, cartaPendiente ? [cartaPendiente, ...subidas] : subidas, respondiendoA)
      dejarRespuesta()
      cartaPendiente = null
      pintarCartaPendiente()
      caja.value = ''
      ajustarAlto()
      for (const p of pendientes) URL.revokeObjectURL(p.url)
      pendientes.length = 0
      pintarPendientes()
      await refreshMessages()
      bajarAlFinal()
    } catch (err) {
      const msg = String(err?.message || err || '')
      showToast(/adjuntos|column|schema cache|bucket|Bucket not found/i.test(msg) ? 'Las fotos en los mensajes todavía no están activadas (falta la migración 891).' : `No se ha podido enviar: ${msg}`)
    } finally {
      sending = false
      btn.disabled = false
      btn.title = 'Enviar'
      form.classList.remove('enviando')
    }
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    enviar()
  })
  caja.addEventListener('keydown', (e) => {
    if (enterEnvia(e, conRaton())) {
      e.preventDefault()
      enviar()
    }
  })

  // ── En vivo (tanda 227) ──
  // Una conversación privada donde hay que recargar para ver lo que te
  // contestan no es una conversación. El filtro es por conversación:
  // así el servidor solo evalúa los mensajes de ESTE hilo. Aquí SÍ va
  // sondeo de respaldo: cuando el vivo conecta, baja a una vez por minuto.
  const { escuchar, sondeoAdaptable, difundir } = await import('./vivo.js')
  const sondeo = sondeoAdaptable(refreshMessages, 10000)
  // «Escribiendo…» (1140): como mucho una señal cada dos segundos y medio
  // mientras tecleas; la otra punta la enseña cinco segundos.
  const difusion = difundir({
    tema: `escribe-${conversationId}`,
    evento: 'escribe',
    alRecibir: (p) => {
      if (p?.quien !== otherProfile.id) return
      escribeHasta = Date.now() + 5000
      pintarEstado()
      clearTimeout(apagarEscribe)
      apagarEscribe = setTimeout(pintarEstado, 5100)
    },
  })
  let ultimaSenal = 0
  caja.addEventListener('input', () => {
    if (!caja.value.trim() || Date.now() - ultimaSenal < 2500) return
    ultimaSenal = Date.now()
    difusion.enviar({ quien: miId })
  })
  escuchar({
    nombre: `mensajes-${conversationId}`,
    tablas: [
      { tabla: 'private_messages', filtro: `conversation_id=eq.${conversationId}` },
      ...(con1141 ? [{ tabla: 'private_message_reactions', filtro: `conversation_id=eq.${conversationId}` }] : []),
    ],
    alCambiar: () => refreshMessages(),
    alEstado: (vivo) => sondeo.conVivo(vivo),
  })
}

async function init() {
  const session = await requireAuth()
  if (!session) return

  const withUserId = params.get('with')
  const conversationId = params.get('c')
  const isNew = params.get('new')

  if (withUserId === session.user.id) {
    window.location.href = '/mensajes.html'
    return
  }

  if (withUserId) {
    root.innerHTML = `<p class="empty-state">Cargando…</p>`
    const newConversationId = await findOrCreateConversation(session.user.id, withUserId)
    window.history.replaceState({}, '', `/mensajes.html?c=${newConversationId}`)
    await renderThread(session, newConversationId)
  } else if (conversationId) {
    await renderThread(session, conversationId)
  } else if (isNew) {
    await renderNewConversation(session)
  } else {
    await renderInbox(session)
  }
}

init()
