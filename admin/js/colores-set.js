// ── «Corregir color» de Tus colores (tanda 1419) ──
//
// PINGU eligió lo recomendado de «Tus colores, bien»: el color de cada
// ilustración lo calcula el servidor (`colores-cartas`, con la foto grande) y,
// si sale mal, el equipo lo corrige AQUÍ y vale para todo el mundo. Se entra
// desde las cartas de una colección (botón «Colores»): sus ilustraciones
// (las mismas que entran en Tus colores: `entraEnColores`), cada una con su
// foto, la barra de sus tres colores y un desplegable con el grupo. Elegir
// «Automático» quita la corrección.
//
// «Calcular ahora» lanza `colores-cartas-ahora` para esta colección (las que
// aún no tienen color), sin esperar a la pasada de cada hora.
import { supabase } from '../../js/supabase.js'
import { escapeHtml, getSession } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../../js/escaneo-carta.js'
import { entraEnColores, GRUPOS, hexDe, fondoDeGrupo, hexDeColores } from '../../js/mi-coleccion/color-de-carta.js'

const NOMBRE = { rojo: 'Rojo', naranja: 'Naranja', amarillo: 'Amarillo', verde: 'Verde', turquesa: 'Turquesa', celeste: 'Celeste', azul: 'Azul', morado: 'Morado', rosa: 'Rosa', 'marrón': 'Marrón', multicolor: 'Multicolor', claras: 'Claras', oscuras: 'Oscuras' }
const $ = (id) => document.getElementById(id)
const AVISO_MIGRACION = 'Falta ejecutar supabase-migration-1419-colores-de-cartas.sql en el SQL Editor.'
const faltaLaMigracion = (e) => /tcg_card_colores|admin_color_corregir|42P01|PGRST20[25]/.test(`${e?.code || ''} ${e?.message || ''}`)

// Lo que se enseña de una carta. Puro, para la prueba.
export function estadoDeCarta(fila) {
  const auto = fila?.huella?.colores?.color || fila?.color || null
  return { auto, corregido: fila?.color_admin || null, manda: fila?.color_admin || auto, leida: !!fila?.huella, intentos: fila?.intentos || 0 }
}

let ctx = null
let filas = new Map()

async function cargar() {
  const ids = ctx.ilustraciones.map((c) => c.id)
  filas = new Map()
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase.from('tcg_card_colores').select('card_id,huella,color,color_admin,intentos').eq('market', ctx.mercado).in('card_id', ids.slice(i, i + 150))
    if (error) { ctx.error = faltaLaMigracion(error) ? AVISO_MIGRACION : error.message.slice(0, 140); return }
    for (const f of data || []) filas.set(f.card_id, f)
  }
  ctx.error = null
}

function tarjetaHtml(c) {
  const e = estadoDeCarta(filas.get(c.id))
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c)) || ''
  const pal = filas.get(c.id)?.huella?.colores?.paleta || []
  const total = pal.reduce((s, p) => s + p.s, 0) || 1
  const muestra = e.manda ? fondoDeGrupo(e.manda, hexDeColores(filas.get(c.id)?.huella?.colores)) : 'transparent'
  return `<li class="colset-carta${e.corregido ? ' colset-corregida' : ''}" data-carta="${escapeHtml(c.id)}">
    <span class="colset-foto">${escaneo ? `<img ${escaneo} alt="" loading="lazy" width="245" height="342">` : ''}</span>
    <i class="colset-barra" aria-hidden="true">${pal.map((p) => `<b style="flex:${(p.s / total).toFixed(3)} 1 0;background:${hexDe(p.lab)}"></b>`).join('')}</i>
    <span class="colset-nombre"><i style="background:${muestra}" aria-hidden="true"></i>${escapeHtml(c.local_id)} · ${escapeHtml(c.name_es || c.name || c.id)}</span>
    <select data-color-de="${escapeHtml(c.id)}" aria-label="${escapeHtml(`Grupo de color de ${c.name || c.id}`)}">
      <option value="">${e.auto ? `Auto · ${NOMBRE[e.auto] || e.auto}` : e.leida ? 'Auto' : e.intentos >= 3 ? 'Sin foto legible' : 'Sin calcular'}</option>
      ${GRUPOS.map((g) => `<option value="${g}"${e.corregido === g ? ' selected' : ''}>${NOMBRE[g]}</option>`).join('')}
    </select>
  </li>`
}

function pintar() {
  const leidas = ctx.ilustraciones.filter((c) => filas.get(c.id)?.huella).length
  const corregidas = ctx.ilustraciones.filter((c) => filas.get(c.id)?.color_admin).length
  // Por grupo, como en Tus colores: así se ve de un vistazo la que desentona.
  const orden = (c) => { const g = estadoDeCarta(filas.get(c.id)).manda; return g ? GRUPOS.indexOf(g) : GRUPOS.length }
  const lista = [...ctx.ilustraciones].sort((a, b) => orden(a) - orden(b))
  ctx.hoja.abrir(`
    <div class="cat-cab">
      <button class="btn-secondary btn-small" id="colsetVolver">← Cartas</button>
      <h3>Colores · ${escapeHtml(ctx.set.name_en || ctx.set.name || ctx.set.id)}</h3>
    </div>
    <p class="admin-note">${ctx.error ? escapeHtml(ctx.error) : `${ctx.ilustraciones.length} ilustraciones · ${leidas} con color calculado${corregidas ? ` · ${corregidas} ${corregidas === 1 ? 'corregida' : 'corregidas'} a mano` : ''}. Si una sale en un grupo que no es, elige el suyo: vale para Tus colores de todo el mundo.`}</p>
    <div class="cat-barra">
      <button class="btn-primary btn-small" id="colsetCalcular"${ctx.error ? ' disabled' : ''}>Calcular ahora las que faltan</button>
      <span class="admin-note" id="colsetEstado" role="status"></span>
    </div>
    <ul class="colset-lista">${lista.map(tarjetaHtml).join('') || '<li class="empty-state">Esta colección no tiene ilustraciones (IR, SIR, full art…).</li>'}</ul>`)
  $('colsetVolver').addEventListener('click', () => ctx.volver())
  $('colsetCalcular').addEventListener('click', calcular)
  document.querySelectorAll('[data-color-de]').forEach((sel) => sel.addEventListener('change', () => corregir(sel.dataset.colorDe, sel.value || null)))
}

async function corregir(id, color) {
  const { error } = await supabase.rpc('admin_color_corregir', { p_card: id, p_market: ctx.mercado, p_color: color })
  if (error) return showToast(faltaLaMigracion(error) ? AVISO_MIGRACION : error.message.slice(0, 140), 'error')
  const f = filas.get(id) || { card_id: id }
  filas.set(id, { ...f, color_admin: color })
  showToast(color ? `Corregida: ${NOMBRE[color]}` : 'Corrección quitada: vuelve la automática', 'success')
  const li = document.querySelector(`.colset-carta[data-carta="${CSS.escape(id)}"]`)
  if (li) li.outerHTML = tarjetaHtml(ctx.ilustraciones.find((c) => c.id === id))
  document.querySelector(`[data-color-de="${CSS.escape(id)}"]`)?.addEventListener('change', (e) => corregir(id, e.target.value || null))
}

async function calcular() {
  const b = $('colsetCalcular')
  const estado = $('colsetEstado')
  b.disabled = true
  try {
    const session = await getSession()
    // Hasta que no quede ninguna o la pasada no avance (20 s por llamada).
    for (let vuelta = 0; vuelta < 10; vuelta++) {
      estado.textContent = vuelta ? `Mirando fotos… (${vuelta + 1})` : 'Mirando fotos…'
      const res = await fetch('/.netlify/functions/colores-cartas-ahora', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ set: ctx.set.id, market: ctx.mercado }),
      })
      const r = await res.json().catch(() => ({ ok: false, error: `Error ${res.status}` }))
      if (!r.ok || r.saltado) { showToast(r.saltado || r.error || 'No se ha podido calcular.', 'error'); break }
      if (!r.quedan || !(r.leidas + r.fallidas)) { showToast(`Hecho: ${r.leidas} leídas${r.fallidas ? `, ${r.fallidas} sin foto legible` : ''}.`, 'success'); break }
    }
  } catch (e) {
    showToast(String(e?.message || e).slice(0, 140), 'error')
  }
  await cargar()
  pintar()
}

export async function abrirColoresDeSet({ set, mercado, cartas, hoja, volver }) {
  ctx = { set, mercado, hoja, volver, ilustraciones: (cartas || []).filter(entraEnColores), error: null }
  hoja.abrir('<p class="admin-note">Cargando los colores…</p>')
  await cargar()
  pintar()
}
