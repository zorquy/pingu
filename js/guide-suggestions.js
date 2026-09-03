import { supabase } from './supabase.js'
import { escapeHtml, profileUrl } from './app.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { createNotification } from './notifications.js'

// Sugerir una corrección a la guía de otro.
//
// POR QUÉ: escribir una guía entera es un salto muy grande. Ver una
// errata, un dato que ya no es cierto o una explicación que no se
// entiende, eso lo puede hacer cualquiera desde el primer día. Y las
// guías envejecen — el TCG cambia — pero quien lo nota es quien la está
// leyendo, no su autor.
//
// ACEPTAR NO EDITA NADA. La guía la sigue escribiendo su autor; aceptar
// quiere decir "tienes razón y ya lo he arreglado", y acredita a quien
// avisó. Meterle mano al texto de otro automáticamente sería otra cosa
// muy distinta y bastante peor.
//
// La tabla la crea supabase-migration-sugerencias.sql.

function faltaLaTabla(error) {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /guide_suggestions/.test(`${error.message || ''} ${error.details || ''}`)
  )
}

// ── Quién ha ayudado a mejorar esta guía ──
//
// Solo salen las ACEPTADAS: son las únicas públicas, y son justamente el
// crédito. Si no hay ninguna no se pinta nada — un "correcciones de:
// (nadie)" no le hace ilusión a nadie.
export async function creditosHtml(guideId) {
  const { data, error } = await supabase
    .from('guide_suggestions')
    .select('author_id')
    .eq('guide_id', guideId)
    .eq('status', 'accepted')
  if (error || !data || data.length === 0) return ''

  const ids = [...new Set(data.map((s) => s.author_id).filter(Boolean))]
  if (ids.length === 0) return ''

  const { data: perfiles } = await supabase.from('user_profiles').select('id, username, display_name').in('id', ids)
  const nombres = (perfiles || []).map(
    (p) => `<a href="${profileUrl(p)}">${escapeHtml(p.display_name || p.username || 'alguien')}</a>`
  )
  if (nombres.length === 0) return ''

  return `<p class="guide-creditos">${icons.sprout(13)} Con correcciones de ${nombres.join(', ')}</p>`
}

// ── El botón y su formulario ──
export async function montarSugerencia(contenedor, guide, session) {
  if (!contenedor || !guide?.id) return
  // El autor no se sugiere a sí mismo: edita la guía y ya. (La base
  // tampoco se lo permitiría.)
  if (session && guide.author_id === session.user.id) return

  contenedor.innerHTML = `
    <button type="button" class="sugerencia-btn" id="btnSugerir">
      ${icons.flag(14)} ¿Ves algo que no está bien? Sugiere una corrección
    </button>
    <div class="sugerencia-form hidden" id="sugerenciaForm">
      <p class="subtext">
        Una errata, un dato que ya no es cierto, algo que no se entiende…
        Se lo mandas a quien la escribió; <strong>si la acepta, apareces
        acreditado en la guía</strong>.
      </p>
      <input type="text" id="sugerenciaCita" maxlength="200" placeholder="¿A qué parte? Copia el trozo (opcional)" />
      <textarea id="sugerenciaCuerpo" maxlength="1000" rows="3" placeholder="Qué está mal y qué debería decir"></textarea>
      <div class="sugerencia-acciones">
        <button type="button" class="btn-primary" id="btnEnviarSugerencia">Enviar</button>
        <button type="button" class="btn-secondary" id="btnCancelarSugerencia">Cancelar</button>
      </div>
    </div>`

  const boton = document.getElementById('btnSugerir')
  const form = document.getElementById('sugerenciaForm')

  boton.addEventListener('click', () => {
    if (!session) {
      showToast('Entra con tu cuenta para sugerir una corrección.')
      return
    }
    form.classList.toggle('hidden')
    if (!form.classList.contains('hidden')) document.getElementById('sugerenciaCuerpo').focus()
  })

  document.getElementById('btnCancelarSugerencia').addEventListener('click', () => form.classList.add('hidden'))

  let enviando = false
  document.getElementById('btnEnviarSugerencia').addEventListener('click', async () => {
    if (enviando) return
    const cuerpo = document.getElementById('sugerenciaCuerpo').value.trim()
    if (!cuerpo) {
      showToast('Cuéntale qué está mal, aunque sea en una línea.')
      return
    }
    enviando = true
    const { error } = await supabase.from('guide_suggestions').insert({
      guide_id: guide.id,
      author_id: session.user.id,
      quote: document.getElementById('sugerenciaCita').value.trim() || null,
      body: cuerpo,
    })
    enviando = false

    if (error) {
      showToast(faltaLaTabla(error) ? 'Las sugerencias todavía no están activadas.' : 'No se ha podido enviar: ' + error.message)
      return
    }

    await createNotification({
      recipientId: guide.author_id,
      actorId: session.user.id,
      type: 'guide_suggestion',
      title: 'Te sugieren una corrección',
      body: guide.title,
      // Con la guía en el enlace, la campanita no te deja en la
      // pestaña y ya: el perfil abre directamente el panel de ESA guía
      // (tanda 253). Los avisos viejos siguen valiendo — sin el
      // parámetro, se abre la pestaña y se busca a mano.
      //
      // `/perfil` y NO `/perfil.html`: con la extensión hay una
      // redirección a la URL limpia, y una redirección de más es una
      // ocasión de perder la query por el camino (el servidor de las
      // pruebas se la come, sin ir más lejos). El parámetro es justo lo
      // que hace útil este enlace.
      link: `/perfil?sugerencias=${encodeURIComponent(guide.id)}#guides`,
    })

    form.classList.add('hidden')
    boton.disabled = true
    boton.innerHTML = `${icons.checkCircle(14)} Enviada. Gracias por avisar.`
    showToast('Enviada. Si la acepta, aparecerás acreditado en la guía.', 'success')
  })
}

// ── Lado del autor: revisar lo que le han sugerido ──
export async function sugerenciasPendientes(guideIds) {
  if (!guideIds || guideIds.length === 0) return {}
  const { data, error } = await supabase
    .from('guide_suggestions')
    .select('id, guide_id, author_id, quote, body, status, created_at')
    .in('guide_id', guideIds)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) return {}

  const porGuia = {}
  for (const s of data || []) (porGuia[s.guide_id] ||= []).push(s)
  return porGuia
}

export async function resolverSugerencia(sugerencia, aceptada, guideTitle, guideSlug) {
  const { error } = await supabase
    .from('guide_suggestions')
    .update({ status: aceptada ? 'accepted' : 'rejected', resolved_at: new Date().toISOString() })
    .eq('id', sugerencia.id)
  if (error) return { error }

  // Solo se avisa al aceptar. Un "te han rechazado la corrección" no le
  // sirve a nadie y desanima a volver a avisar; y el XP lo da la base,
  // no esto.
  if (aceptada) {
    await createNotification({
      recipientId: sugerencia.author_id,
      actorId: null,
      type: 'guide_suggestion_accepted',
      title: 'Han aceptado tu corrección',
      body: guideTitle,
      link: `/guia.html?slug=${encodeURIComponent(guideSlug || '')}`,
    })
  }
  return { error: null }
}
