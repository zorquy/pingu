// ── «Versiones de todas»: versiones a muchas cartas de un set (tanda 949) ──
//
// PINGU: «méteme en admin para poner las versiones de todas las cartas. Pero
// no son todas las cartas: hay algunas que tienen primera edición y normal,
// las japonesas muchas veces no tienen reverse… para esos momentos que me
// dicen "este tenía primera edición y unlimited", se arregla en un momento».
//
// Se entra desde la lista de cartas del set (`catalogo-cartas.js`), por
// `import()`: es una pantalla que se usa poco. Se eligen las versiones y a qué
// cartas (por rareza y por números); antes de tocar nada se dice cuántas
// filas crea, y la misma hoja las quita. Lo escribe
// `catalogo_versiones_lote` (supabase-migration-949), como filas de edición.
import { supabase } from '../../js/supabase.js'
import { escapeHtml } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { iconoDeVersion } from '../../js/mi-coleccion/iconos-version.js'
import { varianteDeEtiqueta } from '../../js/mi-coleccion/variantes.js'
import { faltaLaMigracion } from './catalogo-puro.js'
import { VERSIONES_LOTE, rarezasDelSet, cartasDelLote, etiquetasElegidas, resumenDelLote, AVISO_LOTE } from './versiones-lote-puro.js'

const $ = (id) => document.getElementById(id)

// Las de edición que ya lleva cada carta del set: card_id → etiquetas en
// minúsculas. A trozos: un set con sus ediciones pasa de 1.000 filas (la 808).
async function edicionesDelSet(set, mercado) {
  const tiene = new Map()
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from('tcg_card_versions').select('card_id,etiqueta')
      .eq('market', mercado).eq('set_id', set.id).eq('origen', 'edicion').order('tcggo_id').range(desde, desde + 999)
    if (error) return null
    for (const f of data || []) {
      if (!tiene.has(f.card_id)) tiene.set(f.card_id, new Set())
      tiene.get(f.card_id).add(String(f.etiqueta || '').toLowerCase())
    }
    if (!data || data.length < 1000) break
  }
  return tiene
}

export async function abrirVersionesDeTodas({ set, mercado, cartas, hoja, volver }) {
  hoja.abrir('<p class="admin-note">Mirando qué versiones tiene ya el set…</p>')
  let tiene = await edicionesDelSet(set, mercado)
  const rarezas = rarezasDelSet(cartas)
  const casilla = (v) => `<label class="lote-version"><input type="checkbox" data-lote-version="${escapeHtml(v.etiqueta)}"> ${iconoDeVersion(varianteDeEtiqueta(v.etiqueta), 16)} ${escapeHtml(v.nombre)}</label>`
  hoja.abrir(`
    <div class="cat-cab">
      <button class="btn-secondary btn-small" id="loteVolver">← Cartas</button>
      <h3>Versiones de todas · ${escapeHtml(set.name_en || set.name || set.id)}</h3>
    </div>
    <p class="admin-note">Para cuando se sabe que el set entero tuvo unas versiones (por ejemplo, 1.ª edición y Unlimited). Elige cuáles y a qué cartas: antes de tocar nada te digo cuántas se crean. ${tiene ? '' : '<strong>No se ha podido leer lo que ya tiene: el resumen no sabrá cuáles están.</strong>'}</p>
    <fieldset class="lote-caja">
      <legend>Versiones</legend>
      <div class="lote-opciones">${VERSIONES_LOTE.map(casilla).join('')}</div>
      <label class="cat-campo">Otra, como la escribe TCGGO (varias, separadas por comas)<input type="text" id="loteOtra" maxlength="200" placeholder="Shadowless, Prerelease…"></label>
    </fieldset>
    <fieldset class="lote-caja">
      <legend>A qué cartas</legend>
      <div class="lote-opciones">${rarezas.map((r) => `<label class="lote-version"><input type="checkbox" data-lote-rareza="${escapeHtml(r.rareza)}" checked> ${escapeHtml(r.rareza)} <small>(${r.n})</small></label>`).join('')}</div>
      <div class="lote-rango">
        <label class="cat-campo cat-campo-medio">Desde el número<input type="number" id="loteDesde" min="0" inputmode="numeric"></label>
        <label class="cat-campo cat-campo-medio">Hasta el número<input type="number" id="loteHasta" min="0" inputmode="numeric"></label>
      </div>
    </fieldset>
    <label class="lote-version"><input type="checkbox" id="loteMover" checked> Las copias apuntadas como «Normal» u «Holo» pasan a «Unlimited» (si pones la Unlimited)</label>
    <p class="admin-note" id="loteResumen" aria-live="polite"></p>
    <div class="col-hoja-pie">
      <button class="btn-secondary" id="loteQuitar">Quitar estas versiones</button>
      <span style="flex:1"></span>
      <button class="btn-primary" id="lotePoner">Poner versiones</button>
    </div>`)

  const elegidas = () => etiquetasElegidas([...document.querySelectorAll('[data-lote-version]:checked')].map((x) => x.dataset.loteVersion), $('loteOtra').value)
  const numero = (id) => ($(id).value === '' ? null : Number($(id).value))
  const lote = () => cartasDelLote(cartas, {
    rarezas: new Set([...document.querySelectorAll('[data-lote-rareza]:checked')].map((x) => x.dataset.loteRareza)),
    desde: numero('loteDesde'),
    hasta: numero('loteHasta'),
  })
  const resumir = () => {
    const et = elegidas()
    const r = resumenDelLote(lote(), et, tiene || new Map())
    $('lotePoner').disabled = !et.length || !r.cartas || !r.nuevas
    $('loteQuitar').disabled = !et.length || !r.cartas || (tiene && !r.quitables)
    $('loteResumen').textContent = !et.length
      ? 'Elige al menos una versión.'
      : !r.cartas
        ? 'Ninguna carta entra con esos filtros.'
        : `${r.cartas} ${r.cartas === 1 ? 'carta' : 'cartas'}: se crean ${r.nuevas} ${r.nuevas === 1 ? 'versión' : 'versiones'}${r.ya ? ` (${r.ya} ya estaban)` : ''}.`
  }
  document.querySelectorAll('[data-lote-version],[data-lote-rareza]').forEach((x) => x.addEventListener('change', resumir))
  for (const id of ['loteOtra', 'loteDesde', 'loteHasta']) $(id).addEventListener('input', resumir)
  $('loteVolver').addEventListener('click', () => volver())

  const mandar = async (quitar) => {
    const et = elegidas()
    const ids = lote().map((c) => c.id)
    if (!et.length || !ids.length) return
    if (quitar && !window.confirm(`¿Quitar ${et.join(', ')} de ${ids.length} ${ids.length === 1 ? 'carta' : 'cartas'}? Las copias de la gente no se tocan.`)) return
    const boton = $(quitar ? 'loteQuitar' : 'lotePoner')
    boton.disabled = true
    const texto = boton.textContent
    boton.textContent = quitar ? 'Quitando…' : 'Poniendo…'
    const { data, error } = await supabase.rpc('catalogo_versiones_lote', { p_market: mercado, p_cartas: ids, p_etiquetas: et, p_quitar: quitar, p_mover: !quitar && $('loteMover').checked })
    boton.textContent = texto
    if (error) {
      boton.disabled = false
      return showToast(faltaLaMigracion(error) ? AVISO_LOTE : error.message.slice(0, 160), 'error')
    }
    showToast(quitar
      ? `Quitadas ${data?.quitadas ?? 0} versiones`
      : `Puestas ${data?.nuevas ?? 0} versiones en ${data?.cartas ?? ids.length} cartas${data?.copias ? ` · ${data.copias} copias a Unlimited` : ''}`, 'success')
    tiene = (await edicionesDelSet(set, mercado)) || tiene
    resumir()
  }
  $('lotePoner').addEventListener('click', () => mandar(false))
  $('loteQuitar').addEventListener('click', () => mandar(true))
  resumir()
}
