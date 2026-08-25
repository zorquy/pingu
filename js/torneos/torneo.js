// La ficha de un torneo (/torneo?slug=…): inscribirse, darse de baja,
// entregar la decklist y — para el admin — abrir y cerrar inscripciones.
// Es el porte de la página pública de TrainerArena (SPEC §8 y §9) sin
// pagos: la inscripción es siempre gratuita y activa al momento.
//
// MIENTRAS DURE LA PRUEBA es solo para admins, igual que /torneos.
import { supabase } from '../supabase.js'
import { escapeHtml, getSession, getProfile } from '../app.js'
import { showToast } from '../toast.js'
import { icons } from '../icons.js'
import { parseDecklist, validateDecklist, canEditDecklist } from './motor.js'
import { ESTADOS, fechaBonita, textoFormato } from './comun.js'

let session = null
let perfil = null
let torneo = null
let inscripciones = [] // todas las del torneo, con perfil resuelto
let miInscripcion = null
let miDecklist = null
let decklistsEntregadas = [] // {user_id, submitted_at, locked_at}: el admin ve quién ha entregado

const $ = (id) => document.getElementById(id)

function avisarError(error, quePaso) {
  showToast(
    /tournament/.test(error.message || '')
      ? 'Falta ejecutar supabase-migration-torneos.sql en el SQL Editor de Supabase.'
      : `${quePaso}: ${error.message}`,
    'error'
  )
}

// ── Carga ──

async function cargarTorneo(slug) {
  const { data } = await supabase.from('tournaments').select('*').eq('slug', slug).maybeSingle()
  return data || null
}

async function cargarInscripciones() {
  const { data } = await supabase
    .from('tournament_registrations')
    .select('*')
    .eq('tournament_id', torneo.id)
    .order('registered_at', { ascending: true })
  inscripciones = data || []
  miInscripcion = inscripciones.find((i) => i.user_id === session.user.id) || null

  // Los nombres de usuario, de una tacada.
  const ids = [...new Set(inscripciones.map((i) => i.user_id))]
  if (ids.length) {
    const { data: perfiles } = await supabase.from('user_profiles').select('id, username').in('id', ids)
    const porId = Object.fromEntries((perfiles || []).map((p) => [p.id, p]))
    for (const i of inscripciones) i.perfil = porId[i.user_id] || null
  }
}

async function cargarDecklists() {
  const { data: propia } = await supabase
    .from('tournament_decklists')
    .select('*')
    .eq('tournament_id', torneo.id)
    .eq('user_id', session.user.id)
    .maybeSingle()
  miDecklist = propia || null

  // Para la lista de inscritos: quién ha entregado ya (solo metadatos, el
  // texto de las listas ajenas no se pide nunca desde aquí).
  const { data: entregadas } = await supabase
    .from('tournament_decklists')
    .select('user_id, submitted_at, locked_at')
    .eq('tournament_id', torneo.id)
  decklistsEntregadas = entregadas || []
}

// ── La ficha ──

function activos() {
  return inscripciones.filter((i) => i.status === 'active').length
}

function pintarFicha() {
  const estado = ESTADOS[torneo.status] || ESTADOS.draft
  document.title = `${torneo.name} — PokeDoc`
  $('torneoNombre').textContent = torneo.name
  const pill = $('torneoEstado')
  pill.textContent = estado.texto
  pill.className = `torneo-estado ${estado.clase}`
  $('torneoMeta').textContent = `${fechaBonita(torneo.start_at)} · ${textoFormato(torneo)}`
  const desc = $('torneoDescripcion')
  desc.classList.toggle('hidden', !torneo.description)
  desc.textContent = torneo.description || ''

  const ocupadas = activos()
  $('torneoPlazasTexto').textContent = `${ocupadas} de ${torneo.max_players} plazas`
  $('torneoPlazasRelleno').style.width = `${Math.min(100, (ocupadas / torneo.max_players) * 100)}%`

  const acciones = $('torneoAdminAcciones')
  if (!perfil.is_admin) {
    acciones.innerHTML = ''
  } else if (torneo.status === 'draft') {
    acciones.innerHTML = '<button class="btn-primary" id="btnAbrirInscripciones">Abrir inscripciones</button>'
    $('btnAbrirInscripciones').addEventListener('click', () => cambiarEstado('registration_open', 'Inscripciones abiertas. ¡A correr la voz!'))
  } else if (torneo.status === 'registration_open') {
    acciones.innerHTML = '<button class="btn-secondary" id="btnCerrarInscripciones">Cerrar inscripciones</button>'
    $('btnCerrarInscripciones').addEventListener('click', () => cambiarEstado('registration_closed', 'Inscripciones cerradas.'))
  } else {
    acciones.innerHTML = ''
  }
}

async function cambiarEstado(nuevo, mensaje) {
  const { error } = await supabase.from('tournaments').update({ status: nuevo }).eq('id', torneo.id)
  if (error) {
    avisarError(error, 'No se ha podido cambiar el estado')
    return
  }
  torneo.status = nuevo
  showToast(mensaje, 'success')
  pintarTodo()
}

// ── Tu plaza ──

function pintarMiPlaza() {
  const caja = $('miPlazaContenido')

  if (miInscripcion?.status === 'active') {
    caja.innerHTML = `
      <p>Estás inscrito como <strong>${escapeHtml(miInscripcion.tcg_live_username)}</strong> (tu usuario de TCG Live).</p>
      <button class="btn-secondary" id="btnBaja">Darme de baja</button>`
    engancharBaja()
    return
  }
  if (miInscripcion?.status === 'dropped') {
    caja.innerHTML = '<p class="subtext">Te retiraste de este torneo. La plaza no se libera y no es posible reinscribirse.</p>'
    return
  }
  if (torneo.status !== 'registration_open') {
    caja.innerHTML = `<p class="subtext">${torneo.status === 'draft' ? 'Las inscripciones aún no se han abierto.' : 'Las inscripciones no están abiertas.'}</p>`
    return
  }
  if (activos() >= torneo.max_players) {
    caja.innerHTML = '<p class="subtext">Torneo lleno.</p>'
    return
  }
  caja.innerHTML = `
    <form id="formInscripcion" class="torneo-form-inscripcion">
      <label>Tu usuario de Pokémon TCG Live
        <input type="text" id="inscripcionTcgLive" maxlength="60" placeholder="AshKetchum99" />
      </label>
      <button type="submit" class="btn-primary" id="btnInscribirme">Inscribirme</button>
    </form>
    <p class="subtext">Las partidas se juegan en TCG Live: tu rival te buscará por ese usuario.</p>`
  engancharInscripcion()
}

function engancharInscripcion() {
  let enviando = false
  $('formInscripcion').addEventListener('submit', async (e) => {
    e.preventDefault()
    if (enviando) return
    const tcgLive = $('inscripcionTcgLive').value.trim()
    if (!tcgLive) {
      showToast('Di tu usuario de TCG Live: sin él, tu rival no puede encontrarte.')
      return
    }
    enviando = true
    // Recuento fresco justo antes de insertar. La carrera entre dos
    // inscripciones a la vez no se puede cerrar del todo desde el
    // navegador (TrainerArena usaba un lock de fila); con el aforo de
    // pruebas basta, y el duplicado sí lo corta el UNIQUE de la tabla.
    const { count } = await supabase
      .from('tournament_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', torneo.id)
      .eq('status', 'active')
    if ((count ?? 0) >= torneo.max_players) {
      enviando = false
      showToast('Torneo lleno.', 'error')
      await recargar()
      return
    }
    const { error } = await supabase.from('tournament_registrations').insert({
      tournament_id: torneo.id,
      user_id: session.user.id,
      status: 'active',
      tcg_live_username: tcgLive,
      registered_at: new Date().toISOString(),
    })
    enviando = false
    if (error) {
      if (/duplicate|unique/i.test(error.message || '')) showToast('Ya estás inscrito en este torneo.', 'error')
      else avisarError(error, 'No se ha podido inscribir')
      return
    }
    showToast('¡Inscrito! Recuerda entregar tu decklist antes de que empiece.', 'success')
    await recargar()
  })
}

// Baja en dos pulsaciones: la primera pide confirmar en el propio botón.
function engancharBaja() {
  const btn = $('btnBaja')
  btn.addEventListener('click', async () => {
    if (btn.dataset.confirmar !== '1') {
      btn.dataset.confirmar = '1'
      btn.textContent = '¿Seguro? La plaza no se recupera'
      return
    }
    // SPEC §6.9: sigue jugando su ronda en curso y queda fuera del pareo
    // siguiente; por eso se apunta la ronda en la que se fue.
    const { error } = await supabase
      .from('tournament_registrations')
      .update({
        status: 'dropped',
        dropped_at: new Date().toISOString(),
        dropped_after_round_id: torneo.current_round_id || null,
      })
      .eq('id', miInscripcion.id)
    if (error) {
      avisarError(error, 'No se ha podido tramitar la baja')
      return
    }
    showToast('Baja tramitada. Si el torneo está en juego, tu ronda actual sigue contando.', 'success')
    await recargar()
  })
}

// ── Tu decklist ──

function resumenDecklist(parsed) {
  return `${parsed.total} cartas · ${parsed.pokemon.length} Pokémon, ${parsed.trainer.length} Trainer, ${parsed.energy.length} Energía (líneas distintas)`
}

function pintarDecklist() {
  const caja = $('torneoDecklistCaja')
  // Sin inscripción no hay decklist que enseñar (la de otros, jamás).
  if (!miInscripcion) {
    caja.classList.add('hidden')
    return
  }
  caja.classList.remove('hidden')

  const editable = canEditDecklist(session.user.id, {
    tournament: { status: torneo.status },
    registration: { userId: miInscripcion.user_id, status: miInscripcion.status },
    decklist: miDecklist ? { userId: miDecklist.user_id, lockedAt: miDecklist.locked_at ?? null } : null,
  })

  const sellada = miDecklist?.locked_at
    ? `<span class="torneo-decklist-sellada">${icons.lock(14)} Sellada — ya no se puede cambiar</span>`
    : ''
  const estadoEntrega = miDecklist
    ? `<p class="subtext">Entregada el ${fechaBonita(miDecklist.submitted_at)} · ${resumenDecklist(miDecklist.parsed_cards)} ${sellada}</p>`
    : '<p class="subtext">Todavía no has entregado ninguna lista.</p>'

  $('decklistContenido').innerHTML = `
    ${estadoEntrega}
    <textarea id="decklistTexto" rows="10" maxlength="20000" ${editable ? '' : 'readonly'} placeholder="Pokémon: 8&#10;4 Charizard ex OBF 125&#10;…">${escapeHtml(miDecklist?.raw_text || '')}</textarea>
    <ul class="torneo-decklist-errores hidden" id="decklistErrores"></ul>
    ${editable ? '<button class="btn-primary" id="btnGuardarDecklist">Guardar decklist</button>' : ''}`
  if (editable) engancharDecklist()
}

function engancharDecklist() {
  let guardando = false
  $('btnGuardarDecklist').addEventListener('click', async () => {
    if (guardando) return
    const texto = $('decklistTexto').value
    const parsed = parseDecklist(texto)
    const errores = validateDecklist(parsed)
    const lista = $('decklistErrores')
    lista.classList.toggle('hidden', errores.length === 0)
    lista.innerHTML = errores.map((e) => `<li>${escapeHtml(e)}</li>`).join('')
    if (errores.length) return

    guardando = true
    // La entrega tardía (torneo ya en juego) se sella al momento; el
    // resto de guardados no tocan el sello, que pone el arranque de la
    // ronda 1.
    const { error } = await supabase.from('tournament_decklists').upsert(
      {
        tournament_id: torneo.id,
        user_id: session.user.id,
        raw_text: texto,
        parsed_cards: parsed,
        submitted_at: new Date().toISOString(),
        locked_at: torneo.status === 'in_progress' && !miDecklist ? new Date().toISOString() : miDecklist?.locked_at ?? null,
      },
      { onConflict: 'tournament_id,user_id' }
    )
    guardando = false
    if (error) {
      avisarError(error, 'No se ha podido guardar la decklist')
      return
    }
    showToast('Decklist guardada.', 'success')
    await recargar()
  })
}

// ── Los inscritos ──

function pintarInscritos() {
  $('inscritosNumero').textContent = String(activos())
  $('inscritosVacio').classList.toggle('hidden', inscripciones.length > 0)
  const entregadaPor = new Set(decklistsEntregadas.map((d) => d.user_id))
  $('listaInscritos').innerHTML = inscripciones
    .map((i) => {
      const nombre = i.perfil?.username || 'Alguien'
      const retirado = i.status === 'dropped' ? ' <span class="torneo-retirado">(retirado)</span>' : ''
      // Quién ha entregado lista lo ve solo el organizador: a los demás
      // jugadores no les incumbe (SPEC §9, visibilidad).
      const decklist = perfil.is_admin
        ? `<span class="torneo-decklist-marca ${entregadaPor.has(i.user_id) ? 'entregada' : ''}">${entregadaPor.has(i.user_id) ? 'decklist entregada' : 'sin decklist'}</span>`
        : ''
      return `
      <div class="torneo-inscrito">
        <span class="torneo-inscrito-nombre"><a href="/usuario/${encodeURIComponent(i.perfil?.username || '')}">${escapeHtml(nombre)}</a>${retirado}</span>
        <span class="subtext">TCG Live: ${escapeHtml(i.tcg_live_username)}</span>
        ${decklist}
      </div>`
    })
    .join('')
}

// ── Arranque ──

function pintarTodo() {
  pintarFicha()
  pintarMiPlaza()
  pintarDecklist()
  pintarInscritos()
}

async function recargar() {
  await cargarInscripciones()
  await cargarDecklists()
  pintarTodo()
}

async function init() {
  session = await getSession()
  perfil = session ? await getProfile(session.user.id) : null
  if (!perfil?.is_admin) {
    window.location.href = '/index.html'
    return
  }

  const slug = new URLSearchParams(window.location.search).get('slug')
  torneo = slug ? await cargarTorneo(slug) : null
  if (!torneo) {
    window.location.href = '/torneos.html'
    return
  }

  document.getElementById('torneoContenido').style.display = ''
  await recargar()
}

init()
