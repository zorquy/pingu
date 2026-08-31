// Jueces y chats del torneo (SPEC §10 de TrainerArena, portado):
// solicitudes de juez, llamadas al juez con su conversación, la cola del
// juez con las disputas, y el chat de mesa entre jugadores — que va A LA
// VISTA en «Tu partida» (PINGU lo quiso primero en desplegable y lo
// cambió al probarlo; los chats de juez sí siguen plegados). Sin
// WebSockets: los mensajes se recargan al abrir, tras cada envío y con
// el refresco automático de la ficha (torneo.js, cada 10 s).
//
// torneo.js monta este módulo con montarJueces(ctx) en cada recarga.
import { supabase } from '../supabase.js'
import { escapeHtml } from '../app.js'
import { showToast } from '../toast.js'
import { pintarDecklistVisual } from './cartas-decklist.js'
import { botonesExportarHtml, engancharExportar } from './decklist-export.js'

let ctx = null // { torneo, session, perfil, inscripciones, esJuez, recargarFicha }
let solicitudes = []
let miSolicitud = null
let llamadas = []
let decklistsTorneo = [] // completas, con texto: solo se piden si eres juez u organizador
let mesasPorId = {}
let miPartida = null
let disputadas = []
const perfiles = {} // id → username, para nombres que no están inscritos

const $ = (id) => document.getElementById(id)
// Puede ser null: desde la tanda 229 la ficha se abre también sin
// cuenta (modo escaparate), y entonces no hay «yo».
const yo = () => ctx.session?.user?.id ?? null

function nombreDe(userId) {
  const inscrito = ctx.inscripciones.find((i) => i.user_id === userId)
  return inscrito?.perfil?.username || perfiles[userId] || 'Alguien'
}

async function resolverNombres(ids) {
  const faltan = [...new Set(ids)].filter((id) => id && !perfiles[id] && !ctx.inscripciones.some((i) => i.user_id === id))
  if (!faltan.length) return
  const { data } = await supabase.from('user_profiles').select('id, username').in('id', faltan)
  for (const p of data || []) perfiles[p.id] = p.username
}

// ── Carga ──

async function cargar() {
  // Las solicitudes de juez las trae ya la ficha: las necesita ANTES que
  // este módulo para saber si quien mira es juez aprobado (y con eso
  // decide, entre otras cosas, si puede ver las decklists ajenas).
  // Volver a pedirlas aquí era pedir dos veces lo mismo en cada refresco.
  solicitudes = ctx.solicitudes || []
  miSolicitud = solicitudes.find((s) => s.user_id === yo()) || null

  const { data: calls } = await supabase
    .from('judge_calls')
    .select('*')
    .eq('tournament_id', ctx.torneo.id)
    .order('created_at', { ascending: true })
  llamadas = calls || []

  // Las rondas y las mesas las acaba de cargar el módulo del ciclo
  // (montarCiclo corre antes que montarJueces y las deja en ctx.ciclo).
  // Si por lo que sea no están, se piden: este módulo tiene que poder
  // funcionar solo.
  let rondas = ctx.ciclo?.rondas
  let mesas = ctx.ciclo?.partidas
  if (!rondas || !mesas) {
    const { data: filas } = await supabase.from('rounds').select('id, status').eq('tournament_id', ctx.torneo.id)
    rondas = filas || []
    const idsRondas = rondas.map((r) => r.id)
    mesas = []
    if (idsRondas.length) {
      const { data } = await supabase.from('tournament_matches').select('*').in('round_id', idsRondas)
      mesas = data || []
    }
  }
  mesasPorId = Object.fromEntries(mesas.map((m) => [m.id, m]))
  disputadas = mesas.filter((m) => m.status === 'disputed')

  const rondaViva = rondas.find((r) => r.status !== 'finished') || null
  // El `mi &&` importa: sin sesión yo() es null, y la mesa del bye tiene
  // player_b_id a null — sin él, un visitante «tendría» esa partida.
  const mi = yo()
  miPartida = mi && rondaViva
    ? mesas.find((m) => m.round_id === rondaViva.id && (m.player_a_id === mi || m.player_b_id === mi)) || null
    : null

  // Las decklists completas SOLO para juez u organizador (SPEC §9: los
  // jugadores nunca ven las ajenas — desde aquí ni se piden).
  decklistsTorneo = []
  if (ctx.perfil?.is_admin || ctx.esJuez) {
    // Igual que arriba: quien es juez u organizador ya se las ha traído
    // enteras en la ficha, y son la MISMA consulta.
    if (ctx.decklistsTorneo) {
      decklistsTorneo = ctx.decklistsTorneo
    } else {
      const { data } = await supabase
        .from('tournament_decklists')
        .select('*')
        .eq('tournament_id', ctx.torneo.id)
        .order('submitted_at', { ascending: true })
      decklistsTorneo = data || []
    }
  }

  await resolverNombres([
    ...solicitudes.map((s) => s.user_id),
    ...llamadas.flatMap((c) => [c.created_by, c.assigned_judge_id]),
  ])
}

// ── Las decklists del torneo (SPEC §9 y /juez/.../decklists) ──
// Listado con quién falta y detalle abrible: resumen por secciones y el
// texto crudo tal cual lo pegó el jugador.
function pintarDecklistsJuez() {
  const caja = $('torneoDecklistsJuezCaja')
  const soyJuez = ctx.perfil?.is_admin || ctx.esJuez
  const activos = ctx.inscripciones.filter((i) => i.status === 'active')
  if (!soyJuez || (!decklistsTorneo.length && !activos.length)) {
    caja.classList.add('hidden')
    return
  }
  caja.classList.remove('hidden')

  const entregadas = decklistsTorneo
    .map((d) => {
      const p = d.parsed_cards || {}
      const detalle = `
        <div class="torneo-decklist-detalle hidden" data-decklist-detalle="${escapeHtml(d.user_id)}">
          <p class="subtext">${p.pokemon?.length ?? 0} líneas de Pokémon · ${p.trainer?.length ?? 0} de Trainer · ${p.energy?.length ?? 0} de Energía — ${p.total ?? '?'} cartas</p>
          ${botonesExportarHtml()}
          <div class="torneo-decklist-visual" data-decklist-cartas="${escapeHtml(d.user_id)}"></div>
          <pre class="torneo-decklist-cruda">${escapeHtml(d.raw_text || '')}</pre>
        </div>`
      return `
      <div class="torneo-decklist-fila">
        <span><strong>${escapeHtml(nombreDe(d.user_id))}</strong> — ${p.total ?? '?'} cartas${d.locked_at ? ' · sellada' : ''}</span>
        <button class="btn-secondary" data-ver-decklist="${escapeHtml(d.user_id)}">Ver</button>
      </div>${detalle}`
    })
    .join('')

  const conLista = new Set(decklistsTorneo.map((d) => d.user_id))
  const faltan = activos.filter((i) => !conLista.has(i.user_id))
  const sinEntregar = faltan.length
    ? `<p class="torneo-decklists-faltan">Sin entregar: ${faltan.map((i) => escapeHtml(i.perfil?.username || 'Alguien')).join(', ')} — pierden las rondas que empiecen sin lista.</p>`
    : ''

  $('decklistsJuezContenido').innerHTML =
    (entregadas || '<p class="subtext">Nadie ha entregado lista todavía.</p>') + sinEntregar

  document.querySelectorAll('[data-ver-decklist]').forEach((b) =>
    b.addEventListener('click', () => {
      const detalle = document.querySelector(`[data-decklist-detalle="${b.dataset.verDecklist}"]`)
      detalle.classList.toggle('hidden')
      b.textContent = detalle.classList.contains('hidden') ? 'Ver' : 'Cerrar'
      // Las cartas se buscan la primera vez que se abre, no antes. Los
      // botones de exportar (tanda 219) se enganchan en esa misma pasada.
      const cartas = detalle.querySelector('[data-decklist-cartas]')
      if (!detalle.classList.contains('hidden') && cartas && !cartas.dataset.pintada) {
        cartas.dataset.pintada = '1'
        const lista = decklistsTorneo.find((d) => d.user_id === b.dataset.verDecklist)
        if (lista?.parsed_cards) pintarDecklistVisual(cartas, lista.parsed_cards)
        if (lista) engancharExportar(detalle, { nombre: nombreDe(lista.user_id), rawText: lista.raw_text, parsed: lista.parsed_cards })
      }
    })
  )
}

// ── El chat, común a mesas y llamadas ──
// El de la MESA va a la vista (pedido de PINGU: fuera el desplegable
// entre jugadores); los de juez siguen plegados en <details>, y
// `desplegado` conserva los que estaban abiertos cuando la ficha se
// refresca sola.

function montarChat(marcador, { tabla, columna, id, titulo, cerrado, abierto = false, desplegado = false }) {
  const cuerpo = `
      <div class="torneo-chat-cuerpo">
        <div class="torneo-chat-mensajes"><p class="subtext">Cargando…</p></div>
        ${cerrado
          ? '<p class="subtext">Conversación cerrada: queda como registro.</p>'
          : '<div class="torneo-chat-envio"><input type="text" maxlength="2000" placeholder="Escribe…" /><button type="button" class="btn-secondary">Enviar</button></div>'}
      </div>`
  marcador.innerHTML = abierto
    ? `<div class="torneo-chat-abierto">
        <p class="torneo-chat-titulo">${escapeHtml(titulo)}</p>${cuerpo}
      </div>`
    : `<details class="torneo-chat-desplegable" ${desplegado ? 'open' : ''}>
        <summary>${escapeHtml(titulo)}</summary>${cuerpo}
      </details>`
  const detalles = marcador.querySelector('details')
  const lista = marcador.querySelector('.torneo-chat-mensajes')

  // Cada mensaje en su bocadillo: los tuyos a la derecha en navy, los
  // del otro a la izquierda — con quién y a qué hora.
  async function pintarMensajes() {
    const { data } = await supabase
      .from(tabla)
      .select('*')
      .eq(columna, id)
      .order('sent_at', { ascending: true })
      .limit(200)
    const mensajes = data || []
    await resolverNombres(mensajes.map((m) => m.sender_id))
    lista.innerHTML =
      mensajes
        .map((m) => {
          const mio = m.sender_id === yo()
          const hora = m.sent_at
            ? new Date(m.sent_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            : ''
          return `
          <div class="torneo-chat-linea ${mio ? 'mia' : ''}">
            <div class="torneo-burbuja">
              ${mio ? '' : `<span class="torneo-burbuja-quien">${escapeHtml(nombreDe(m.sender_id))}</span>`}
              <span class="torneo-burbuja-texto">${escapeHtml(m.message)}</span>
              <span class="torneo-burbuja-hora">${hora}</span>
            </div>
          </div>`
        })
        .join('') || '<p class="subtext">Sin mensajes todavía.</p>'
    lista.scrollTop = lista.scrollHeight
  }

  if (detalles) {
    detalles.addEventListener('toggle', () => {
      if (detalles.open) pintarMensajes()
    })
  }
  // A la vista o ya desplegado: los mensajes se cargan al momento (y en
  // cada refresco automático de la ficha, que remonta este chat).
  if (abierto || desplegado) pintarMensajes()
  const boton = marcador.querySelector('.torneo-chat-envio button')
  if (boton) {
    const enviarMensaje = async () => {
      const input = marcador.querySelector('.torneo-chat-envio input')
      const texto = input.value.trim()
      if (!texto) return
      const { error } = await supabase.from(tabla).insert({ [columna]: id, sender_id: yo(), message: texto })
      if (error) {
        showToast('No se ha podido enviar: ' + error.message, 'error')
        return
      }
      input.value = ''
      pintarMensajes()
    }
    boton.addEventListener('click', enviarMensaje)
    marcador.querySelector('.torneo-chat-envio input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') enviarMensaje()
    })
  }
}

// ── Tu partida: chat de mesa y llamar al juez ──

function pintarMiPartidaExtra() {
  const zona = $('miPartidaExtra')
  if (!miPartida || miPartida.status === 'bye') {
    zona.innerHTML = ''
    return
  }

  // El refresco automático remonta esta zona: si el chat con el juez
  // estaba abierto, que siga abierto.
  const llamadaAbierta = Boolean($('chatDeLlamada')?.querySelector('details')?.open)

  zona.innerHTML = `
    <div id="chatDeMesa"></div>
    <div class="torneo-llamar-juez" id="zonaLlamarJuez"></div>`
  montarChat($('chatDeMesa'), {
    tabla: 'match_messages',
    columna: 'match_id',
    id: miPartida.id,
    titulo: 'Chat de la mesa',
    cerrado: false,
    abierto: true, // entre jugadores, a la vista: fuera el desplegable
  })

  const zonaJuez = $('zonaLlamarJuez')
  const puedeLlamar = ['active', 'awaiting_confirmation', 'disputed'].includes(miPartida.status)
  const miLlamada = llamadas.find((c) => c.match_id === miPartida.id && c.created_by === yo() && c.status !== 'resolved')
  if (miLlamada) {
    zonaJuez.innerHTML = `
      <p class="subtext">${miLlamada.status === 'open' ? 'Esperando juez…' : `Un juez la está atendiendo (${escapeHtml(nombreDe(miLlamada.assigned_judge_id))}).`}</p>
      <div id="chatDeLlamada"></div>`
    montarChat($('chatDeLlamada'), {
      tabla: 'judge_messages',
      columna: 'judge_call_id',
      id: miLlamada.id,
      titulo: 'Conversación con el juez',
      cerrado: false,
      desplegado: llamadaAbierta,
    })
  } else if (puedeLlamar) {
    zonaJuez.innerHTML = '<button class="btn-secondary" id="btnLlamarJuez">Llamar al juez</button>'
    $('btnLlamarJuez').addEventListener('click', llamarJuez)
  } else {
    zonaJuez.innerHTML = ''
  }
}

// Idempotente (SPEC §10.2): una llamada viva por jugador y mesa se
// reutiliza; solo se crea si no hay ninguna.
async function llamarJuez() {
  const viva = llamadas.find((c) => c.match_id === miPartida.id && c.created_by === yo() && c.status !== 'resolved')
  if (viva) {
    showToast('Ya tienes una llamada en marcha para esta mesa.')
    return
  }
  const { error } = await supabase.from('judge_calls').insert({
    tournament_id: ctx.torneo.id,
    match_id: miPartida.id,
    created_by: yo(),
    status: 'open',
  })
  if (error) {
    showToast('No se ha podido llamar: ' + error.message, 'error')
    return
  }
  showToast('Llamada enviada: un juez te atenderá en el chat.', 'success')
  await recargarJueces()
}

// ── La cola del juez ──

function pintarCola() {
  const caja = $('torneoColaCaja')
  const soyJuez = ctx.perfil?.is_admin || ctx.esJuez
  const vivas = llamadas.filter((c) => c.status !== 'resolved')
  if (!soyJuez || (!vivas.length && !disputadas.length && !llamadas.length)) {
    caja.classList.add('hidden')
    return
  }
  caja.classList.remove('hidden')

  // El refresco automático repinta la cola: los chats que estaban
  // abiertos se quedan abiertos.
  const chatsAbiertos = new Set(
    [...document.querySelectorAll('[data-chat-llamada]')]
      .filter((el) => el.querySelector('details')?.open)
      .map((el) => el.dataset.chatLlamada)
  )

  const filasLlamadas = llamadas
    .map((c) => {
      const mesa = mesasPorId[c.match_id]
      const estado =
        c.status === 'open' ? 'sin atender' : c.status === 'in_progress' ? `la atiende ${escapeHtml(nombreDe(c.assigned_judge_id))}` : 'resuelta'
      const acciones =
        c.status === 'open'
          ? `<button class="btn-secondary" data-atender="${c.id}">Atender</button>`
          : c.status === 'in_progress'
            ? `<button class="btn-secondary" data-resolver-llamada="${c.id}">Resolver</button>`
            : ''
      return `
      <div class="torneo-llamada">
        <div class="torneo-llamada-fila">
          <span>Mesa ${mesa ? mesa.table_number : '?'} — llamada de <strong>${escapeHtml(nombreDe(c.created_by))}</strong> <span class="subtext">(${estado})</span></span>
          ${acciones}
        </div>
        <div data-chat-llamada="${c.id}"></div>
      </div>`
    })
    .join('')

  const filasDisputas = disputadas
    .map(
      (m) =>
        `<p class="torneo-disputa">Mesa ${m.table_number} en <strong>disputa</strong>: ${escapeHtml(nombreDe(m.player_a_id))} contra ${escapeHtml(nombreDe(m.player_b_id))} — resuélvela en la sección de mesas.</p>`
    )
    .join('')

  $('colaContenido').innerHTML =
    filasLlamadas + filasDisputas || '<p class="subtext">Sin llamadas ni disputas pendientes.</p>'

  for (const c of llamadas) {
    const marcador = document.querySelector(`[data-chat-llamada="${c.id}"]`)
    if (marcador) {
      montarChat(marcador, {
        tabla: 'judge_messages',
        columna: 'judge_call_id',
        id: c.id,
        titulo: 'Conversación',
        cerrado: c.status === 'resolved',
        desplegado: chatsAbiertos.has(c.id),
      })
    }
  }
  document.querySelectorAll('[data-atender]').forEach((b) => b.addEventListener('click', () => atender(b.dataset.atender)))
  document
    .querySelectorAll('[data-resolver-llamada]')
    .forEach((b) => b.addEventListener('click', () => resolverLlamada(b.dataset.resolverLlamada)))
}

// Atender bajo candado (SPEC §10.2): el filtro por estado hace que si
// dos jueces pulsan a la vez, solo el primero cambie la fila.
async function atender(llamadaId) {
  const { data } = await supabase
    .from('judge_calls')
    .update({ status: 'in_progress', assigned_judge_id: yo() })
    .eq('id', llamadaId)
    .eq('status', 'open')
    .select('id')
  if (!data || !data.length) {
    showToast('Otro juez se ha adelantado con esa llamada.', 'error')
  }
  await recargarJueces()
}

async function resolverLlamada(llamadaId) {
  const llamada = llamadas.find((c) => c.id === llamadaId)
  await supabase
    .from('judge_calls')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      assigned_judge_id: llamada?.assigned_judge_id || yo(),
    })
    .eq('id', llamadaId)
  showToast('Llamada resuelta: el chat queda como registro.', 'success')
  await recargarJueces()
}

// ── Solicitudes de juez ──

function pintarSolicitudes() {
  const caja = $('torneoJuecesCaja')
  // El escaparate (tanda 229) no ve nada de jueces: quien mira sin
  // cuenta no puede solicitar serlo ni le incumbe quién lo es.
  if (!yo()) {
    caja.classList.add('hidden')
    return
  }
  const soyOrganizador = ctx.torneo.admin_id === yo()
  const pendientes = solicitudes.filter((s) => s.status === 'pending')
  const aprobados = solicitudes.filter((s) => s.status === 'approved')

  let propio = ''
  if (!soyOrganizador) {
    if (!miSolicitud) {
      propio = '<button class="btn-secondary" id="btnSolicitarJuez">Solicitar ser juez</button>'
    } else if (miSolicitud.status === 'pending') {
      propio = '<p class="subtext">Solicitud enviada: pendiente del organizador.</p>'
    } else if (miSolicitud.status === 'approved') {
      propio = '<p>Eres <strong>juez</strong> de este torneo: la cola de llamadas es tuya también.</p>'
    } else {
      propio = '<p class="subtext">Tu solicitud fue rechazada.</p>'
    }
  }

  let gestion = ''
  if (ctx.perfil?.is_admin) {
    const filas = pendientes
      .map(
        (s) => `
        <div class="torneo-solicitud-juez">
          <span><strong>${escapeHtml(nombreDe(s.user_id))}</strong> quiere ser juez</span>
          <span>
            <button class="btn-secondary" data-decidir-juez="${s.id}" data-decision="approved">Aprobar</button>
            <button class="btn-secondary" data-decidir-juez="${s.id}" data-decision="rejected">Rechazar</button>
          </span>
        </div>`
      )
      .join('')
    const lista = aprobados.length
      ? `<p class="subtext">Jueces del torneo: ${aprobados.map((s) => escapeHtml(nombreDe(s.user_id))).join(', ')}.</p>`
      : ''
    gestion = filas + lista
  }

  if (!propio && !gestion) {
    caja.classList.add('hidden')
    return
  }
  caja.classList.remove('hidden')
  $('juecesContenido').innerHTML = propio + gestion

  if ($('btnSolicitarJuez')) $('btnSolicitarJuez').addEventListener('click', solicitarJuez)
  document.querySelectorAll('[data-decidir-juez]').forEach((b) =>
    b.addEventListener('click', () => decidirJuez(b.dataset.decidirJuez, b.dataset.decision))
  )
}

async function solicitarJuez() {
  const { error } = await supabase.from('judge_applications').insert({
    tournament_id: ctx.torneo.id,
    user_id: yo(),
    status: 'pending',
  })
  if (error) {
    showToast('No se ha podido solicitar: ' + error.message, 'error')
    return
  }
  showToast('Solicitud enviada al organizador.', 'success')
  // Ficha ENTERA y no solo esta caja: desde la tanda 229 las solicitudes
  // las carga torneo.js (para no pedirlas dos veces), así que un
  // recargarJueces() a secas repintaría la lista de antes. Y aprobar a
  // un juez cambia además lo que esa persona puede ver.
  await ctx.recargarFicha()
}

async function decidirJuez(solicitudId, decision) {
  await supabase
    .from('judge_applications')
    .update({ status: decision, decided_at: new Date().toISOString(), decided_by: yo() })
    .eq('id', solicitudId)
  showToast(decision === 'approved' ? 'Juez aprobado.' : 'Solicitud rechazada.', 'success')
  await ctx.recargarFicha()
}

// ── Arranque ──

function pintarJueces() {
  pintarSolicitudes()
  pintarCola()
  pintarDecklistsJuez()
  pintarMiPartidaExtra()
  ctx.alRepintar?.()
}

async function recargarJueces() {
  await cargar()
  pintarJueces()
}

export async function montarJueces(contexto) {
  ctx = contexto
  await cargar()
  pintarJueces()
}
