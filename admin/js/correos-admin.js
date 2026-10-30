// /admin → Correos (tanda 1122). Antes, veinte tarjetas con su vista previa
// una debajo de otra, y el texto escrito en el código: para cambiar una coma
// había que pedirlo. Ahora: la lista a la izquierda (por familia, con «cambiado»
// en los que ya no dicen lo de siempre) y a la derecha el correo elegido con
// su asunto, un texto encima, el botón y el motivo del pie editables, la
// vista previa con la MISMA plantilla que sale de verdad mientras escribes,
// «Enviarme una prueba» y «Volver al de siempre».
//
// Lo que se cambia vive en `correo_textos` (migración 1122) y lo lee la
// función de envío; sin la migración, el panel enseña los correos como antes
// y dice qué falta.
import { supabase } from '../../js/supabase.js'
import { escapeHtml } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { EJEMPLOS_DE_CORREO, renderFilaDeCola, textosDeTipo, familiaDeTipo, limpiarPropio, HUECO_ASUNTO, FAMILIA_POR_TIPO, FAMILIAS } from '../../js/email-plantilla.js'

const SITIO = 'https://pokedoc.es'
let estado = null

const vacio = (p) => !p || Object.values(limpiarPropio(p)).every((v) => !v)

function pintarLista() {
  const { caja, textos, elegido } = estado
  const grupos = {}
  for (const ej of EJEMPLOS_DE_CORREO) (grupos[FAMILIA_POR_TIPO[ej.type] || 'otros'] ||= []).push(ej)
  caja.querySelector('#coLista').innerHTML = Object.entries(grupos)
    .map(([fam, ejs]) => `<p class="co-grupo">${escapeHtml(FAMILIAS[fam]?.etiqueta || 'Otros')}</p>${ejs
      .map((ej) => `<button type="button" class="co-item${ej.type === elegido ? ' on' : ''}" data-co="${escapeHtml(ej.type)}"><span>${escapeHtml(ej.subject)}</span>${vacio(textos[ej.type]) ? '' : '<small class="co-cambiado">cambiado</small>'}</button>`)
      .join('')}`)
    .join('')
}

function leer() {
  const v = (id) => estado.caja.querySelector(id)?.value || ''
  return limpiarPropio({ asunto: v('#coAsunto'), intro: v('#coIntro'), cta: v('#coCta'), pie: v('#coPie') })
}

function pintarPrevia() {
  const ej = EJEMPLOS_DE_CORREO.find((e) => e.type === estado.elegido)
  const propio = leer()
  const { subject, html } = renderFilaDeCola(ej, {
    siteUrl: SITIO,
    unsubscribeUrl: `${SITIO}/baja-correo?t=EJEMPLO&tipo=${encodeURIComponent(ej.type)}`,
    textos: { [ej.type]: propio },
  })
  // El HTML va por `srcdoc` (lleva comillas por todas partes) y el iframe
  // con `sandbox=""`: no ejecuta nada ni navega.
  estado.caja.querySelector('#coPrevia').srcdoc = html
  estado.caja.querySelector('#coAsuntoFinal').textContent = subject
  const nota = estado.caja.querySelector('#coAsuntoNota')
  nota.hidden = !(propio.asunto && !propio.asunto.includes(HUECO_ASUNTO) && ej.type !== 'weekly_digest')
}

function pintarEditor() {
  const { caja, textos, elegido, sinTabla } = estado
  const ej = EJEMPLOS_DE_CORREO.find((e) => e.type === elegido)
  const p = limpiarPropio(textos[elegido])
  const base = textosDeTipo(elegido)
  const familia = familiaDeTipo(elegido)
  caja.querySelector('#coEditor').innerHTML = `
    <div class="co-cab"><b>${escapeHtml(ej.subject)}</b><small><code>${escapeHtml(ej.type)}</code>${familia ? ` · ${escapeHtml(familia.etiqueta)}` : ''} · lo encola: ${escapeHtml(ej.donde)}</small></div>
    ${sinTabla ? '<p class="admin-note admin-note-alerta">Para cambiar los textos falta ejecutar <code>supabase-migration-1122-correos.sql</code>. Mientras, se ven como salen.</p>' : ''}
    <div class="co-dos">
      <form class="co-form" id="coForm">
        <label class="av-campo"><span class="av-eti">Asunto</span>
          <input type="text" id="coAsunto" maxlength="200" placeholder="${escapeHtml(HUECO_ASUNTO)} (el de cada aviso)" value="${escapeHtml(p.asunto)}" ${sinTabla ? 'disabled' : ''} />
          <small class="av-nota">${escapeHtml(HUECO_ASUNTO)} es el de cada aviso (en el ejemplo, «${escapeHtml(ej.subject)}»). Vacío, ese tal cual.</small>
          <small class="av-nota av-mal" id="coAsuntoNota" hidden>Sin ${escapeHtml(HUECO_ASUNTO)}, todos los correos de este tipo llevarán el mismo asunto.</small></label>
        <label class="av-campo"><span class="av-eti">Texto de arriba (opcional)</span>
          <textarea id="coIntro" rows="3" maxlength="600" placeholder="Va debajo del asunto, encima de la cita" ${sinTabla ? 'disabled' : ''}>${escapeHtml(p.intro)}</textarea></label>
        <div class="av-dos">
          <label class="av-campo"><span class="av-eti">Botón</span><input type="text" id="coCta" maxlength="60" placeholder="${escapeHtml(base.cta)}" value="${escapeHtml(p.cta)}" ${sinTabla ? 'disabled' : ''} /></label>
          <label class="av-campo"><span class="av-eti">Por qué le llega (pie)</span><input type="text" id="coPie" maxlength="300" placeholder="${escapeHtml(base.pie)}" value="${escapeHtml(p.pie)}" ${sinTabla ? 'disabled' : ''} /></label>
        </div>
        <p class="av-nota">Enlace del ejemplo: <a href="${escapeHtml(ej.link || '/')}" target="_blank" rel="noopener">${escapeHtml(ej.link || '(sin enlace)')}</a></p>
        <div class="av-acciones">
          <button type="submit" class="btn-primary" ${sinTabla ? 'disabled' : ''}>Guardar</button>
          <button type="button" class="btn-secondary" data-co-prueba>Enviarme una prueba</button>
          ${vacio(textos[elegido]) ? '' : '<button type="button" class="btn-secondary" data-co-siempre>Volver al de siempre</button>'}
        </div>
      </form>
      <div class="co-previa">
        <span class="av-eti">Así llega</span>
        <p class="co-asunto">Asunto: <b id="coAsuntoFinal"></b></p>
        <iframe id="coPrevia" title="Vista previa del correo" sandbox=""></iframe>
      </div>
    </div>`
  pintarPrevia()
}

async function guardar() {
  const tipo = estado.elegido
  const propio = leer()
  const { data: s } = await supabase.auth.getSession()
  const { error } = vacio(propio)
    ? await supabase.from('correo_textos').delete().eq('tipo', tipo)
    : await supabase.from('correo_textos').upsert({ tipo, ...propio, updated_at: new Date().toISOString(), por: s?.session?.user?.id || null }, { onConflict: 'tipo' })
  if (error) return showToast(`No se ha podido guardar: ${error.message}`, 'error')
  estado.textos[tipo] = vacio(propio) ? null : propio
  pintarLista()
  pintarEditor()
  showToast(vacio(propio) ? 'Vuelve a ser el de siempre.' : 'Guardado. Los próximos correos de este tipo salen así.', 'success')
}

async function volverAlDeSiempre() {
  const { error } = await supabase.from('correo_textos').delete().eq('tipo', estado.elegido)
  if (error) return showToast(`No se ha podido: ${error.message}`, 'error')
  estado.textos[estado.elegido] = null
  pintarLista()
  pintarEditor()
  showToast('Vuelve a ser el de siempre.', 'success')
}

async function prueba() {
  const ej = EJEMPLOS_DE_CORREO.find((e) => e.type === estado.elegido)
  // La prueba sale con lo GUARDADO (es lo que lee la función de envío): si
  // hay cambios sin guardar, se avisa.
  const sinGuardar = JSON.stringify(leer()) !== JSON.stringify(limpiarPropio(estado.textos[ej.type]))
  const { error } = await supabase.rpc('admin_correo_prueba', { p_tipo: ej.type, p_asunto: ej.subject, p_cita: ej.preview || null, p_enlace: ej.link || null })
  if (error) {
    const falta = /PGRST202|Could not find the function/i.test(`${error.code} ${error.message}`)
    return showToast(falta ? 'Las pruebas necesitan supabase-migration-1122-correos.sql.' : `No se ha podido: ${error.message}`, 'error')
  }
  showToast(`En la cola: te llega en unos minutos a tu correo${sinGuardar ? ' (con lo guardado, no con lo que estás escribiendo)' : ''}.`, 'success')
}

export async function montarCorreos(caja) {
  if (!caja) return
  const { data, error } = await supabase.from('correo_textos').select('tipo, asunto, intro, cta, pie')
  const textos = {}
  for (const f of data || []) textos[f.tipo] = f
  estado = { caja, textos, elegido: EJEMPLOS_DE_CORREO[0].type, sinTabla: Boolean(error) }
  caja.innerHTML = `<div class="co-cuerpo"><nav class="co-lista" id="coLista" aria-label="Correos"></nav><div class="co-editor" id="coEditor"></div></div>`
  pintarLista()
  pintarEditor()
  caja.addEventListener('click', (e) => {
    const item = e.target.closest('[data-co]')
    if (item) {
      estado.elegido = item.dataset.co
      pintarLista()
      pintarEditor()
      return
    }
    if (e.target.closest('[data-co-prueba]')) return prueba()
    if (e.target.closest('[data-co-siempre]')) return volverAlDeSiempre()
  })
  caja.addEventListener('input', (e) => {
    if (e.target.closest('#coForm')) pintarPrevia()
  })
  caja.addEventListener('submit', (e) => {
    if (!e.target.closest('#coForm')) return
    e.preventDefault()
    guardar()
  })
}
