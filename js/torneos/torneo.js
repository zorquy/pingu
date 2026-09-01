// La ficha de un torneo (/torneo?slug=…): inscribirse, darse de baja,
// entregar la decklist y — para el admin — abrir y cerrar inscripciones.
// Es el porte de la página pública de TrainerArena (SPEC §8 y §9) sin
// pagos: la inscripción es siempre gratuita y activa al momento.
//
// MIENTRAS DURE LA PRUEBA es solo para admins, igual que /torneos.
import { supabase } from '../supabase.js'
import { escapeHtml, getSession, getProfile, burstConfetti } from '../app.js'
import { showToast } from '../toast.js'
import { icons } from '../icons.js'
import { parseDecklist, validateDecklist, canEditDecklist, decklistUnparsed, officialStructure } from './motor.js'
import {
  ESTADOS,
  fechaBonita,
  textoFormato,
  puedeBorrarTorneo,
  COLUMNAS_PUBLICAS_INSCRIPCION,
} from './comun.js'
import { montarCiclo, resumenDeGloria, podioDelTorneo } from './ronda.js'
import { montarJueces } from './jueces.js'
import { getAllAchievements, addXP } from '../gamification.js'
import { urlTema } from '../foro-comun.js'
import { pintarDecklistVisual } from './cartas-decklist.js'
import { botonesExportarHtml, engancharExportar } from './decklist-export.js'
import { sanitizeRichText } from '../richtext-format.js'
import { borrarTorneo, anunciarBorrado, textoConfirmarBorrado } from './borrar.js'

let session = null
let perfil = null
let torneo = null
let inscripciones = [] // todas las del torneo, con perfil resuelto
let miInscripcion = null
let miDecklist = null
let decklistsEntregadas = [] // {user_id, submitted_at, locked_at}: el admin ve quién ha entregado
let decklistsTorneo = null // las listas ENTERAS, solo si quien mira es juez u organizador
let solicitudesJuez = [] // todas las solicitudes de juez del torneo (las usa jueces.js)
let esJuez = false
// MODO ESCAPARATE (tanda 229): la ficha se abre TAMBIÉN sin cuenta, para
// que un enlace compartido enseñe algo en vez de rebotar. Quien mira sin
// entrar ve el cartel, los inscritos, las mesas y la clasificación; no
// ve decklists, ni chats, ni jueces, ni el usuario de TCG Live de nadie,
// y no puede tocar nada.
//
// Quien decide de verdad qué se puede leer es la RLS de la base, no
// esto: aquí solo se evita pedir lo que se sabe que no toca y pintar
// cajas que estarían vacías.
let soloMirando = false

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
    .select(soloMirando ? COLUMNAS_PUBLICAS_INSCRIPCION.join(', ') : '*')
    .eq('tournament_id', torneo.id)
    .order('registered_at', { ascending: true })
  inscripciones = data || []
  miInscripcion = session ? inscripciones.find((i) => i.user_id === session.user.id) || null : null

  // Los nombres de usuario, de una tacada.
  const ids = [...new Set(inscripciones.map((i) => i.user_id))]
  if (ids.length) {
    const { data: perfiles } = await supabase.from('user_profiles').select('id, username').in('id', ids)
    const porId = Object.fromEntries((perfiles || []).map((p) => [p.id, p]))
    for (const i of inscripciones) i.perfil = porId[i.user_id] || null
  }
}

// Quién es juez aprobado en este torneo, y de paso TODAS las solicitudes:
// las necesita el módulo de jueces, que antes las volvía a pedir. Se
// piden aquí porque la respuesta decide lo siguiente que se carga.
async function cargarJueces() {
  if (soloMirando) {
    solicitudesJuez = []
    esJuez = false
    return
  }
  const { data } = await supabase.from('judge_applications').select('*').eq('tournament_id', torneo.id)
  solicitudesJuez = data || []
  esJuez = solicitudesJuez.some((s) => s.user_id === session.user.id && s.status === 'approved')
}

async function cargarDecklists() {
  // Sin cuenta no hay decklist propia ni derecho a ver las ajenas: no se
  // pide ninguna de las dos consultas.
  if (soloMirando) {
    decklistsTorneo = null
    decklistsEntregadas = []
    miDecklist = null
    return
  }

  // Juez u organizador ven las listas enteras, así que UNA consulta les
  // sirve para las tres cosas: la suya, quién ha entregado y el detalle
  // de cada una. Antes se pedía tres veces (dos aquí y otra en
  // jueces.js) en CADA refresco.
  if (perfil?.is_admin || esJuez) {
    const { data } = await supabase
      .from('tournament_decklists')
      .select('*')
      .eq('tournament_id', torneo.id)
      .order('submitted_at', { ascending: true })
    decklistsTorneo = data || []
    decklistsEntregadas = decklistsTorneo
    miDecklist = decklistsTorneo.find((d) => d.user_id === session.user.id) || null
    return
  }

  decklistsTorneo = null // señal para jueces.js: aquí no se han traído
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
  $('torneoMeta').textContent = fechaBonita(torneo.start_at)
  // La descripción sale del editor con formato (tanda 220) y se pinta
  // SANEADA por la misma lista cerrada del foro. Las descripciones de
  // antes eran texto plano: sin etiquetas dentro, se pintan como texto
  // para no perder sus saltos de línea.
  const desc = $('torneoDescripcion')
  desc.classList.toggle('hidden', !torneo.description)
  if (/<[a-z][\s\S]*>/i.test(torneo.description || '')) {
    desc.innerHTML = sanitizeRichText(torneo.description)
    desc.classList.remove('torneo-descripcion-plana')
  } else {
    desc.textContent = torneo.description || ''
    desc.classList.add('torneo-descripcion-plana')
  }

  // La caja «Formato» del original: cada dato con su icono. Una liga
  // (tanda 219) habla de jornadas y enseña su calendario debajo.
  const esLiga = torneo.format === 'league'
  $('torneoFormato').innerHTML = [
    [icons.layers(18), esLiga ? 'Jornadas' : 'Rondas suizas', `${torneo.swiss_rounds} · BO${torneo.swiss_bo ?? 1}`],
    [icons.trophy(18), 'Top cut', torneo.top_cut_size ? `Top ${torneo.top_cut_size} · BO${torneo.top_cut_bo ?? 3}` : 'Sin corte'],
    // Los «?? por defecto» son los mismos de la tabla: una ficha nunca
    // debe enseñar «undefined min» si a la fila le falta la columna.
    [icons.clock(18), 'Tiempo por ronda', `${torneo.round_time_minutes ?? 30} min`],
    [icons.checkCircle(18), 'Check-in', `${torneo.checkin_minutes ?? 5} min`],
  ]
    .map(([icono, dt, dd]) => `<div class="torneo-formato-dato">${icono}<div><dt>${dt}</dt><dd>${escapeHtml(dd)}</dd></div></div>`)
    .join('')
  // El calendario de la liga: una chapa por jornada con su fecha.
  document.getElementById('torneoJornadas')?.remove()
  const jornadas = Array.isArray(torneo.matchday_dates) ? torneo.matchday_dates : []
  if (esLiga && jornadas.length) {
    $('torneoFormato').insertAdjacentHTML(
      'afterend',
      `<div class="torneo-jornadas" id="torneoJornadas">${jornadas
        .map((f, i) => `<span class="torneo-jornada-chip">${icons.calendar(14)} J${i + 1} · ${escapeHtml(fechaBonita(f))}</span>`)
        .join('')}</div>`
    )
  }

  // max_players NULL = aforo sin límite (tanda 228): sin denominador la
  // barra de ocupación no cuenta nada — se esconde y se dice la gente.
  const ocupadas = activos()
  const aforoSinLimite = torneo.max_players == null
  $('torneoPlazasTexto').textContent = aforoSinLimite
    ? `${ocupadas} inscrito${ocupadas === 1 ? '' : 's'} · sin límite de plazas`
    : `${ocupadas} de ${torneo.max_players} plazas`
  document.querySelector('.torneo-plazas-barra')?.classList.toggle('hidden', aforoSinLimite)
  if (!aforoSinLimite) $('torneoPlazasRelleno').style.width = `${Math.min(100, (ocupadas / torneo.max_players) * 100)}%`

  // El cuadro de cierre con rondas (tanda 228) sobrevive a los
  // repintados del sondeo mientras las inscripciones sigan abiertas —
  // es hermano de las acciones, no hijo—; si el estado cambió por
  // debajo, ya no pinta nada ahí.
  if (torneo.status !== 'registration_open') document.getElementById('torneoCerrarRondas')?.remove()

  const acciones = $('torneoAdminAcciones')
  if (!perfil?.is_admin) {
    acciones.innerHTML = ''
  } else if (torneo.status === 'draft') {
    acciones.innerHTML = '<button class="btn-primary" id="btnAbrirInscripciones">Abrir inscripciones</button>'
    $('btnAbrirInscripciones').addEventListener('click', () => cambiarEstado('registration_open', 'Inscripciones abiertas. ¡A correr la voz!'))
  } else if (torneo.status === 'registration_open') {
    acciones.innerHTML = '<button class="btn-secondary" id="btnCerrarInscripciones">Cerrar inscripciones</button>'
    $('btnCerrarInscripciones').addEventListener('click', cerrarInscripciones)
  } else {
    acciones.innerHTML = ''
  }
  if (perfil?.is_admin && torneo.status !== 'draft') pintarAnuncioForo(acciones)
  ponerBotonCalendario(acciones)
  // Herramientas del organizador (tanda 211): editar mientras tenga
  // sentido, y cancelar mientras el torneo siga vivo.
  if (perfil?.is_admin && ['draft', 'registration_open', 'registration_closed'].includes(torneo.status)) {
    acciones.insertAdjacentHTML('beforeend', '<button class="btn-secondary" id="btnEditarTorneo">Editar</button>')
    $('btnEditarTorneo').addEventListener('click', pintarEditor)
  }
  if (perfil?.is_admin && !['finished', 'cancelled'].includes(torneo.status)) {
    acciones.insertAdjacentHTML('beforeend', '<button class="btn-secondary" id="btnCancelarTorneo">Cancelar torneo</button>')
    engancharCancelar()
  }
  // Borrar va SIEMPRE el último y separado del resto: no es un paso más
  // del ciclo del torneo, es el que no tiene vuelta.
  if (puedeBorrarTorneo(perfil, torneo, session?.user?.id)) {
    acciones.insertAdjacentHTML('beforeend', '<button class="torneo-borrar" id="btnBorrarTorneo">Borrar torneo</button>')
    engancharBorrar()
  }
}

// ── Editar el torneo (tanda 211; ampliado en la 220) ──
// Nombre, fecha, descripción, check-in y la visibilidad de listas se
// pueden retocar hasta el final de las inscripciones; la ESTRUCTURA
// (plazas, rondas/jornadas, corte, BO, minutos) solo mientras las
// inscripciones no se hayan cerrado — cerrarlas es el paso previo a
// generar pareos, y los pareos dependen de ella. En una liga las
// jornadas se añaden, se quitan y se les cambia la fecha desde aquí
// (las fechas se pueden retocar incluso cerradas: son informativas).
const aFechaLocal = (iso) => {
  const d = iso ? new Date(iso) : new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

let editarDescripcionHtml = ''
// La imagen del torneo en el editor (tanda 239): `undefined` = sin
// tocar, un File = subir esta al guardar, `null` = quitar la que hay.
// La subida se hace SOLO al guardar, para no dejar ficheros huérfanos
// en Storage si se cierra el editor sin más.
let editarImagenNueva = undefined

function pintarJornadasEditor(fechas, bloqueada) {
  const lista = $('editarJornadasLista')
  lista.innerHTML = fechas
    .map(
      (f, i) => `
    <div class="torneo-jornada-campo">
      <label>Jornada ${i + 1}
        <input type="datetime-local" data-editar-jornada="${i}" value="${escapeHtml(f || '')}" />
      </label>
      ${!bloqueada && fechas.length > 1 ? `<button type="button" class="btn-secondary torneo-quitar-jornada" data-editar-quitar="${i}" title="Quitar esta jornada">✕</button>` : ''}
    </div>`
    )
    .join('')
  lista.querySelectorAll('[data-editar-quitar]').forEach((b) =>
    b.addEventListener('click', () => {
      pintarJornadasEditor(fechasDelEditor().filter((_, i) => i !== Number(b.dataset.editarQuitar)), bloqueada)
    })
  )
}

function fechasDelEditor() {
  return [...document.querySelectorAll('#editarJornadasLista input')].map((i) => i.value)
}

function pintarEditor() {
  const previo = $('torneoEditor')
  if (previo) {
    previo.remove()
    return
  }
  const estructuraBloqueada = torneo.status === 'registration_closed'
  const esLiga = torneo.format === 'league'
  const bloqueo = estructuraBloqueada ? 'disabled title="Con las inscripciones cerradas, la estructura ya no se toca"' : ''
  document.querySelector('.torneo-ficha').insertAdjacentHTML(
    'beforeend',
    `
    <div class="torneos-form torneo-editor" id="torneoEditor">
      <div class="torneos-form-rejilla">
        <label>Nombre<input type="text" id="editarNombre" maxlength="120" value="${escapeHtml(torneo.name)}" /></label>
        <label>Fecha y hora<input type="datetime-local" id="editarFecha" value="${aFechaLocal(torneo.start_at)}" /></label>
        <div class="torneos-form-plazas">Plazas
          <input type="number" id="editarPlazas" min="4" max="256" value="${torneo.max_players ?? ''}" ${bloqueo} ${torneo.max_players == null ? 'disabled' : ''} />
          <label class="torneo-sin-limite"><input type="checkbox" id="editarSinLimite" ${torneo.max_players == null ? 'checked' : ''} ${bloqueo} /> Sin límite</label>
        </div>
        ${esLiga ? '' : `<label>Rondas suizas<input type="number" id="editarRondas" min="1" max="12" value="${torneo.swiss_rounds}" ${bloqueo} /></label>`}
        <label>Top cut<select id="editarCorte" ${bloqueo}>${[0, 4, 8, 16].map((n) => `<option value="${n}" ${torneo.top_cut_size === n ? 'selected' : ''}>${n ? `Top ${n}` : 'Sin corte'}</option>`).join('')}</select></label>
        <label>Minutos por ronda<input type="number" id="editarMinutos" min="5" max="120" value="${torneo.round_time_minutes}" ${bloqueo} /></label>
        <label>Check-in (min)<input type="number" id="editarCheckin" min="0" max="30" value="${torneo.checkin_minutes ?? 5}" /></label>
        <label>Suizas al mejor de<select id="editarSwissBo" ${bloqueo}>${[1, 3].map((n) => `<option value="${n}" ${torneo.swiss_bo === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>Corte al mejor de<select id="editarCorteBo" ${bloqueo}>${[1, 3].map((n) => `<option value="${n}" ${torneo.top_cut_bo === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      </div>
      ${
        esLiga
          ? `<fieldset class="torneo-jornadas-campos">
              <legend>Fechas de las jornadas</legend>
              <div id="editarJornadasLista"></div>
              ${estructuraBloqueada ? '<p class="torneo-campo-pista">Con las inscripciones cerradas puedes cambiar las fechas, pero no añadir ni quitar jornadas.</p>' : '<button type="button" class="btn-secondary torneo-anadir-jornada" id="btnEditarAnadirJornada">+ Añadir jornada</button>'}
            </fieldset>`
          : ''
      }
      <label class="torneo-check-campo">
        <input type="checkbox" id="editarListasRivales" ${torneo.show_opponent_decklists ? 'checked' : ''} />
        <span><strong>Listas a la vista entre rivales.</strong> Podrán ver las decklists de sus rivales desde la clasificación, una vez selladas.</span>
      </label>
      <div class="torneos-form-campo">Imagen del torneo
        <div class="torneo-imagen-campo">
          <img id="editarImagenPreview" class="torneo-imagen-preview ${torneo.image_url ? '' : 'hidden'}" src="${escapeHtml(torneo.image_url || '')}" alt="" />
          <button type="button" class="btn-secondary" id="btnEditarImagen">${torneo.image_url ? 'Cambiar imagen' : 'Elegir imagen'}</button>
          <button type="button" class="btn-outline ${torneo.image_url ? '' : 'hidden'}" id="btnEditarImagenQuitar">Quitar</button>
          <input type="file" id="editarImagenInput" accept="image/*" class="hidden" />
        </div>
        <span class="torneo-campo-pista">Se enseña como icono en el listado de torneos.</span>
      </div>
      <div class="torneos-form-descripcion">Descripción
        <div class="rte-wrap rte-compacta torneo-desc-editor">
          <div class="rte-toolbar" id="editarDescBarra"></div>
          <div class="rte-surface" id="editarDescCuerpo"></div>
        </div>
      </div>
      <div class="torneos-form-acciones">
        <button class="btn-primary" id="btnGuardarEdicion">Guardar cambios</button>
        <button class="btn-secondary" id="btnCerrarEdicion">Cerrar</button>
      </div>
    </div>`
  )
  if (esLiga) {
    const fechas = (Array.isArray(torneo.matchday_dates) ? torneo.matchday_dates : []).map(aFechaLocal)
    pintarJornadasEditor(fechas.length ? fechas : [''], estructuraBloqueada)
    $('btnEditarAnadirJornada')?.addEventListener('click', () => {
      const actuales = fechasDelEditor()
      if (actuales.length >= 12) {
        showToast('Una liga puede tener 12 jornadas como máximo.')
        return
      }
      pintarJornadasEditor([...actuales, ''], estructuraBloqueada)
    })
  }
  // El editor de la descripción, con los módulos del foro cargados a
  // demanda (tanda 220).
  void (async () => {
    const { richTextToolbarHtml, initRichTextEditor } = await import('../richtext-editor.js')
    const { uploadGuideImage } = await import('../app.js')
    editarDescripcionHtml = torneo.description || ''
    const barra = $('editarDescBarra')
    if (!barra) return // el editor pudo cerrarse mientras cargaban los módulos
    barra.innerHTML = richTextToolbarHtml()
    initRichTextEditor({
      toolbarEl: barra,
      surfaceEl: $('editarDescCuerpo'),
      initialHtml: torneo.description || '',
      placeholder: 'Reglas de la casa, premios…',
      onChange: (html) => {
        editarDescripcionHtml = html
      },
      uploadImage: (file) => uploadGuideImage(session.user.id, file),
    })
  })()
  // «Sin límite» apaga el campo de plazas, como en el wizard (tanda
  // 228). El disabled inicial ya va puesto en el HTML de arriba.
  $('editarSinLimite').addEventListener('change', () => {
    $('editarPlazas').disabled = estructuraBloqueada || $('editarSinLimite').checked
  })
  // La imagen: elegir con vista previa, o quitar la que hay.
  editarImagenNueva = undefined
  $('btnEditarImagen').addEventListener('click', () => $('editarImagenInput').click())
  $('editarImagenInput').addEventListener('change', () => {
    const fichero = $('editarImagenInput').files?.[0]
    if (!fichero) return
    editarImagenNueva = fichero
    const preview = $('editarImagenPreview')
    preview.src = URL.createObjectURL(fichero)
    preview.classList.remove('hidden')
    $('btnEditarImagenQuitar').classList.remove('hidden')
    $('btnEditarImagen').textContent = 'Cambiar imagen'
  })
  $('btnEditarImagenQuitar').addEventListener('click', () => {
    editarImagenNueva = null
    $('editarImagenInput').value = ''
    $('editarImagenPreview').classList.add('hidden')
    $('btnEditarImagenQuitar').classList.add('hidden')
    $('btnEditarImagen').textContent = 'Elegir imagen'
  })
  $('btnCerrarEdicion').addEventListener('click', () => $('torneoEditor').remove())
  $('btnGuardarEdicion').addEventListener('click', guardarEdicion)
}

async function guardarEdicion() {
  const nombre = $('editarNombre').value.trim()
  const fecha = $('editarFecha').value
  if (!nombre || !fecha) {
    showToast('El nombre y la fecha no pueden quedar vacíos.', 'error')
    return
  }
  // NULL = sin límite (tanda 228): sin número no hay tope que validar
  // ni contra el rango ni contra los inscritos que ya están dentro.
  const plazas = $('editarSinLimite').checked ? null : Number($('editarPlazas').value)
  if (plazas != null && (!plazas || plazas < 4 || plazas > 256)) {
    showToast('Las plazas deben estar entre 4 y 256 (o marca «Sin límite»).', 'error')
    return
  }
  if (plazas != null && plazas < activos()) {
    showToast(`No puedes dejar ${plazas} plazas con ${activos()} inscritos activos.`, 'error')
    return
  }
  const esLiga = torneo.format === 'league'
  let fechasJornadas = []
  if (esLiga) {
    fechasJornadas = fechasDelEditor()
    if (fechasJornadas.some((f) => !f)) {
      showToast('Ponle fecha a todas las jornadas.', 'error')
      return
    }
    for (let i = 1; i < fechasJornadas.length; i++) {
      if (new Date(fechasJornadas[i]) <= new Date(fechasJornadas[i - 1])) {
        showToast(`La jornada ${i + 1} no puede ir antes que la ${i}.`, 'error')
        return
      }
    }
  }
  const cambios = {
    name: nombre,
    start_at: new Date(fecha).toISOString(),
    description: editarDescripcionHtml || null,
    checkin_minutes: Number($('editarCheckin').value),
    show_opponent_decklists: $('editarListasRivales').checked,
  }
  // La imagen (tanda 239): solo si se tocó. Se sube aquí y no al
  // elegirla, para que cerrar el editor sin guardar no deje ficheros
  // huérfanos en Storage.
  if (editarImagenNueva !== undefined) {
    if (editarImagenNueva === null) {
      cambios.image_url = null
    } else {
      try {
        const { uploadProfileImage } = await import('../app.js')
        cambios.image_url = await uploadProfileImage(session.user.id, editarImagenNueva, 'torneo')
      } catch (err) {
        showToast('No se ha podido subir la imagen: ' + (err?.message || err), 'error')
        return
      }
    }
  }
  // Las fechas de las jornadas se guardan siempre (son informativas);
  // añadir o quitar jornadas cambia swiss_rounds y va con la estructura.
  if (esLiga) cambios.matchday_dates = fechasJornadas.map((f) => new Date(f).toISOString())
  if (torneo.status !== 'registration_closed') {
    cambios.max_players = plazas
    cambios.swiss_rounds = esLiga ? fechasJornadas.length : Number($('editarRondas').value)
    cambios.top_cut_size = Number($('editarCorte').value)
    cambios.round_time_minutes = Number($('editarMinutos').value)
    cambios.swiss_bo = Number($('editarSwissBo').value)
    cambios.top_cut_bo = Number($('editarCorteBo').value)
  }
  const { error } = await supabase.from('tournaments').update(cambios).eq('id', torneo.id)
  if (error) {
    avisarError(error, 'No se ha podido guardar')
    return
  }
  Object.assign(torneo, cambios)
  showToast('Torneo actualizado.', 'success')
  $('torneoEditor')?.remove()
  await recargar()
}

// Cancelar en dos toques, como la baja: es terminal y no hay vuelta.
function engancharCancelar() {
  const btn = $('btnCancelarTorneo')
  btn.addEventListener('click', async () => {
    if (btn.dataset.confirmar !== '1') {
      btn.dataset.confirmar = '1'
      btn.textContent = '¿Seguro? Esto es definitivo'
      return
    }
    const { error } = await supabase.from('tournaments').update({ status: 'cancelled' }).eq('id', torneo.id)
    if (error) {
      avisarError(error, 'No se ha podido cancelar')
      return
    }
    torneo.status = 'cancelled'
    showToast('Torneo cancelado.', 'success')
    await recargar()
  })
}

// Borrar el torneo (tanda 222). En dos toques como cancelar, pero el
// segundo dice lo que se lleva por delante y cuánta gente había dentro:
// cancelar deja el torneo a la vista con su historia; borrar se lleva
// inscripciones, decklists, rondas, mesas y resultados (van en cascada
// desde la fila del torneo) y no hay manera de recuperarlo.
//
// El hilo del foro, si lo hubo, NO se borra: es de la comunidad y sigue
// donde estaba.
function engancharBorrar() {
  const btn = $('btnBorrarTorneo')
  btn.addEventListener('click', async () => {
    const dentro = inscripciones.filter((i) => i.status !== 'waitlisted').length
    if (btn.dataset.confirmar !== '1') {
      btn.dataset.confirmar = '1'
      btn.textContent = textoConfirmarBorrado(dentro)
      return
    }
    btn.disabled = true
    const { error } = await borrarTorneo(torneo.id, dentro)
    if (error) {
      btn.disabled = false
      btn.dataset.confirmar = ''
      btn.textContent = 'Borrar torneo'
      avisarError(error, 'No se ha podido borrar')
      return
    }
    anunciarBorrado(torneo.name, dentro)
    location.href = '/torneos'
  })
}

// ── El anuncio en el foro (tanda 208) ──
// Si el hilo del torneo ya existe se enlaza; si no, el organizador elige
// foro y lo publica de un botón: título fijo «Torneo: nombre» (así se
// reencuentra), etiqueta Torneo y primer mensaje con los datos.
// «Añadir al calendario» (tanda 218): un .ics generado en el momento,
// sin servicio externo ni cuentas de nadie. Dos horas de duración por
// defecto — lo que dura un torneo pequeño — y el enlace a la ficha en
// la descripción, que es lo que uno busca cuando le salta el aviso.
function ponerBotonCalendario(acciones) {
  if (['finished', 'cancelled'].includes(torneo.status) || !torneo.start_at) return
  const boton = document.createElement('button')
  boton.className = 'btn-secondary'
  boton.id = 'btnCalendario'
  boton.textContent = 'Añadir al calendario'
  boton.addEventListener('click', () => {
    const sello = (fecha) => new Date(fecha).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const inicio = new Date(torneo.start_at)
    const fin = new Date(inicio.getTime() + 2 * 3600 * 1000)
    // En un .ics las comas, los puntos y coma y las barras van
    // escapados, y las líneas se separan con CRLF: si no, el
    // calendario lo parte donde no debe.
    const limpio = (t) => String(t || '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, ' ')
    const enlace = `https://pokedoc.es/torneo?slug=${encodeURIComponent(torneo.slug)}`
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PokeDoc//Torneos//ES',
      'BEGIN:VEVENT',
      `UID:torneo-${torneo.id}@pokedoc.es`,
      `DTSTAMP:${sello(Date.now())}`,
      `DTSTART:${sello(inicio)}`,
      `DTEND:${sello(fin)}`,
      `SUMMARY:${limpio(torneo.name)}`,
      `DESCRIPTION:${limpio(textoFormato(torneo))} - ${enlace}`,
      `URL:${enlace}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${torneo.slug || 'torneo'}.ics`
    a.click()
    URL.revokeObjectURL(url)
  })
  acciones.appendChild(boton)
}

// Dos memorias para no repetir consultas en cada refresco (la ficha se
// repinta sola cada pocos segundos y esto se repinta con ella):
//   · el hilo del foro, una vez encontrado, ya no desaparece;
//   · la lista de foros del desplegable no cambia mientras miras.
// Mientras el hilo NO exista sí se sigue preguntando: lo puede haber
// abierto el otro organizador desde su sesión.
let hiloForoId = null
let forosParaAnuncio = null

async function pintarAnuncioForo(acciones) {
  const titulo = `Torneo: ${torneo.name}`
  const zona = document.createElement('span')
  zona.className = 'torneo-anuncio-foro'
  acciones.appendChild(zona)

  if (!hiloForoId) {
    const { data: hilo } = await supabase.from('forum_threads').select('id').eq('title', titulo).maybeSingle()
    hiloForoId = hilo?.id || null
  }
  if (hiloForoId) {
    zona.innerHTML = `<a class="btn-secondary" href="${urlTema(hiloForoId)}">Hilo en el foro</a>`
    return
  }
  if (['finished', 'cancelled'].includes(torneo.status)) return

  if (!forosParaAnuncio) {
    const { data } = await supabase
      .from('forum_boards')
      .select('id, name')
      .eq('is_hidden', false)
      .order('position', { ascending: true })
    forosParaAnuncio = data || []
  }
  const foros = forosParaAnuncio
  if (!foros.length) return
  zona.innerHTML = `
    <select id="anuncioForoDestino">${foros.map((f) => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join('')}</select>
    <button class="btn-secondary" id="btnAnunciarForo">Anunciar en el foro</button>`
  $('btnAnunciarForo').addEventListener('click', () => anunciarEnForo($('anuncioForoDestino').value, titulo))
}

async function anunciarEnForo(boardId, titulo) {
  const { data: hilo, error } = await supabase
    .from('forum_threads')
    .insert({ board_id: boardId, author_id: session.user.id, title: titulo, prefix: 'Torneo' })
    .select('id')
    .single()
  if (error || !hilo) {
    showToast('No se ha podido crear el hilo: ' + (error?.message || 'inténtalo otra vez'), 'error')
    return
  }
  const cuerpo = `<p>¡Torneo a la vista! <strong>${escapeHtml(torneo.name)}</strong></p><ul><li>Fecha: ${escapeHtml(fechaBonita(torneo.start_at))}</li><li>Formato: ${escapeHtml(textoFormato(torneo))}</li><li>Plazas: ${torneo.max_players ?? 'sin límite'}</li></ul><p>Te apuntas en <a href="https://pokedoc.es/torneo?slug=${encodeURIComponent(torneo.slug)}">la página del torneo</a> y se juega en TCG Live. Las dudas, en este hilo.</p>`
  const { error: errorMensaje } = await supabase.from('forum_posts').insert({
    thread_id: hilo.id,
    author_id: session.user.id,
    body_html: cuerpo,
  })
  if (errorMensaje) {
    // El mismo cuidado que foro.js: un hilo sin primer mensaje no sirve.
    await supabase.from('forum_threads').delete().eq('id', hilo.id)
    showToast('No se ha podido publicar el anuncio: ' + errorMensaje.message, 'error')
    return
  }
  // Ya sabemos cuál es: el repintado de después no tiene que ir a
  // buscarlo, y ningún refresco posterior tampoco.
  hiloForoId = hilo.id
  showToast('Anunciado: el hilo del torneo ya está en el foro.', 'success')
  pintarFicha()
}

// ── La gloria (tanda 208): logros y XP al ver terminado tu torneo ──
// Condición «manual» en la migración: los concede esta ficha, no el
// comprobador automático. La pertenencia al array de logros los hace
// idempotentes, se juegue o se recargue lo que se quiera.
async function otorgarGloria() {
  if (torneo.status !== 'finished' || !miInscripcion) return
  // Quien se borró antes de empezar no jugó: sin ronda no hay medalla.
  if (miInscripcion.status === 'dropped' && !miInscripcion.dropped_after_round_id) return
  const gloria = resumenDeGloria()
  if (!gloria) return

  const merecidos = ['torneo_jugado']
  if (gloria.pisaronElCut.has(session.user.id)) merecidos.push('torneo_top_cut')
  if (gloria.campeonId === session.user.id) merecidos.push('torneo_campeon')

  const definiciones = await getAllAchievements()
  const tengo = new Set(perfil.achievements || [])
  const nuevos = definiciones.filter((d) => merecidos.includes(d.id) && !tengo.has(d.id))
  if (!nuevos.length) return

  const { error } = await supabase
    .from('user_profiles')
    .update({ achievements: [...tengo, ...nuevos.map((d) => d.id)] })
    .eq('id', session.user.id)
  if (error) return
  perfil.achievements = [...tengo, ...nuevos.map((d) => d.id)]
  const premio = nuevos.reduce((suma, d) => suma + (d.xp_reward || 0), 0)
  if (premio) await addXP(session.user.id, premio)
  showToast(`Logro${nuevos.length > 1 ? 's' : ''} de torneo: ${nuevos.map((d) => d.title).join(' y ')} (+${premio} XP).`, 'success')
}

// ── El final celebrado (tanda 217) ──
//
// Al terminar un torneo hay que dejar constancia de quién ganó: el
// podio se CONGELA en la fila del torneo (champion_id + podium) para
// que el palmarés de los perfiles no tenga que recalcular brackets, y
// el resultado se anuncia UNA vez en el hilo del foro del torneo si lo
// hubo. Lo sella el organizador al abrir la ficha (es quien tiene
// permiso de escritura mientras los torneos son de admins).
async function sellarResultado() {
  if (torneo.status !== 'finished' || !perfil?.is_admin) return
  const podio = podioDelTorneo()
  if (!podio.length) return

  if (!torneo.champion_id || !torneo.podium) {
    const cambios = { champion_id: podio[0], podium: podio }
    const { error } = await supabase.from('tournaments').update(cambios).eq('id', torneo.id)
    if (error) return
    Object.assign(torneo, cambios)
  }

  // El anuncio en el foro: solo si el torneo tiene hilo (lo abrió
  // alguien al anunciarlo) y solo una vez.
  if (torneo.result_announced_at) return
  const { data: hilo } = await supabase.from('forum_threads').select('id').eq('title', `Torneo: ${torneo.name}`).maybeSingle()
  if (!hilo) return

  const PUESTOS = ['Campeón', 'Finalista', 'Semifinalista', 'Semifinalista']
  const linea = (id, i) => `<li><strong>${escapeHtml(nombreDeInscrito(id))}</strong> — ${PUESTOS[i]}</li>`
  const cuerpo = `<p>¡<strong>${escapeHtml(torneo.name)}</strong> ha terminado!</p><ul>${podio.map(linea).join('')}</ul><p>La clasificación completa, en <a href="https://pokedoc.es/torneo?slug=${encodeURIComponent(torneo.slug)}">la página del torneo</a>. ¡Enhorabuena a todos los que jugaron!</p>`
  const { error } = await supabase.from('forum_posts').insert({
    thread_id: hilo.id,
    author_id: session.user.id,
    body_html: cuerpo,
  })
  if (error) return
  await supabase.from('tournaments').update({ result_announced_at: new Date().toISOString() }).eq('id', torneo.id)
  torneo.result_announced_at = new Date().toISOString()
  showToast('Resultado anunciado en el hilo del foro.', 'success')
}

// El nombre de un inscrito, para el anuncio (las inscripciones ya
// vienen con su perfil en la ficha).
function nombreDeInscrito(id) {
  const i = inscripciones.find((x) => x.user_id === id)
  return i?.perfil?.display_name || i?.perfil?.username || 'Jugador'
}

// Y la celebración de quien lo ganó: confeti una vez por torneo (la
// marca en sessionStorage evita que salte en cada refresco de la ficha,
// que se repinta sola cada 10 s).
function celebrarSiGane() {
  if (torneo.status !== 'finished') return
  const podio = podioDelTorneo()
  if (podio[0] !== session?.user?.id) return
  const marca = `pokedoc-torneo-campeon-${torneo.id}`
  try {
    if (sessionStorage.getItem(marca)) return
    sessionStorage.setItem(marca, '1')
  } catch {}
  burstConfetti(46)
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

// ── Cerrar inscripciones con las rondas a la vista (tanda 228) ──
// Al cerrar ya se sabe cuánta gente hay DE VERDAD, así que es el
// momento de proponer las rondas de la tabla oficial (SPEC §5.1): con
// aforo sin límite es la única propuesta posible, y con aforo normal
// corrige el desfase entre plazas previstas e inscritos reales (16
// plazas con 9 apuntados piden las rondas de 9, no las de 16). La
// última palabra es del organizador: el número se retoca ahí mismo. En
// una liga no se propone nada — sus rondas son las jornadas del
// calendario, con sus fechas.
function cerrarInscripciones() {
  const sugeridas = officialStructure(activos()).swissRounds
  if (torneo.format === 'league' || sugeridas === torneo.swiss_rounds) {
    void cambiarEstado('registration_closed', 'Inscripciones cerradas.')
    return
  }
  const previo = $('torneoCerrarRondas')
  if (previo) {
    previo.remove()
    return
  }
  // Va como HERMANO de las acciones, no dentro: la ficha se repinta
  // sola (sondeo/vivo) y acciones.innerHTML arrasaría lo que el
  // organizador esté escribiendo. pintarFicha lo quita si el estado
  // deja de ser «inscripciones abiertas».
  $('torneoAdminAcciones').insertAdjacentHTML(
    'afterend',
    `
    <div class="torneo-cerrar-rondas" id="torneoCerrarRondas">
      <p>Con <strong>${activos()} jugador${activos() === 1 ? '' : 'es'}</strong>, la tabla oficial sugiere
      <strong>${sugeridas} ronda${sugeridas === 1 ? '' : 's'} suiza${sugeridas === 1 ? '' : 's'}</strong>
      (ahora hay ${torneo.swiss_rounds}). Puedes cambiar el número antes de cerrar.</p>
      <label>Rondas suizas<input type="number" id="cerrarRondasNumero" min="1" max="12" value="${sugeridas}" /></label>
      <button class="btn-primary" id="btnCerrarConRondas">Cerrar inscripciones</button>
      <button class="btn-secondary" id="btnCerrarRondasVolver">Volver</button>
    </div>`
  )
  $('btnCerrarRondasVolver').addEventListener('click', () => $('torneoCerrarRondas').remove())
  $('btnCerrarConRondas').addEventListener('click', async () => {
    const rondas = Number($('cerrarRondasNumero').value)
    if (!rondas || rondas < 1 || rondas > 12) {
      showToast('Las rondas suizas deben estar entre 1 y 12.', 'error')
      return
    }
    const cambios = { swiss_rounds: rondas, status: 'registration_closed' }
    const { error } = await supabase.from('tournaments').update(cambios).eq('id', torneo.id)
    if (error) {
      avisarError(error, 'No se ha podido cerrar')
      return
    }
    Object.assign(torneo, cambios)
    $('torneoCerrarRondas')?.remove()
    showToast(`Inscripciones cerradas: ${rondas} ronda${rondas === 1 ? '' : 's'} suiza${rondas === 1 ? '' : 's'}.`, 'success')
    pintarTodo()
  })
}

// ── Tu plaza ──

// ── La inscripción en dos pasos (tanda 219) ──
// Apuntarse NO basta: hay que entregar la decklist Y confirmar la
// participación. Quien no complete ambos antes de generarse la R1 se
// queda fuera del pareo (lo aplica generarPareos en ronda.js). El campo
// participation_confirmed_at puede no existir aún (migración pendiente):
// en ese caso el checklist ni se enseña, para no prometer un botón que
// fallaría al guardar. Se mira en CUALQUIER inscripción, no solo la
// propia: una fila recién insertada por la app aún no trae la columna.
function hayColumnaConfirmacion() {
  return miInscripcion !== null && inscripciones.some((i) => 'participation_confirmed_at' in i)
}

function checklistDosPasos() {
  if (!hayColumnaConfirmacion()) return ''
  // Con la R1 ya generada el tren pasó: o estás dentro o estás fuera.
  if (!['draft', 'registration_open', 'registration_closed'].includes(torneo.status)) return ''
  const listaHecha = !!miDecklist
  const confirmado = !!miInscripcion.participation_confirmed_at
  if (listaHecha && confirmado) {
    return `<p class="torneo-pasos-listo">${icons.checkCircle(16)} <strong>Todo listo:</strong> decklist entregada y participación confirmada. Entrarás en el pareo de la primera ronda.</p>`
  }
  const paso = (hecho, texto, extra = '') => `
    <li class="${hecho ? 'hecho' : ''}">
      <span class="torneo-paso-marca">${hecho ? icons.checkCircle(16) : ''}</span>
      <span>${texto}${extra}</span>
    </li>`
  return `
    <div class="torneo-pasos">
      <p class="torneo-pasos-aviso">${icons.triangleAlert(16)} <strong>Te ${listaHecha || confirmado ? 'queda 1 paso' : 'quedan 2 pasos'}:</strong>
      si no entregas tu decklist y confirmas tu participación antes de que se genere la
      primera ronda, <strong>no serás emparejado y no jugarás el torneo</strong>.</p>
      <ol class="torneo-pasos-lista">
        ${paso(listaHecha, '<strong>Entrega tu decklist</strong>', listaHecha ? '' : ' — en la pestaña «Jugar», caja «Tu decklist».')}
        ${paso(
          confirmado,
          '<strong>Confirma tu participación</strong>',
          confirmado
            ? ''
            : listaHecha
              ? ' <button class="btn-primary torneo-boton-confirmar" id="btnConfirmarParticipacion">Confirmar mi participación</button>'
              : ' — se desbloquea al entregar la lista.'
        )}
      </ol>
    </div>`
}

function engancharConfirmarParticipacion() {
  const btn = $('btnConfirmarParticipacion')
  if (!btn) return
  btn.addEventListener('click', async () => {
    const { error } = await supabase
      .from('tournament_registrations')
      .update({ participation_confirmed_at: new Date().toISOString() })
      .eq('id', miInscripcion.id)
    if (error) {
      avisarError(error, 'No se ha podido confirmar')
      return
    }
    showToast('Participación confirmada: entrarás en el pareo de la primera ronda.', 'success')
    await recargar()
  })
}

function pintarMiPlaza() {
  const caja = $('miPlazaContenido')

  // El escaparate (tanda 229): quien mira sin cuenta no tiene plaza que
  // enseñar, tiene una razón para crearse una. El enlace vuelve AQUÍ
  // después de entrar, que es lo que uno espera al abrir un enlace
  // compartido.
  if (soloMirando) {
    const vuelta = encodeURIComponent(window.location.pathname + window.location.search)
    caja.innerHTML =
      torneo.status === 'registration_open'
        ? `<p>Las inscripciones están abiertas${
            // Con aforo sin límite (tanda 228 de IBAI) no hay plazas que
            // contar: restarle los inscritos a un null da NaN.
            torneo.max_players == null
              ? ' y no hay límite de plazas'
              : `: quedan ${Math.max(0, torneo.max_players - activos())} plazas`
          }.</p>
           <a class="btn-primary" href="/auth.html?volver=${vuelta}">Entra para inscribirte</a>
           <p class="subtext">Es gratis y se juega en Pokémon TCG Live.</p>`
        : `<p class="subtext">Estás viendo este torneo sin haber entrado.</p>
           <a class="btn-secondary" href="/auth.html?volver=${vuelta}">Entrar en PokeDoc</a>`
    return
  }

  if (miInscripcion?.status === 'active') {
    caja.innerHTML = `
      <p>Estás inscrito como <strong>${escapeHtml(miInscripcion.tcg_live_username)}</strong> (tu usuario de TCG Live).</p>
      ${checklistDosPasos()}
      <button class="btn-secondary" id="btnBaja">Darme de baja</button>`
    engancharConfirmarParticipacion()
    engancharBaja()
    return
  }
  if (miInscripcion?.status === 'dropped') {
    caja.innerHTML = '<p class="subtext">Te retiraste de este torneo. La plaza no se libera y no es posible reinscribirse.</p>'
    return
  }
  // En la cola (tanda 218): se dice el puesto, que es lo único que
  // importa cuando esperas.
  if (miInscripcion?.status === 'waitlisted') {
    caja.innerHTML = `
      <p>Estás en la <strong>lista de espera</strong>, en el puesto ${miPuestoEnCola()}.</p>
      <p class="subtext">Si alguien deja su plaza, la primera de la cola entra sola y te avisamos.</p>
      <button class="btn-secondary" id="btnSalirCola">Salir de la lista</button>`
    engancharSalirCola()
    return
  }
  if (torneo.status !== 'registration_open') {
    caja.innerHTML = `<p class="subtext">${torneo.status === 'draft' ? 'Las inscripciones aún no se han abierto.' : 'Las inscripciones no están abiertas.'}</p>`
    return
  }
  // Sin límite (max_players NULL) nunca hay lleno ni lista de espera.
  const lleno = torneo.max_players != null && activos() >= torneo.max_players
  caja.innerHTML = `
    ${lleno ? `<p class="torneo-lleno-aviso">Torneo lleno — puedes ponerte en la lista de espera (hay ${enCola()} esperando).</p>` : ''}
    <form id="formInscripcion" class="torneo-form-inscripcion">
      <label>Tu usuario de Pokémon TCG Live
        <input type="text" id="inscripcionTcgLive" maxlength="60" placeholder="AshKetchum99" />
      </label>
      <button type="submit" class="btn-primary" id="btnInscribirme">${lleno ? 'Apuntarme a la lista de espera' : 'Inscribirme'}</button>
    </form>
    <p class="subtext">Las partidas se juegan en TCG Live: tu rival te buscará por ese usuario.</p>`
  engancharInscripcion(lleno)
}

// Los que esperan, por orden de llegada (el mismo que sigue el barredor
// al repartir las plazas que se liberan).
function cola() {
  return inscripciones
    .filter((i) => i.status === 'waitlisted')
    .sort((a, b) => String(a.registered_at).localeCompare(String(b.registered_at)))
}

function enCola() {
  return cola().length
}

function miPuestoEnCola() {
  return cola().findIndex((i) => i.user_id === session.user.id) + 1
}

function engancharSalirCola() {
  $('btnSalirCola').addEventListener('click', async () => {
    const { error } = await supabase.from('tournament_registrations').delete().eq('id', miInscripcion.id)
    if (error) {
      avisarError(error, 'No se ha podido salir de la lista')
      return
    }
    showToast('Fuera de la lista de espera.', 'success')
    await recargar()
  })
}

function engancharInscripcion(aLaCola = false) {
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
    // Si se llenó mientras rellenaba el formulario, no se le echa: se
    // le pone en la cola, que para eso está.
    const cupoLleno = torneo.max_players != null && (count ?? 0) >= torneo.max_players
    const estado = aLaCola || cupoLleno ? 'waitlisted' : 'active'
    const { error } = await supabase.from('tournament_registrations').insert({
      tournament_id: torneo.id,
      user_id: session.user.id,
      status: estado,
      tcg_live_username: tcgLive,
      registered_at: new Date().toISOString(),
    })
    enviando = false
    if (error) {
      if (/duplicate|unique/i.test(error.message || '')) showToast('Ya estás inscrito en este torneo.', 'error')
      else avisarError(error, 'No se ha podido inscribir')
      return
    }
    showToast(
      estado === 'waitlisted'
        ? 'Estás en la lista de espera: si se libera una plaza, te avisamos.'
        : '¡Inscrito! Ahora te quedan 2 pasos: entrega tu decklist y confirma tu participación (mira «Tu plaza»).',
      'success'
    )
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
  // Con lista entregada, los botones de exportar (tanda 219): copiar el
  // texto y bajarla como imagen.
  const estadoEntrega = miDecklist
    ? `<p class="subtext">Entregada el ${fechaBonita(miDecklist.submitted_at)} · ${resumenDecklist(miDecklist.parsed_cards)} ${sellada}</p>${botonesExportarHtml()}`
    : '<p class="subtext">Todavía no has entregado ninguna lista.</p>'

  // La lista entregada se ve con sus CARTAS; el texto queda debajo, en
  // un desplegable, que es lo que se edita y se vuelve a guardar.
  // El refresco automático repinta esta caja: si el editor estaba
  // abierto, se respeta.
  const editorAbierto = document.querySelector('.torneo-decklist-editor')?.open
  $('decklistContenido').innerHTML = `
    ${estadoEntrega}
    <div class="torneo-decklist-visual" id="decklistVisual"></div>
    <details class="torneo-decklist-editor" ${(editorAbierto ?? !miDecklist) ? 'open' : ''}>
      <summary>${miDecklist ? (editable ? 'Editar la lista (texto)' : 'Ver la lista en texto') : 'Pegar la lista'}</summary>
      <textarea id="decklistTexto" rows="10" maxlength="20000" ${editable ? '' : 'readonly'} placeholder="Pokémon: 8&#10;4 Charizard ex OBF 125&#10;…">${escapeHtml(miDecklist?.raw_text || '')}</textarea>
      <p class="torneo-decklist-cuenta" id="decklistCuenta"></p>
      <ul class="torneo-decklist-errores hidden" id="decklistErrores"></ul>
      ${editable ? '<button class="btn-primary" id="btnGuardarDecklist">Guardar decklist</button>' : ''}
    </details>`
  if (editable) engancharDecklist()
  if (miDecklist) {
    engancharExportar($('decklistContenido'), {
      nombre: perfil.username || 'Mi decklist',
      rawText: miDecklist.raw_text,
      parsed: miDecklist.parsed_cards,
    })
  }
  if (miDecklist?.parsed_cards) pintarDecklistVisual($('decklistVisual'), miDecklist.parsed_cards)
}

// El contador vivo bajo el editor: cuántas cartas suma lo pegado (en
// rojo si no son 60) y cuántas líneas no se entienden — antes el parser
// las descartaba en silencio y el jugador solo veía que «no da 60» sin
// pista de por qué.
function pintarCuentaDecklist() {
  const caja = $('decklistCuenta')
  if (!caja) return
  const texto = $('decklistTexto').value
  if (!texto.trim()) {
    caja.textContent = ''
    return
  }
  const parsed = parseDecklist(texto)
  const ilegibles = decklistUnparsed(texto)
  caja.classList.toggle('torneo-cuenta-mal', parsed.total !== 60 || ilegibles.length > 0)
  caja.textContent =
    `${parsed.total} / 60 cartas` +
    (ilegibles.length ? ` · ${ilegibles.length} ${ilegibles.length === 1 ? 'línea que no se entiende' : 'líneas que no se entienden'}` : '')
}

function engancharDecklist() {
  let guardando = false
  $('decklistTexto').addEventListener('input', pintarCuentaDecklist)
  pintarCuentaDecklist()
  $('btnGuardarDecklist').addEventListener('click', async () => {
    if (guardando) return
    const texto = $('decklistTexto').value
    const parsed = parseDecklist(texto)
    const errores = validateDecklist(parsed)
    // Las líneas ilegibles se enseñan JUNTO a los errores: son casi
    // siempre el motivo de que el total no dé 60.
    for (const linea of decklistUnparsed(texto).slice(0, 6)) {
      errores.push(`No se entiende la línea: «${linea}» (formato: 4 Nombre SET 123).`)
    }
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
    // El recordatorio del paso 2 (tanda 219), justo cuando toca: la
    // lista ya está y solo falta confirmar en «Tu plaza».
    const faltaConfirmar =
      hayColumnaConfirmacion() &&
      !miInscripcion.participation_confirmed_at &&
      ['draft', 'registration_open', 'registration_closed'].includes(torneo.status)
    showToast(
      faltaConfirmar
        ? 'Decklist guardada. Paso 2: confirma tu participación en «Tu plaza» o no entrarás en el pareo.'
        : 'Decklist guardada.',
      'success'
    )
    await recargar()
  })
}

// ── Los inscritos ──

// El usuario de TCG Live es de la comunidad, no del internet entero: se
// enseña a quien ha entrado y a nadie más. Que no se filtre NO depende
// de esta línea — la base tampoco se lo entrega a un anónimo (grant por
// columnas en la migración de apertura). Esto solo evita pintar «TCG
// Live: undefined».
function tcgLiveDe(i) {
  if (soloMirando || !i.tcg_live_username) return ''
  return `<span class="subtext">TCG Live: ${escapeHtml(i.tcg_live_username)}</span>`
}

function pintarInscritos() {
  $('inscritosNumero').textContent = String(activos())
  $('inscritosVacio').classList.toggle('hidden', inscripciones.length > 0)
  const entregadaPor = new Set(decklistsEntregadas.map((d) => d.user_id))
  // Los que esperan van APARTE y numerados (tanda 218): mezclarlos con
  // los inscritos haría creer que tienen plaza.
  $('listaInscritos').innerHTML = inscripciones
    .filter((i) => i.status !== 'waitlisted')
    .map((i) => {
      const nombre = i.perfil?.username || 'Alguien'
      const retirado = i.status === 'dropped' ? ' <span class="torneo-retirado">(retirado)</span>' : ''
      // Quién ha entregado lista lo ve solo el organizador: a los demás
      // jugadores no les incumbe (SPEC §9, visibilidad).
      const decklist = perfil?.is_admin
        ? `<span class="torneo-decklist-marca ${entregadaPor.has(i.user_id) ? 'entregada' : ''}">${entregadaPor.has(i.user_id) ? 'decklist entregada' : 'sin decklist'}</span>`
        : ''
      // Y el paso 2 (tanda 219), también solo para el organizador: sin
      // confirmar antes de la R1, ese jugador no entra en el pareo.
      const confirmado =
        perfil?.is_admin && i.status === 'active' && 'participation_confirmed_at' in i && !['in_progress', 'finished', 'cancelled'].includes(torneo.status)
          ? `<span class="torneo-decklist-marca ${i.participation_confirmed_at ? 'entregada' : ''}">${i.participation_confirmed_at ? 'confirmado' : 'sin confirmar'}</span>`
          : ''
      // El organizador puede expulsar (misma mecánica que la baja: la
      // plaza no se libera y su ronda en curso cuenta) — a cualquiera
      // menos a sí mismo, que para eso está «Darme de baja».
      const expulsar =
        perfil?.is_admin && i.status === 'active' && i.user_id !== session.user.id && !['finished', 'cancelled'].includes(torneo.status)
          ? `<button class="btn-secondary torneo-expulsar" data-expulsar="${escapeHtml(i.id)}">Expulsar</button>`
          : ''
      return `
      <div class="torneo-inscrito">
        <span class="torneo-inscrito-nombre"><a href="/usuario/${encodeURIComponent(i.perfil?.username || '')}">${escapeHtml(nombre)}</a>${retirado}</span>
        ${tcgLiveDe(i)}
        ${decklist}${confirmado}${expulsar}
      </div>`
    })
    .join('')
  const esperando = cola()
  if (esperando.length) {
    $('listaInscritos').insertAdjacentHTML(
      'beforeend',
      `<h5 class="torneo-cola-titulo">Lista de espera (${esperando.length})</h5>` +
        esperando
          .map(
            (i, n) => `
      <div class="torneo-inscrito torneo-inscrito-cola">
        <span class="torneo-inscrito-nombre"><span class="torneo-cola-puesto">${n + 1}.</span> <a href="/usuario/${encodeURIComponent(i.perfil?.username || '')}">${escapeHtml(i.perfil?.username || 'Alguien')}</a></span>
        ${tcgLiveDe(i)}
      </div>`
          )
          .join('')
    )
  }
  document.querySelectorAll('[data-expulsar]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (b.dataset.confirmar !== '1') {
        b.dataset.confirmar = '1'
        b.textContent = '¿Seguro?'
        return
      }
      const { error } = await supabase
        .from('tournament_registrations')
        .update({
          status: 'dropped',
          dropped_at: new Date().toISOString(),
          dropped_after_round_id: torneo.current_round_id || null,
        })
        .eq('id', b.dataset.expulsar)
      if (error) {
        avisarError(error, 'No se ha podido expulsar')
        return
      }
      showToast('Jugador retirado del torneo. Su plaza no se libera.', 'success')
      await recargar()
    })
  )
}

// ── Las pestañas de la ficha ──
// Una pantalla única era demasiado bloque (palabra de los admins): cada
// zona vive en su pestaña, y las que no tienen nada que enseñar ni
// siquiera aparecen. Si estás jugando, se abre directamente en Jugar.

const PESTANAS = [
  { id: 'torneo', texto: 'Torneo' },
  { id: 'jugar', texto: 'Jugar' },
  { id: 'rondas', texto: 'Rondas' },
  { id: 'clasificacion', texto: 'Clasificación' },
  { id: 'jueces', texto: 'Jueces' },
]
let pestanaActiva = null

function pintarPestanas() {
  const visibles = PESTANAS.filter((p) => {
    const panel = document.querySelector(`[data-panel="${p.id}"]`)
    return [...panel.children].some((caja) => !caja.classList.contains('hidden'))
  })
  if (!pestanaActiva) {
    const jugando = !document.getElementById('torneoMiPartida').classList.contains('hidden')
    pestanaActiva = jugando && visibles.some((p) => p.id === 'jugar') ? 'jugar' : 'torneo'
  }
  if (!visibles.some((p) => p.id === pestanaActiva)) pestanaActiva = visibles[0]?.id || 'torneo'

  const nav = $('torneoPestanas')
  nav.innerHTML = visibles
    .map(
      (p) =>
        `<button class="torneo-pestana ${p.id === pestanaActiva ? 'activa' : ''}" data-pestana="${p.id}">${p.texto}</button>`
    )
    .join('')
  document.querySelectorAll('.torneo-panel').forEach((s) => {
    s.classList.toggle('hidden', s.dataset.panel !== pestanaActiva)
  })
  nav.querySelectorAll('[data-pestana]').forEach((b) =>
    b.addEventListener('click', () => {
      pestanaActiva = b.dataset.pestana
      pintarPestanas()
    })
  )
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
  // Un juez aprobado resuelve mesas igual que el organizador (SPEC §6.7),
  // y además ve las decklists ajenas: por eso esto va ANTES de cargarlas.
  await cargarJueces()
  await cargarDecklists()
  pintarTodo()
  const contexto = {
    torneo,
    session,
    perfil,
    inscripciones,
    esJuez,
    solicitudes: solicitudesJuez,
    decklistsTorneo,
    recargarFicha: recargar,
    // Los módulos repintan cajas por su cuenta (sondeo, check-in…):
    // que recoloquen también las pestañas al hacerlo.
    alRepintar: pintarPestanas,
  }
  await montarCiclo(contexto)
  await montarJueces(contexto)
  // Las tres de abajo ESCRIBEN (logros, XP, el podio congelado, el
  // anuncio en el foro) o celebran algo tuyo: nada que hacer si quien
  // mira no tiene cuenta.
  if (!soloMirando) {
    await otorgarGloria()
    await sellarResultado()
    celebrarSiGane()
  }
  pintarPestanas()
}

async function init() {
  session = await getSession()
  perfil = session ? await getProfile(session.user.id) : null
  soloMirando = !session

  // Aquí NO se comprueba is_admin. Quien decide si este torneo se puede
  // ver es la POLÍTICA de la base: mientras la sección esté cerrada, la
  // consulta vuelve vacía para todo el que no sea admin y se acaba en el
  // mismo sitio que un torneo que no existe. Un `if` en el navegador no
  // protegería nada y además impediría que un enlace compartido enseñe
  // el torneo el día que la sección se abra.
  const slug = new URLSearchParams(window.location.search).get('slug')
  torneo = slug ? await cargarTorneo(slug) : null
  if (!torneo) {
    pintarNoDisponible()
    return
  }

  document.getElementById('torneoContenido').style.display = ''
  await recargar()
  arrancarSondeoFicha()
}

// Sin torneo que enseñar: puede que el enlace esté mal, que se haya
// borrado o que la sección aún no esté abierta. No se distingue a
// propósito — decir «existe pero no puedes verlo» ya es contar algo.
function pintarNoDisponible() {
  const caja = document.getElementById('torneoNoDisponible')
  if (!caja) {
    window.location.href = '/torneos.html'
    return
  }
  caja.classList.remove('hidden')
  document.getElementById('torneoEntrar')?.classList.toggle('hidden', Boolean(session))
}

// ── El refresco automático (pedido de PINGU) ──
// La ficha ENTERA se refresca sola cada 10 s: reportes del rival,
// disputas, chats, la cola del juez… sin tocar el botón Actualizar.
// Se salta el tic si la pestaña está en segundo plano o si estás
// escribiendo (para no pisarte un chat o la decklist a medias).
let sondeoFicha = null
function arrancarSondeoFicha() {
  if (sondeoFicha) return
  const tic = async () => {
    if (document.hidden) return
    const activo = document.activeElement
    if (activo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activo.tagName)) return
    await recargar()
  }
  sondeoFicha = setInterval(tic, 10000)

  // ── En vivo (tanda 227) ──
  // Lo que de verdad cambia mientras miras una ficha: el chat de tu
  // mesa, lo que reporta tu rival, el resultado, el estado de las mesas,
  // el paso de ronda y las llamadas a juez. Todo lo demás (inscritos,
  // decklists, el hilo del foro) no se mueve, y por eso NO se escucha:
  // suscribirse a algo que no cambia es pagar un canal para nada.
  //
  // Se filtra por torneo donde la tabla lo permite. Las de mesa
  // (mensajes, reportes, resultados) cuelgan de match_id y no de
  // tournament_id, así que llegan las de todos los torneos en juego —
  // que a esta escala son uno o dos. Como la reacción es «vuelve a
  // pedirlo», un evento de otro torneo solo cuesta un refresco de más;
  // filtrarlo bien exigiría un canal por mesa.
  //
  // El sondeo se queda de fondo: con el vivo conectado pasa de 10 s a
  // un minuto, que es justo lo que hace falta para enterarse si el
  // websocket se muere en silencio.
  import('../vivo.js')
    .then(({ escuchar, sondeoAdaptable }) => {
      const sondeo = sondeoAdaptable(tic, 10000)
      clearInterval(sondeoFicha)
      sondeoFicha = 'delegado'
      escuchar({
        nombre: `torneo-${torneo.id}`,
        tablas: [
          { tabla: 'rounds', filtro: `tournament_id=eq.${torneo.id}` },
          { tabla: 'judge_calls', filtro: `tournament_id=eq.${torneo.id}` },
          { tabla: 'tournament_matches' },
          { tabla: 'match_messages' },
          { tabla: 'match_reports' },
          { tabla: 'match_results' },
        ],
        alCambiar: () => tic(),
        alEstado: (vivo) => sondeo.conVivo(vivo),
      })
    })
    .catch(() => {
      // Sin tiempo real la ficha sigue exactamente como antes de la
      // tanda 227: sondeo cada diez segundos.
    })
}

init()
