// ── «Una versión a varias»: la misma versión a mano a muchas cartas (tanda 999) ──
//
// PINGU: «estoy añadiendo Cosmos Holo a cartas de sets que tuvieron una promo
// Cosmos» — carta a carta, rellenando lo mismo cada vez. Aquí se escribe la
// versión una vez y se marcan las cartas (tocándolas o pegando sus números).
// Cada una se crea con `catalogo_version_mano` (la 934), como el formulario de
// una carta: nace `origen = 'mano'`, así que ninguna pasada la pisa, y no es
// una EDICIÓN (eso hace «Versiones de todas», la 949, y en un set moderno le
// quitaría a la carta su Holo y su Normal). Se entra desde la lista de cartas
// del set (`catalogo-cartas.js`), por `import()`.
import { supabase } from '../../js/supabase.js'
import { escapeHtml } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../../js/escaneo-carta.js'
import { iconoDeVersion } from '../../js/mi-coleccion/iconos-version.js'
import { avisarALaWeb } from './avisar-web.js'
import { CLASES_DE_VERSION, numerosDeTexto, cartasDeNumeros, idDeVersion, problemaDelNombre, planDeVarias, datosDeVersion, AVISO_934 } from './version-varias-puro.js'

const $ = (id) => document.getElementById(id)
const falta934 = (error) => /catalogo_version_mano|catalogo_borrar_version_mano|PGRST202|42883/.test(`${error?.code} ${error?.message}`)

// Las versiones que ya lleva cada carta del set (de cualquier origen): card_id
// → ids como los guarda la base. A trozos: la 808.
async function versionesDelSet(set, mercado) {
  const tiene = new Map()
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from('tcg_card_versions').select('card_id,etiqueta')
      .eq('market', mercado).eq('set_id', set.id).order('tcggo_id').range(desde, desde + 999)
    if (error) return null
    for (const f of data || []) {
      if (!tiene.has(f.card_id)) tiene.set(f.card_id, new Set())
      tiene.get(f.card_id).add(idDeVersion(f.etiqueta))
    }
    if (!data || data.length < 1000) break
  }
  return tiene
}

export async function abrirVersionVarias({ set, mercado, cartas, hoja, volver }) {
  hoja.abrir('<p class="admin-note">Mirando qué versiones tiene ya el set…</p>')
  let tiene = await versionesDelSet(set, mercado)
  const marcadas = new Set()
  let hechas = [] // los tcggo_id de la última vez, para Deshacer

  const hueco = (c) => {
    const foto = atributosDeEscaneo(cadenaDeEscaneo(c)) || ''
    return `<button type="button" class="vv-carta" data-vv-carta="${escapeHtml(c.id)}" aria-pressed="false" title="${escapeHtml(`${c.local_id} · ${c.name_es || c.name || c.id}`)}">
      <span class="vv-foto">${foto ? `<img ${foto} alt="" loading="lazy" width="63" height="88">` : ''}<span class="vv-ya" hidden>ya</span></span>
      <span class="vv-num">${escapeHtml(c.local_id)}</span>
    </button>`
  }
  hoja.abrir(`
    <div class="cat-cab">
      <button class="btn-secondary btn-small" id="vvVolver">← Cartas</button>
      <h3>Una versión a varias · ${escapeHtml(set.name_en || set.name || set.id)}</h3>
    </div>
    <p class="admin-note">La misma versión a mano (una Cosmos Holo de blíster, la holo de un mazo…) a todas las cartas que marques. La foto y el Cardmarket de cada una se ponen después, en su ficha. ${tiene ? '' : '<strong>No se ha podido leer lo que ya tiene el set: no sabré cuáles la llevan ya, y una que ya la tenga saldría dos veces.</strong>'}</p>
    <div class="vv-campos">
      <label class="cat-campo">Nombre de la versión<input type="text" id="vvNombre" maxlength="60" placeholder="Cosmos Holo" autocomplete="off"></label>
      <label class="cat-campo">Salió en <small>(opcional)</small><input type="text" id="vvSalio" maxlength="120" placeholder="Blíster de 3 sobres"></label>
      <label class="cat-campo">Clase<select id="vvClase">${CLASES_DE_VERSION.map(([k, r]) => `<option value="${k}">${escapeHtml(r)}</option>`).join('')}</select></label>
      <label class="cat-campo">Lanzamiento <small>(opcional)</small><input type="date" id="vvLanza"></label>
    </div>
    <label class="cat-campo">O pega los números <small>(4, 25, 58, 101-103)</small><input type="text" id="vvNumeros" autocomplete="off" inputmode="text"></label>
    <div class="vv-rejilla" id="vvRejilla">${cartas.map(hueco).join('') || '<p class="empty-state">Este set no tiene cartas.</p>'}</div>
    <p class="admin-note" id="vvResumen" aria-live="polite"></p>
    <div class="col-hoja-pie">
      <button class="btn-secondary" id="vvNinguna">Quitar la marca a todas</button>
      <button class="btn-secondary hidden" id="vvDeshacer">Deshacer</button>
      <span style="flex:1"></span>
      <button class="btn-primary" id="vvCrear">Crear versiones</button>
    </div>`)

  const nombre = () => $('vvNombre').value.trim()
  const elegidas = () => cartas.filter((c) => marcadas.has(c.id))
  const repintar = () => {
    const id = nombre() ? idDeVersion(nombre()) : null
    for (const b of document.querySelectorAll('[data-vv-carta]')) {
      const si = marcadas.has(b.dataset.vvCarta)
      b.setAttribute('aria-pressed', String(si))
      b.querySelector('.vv-ya').hidden = !(id && tiene?.get(b.dataset.vvCarta)?.has(id))
    }
    const problema = problemaDelNombre(nombre())
    const { crear, ya } = planDeVarias(elegidas(), nombre(), tiene || new Map())
    const boton = $('vvCrear')
    boton.disabled = Boolean(problema) || !crear.length
    boton.innerHTML = crear.length && !problema
      ? `${iconoDeVersion(idDeVersion(nombre()), 16)} Crear ${crear.length} ${crear.length === 1 ? 'versión' : 'versiones'} «${escapeHtml(nombre())}»`
      : 'Crear versiones'
    $('vvResumen').textContent = problema && marcadas.size
      ? problema
      : !marcadas.size
        ? 'Marca las cartas tocándolas o pega sus números.'
        : `${marcadas.size} ${marcadas.size === 1 ? 'carta marcada' : 'cartas marcadas'}${ya.length ? ` · ${ya.length} ya la ${ya.length === 1 ? 'tiene' : 'tienen'} (no se repite)` : ''}.`
  }

  $('vvRejilla').addEventListener('click', (e) => {
    const b = e.target.closest('[data-vv-carta]')
    if (!b) return
    const id = b.dataset.vvCarta
    if (marcadas.has(id)) marcadas.delete(id)
    else marcadas.add(id)
    repintar()
  })
  // Lo pegado MARCA (suma a lo que ya estaba): así se puede pegar una lista y
  // tocar luego la que falte.
  $('vvNumeros').addEventListener('input', () => {
    for (const c of cartasDeNumeros(cartas, numerosDeTexto($('vvNumeros').value))) marcadas.add(c.id)
    repintar()
  })
  $('vvNombre').addEventListener('input', repintar)
  $('vvNinguna').addEventListener('click', () => { marcadas.clear(); $('vvNumeros').value = ''; repintar() })
  $('vvVolver').addEventListener('click', () => volver())

  $('vvCrear').addEventListener('click', async () => {
    const { crear, ya } = planDeVarias(elegidas(), nombre(), tiene || new Map())
    if (!crear.length || problemaDelNombre(nombre())) return
    const boton = $('vvCrear')
    boton.disabled = true
    boton.textContent = `Creando 0 de ${crear.length}…`
    const datos = datosDeVersion({ etiqueta: nombre(), salio_en: $('vvSalio').value, lanzamiento: $('vvLanza').value, clase: $('vvClase').value })
    const nuevas = []
    const fallos = []
    // Una a una (como el formulario): si una falla, las demás siguen y se dice cuál.
    for (const c of crear) {
      const { data, error } = await supabase.rpc('catalogo_version_mano', { p_card_id: c.id, p_market: mercado, p_datos: datos, p_tcggo_id: null })
      if (error) {
        if (falta934(error)) { showToast(AVISO_934, 'error'); break }
        fallos.push(`${c.local_id}: ${error.message.slice(0, 80)}`)
      } else if (data?.tcggo_id != null) nuevas.push(data.tcggo_id)
      boton.textContent = `Creando ${nuevas.length + fallos.length} de ${crear.length}…`
    }
    hechas = nuevas
    if (nuevas.length) avisarALaWeb()
    showToast(`${nuevas.length} ${nuevas.length === 1 ? 'versión creada' : 'versiones creadas'}${ya.length ? ` · ${ya.length} ya la tenían` : ''}${fallos.length ? ` · ${fallos.length} fallaron: ${fallos.join(' · ')}` : ''}`, fallos.length ? 'error' : 'success')
    $('vvDeshacer').classList.toggle('hidden', !nuevas.length)
    tiene = (await versionesDelSet(set, mercado)) || tiene
    marcadas.clear()
    $('vvNumeros').value = ''
    repintar()
  })

  // Deshacer quita SOLO las que se acaban de crear esta vez.
  $('vvDeshacer').addEventListener('click', async () => {
    if (!hechas.length) return
    const b = $('vvDeshacer')
    b.disabled = true
    let quitadas = 0
    for (const id of hechas) {
      const { error } = await supabase.rpc('catalogo_borrar_version_mano', { p_tcggo_id: id })
      if (!error) quitadas++
    }
    showToast(`${quitadas} ${quitadas === 1 ? 'versión quitada' : 'versiones quitadas'}${quitadas < hechas.length ? ` · ${hechas.length - quitadas} no se han podido quitar` : ''}`, quitadas === hechas.length ? 'success' : 'error')
    hechas = []
    b.disabled = false
    b.classList.add('hidden')
    if (quitadas) avisarALaWeb()
    tiene = (await versionesDelSet(set, mercado)) || tiene
    repintar()
  })
  repintar()
  $('vvNombre').focus()
}
