// LA CLASIFICACIÓN DE LOS RETOS (844 en la portada; desde la 1188, en /retos
// → «Tu historial», porque la portada pasó a ser un mosaico sin ella).
//
import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { hoja, caraHtml, cabecera, ic, nombre } from './pb-comun.js'

// Junta la liga de la semana y el top del mes, y los dos cuentan lo mismo:
// la XP de los seis retos (`portada_clasificacion`, supabase-migration-
// portada.sql). Podio con los tres primeros, el 4.º y el 5.º, y tu puesto
// siempre: es lo que se mira. Puro.
export function clasificacionHtml(d, { periodo = 'semana', conSesion = false } = {}) {
  const r = d?.ranking || []
  const sub = periodo === 'mes' ? 'La XP de los seis retos desde el día 1' : 'La XP de los seis retos, de lunes a domingo'
  const pestanas = `<span class="pb-pestanas" role="group" aria-label="Periodo">${['semana', 'mes'].map((p) => `<button type="button" data-periodo="${p}" class="${p === periodo ? 'activo' : ''}" aria-pressed="${p === periodo}">${p === 'semana' ? 'Semana' : 'Mes'}</button>`).join('')}</span>`
  if (!r.length) {
    // Sin lista pero con tu puesto, se dice tu puesto (lo que decía la línea
    // de la liga que esto sustituyó en /retos, 1188), no «nadie».
    const t = d?.tu
    const cuerpo = t?.puesto
      ? `<div class="pb-clas-tu"><span class="pb-pos">${t.puesto}</span><b>Tú</b><small class="pb-tenue">${t.faltan ? `${t.faltan} XP para pasar${t.pasarA ? ` a ${escapeHtml(t.pasarA)}` : ' al de delante'}` : ''}</small><span class="pb-xp">${t.xp}</span></div>`
      : `<p class="pb-vacio">${periodo === 'mes' ? 'Este mes' : 'Esta semana'} todavía no ha puntuado nadie. <a href="/retos">Juega un reto</a> y estrénala.</p>`
    return `${cabecera('Clasificación', pestanas)}<p class="pb-tenue pb-clas-sub">${sub}</p>${cuerpo}`
  }
  const podio = [r[1], r[0], r[2]]
    .map((x, i) => (x ? `<div class="pb-podio-${[2, 1, 3][i]}">${[2, 1, 3][i] === 1 ? `<span class="pb-corona" aria-hidden="true">${ic('crown', 18)}</span>` : ''}${caraHtml(x, [2, 1, 3][i] === 1 ? 56 : 46)}<b>${x.tu ? 'Tú' : escapeHtml(nombre(x))}</b><small>${x.xp} XP</small><span class="pb-podio-caja">${x.puesto}</span></div>` : '<div></div>'))
    .join('')
  const fila = (x) => `<li class="${x.tu ? 'tu' : ''}"><span class="pb-pos">${x.puesto}</span>${caraHtml(x, 28)}<b>${x.tu ? 'Tú' : escapeHtml(nombre(x))}</b><span class="pb-xp">${x.xp}</span></li>`
  const t = d.tu
  const enLista = r.slice(0, 5).some((x) => x.tu)
  const tuHtml = t && !enLista
    ? `<div class="pb-clas-tu"><span class="pb-pos">${t.puesto}</span><b>Tú</b><small class="pb-tenue">${t.faltan ? `${t.faltan} XP para pasar${t.pasarA ? ` a ${escapeHtml(t.pasarA)}` : ' al de delante'}` : ''}</small><span class="pb-xp">${t.xp}</span></div>`
    : conSesion && !t
      ? `<p class="pb-clas-invita">${periodo === 'mes' ? 'Este mes' : 'Esta semana'} todavía no puntúas — <a href="/retos">juega un reto</a></p>`
      : ''
  return `${cabecera('Clasificación', pestanas)}
    <p class="pb-tenue pb-clas-sub">${sub}</p>
    <div class="pb-podio">${podio}</div>
    ${r.length > 3 ? `<ol class="pb-clas-lista">${r.slice(3, 5).map(fila).join('')}</ol>` : ''}
    ${tuHtml}`
}

// La pinta /retos dentro de «Tu historial» (la caja es `#rtLiga`), que es
// adonde llevan los «Ver la clasificación». Devuelve false si no se ha
// podido preguntar.
export async function montarClasificacion(caja, session) {
  if (!caja) return false
  const cache = {}
  const pedir = async (periodo) => {
    if (!cache[periodo]) {
      const { data, error } = await supabase.rpc('portada_clasificacion', { p_periodo: periodo })
      if (error) throw error
      cache[periodo] = data
    }
    return cache[periodo]
  }
  let datos
  try {
    datos = await pedir('semana')
  } catch {
    // Sin la migración, ni semana ni mes: no se sabe, y no se dice «nadie».
    return false
  }
  let periodo = 'semana'
  await hoja
  caja.innerHTML = clasificacionHtml(datos, { periodo, conSesion: Boolean(session) })
  caja.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-periodo]')
    if (!b || b.dataset.periodo === periodo) return
    periodo = b.dataset.periodo
    try {
      const d = await pedir(periodo)
      if (periodo !== b.dataset.periodo) return
      caja.innerHTML = clasificacionHtml(d, { periodo, conSesion: Boolean(session) })
      caja.querySelector(`[data-periodo="${periodo}"]`)?.focus()
    } catch {}
  })
  return true
}
