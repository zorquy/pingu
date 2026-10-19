// EL EDITOR DEL TORNEO, aparte (tanda 895, R4 de «Rápida y limpia»).
//
// Solo lo abre quien lleva el torneo, y era la quinta parte de torneo.js:
// la ficha lo bajaba para todo el mundo. Ahora entra por `import()` al
// pulsar «Editar». Lo que necesita de la ficha (el torneo, la sesión, las
// inscripciones, las jornadas, y recargar / avisar) llega en `ctx` y se
// copia aquí al abrir: el torneo es el MISMO objeto que tiene la ficha,
// así que lo que el editor le cambia, la ficha lo ve.
import { supabase } from '../supabase.js'
import { escapeHtml } from '../app.js'
import { showToast } from '../toast.js'
import { premiosDeTorneo, premiosParaGuardar, PREMIOS_MAXIMO, PUESTO_MAXIMO, PREMIO_MAXIMO } from './comun.js'
import { rondasPorJornada } from './jornadas.js'

const $ = (id) => document.getElementById(id)

let session = null
let perfil = null
let torneo = null
let inscripciones = []
let jornadas = null
let organizador = null
let activos = () => []
let avisarError = () => {}
let recargar = async () => {}
function sincronizar(ctx) {
  ;({ session, perfil, torneo, inscripciones, jornadas, organizador, activos, avisarError, recargar } = ctx)
}

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
// Y el banner (tanda 242), con el mismo triestado.
let editarBannerNuevo = undefined

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

// ── El código de entrada (tanda 367) ──
//
// Vive en `tournament_join_codes`, no en la fila del torneo. Desde que
// un torneo con código se VE como los demás, cualquier columna suya la
// puede leer cualquiera: la llave no puede ir pegada a la puerta. Esa
// tabla solo la lee quien lleva el torneo, y lo decide su política.
//
// Se pide al ABRIR el editor y no al cargar la ficha: la ficha se
// refresca sola cada 10 segundos y esto sería una consulta más en cada
// vuelta para un dato que casi nunca se mira.
//
// El puente al sitio viejo se fue con la migración (2026-09-30):
// `tournaments.join_code` ya no existe. Si esto falla ahora es por otra
// cosa —permisos, red— y devolver '' es lo correcto igual: el campo sale
// vacío y quien edita vuelve a escribir su código, que es mejor que
// enseñarle uno que no sabemos si es el bueno.
async function leerCodigo() {
  const { data, error } = await supabase
    .from('tournament_join_codes')
    .select('code')
    .eq('tournament_id', torneo.id)
    .maybeSingle()
  if (error) return ''
  return data?.code || ''
}

// Sin código no se guarda una fila vacía: se borra. Una llave en blanco
// no abre nada y encima haría creer que el torneo tiene una.
async function guardarCodigo(codigo) {
  if (!codigo) {
    const { error } = await supabase.from('tournament_join_codes').delete().eq('tournament_id', torneo.id)
    return error
  }
  const { error } = await supabase
    .from('tournament_join_codes')
    .upsert({ tournament_id: torneo.id, code: codigo }, { onConflict: 'tournament_id' })
  return error
}

export async function pintarEditor(ctx) {
  sincronizar(ctx)
  const previo = $('torneoEditor')
  if (previo) {
    previo.remove()
    return
  }
  const codigoActual = await leerCodigo()
  const estructuraBloqueada = torneo.status === 'registration_closed'
  const esLiga = torneo.format === 'league'
  const bloqueo = estructuraBloqueada ? 'disabled title="Con las inscripciones cerradas, la estructura ya no se toca"' : ''
  // ── Dónde se cuelga el formulario (tanda 351) ──
  //
  // Iba a `.torneo-ficha`, que era la tarjeta blanca de antes. La tanda
  // 298 rehízo la cabecera y esa clase DEJÓ DE EXISTIR, así que
  // `querySelector` devolvía null y esta línea reventaba: el botón de
  // Editar dejó de hacer nada, sin más síntoma que un error en la
  // consola que no mira nadie. PINGU se quedó sin poder ponerle el
  // banner a un torneo recién creado.
  //
  // Ahora se cuelga DEBAJO de la cabecera, y si algún día también le
  // cambian el nombre, se cae a la caja de la página en vez de romperse.
  const anfitrion = document.getElementById('torneoCabecera')
  if (anfitrion) {
    anfitrion.insertAdjacentHTML('afterend', editorHtml(torneo, estructuraBloqueada, esLiga, bloqueo, codigoActual))
  } else {
    const suelo = document.querySelector('.page-content') || document.body
    suelo.insertAdjacentHTML('beforeend', editorHtml(torneo, estructuraBloqueada, esLiga, bloqueo, codigoActual))
  }
  engancharEditor(torneo, estructuraBloqueada, esLiga)
}

// «Rondas por jornada» de una liga (849). Solo se cambia mientras la liga
// no tenga NINGUNA ronda —ni jugada ni saltada—: con rondas hechas, cambiar
// cuántas tiene cada jornada movería las ya jugadas a otra jornada. Y solo
// sale si la base ya tiene la columna (sin la migración, `undefined`).
function campoRondasPorJornada(torneo) {
  if (!('rounds_per_matchday' in torneo)) return ''
  const conRondas = Boolean(jornadas?.empezadas?.size)
  const actual = rondasPorJornada(torneo)
  return `<label>Rondas por jornada<select id="editarRondasJornada" ${conRondas ? 'disabled title="La liga ya tiene rondas: deshazlas para cambiarlo"' : ''}>${[1, 2, 3, 4, 5]
    .map((n) => `<option value="${n}" ${n === actual ? 'selected' : ''}>${n}</option>`)
    .join('')}</select></label>`
}

function editorHtml(torneo, estructuraBloqueada, esLiga, bloqueo, codigoActual) {
  return (
    `
    <div class="torneos-form torneo-editor" id="torneoEditor">
      <div class="torneos-form-rejilla">
        <label>Nombre<input type="text" id="editarNombre" maxlength="120" value="${escapeHtml(torneo.name)}" /></label>
        <label>Fecha y hora<input type="datetime-local" id="editarFecha" value="${aFechaLocal(torneo.start_at)}" /></label>
        <div class="torneos-form-plazas">Plazas
          <input type="number" inputmode="numeric" id="editarPlazas" min="4" max="256" value="${torneo.max_players ?? ''}" ${bloqueo} ${torneo.max_players == null ? 'disabled' : ''} />
          <label class="torneo-sin-limite"><input type="checkbox" id="editarSinLimite" ${torneo.max_players == null ? 'checked' : ''} ${bloqueo} /> Sin límite</label>
        </div>
        ${esLiga ? campoRondasPorJornada(torneo) : `<label>Rondas suizas<input type="number" inputmode="numeric" id="editarRondas" min="1" max="12" value="${torneo.swiss_rounds}" ${bloqueo} /></label>`}
        <label>Top cut<select id="editarCorte" ${bloqueo}>${[0, 4, 8, 16].map((n) => `<option value="${n}" ${torneo.top_cut_size === n ? 'selected' : ''}>${n ? `Top ${n}` : 'Sin corte'}</option>`).join('')}</select></label>
        <label>Minutos por ronda<input type="number" inputmode="numeric" id="editarMinutos" min="5" max="120" value="${torneo.round_time_minutes}" ${bloqueo} /></label>
        <label>Check-in (min)<input type="number" inputmode="numeric" id="editarCheckin" min="0" max="30" value="${torneo.checkin_minutes ?? 5}" /></label>
        <label>Suizas al mejor de<select id="editarSwissBo" ${bloqueo}>${[1, 3].map((n) => `<option value="${n}" ${torneo.swiss_bo === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label id="editarCorteBoCampo" class="${torneo.top_cut_size ? '' : 'hidden'}">Corte al mejor de<select id="editarCorteBo" ${bloqueo}>${[1, 3].map((n) => `<option value="${n}" ${torneo.top_cut_bo === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
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
      <label class="torneos-form-campo">
        <span><input type="checkbox" id="editarPrivado" ${torneo.is_private ? 'checked' : ''} /> Entrada con código</span>
        <span class="torneo-campo-pista">El torneo se ve como cualquier otro, pero para inscribirse hace falta el código. Solo lo ves tú.</span>
      </label>
      <label class="torneos-form-campo">
        <span>Código para entrar</span>
        <input type="text" id="editarCodigo" autocomplete="off" maxlength="40" value="${escapeHtml(codigoActual)}" />
      </label>
      <label class="torneos-form-campo">Listas de los rivales
        <select id="editarListasModo">
          ${[
            ['al_terminar', 'Públicas cuando termine el torneo'],
            ['en_juego', 'Públicas desde la ronda 1 (lista abierta)'],
            ['nunca', 'Nunca públicas'],
          ]
            .map(
              ([valor, texto]) =>
                `<option value="${valor}" ${(torneo.decklist_visibility || (torneo.show_opponent_decklists ? 'en_juego' : 'al_terminar')) === valor ? 'selected' : ''}>${texto}</option>`
            )
            .join('')}
        </select>
        <span class="torneo-campo-pista">Cuándo pueden verse las decklists (y los mazos) de los demás. El organizador y los jueces las ven siempre.</span>
      </label>
      ${
        // El sello de OFICIAL, solo para administración (tanda 266). Un
        // organizador normal ni lo ve; y si lo mandara por la API, el
        // disparador de la base se lo revierte.
        // Solo el admin del SITIO: un organizador manda en el torneo, pero
        // no en la chapa que dice quién lo organiza (tanda 295).
        perfil?.is_admin
          ? `<label class="torneos-form-campo">
        <span><input type="checkbox" id="editarOficial" ${torneo.is_official ? 'checked' : ''} /> Torneo oficial de PokeDoc</span>
        <span class="torneo-campo-pista">Sin marcar sale como torneo de la comunidad.</span>
      </label>`
          : ''
      }
      <div class="torneos-form-campo">Imagen del torneo
        <div class="torneo-imagen-campo">
          <img loading="lazy" id="editarImagenPreview" class="torneo-imagen-preview ${torneo.image_url ? '' : 'hidden'}" src="${escapeHtml(torneo.image_url || '')}" alt="" />
          <button type="button" class="btn-secondary" id="btnEditarImagen">${torneo.image_url ? 'Cambiar imagen' : 'Elegir imagen'}</button>
          <button type="button" class="btn-outline ${torneo.image_url ? '' : 'hidden'}" id="btnEditarImagenQuitar">Quitar</button>
          <input type="file" id="editarImagenInput" accept="image/*" class="hidden" />
        </div>
        <span class="torneo-campo-pista">Se enseña como icono en el listado de torneos.</span>
      </div>
      <div class="torneos-form-campo">Banner del torneo
        <div class="torneo-imagen-campo">
          <img loading="lazy" id="editarBannerPreview" class="torneo-banner-preview ${torneo.banner_url ? '' : 'hidden'}" src="${escapeHtml(torneo.banner_url || '')}" alt="" />
          <button type="button" class="btn-secondary" id="btnEditarBanner">${torneo.banner_url ? 'Cambiar banner' : 'Elegir banner'}</button>
          <button type="button" class="btn-outline ${torneo.banner_url ? '' : 'hidden'}" id="btnEditarBannerQuitar">Quitar</button>
          <input type="file" id="editarBannerInput" accept="image/*" class="hidden" />
        </div>
        <span class="torneo-campo-pista">Se enseña arriba del todo en la ficha. Apaisado queda mejor.</span>
      </div>
      <div class="torneos-form-campo">Premios
        <div class="torneo-premios-editor" id="editarPremiosLista"></div>
        <button type="button" class="btn-secondary" id="btnEditarAnadirPremio">Añadir un premio</button>
        <span class="torneo-campo-pista">Una línea por puesto. El puesto es texto libre: «1º», «Top 8», «Todos los participantes»… El primero es el que sale en el listado de torneos.</span>
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
}

// ── Las filas de premios del editor (tanda 352) ──
//
// Se repintan enteras en cada cambio, como las jornadas de una liga: son
// como mucho doce filas y así no hay dos ideas de cuál es el orden (la
// del DOM y la de una variable) que puedan discrepar.
function pintarPremiosEditor(filas) {
  const caja = $('editarPremiosLista')
  if (!caja) return
  caja.innerHTML = (filas.length ? filas : [{ puesto: '', premio: '' }])
    .map(
      (p, i) => `<div class="torneo-premio-fila">
        <input type="text" data-premio-puesto="${i}" maxlength="${PUESTO_MAXIMO}" placeholder="1º" value="${escapeHtml(p.puesto || '')}" aria-label="Puesto del premio ${i + 1}" />
        <input type="text" data-premio-que="${i}" maxlength="${PREMIO_MAXIMO}" placeholder="50 € en cartas" value="${escapeHtml(p.premio || '')}" aria-label="Qué se lleva" />
        <button type="button" class="btn-secondary torneo-quitar-jornada" data-premio-quitar="${i}" title="Quitar este premio">✕</button>
      </div>`
    )
    .join('')
  caja.querySelectorAll('[data-premio-quitar]').forEach((b) =>
    b.addEventListener('click', () => {
      const quedan = premiosDelEditor().filter((_, i) => i !== Number(b.dataset.premioQuitar))
      pintarPremiosEditor(quedan)
    })
  )
}

function premiosDelEditor() {
  return [...document.querySelectorAll('#editarPremiosLista .torneo-premio-fila')].map((fila) => ({
    puesto: fila.querySelector('[data-premio-puesto]')?.value || '',
    premio: fila.querySelector('[data-premio-que]')?.value || '',
  }))
}

// El formulario ya está en la página: esto le pone la vida (el editor de
// texto, las imágenes, las jornadas de una liga y el guardar).
function engancharEditor(torneo, estructuraBloqueada, esLiga) {
  pintarPremiosEditor(premiosDeTorneo(torneo))
  $('btnEditarAnadirPremio')?.addEventListener('click', () => {
    const actuales = premiosDelEditor()
    if (actuales.length >= PREMIOS_MAXIMO) {
      showToast(`Como mucho ${PREMIOS_MAXIMO} premios.`)
      return
    }
    pintarPremiosEditor([...actuales, { puesto: '', premio: '' }])
  })
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
      placeholder: 'Reglas de la casa, cómo se juega…',
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
  // Sin corte no hay «al mejor de» que elegir (tanda 241).
  $('editarCorte').addEventListener('change', () => {
    $('editarCorteBoCampo').classList.toggle('hidden', !Number($('editarCorte').value))
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
  // El banner, con el mismo baile.
  editarBannerNuevo = undefined
  $('btnEditarBanner').addEventListener('click', () => $('editarBannerInput').click())
  $('editarBannerInput').addEventListener('change', () => {
    const fichero = $('editarBannerInput').files?.[0]
    if (!fichero) return
    editarBannerNuevo = fichero
    const preview = $('editarBannerPreview')
    preview.src = URL.createObjectURL(fichero)
    preview.classList.remove('hidden')
    $('btnEditarBannerQuitar').classList.remove('hidden')
    $('btnEditarBanner').textContent = 'Cambiar banner'
  })
  $('btnEditarBannerQuitar').addEventListener('click', () => {
    editarBannerNuevo = null
    $('editarBannerInput').value = ''
    $('editarBannerPreview').classList.add('hidden')
    $('btnEditarBannerQuitar').classList.add('hidden')
    $('btnEditarBanner').textContent = 'Elegir banner'
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
  const modoListas = $('editarListasModo').value
  const cambios = {
    name: nombre,
    start_at: new Date(fecha).toISOString(),
    description: editarDescripcionHtml || null,
    checkin_minutes: Number($('editarCheckin').value),
    // El modo nuevo manda; el booleano viejo se mantiene en sincronía
    // porque la política RLS y el código pre-migración lo leen.
    decklist_visibility: modoListas,
    show_opponent_decklists: modoListas === 'en_juego',
    prizes: premiosParaGuardar(premiosDelEditor()),
  }
  // Solo si el campo está en pantalla: si no, un organizador normal
  // guardaría `false` cada vez que edita y le quitaría el sello a un
  // torneo oficial que lleve él.
  if ($('editarOficial')) cambios.is_official = $('editarOficial').checked
  // El código va aparte (tanda 367) y con una regla delante: marcar
  // «entrada con código» sin escribir ninguno dejaría un torneo a la
  // vista al que NO SE PUEDE ENTRAR, y sin que nada diera error.
  let codigoNuevo
  if ($('editarPrivado')) {
    cambios.is_private = $('editarPrivado').checked
    codigoNuevo = cambios.is_private ? $('editarCodigo').value.trim() : ''
    if (cambios.is_private && !codigoNuevo) {
      showToast('Escribe el código: sin él nadie podría inscribirse.', 'error')
      return
    }
  }
  // La imagen (tanda 239): solo si se tocó. Se sube aquí y no al
  // elegirla, para que cerrar el editor sin guardar no deje ficheros
  // huérfanos en Storage.
  if (editarImagenNueva !== undefined || editarBannerNuevo !== undefined) {
    try {
      const { uploadProfileImage } = await import('../app.js')
      if (editarImagenNueva !== undefined) {
        cambios.image_url =
          editarImagenNueva === null ? null : await uploadProfileImage(session.user.id, editarImagenNueva, 'torneo')
      }
      if (editarBannerNuevo !== undefined) {
        cambios.banner_url =
          editarBannerNuevo === null ? null : await uploadProfileImage(session.user.id, editarBannerNuevo, 'torneo-banner')
      }
    } catch (err) {
      showToast('No se ha podido subir la imagen: ' + (err?.message || err), 'error')
      return
    }
  }
  // Las fechas de las jornadas se guardan siempre (son informativas);
  // añadir o quitar jornadas cambia swiss_rounds y va con la estructura.
  if (esLiga) cambios.matchday_dates = fechasJornadas.map((f) => new Date(f).toISOString())
  // Las rondas por jornada (849): con ellas, el total de rondas es jornadas
  // × rondas. Se guardan aunque la estructura esté cerrada mientras no haya
  // ninguna ronda (el campo sale desactivado si las hay).
  const campoRpj = $('editarRondasJornada')
  const rpj = campoRpj && !campoRpj.disabled ? Number(campoRpj.value) : rondasPorJornada(torneo)
  if (esLiga && campoRpj && !campoRpj.disabled) {
    cambios.rounds_per_matchday = rpj
    cambios.swiss_rounds = fechasJornadas.length * rpj
  }
  if (torneo.status !== 'registration_closed') {
    cambios.max_players = plazas
    cambios.swiss_rounds = esLiga ? fechasJornadas.length * rpj : Number($('editarRondas').value)
    cambios.top_cut_size = Number($('editarCorte').value)
    cambios.round_time_minutes = Number($('editarMinutos').value)
    cambios.swiss_bo = Number($('editarSwissBo').value)
    cambios.top_cut_bo = Number($('editarCorteBo').value)
  }
  let { error } = await supabase.from('tournaments').update(cambios).eq('id', torneo.id)
  // Si alguna migración de columna nueva aún no se ejecutó, se guarda
  // sin esa columna (del modo de listas queda el booleano viejo). El
  // comprobador de /admin ya avisa de lo que falta.
  for (const columna of ['decklist_visibility', 'image_url', 'banner_url', 'is_private', 'prizes']) {
    if (error && (error.message || '').includes(columna)) {
      delete cambios[columna]
      ;({ error } = await supabase.from('tournaments').update(cambios).eq('id', torneo.id))
    }
  }
  if (error) {
    avisarError(error, 'No se ha podido guardar')
    return
  }
  // Después del torneo, no antes: si la fila no se guarda, el código
  // tampoco tiene por qué cambiar.
  if (codigoNuevo !== undefined) {
    const falloCodigo = await guardarCodigo(codigoNuevo)
    if (falloCodigo) {
      avisarError(falloCodigo, 'El torneo se ha guardado, pero el código no')
      return
    }
  }
  Object.assign(torneo, cambios)
  showToast('Torneo actualizado.', 'success')
  $('torneoEditor')?.remove()
  await recargar()
}
