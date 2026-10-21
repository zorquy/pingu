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
} from './messages.js'
import { reportButtonHtml, wireReportButtons } from './report.js'
import { icons } from './icons.js'
import { conVueltaAtras, terminoParaFiltro } from './busqueda.js'
import { perfilesMencionados, enlazarMenciones, porNombre } from './menciones.js'
import { atributosDeRango } from './rangos.js'
import { showToast } from './toast.js'
import { agruparPorDia, horaDe, ultimoVisto, resumenDeUltimo, adjuntosDe, cabenAdjuntos, enterEnvia, MAX_FOTOS } from './mensajes-puro.js'

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
        <span class="mini-avatar msg-fila-avatar" style="${avatarStyle(p)}">${p?.avatar_url ? '' : getInitial(name)}</span>
        <span class="msg-fila-cuerpo">
          <span class="msg-fila-nombre"><strong>${escapeHtml(name)}</strong>${c.lastMessage ? `<time>${timeAgo(c.lastMessage.created_at)}</time>` : ''}</span>
          <span class="msg-fila-ultimo">${vistoMio ? `<i class="msg-check">${icons.checkCircle(13)}</i>` : ''}${ultimo.foto ? `<i class="msg-foto-ico">${icons.image(13)}</i>` : ''}<span>${escapeHtml(ultimo.texto)}</span></span>
        </span>
        ${c.noLeidos ? `<span class="msg-noleidos" aria-label="${c.noLeidos} sin leer">${c.noLeidos > 99 ? '99+' : c.noLeidos}</span>` : ''}
      </a>`
}

// Más de diez conversaciones: un buscador que filtra por nombre, aquí
// mismo, sin consulta.
function buscadorHtml(cuantas) {
  if (cuantas < 10) return ''
  return `<div class="search-input-wrap msg-buscar"><input type="search" class="search-input" id="msgBuscar" placeholder="Buscar conversación" aria-label="Buscar conversación" /></div>`
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

function listaHtml(list, miId, actual) {
  return list.length ? list.map((c) => filaDeConversacion(c, miId, actual)).join('') : '<p class="subtext msg-vacio">Todavía no tienes conversaciones.</p>'
}

// La lista de la izquierda en el PC, al lado de lo que esté abierto.
async function pintarListaLateral(session, actual) {
  const caja = document.getElementById('msgLista')
  if (!caja || !enPC()) return
  const list = await listConversations(session.user.id).catch(() => [])
  caja.innerHTML = `<div class="msg-lista-cabeza"><h2>Mensajes</h2><a class="btn-secondary" href="/mensajes.html?new=1">${icons.edit(14)} Nueva</a></div>${buscadorHtml(list.length)}<div class="msg-filas">${listaHtml(list, session.user.id, actual)}</div>`
  engancharBuscador(caja)
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

function burbujaHtml(m, { mia, mencionados, urls, visto }) {
  if (m.deleted_at) {
    return `<div class="msg-burbuja msg-eliminado${mia ? ' mia' : ''}" data-id="${m.id}">Mensaje eliminado</div>`
  }
  const texto = String(m.body || '').trim()
  const fotos = fotosHtml(adjuntosDe(m), urls)
  return `
    <div class="msg-burbuja${mia ? ' mia' : ''}${m.seguido ? ' seguida' : ''}${fotos && !texto ? ' solo-fotos' : ''}" data-id="${m.id}">
      ${fotos}
      ${texto ? `<p>${enlazarMenciones(escapeHtml(texto), mencionados)}</p>` : ''}
      <span class="msg-meta">
        <time datetime="${escapeHtml(m.created_at)}" title="${new Date(m.created_at).toLocaleString('es-ES')}">${horaDe(m.created_at)}</time>
        ${mia ? `<button type="button" class="msg-borrar" data-delete-msg="${m.id}" aria-label="Eliminar mensaje" title="Eliminar">${icons.trash(13)}</button>` : reportButtonHtml('private_message', m.id)}
      </span>
    </div>
    ${visto ? `<span class="msg-visto">${icons.checkCircle(12)} Visto${visto === true ? '' : ` ${visto}`}</span>` : ''}`
}

async function renderThread(session, conversationId) {
  const miId = session.user.id
  const [amIParticipant, otherProfile] = await Promise.all([isParticipant(conversationId, miId), getOtherParticipant(conversationId, miId)])
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
        <a class="mini-avatar msg-cabecera-avatar" href="${profileUrl(otherProfile)}" style="${avatarStyle(otherProfile)}">${otherProfile.avatar_url ? '' : getInitial(name)}</a>
        <h1 class="msg-cabecera-nombre"><a href="${profileUrl(otherProfile)}"${atributosDeRango(otherProfile, 'color:var(--text)')}>${escapeHtml(name)}</a></h1>
        <a class="msg-ver-perfil" href="${profileUrl(otherProfile)}">Ver perfil</a>
      </div>
      <div class="msg-scroll" id="msgScroll">
        <div class="msg-cambio" id="msgCambio"></div>
        <div id="msgPropuestas" hidden aria-live="polite"></div>
        <section class="perfil-cruce hidden" id="msgCruce" aria-live="polite"></section>
        <div class="msg-mensajes" id="threadMessages" aria-live="polite"><div class="skeleton msg-esqueleto"></div></div>
      </div>
      <button type="button" class="msg-nuevos hidden" id="msgNuevos">${icons.arrowDown(14)} <span>1 nuevo</span></button>
      <form class="msg-compositor" id="msgCompositor">
        <div class="msg-adjuntos" id="msgAdjuntos" hidden></div>
        <div class="msg-linea">
          <button type="button" class="msg-clip" id="msgClip" aria-label="Adjuntar foto" title="Adjuntar foto">${icons.paperclip(18)}</button>
          <textarea id="msgBody" class="msg-caja" rows="1" placeholder="Escribe un mensaje…" aria-label="Mensaje"></textarea>
          <button type="submit" class="msg-enviar" id="btnSendMsg" aria-label="Enviar" title="Enviar">${icons.send(18)}</button>
        </div>
        <input type="file" id="msgFotos" accept="image/*" multiple hidden />
        <input type="file" id="msgCamara" accept="image/*" capture="environment" hidden />
      </form>
      <dialog class="msg-hoja" id="msgHoja" aria-label="Adjuntar foto">
        <div class="msg-hoja-tirador"></div>
        <button type="button" class="msg-hoja-opcion" data-hoja="camara"><span class="msg-hoja-ico">${icons.camera(18)}</span><span>Hacer una foto<small>Abre la cámara</small></span></button>
        <button type="button" class="msg-hoja-opcion" data-hoja="galeria"><span class="msg-hoja-ico">${icons.image(18)}</span><span>Elegir de la galería<small>Hasta ${MAX_FOTOS} fotos por mensaje</small></span></button>
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

  const el = document.getElementById('threadMessages')
  const caja = document.getElementById('msgBody')
  const form = document.getElementById('msgCompositor')
  const btn = document.getElementById('btnSendMsg')
  const pastillaNuevos = document.getElementById('msgNuevos')

  // Las fotos de los mensajes van por direcciones firmadas (el cubo es
  // privado); el módulo se baja al pintar el primer hilo, no antes.
  let adjuntosMod = null
  const adjuntos = async () => (adjuntosMod ||= await import('./mensajes-adjuntos.js'))

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
  async function refreshMessages() {
    if (pintando) return
    pintando = true
    try {
      const [messages, otroLeyoHasta] = await Promise.all([loadThreadMessages(conversationId), otherLastReadAt(conversationId, miId)])
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
      ])
      const vistoId = ultimoVisto(messages, miId, otroLeyoHasta)
      const estabaAbajo = primeraPintada || cercaDelFinal()
      const nuevoAjeno = messages.length && messages[messages.length - 1].id !== ultimoIdPintado && messages[messages.length - 1].sender_id !== miId && ultimoIdPintado !== null
      el.innerHTML =
        messages.length === 0
          ? `<p class="empty-state">Todavía no hay mensajes. ¡Escribe el primero!</p>`
          : agruparPorDia(messages)
              .map(
                (dia) => `<div class="msg-dia"><span>${escapeHtml(dia.etiqueta)}</span></div>${dia.mensajes
                  .map((m) => burbujaHtml(m, { mia: m.sender_id === miId, mencionados, urls, visto: m.id === vistoId ? horaDe(otroLeyoHasta) : null }))
                  .join('')}`
              )
              .join('')
      ultimoIdPintado = messages.length ? messages[messages.length - 1].id : null
      el.querySelectorAll('[data-delete-msg]').forEach((b) => b.addEventListener('click', () => pedirBorrar(b.dataset.deleteMsg, messages)))
      wireReportButtons(el, session)
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

  await refreshMessages()

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
    const { aceptados, rechazados } = cabenAdjuntos(pendientes, [...(lista || [])])
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
  // El clip: con ratón abre la galería directamente; con el dedo, la hoja
  // de «cámara o galería» desde abajo (la 705).
  const hoja = document.getElementById('msgHoja')
  document.getElementById('msgClip').addEventListener('click', () => {
    if (conRaton()) entradaFotos.click()
    else hoja.showModal()
  })
  hoja.addEventListener('click', (e) => {
    const que = e.target.closest('[data-hoja]')?.dataset.hoja
    if (!que && e.target === hoja) hoja.close()
    if (!que) return
    hoja.close()
    if (que === 'camara') entradaCamara.click()
    else if (que === 'galeria') entradaFotos.click()
  })
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
    if (!body && !pendientes.length) return
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
      await sendMessage(conversationId, miId, body, subidas)
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
  const { escuchar, sondeoAdaptable } = await import('./vivo.js')
  const sondeo = sondeoAdaptable(refreshMessages, 10000)
  escuchar({
    nombre: `mensajes-${conversationId}`,
    tablas: [{ tabla: 'private_messages', filtro: `conversation_id=eq.${conversationId}` }],
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
