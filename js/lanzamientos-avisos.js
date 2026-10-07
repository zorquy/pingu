// «Avísame» en cada lanzamiento (tanda 753, P2): una semana antes, el día
// que sale y, si se sabe, cuando abre la preventa. Guarda en
// `user_release_alerts` (supabase-migration-avisos-lanzamientos.sql) y los
// manda la función programada `avisos-lanzamientos`, una vez al día.
//
// Entra por `import()` cuando /lanzamientos ya ha pintado: la página se ve
// igual sin él, y los botones llegan después.
import { supabase } from './supabase.js'
import { getSession } from './app.js'
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { normalizeSearch } from './texto.js'

export const FICHERO_MIGRACION = 'supabase-migration-avisos-lanzamientos.sql'
// La clave de un evento: el id del set, o el nombre para uno de la lista a
// mano (la función programada lo busca igual).
export const claveDeEvento = (e) => (e.id ? String(e.id) : `manual:${normalizeSearch(e.nombre)}`)
const sinTabla = (error) => /user_release_alerts|42P01|PGRST205|schema cache/i.test(String(error?.message || error?.code || ''))

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const fechaCorta = (f) => { const [, m, d] = String(f).split('-').map(Number); return `${d} de ${MESES[m - 1]}` }

export function botonHtml(e, puesto, conSesion) {
  const rotulo = puesto ? `Te avisaremos de ${e.nombre}` : `Avísame de ${e.nombre}`
  if (!conSesion) return `<a class="lanz-avisar" href="/auth.html?registro=1&amp;volver=${encodeURIComponent('/lanzamientos.html')}" aria-label="${escapeHtml(rotulo)}">${icons.bell(18)}<span>Avísame</span></a>`
  return `<button type="button" class="lanz-avisar" aria-pressed="${puesto}" aria-label="${escapeHtml(rotulo)}">${icons.bell(18)}<span>${puesto ? 'Avisado' : 'Avísame'}</span></button>`
}

function dialogo(doc) {
  let d = doc.getElementById('lanzAvisoDialogo')
  if (d) return d
  doc.body.insertAdjacentHTML('beforeend', `
    <dialog class="lanz-aviso-dialogo" id="lanzAvisoDialogo" aria-labelledby="lanzAvisoTitulo">
      <form method="dialog" id="lanzAvisoForm">
        <h2 id="lanzAvisoTitulo"></h2>
        <p class="subtext" id="lanzAvisoFecha"></p>
        <label class="lanz-aviso-opcion"><input type="checkbox" name="semana" /> <span>Una semana antes</span></label>
        <label class="lanz-aviso-opcion"><input type="checkbox" name="dia" /> <span>El día que sale</span></label>
        <label class="lanz-aviso-opcion" id="lanzAvisoPreventa"><input type="checkbox" name="preventa" /> <span></span></label>
        <p class="subtext">Te llega a la campanita y, si los tienes puestos, al móvil.</p>
        <div class="lanz-aviso-pie">
          <button type="button" class="btn-secondary" data-lanz="quitar">Quitar aviso</button>
          <button type="button" class="btn-secondary" data-lanz="cancelar">Cancelar</button>
          <button type="submit" class="btn-primary">Guardar</button>
        </div>
      </form>
    </dialog>`)
  return doc.getElementById('lanzAvisoDialogo')
}

export async function montarAvisos(cal, mercado, doc = document) {
  const eventos = [cal?.siguiente, ...(cal?.proximos || [])].filter(Boolean)
  if (!eventos.length) return
  const sesion = await getSession().catch(() => null)
  // Los tuyos. null = no se sabe (sin la migración): los botones salen y,
  // al guardar, se dice qué falta.
  let mios = null
  if (sesion) {
    const { data, error } = await supabase.from('user_release_alerts').select('id,clave,market,semana,dia,preventa').eq('user_id', sesion.user.id)
    mios = error ? null : new Map((data || []).map((f) => [`${f.clave}|${f.market}`, f]))
  }
  const mercadoDe = (e) => (e.id ? e.mercado || mercado : 'WEST')
  const filaDe = (e) => mios?.get(`${claveDeEvento(e)}|${mercadoDe(e)}`) || null
  const sitios = [doc.querySelector('#proximoDestacado .lanzamiento-destacado'), ...doc.querySelectorAll('#listaProximos .lanz-evento')]
  eventos.forEach((e, i) => {
    const sitio = sitios[i]
    if (!sitio || sitio.querySelector('.lanz-avisar')) return
    sitio.insertAdjacentHTML('beforeend', botonHtml(e, Boolean(filaDe(e)), Boolean(sesion)))
    const b = sitio.querySelector('button.lanz-avisar')
    b?.addEventListener('click', () => abrir(e))
  })
  if (!sesion) return

  function repintarBoton(e) {
    const i = eventos.indexOf(e)
    const viejo = sitios[i]?.querySelector('.lanz-avisar')
    if (!viejo) return
    viejo.outerHTML = botonHtml(e, Boolean(filaDe(e)), true)
    sitios[i].querySelector('button.lanz-avisar')?.addEventListener('click', () => abrir(e))
  }

  function abrir(e) {
    const d = dialogo(doc)
    const f = d.querySelector('form')
    const fila = filaDe(e)
    d.querySelector('#lanzAvisoTitulo').textContent = `Avísame de ${e.nombre}`
    d.querySelector('#lanzAvisoFecha').textContent = `Sale el ${fechaCorta(e.fecha)}.`
    f.semana.checked = fila ? fila.semana : true
    f.dia.checked = fila ? fila.dia : true
    const pre = d.querySelector('#lanzAvisoPreventa')
    pre.hidden = !e.preventa
    pre.querySelector('span').textContent = e.preventa ? `Cuando abra la preventa (${fechaCorta(e.preventa)})` : ''
    f.preventa.checked = Boolean(e.preventa) && (fila ? fila.preventa : true)
    d.querySelector('[data-lanz="quitar"]').hidden = !fila
    d.onclick = async (ev) => {
      const b = ev.target.closest('[data-lanz]')
      if (!b) return
      if (b.dataset.lanz === 'cancelar') return d.close()
      const { error } = await supabase.from('user_release_alerts').delete().eq('user_id', sesion.user.id).eq('clave', claveDeEvento(e)).eq('market', mercadoDe(e))
      if (error) return showToast(sinTabla(error) ? `Falta ejecutar ${FICHERO_MIGRACION} en Supabase.` : `No se ha podido quitar: ${error.message}`, 'error')
      mios?.delete(`${claveDeEvento(e)}|${mercadoDe(e)}`)
      d.close()
      repintarBoton(e)
      showToast('Aviso quitado.', 'success')
    }
    f.onsubmit = async (ev) => {
      ev.preventDefault()
      const quiere = { semana: f.semana.checked, dia: f.dia.checked, preventa: Boolean(e.preventa) && f.preventa.checked }
      if (!quiere.semana && !quiere.dia && !quiere.preventa) return showToast('Marca al menos un aviso, o quítalo.', 'error')
      const { data, error } = await supabase.from('user_release_alerts')
        .upsert({ user_id: sesion.user.id, clave: claveDeEvento(e), market: mercadoDe(e), nombre: e.nombre, ...quiere }, { onConflict: 'user_id,clave,market' })
        .select('id,clave,market,semana,dia,preventa')
      if (error) return showToast(sinTabla(error) ? `Falta ejecutar ${FICHERO_MIGRACION} en Supabase.` : `No se ha podido guardar: ${error.message}`, 'error')
      if (!mios) mios = new Map()
      const nueva = (data || [])[0] || { clave: claveDeEvento(e), market: mercadoDe(e), ...quiere }
      mios.set(`${nueva.clave}|${nueva.market}`, nueva)
      d.close()
      repintarBoton(e)
      showToast(`Hecho: te avisaremos de ${e.nombre}.`, 'success')
    }
    d.showModal()
  }
}
