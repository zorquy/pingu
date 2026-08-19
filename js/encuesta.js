import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'

// Encuestas del foro.
//
// Un tema puede llevar una votación. Votar cuesta un clic y participar
// en un hilo cuesta escribir un párrafo, así que es lo que más movimiento
// genera en un foro que arranca.
//
// Lo que impide votar dos veces NO está aquí: está en la base, con un
// índice único (ver supabase-migration-encuestas-foro.sql). Esto es la
// pantalla; la regla la impone Postgres, que es el único sitio donde no
// se puede esquivar abriendo dos pestañas.

export const MAX_OPCIONES = 8
export const MIN_OPCIONES = 2

// ── Crear ──

export function formularioEncuestaHtml() {
  return `
    <div class="encuesta-form" id="encuestaForm">
      <label class="checkbox-row encuesta-activar">
        <input type="checkbox" id="encuestaActivar" /> ${icons.barChart(15)} Añadir una encuesta
      </label>
      <div class="encuesta-campos hidden" id="encuestaCampos">
        <input type="text" id="encuestaPregunta" maxlength="150" placeholder="La pregunta (ej: ¿Cómo llamamos a la mascota?)" />
        <div id="encuestaOpciones"></div>
        <button type="button" class="link-btn" id="btnAnadirOpcion">+ Añadir opción</button>
        <label class="checkbox-row"><input type="checkbox" id="encuestaMultiple" /> Se pueden marcar varias</label>
      </div>
    </div>`
}

function filaOpcionHtml(i) {
  return `<input type="text" class="encuesta-opcion" maxlength="80" placeholder="Opción ${i + 1}" />`
}

export function engancharFormularioEncuesta(raiz) {
  const activar = raiz.querySelector('#encuestaActivar')
  const campos = raiz.querySelector('#encuestaCampos')
  const opciones = raiz.querySelector('#encuestaOpciones')
  if (!activar) return

  opciones.innerHTML = Array.from({ length: MIN_OPCIONES }, (_, i) => filaOpcionHtml(i)).join('')

  activar.addEventListener('change', () => campos.classList.toggle('hidden', !activar.checked))
  raiz.querySelector('#btnAnadirOpcion').addEventListener('click', () => {
    const cuantas = opciones.querySelectorAll('.encuesta-opcion').length
    if (cuantas >= MAX_OPCIONES) {
      showToast(`Como mucho ${MAX_OPCIONES} opciones.`)
      return
    }
    opciones.insertAdjacentHTML('beforeend', filaOpcionHtml(cuantas))
  })
}

// Devuelve null si no se ha activado, o un texto de error si falta algo.
export function leerFormularioEncuesta(raiz) {
  if (!raiz.querySelector('#encuestaActivar')?.checked) return { encuesta: null }

  const pregunta = raiz.querySelector('#encuestaPregunta').value.trim()
  const etiquetas = [...raiz.querySelectorAll('.encuesta-opcion')]
    .map((i) => i.value.trim())
    .filter(Boolean)

  if (!pregunta) return { error: 'Ponle una pregunta a la encuesta.' }
  if (etiquetas.length < MIN_OPCIONES) return { error: `La encuesta necesita al menos ${MIN_OPCIONES} opciones.` }
  // Dos opciones con el mismo texto dejan un resultado que no se puede
  // leer: no hay forma de saber a cuál de las dos votó cada uno.
  if (new Set(etiquetas.map((e) => e.toLowerCase())).size !== etiquetas.length) {
    return { error: 'Hay dos opciones repetidas.' }
  }

  return {
    encuesta: {
      pregunta,
      multiple: raiz.querySelector('#encuestaMultiple').checked,
      etiquetas,
    },
  }
}

export async function crearEncuesta(threadId, encuesta) {
  const { error } = await supabase
    .from('forum_polls')
    .insert({ thread_id: threadId, question: encuesta.pregunta, multiple: encuesta.multiple })
  if (error) return error

  const { error: errorOpciones } = await supabase.from('forum_poll_options').insert(
    encuesta.etiquetas.map((label, i) => ({ thread_id: threadId, label, order_pos: i }))
  )
  return errorOpciones || null
}

// ── Pintar y votar ──

// Si la tabla no existe todavía (migración sin ejecutar), esto se calla y
// el tema se ve igual que siempre — sin encuesta, pero entero.
export async function cargarEncuesta(threadId) {
  const { data: encuesta, error } = await supabase
    .from('forum_polls')
    .select('thread_id, question, multiple, closes_at')
    .eq('thread_id', threadId)
    .maybeSingle()
  if (error || !encuesta) return null

  const [{ data: resultados }, { data: sesion }] = await Promise.all([
    supabase.rpc('forum_poll_resultados', { p_thread: threadId }),
    supabase.auth.getSession(),
  ])
  const userId = sesion?.session?.user?.id || null

  let mios = []
  if (userId) {
    const { data } = await supabase
      .from('forum_poll_votes')
      .select('option_id')
      .eq('thread_id', threadId)
      .eq('user_id', userId)
    mios = (data || []).map((v) => v.option_id)
  }

  return { encuesta, resultados: resultados || [], mios, userId }
}

export function encuestaHtml({ encuesta, resultados, mios, userId }, puedeEditar = false) {
  const total = resultados.reduce((s, r) => s + Number(r.votos || 0), 0)
  const cerrada = encuesta.closes_at && new Date(encuesta.closes_at) <= new Date()
  const heVotado = mios.length > 0
  // Los resultados se enseñan cuando ya has votado o cuando está
  // cerrada. Antes no: ver por dónde va la votación cambia lo que vota
  // la gente, y en una comunidad pequeña eso se nota mucho.
  const verResultados = heVotado || cerrada
  const puedeVotar = !!userId && !cerrada

  const opciones = resultados
    .map((r) => {
      const votos = Number(r.votos || 0)
      const pct = total > 0 ? Math.round((votos / total) * 100) : 0
      const mio = mios.includes(r.option_id)
      if (verResultados) {
        return `
          <div class="encuesta-resultado ${mio ? 'encuesta-mio' : ''}">
            <div class="encuesta-resultado-cab">
              <span>${mio ? icons.checkCircle(13) : ''}${escapeHtml(r.label)}</span>
              <strong>${pct}%</strong>
            </div>
            <div class="encuesta-barra"><span style="width:${pct}%"></span></div>
            <small>${votos} ${votos === 1 ? 'voto' : 'votos'}</small>
          </div>`
      }
      return `
        <label class="encuesta-opcion-voto">
          <input type="${encuesta.multiple ? 'checkbox' : 'radio'}" name="encuestaVoto" value="${r.option_id}" ${puedeVotar ? '' : 'disabled'} />
          <span>${escapeHtml(r.label)}</span>
        </label>`
    })
    .join('')

  return `
    <section class="encuesta" id="encuestaBloque" data-thread="${encuesta.thread_id}" data-multiple="${encuesta.multiple ? '1' : ''}">
      <h3>${escapeHtml(encuesta.question)}</h3>
      ${opciones}
      <div class="encuesta-pie">
        <span class="subtext">${total} ${total === 1 ? 'voto' : 'votos'}${cerrada ? ' · cerrada' : ''}</span>
        ${
          verResultados
            ? !cerrada && heVotado
              ? `<button type="button" class="link-btn" id="btnCambiarVoto">Cambiar mi voto</button>`
              : ''
            : puedeVotar
              ? `<button type="button" class="btn-secondary" id="btnVotar">Votar</button>`
              : `<span class="subtext">Entra con tu cuenta para votar.</span>`
        }
        ${puedeEditar ? `<button type="button" class="link-btn" id="btnEditarEncuesta">Editar encuesta</button>` : ''}
      </div>
    </section>`
}

export function engancharEncuesta(raiz, threadId, alCambiar, datos = null) {
  const bloque = raiz.querySelector('#encuestaBloque')
  if (!bloque) return

  // Editar la encuesta (quien abrió el tema, o el equipo). El botón solo
  // existe si encuestaHtml() lo pintó con permiso.
  raiz.querySelector('#btnEditarEncuesta')?.addEventListener('click', () => {
    if (datos) pintarEditorDeEncuesta(raiz, threadId, alCambiar, datos)
  })

  raiz.querySelector('#btnVotar')?.addEventListener('click', async () => {
    const marcadas = [...raiz.querySelectorAll('input[name="encuestaVoto"]:checked')].map((i) => i.value)
    if (marcadas.length === 0) {
      showToast('Marca una opción antes de votar.')
      return
    }
    const multiple = bloque.dataset.multiple === '1'
    const { data: sesion } = await supabase.auth.getSession()
    const userId = sesion?.session?.user?.id
    if (!userId) return

    const { error } = await supabase.from('forum_poll_votes').insert(
      marcadas.map((option_id) => ({ option_id, user_id: userId, thread_id: threadId, multiple }))
    )
    if (error) {
      // 23505 es el índice único: alguien ya tenía un voto en esta
      // encuesta (otra pestaña, o el botón pulsado dos veces). No es un
      // error que haya que explicar con jerga.
      showToast(error.code === '23505' ? 'Ya has votado en esta encuesta.' : 'No se ha podido votar. Inténtalo otra vez.')
    }
    await alCambiar()
  })

  raiz.querySelector('#btnCambiarVoto')?.addEventListener('click', async () => {
    const { data: sesion } = await supabase.auth.getSession()
    const userId = sesion?.session?.user?.id
    if (!userId) return
    await supabase.from('forum_poll_votes').delete().eq('thread_id', threadId).eq('user_id', userId)
    await alCambiar()
  })
}

// ── Editar ──
//
// La base (forum_editar_encuesta, security definer) es quien manda aquí:
// impone quién puede, valida como al crear, y decide qué pasa con los
// votos — si el cambio toca las opciones o el modo de voto, se borran y
// la votación empieza de cero; si solo se corrige la pregunta, se
// conservan. Esta pantalla lo dice ANTES de guardar, no después.
function pintarEditorDeEncuesta(raiz, threadId, alCambiar, { encuesta, resultados }) {
  const bloque = raiz.querySelector('#encuestaBloque')
  if (!bloque) return

  bloque.innerHTML = `
    <h3>Editar la encuesta</h3>
    <div class="encuesta-campos" id="encuestaEditar">
      <input type="text" id="encuestaPregunta" maxlength="150" value="${escapeHtml(encuesta.question)}" aria-label="La pregunta" />
      <div id="encuestaOpciones">
        ${resultados
          .map((r) => `<input type="text" class="encuesta-opcion" maxlength="80" value="${escapeHtml(r.label)}" />`)
          .join('')}
      </div>
      <button type="button" class="link-btn" id="btnAnadirOpcion">+ Añadir opción</button>
      <label class="checkbox-row"><input type="checkbox" id="encuestaMultiple" ${encuesta.multiple ? 'checked' : ''} /> Se pueden marcar varias</label>
      <p class="subtext">Si cambias las opciones o el modo de voto, los votos ya emitidos se borran
      y la votación empieza de cero (si solo corriges la pregunta, se conservan).</p>
      <div class="foro-form-acciones">
        <button type="button" class="btn-primary" id="btnGuardarEncuesta">Guardar</button>
        <button type="button" class="btn-secondary" id="btnCancelarEncuesta">Cancelar</button>
        <button type="button" class="link-btn" id="btnQuitarEncuesta">Quitar la encuesta</button>
      </div>
    </div>`

  raiz.querySelector('#btnAnadirOpcion').addEventListener('click', () => {
    const opciones = raiz.querySelector('#encuestaOpciones')
    const cuantas = opciones.querySelectorAll('.encuesta-opcion').length
    if (cuantas >= MAX_OPCIONES) {
      showToast(`Como mucho ${MAX_OPCIONES} opciones.`)
      return
    }
    opciones.insertAdjacentHTML('beforeend', filaOpcionHtml(cuantas))
  })

  raiz.querySelector('#btnCancelarEncuesta').addEventListener('click', alCambiar)

  raiz.querySelector('#btnGuardarEncuesta').addEventListener('click', async (e) => {
    const pregunta = raiz.querySelector('#encuestaPregunta').value.trim()
    const etiquetas = [...raiz.querySelectorAll('.encuesta-opcion')].map((i) => i.value.trim()).filter(Boolean)

    // Las mismas comprobaciones que al crear, para avisar aquí con una
    // frase en vez de con el error de la base (que también las impone).
    if (!pregunta) return showToast('Ponle una pregunta a la encuesta.')
    if (etiquetas.length < MIN_OPCIONES) return showToast(`La encuesta necesita al menos ${MIN_OPCIONES} opciones.`)
    if (new Set(etiquetas.map((t) => t.toLowerCase())).size !== etiquetas.length) {
      return showToast('Hay dos opciones repetidas.')
    }

    e.target.disabled = true
    const { data: borrados, error } = await supabase.rpc('forum_editar_encuesta', {
      p_thread: threadId,
      p_pregunta: pregunta,
      p_multiple: raiz.querySelector('#encuestaMultiple').checked,
      p_opciones: etiquetas,
    })
    e.target.disabled = false
    if (error) {
      showToast('No se ha podido guardar: ' + error.message)
      return
    }
    showToast(
      Number(borrados) > 0
        ? `Encuesta guardada. Se han borrado ${borrados} ${Number(borrados) === 1 ? 'voto' : 'votos'} de la versión anterior.`
        : 'Encuesta guardada.',
      'success'
    )
    await alCambiar()
  })

  raiz.querySelector('#btnQuitarEncuesta').addEventListener('click', async (e) => {
    if (!confirm('¿Quitar la encuesta de este tema? Los votos se pierden.')) return
    e.target.disabled = true
    const { error } = await supabase.rpc('forum_editar_encuesta', {
      p_thread: threadId,
      p_pregunta: null,
      p_multiple: null,
      p_opciones: null,
    })
    e.target.disabled = false
    if (error) {
      showToast('No se ha podido quitar: ' + error.message)
      return
    }
    showToast('Encuesta retirada.', 'success')
    await alCambiar()
  })
}
