// ── Los idiomas de un set y las versiones de cada idioma, a mano (956) ──
//
// Sergio.M en el foro: «Undaunted, quitar portugués»; «Stormfront nunca
// salió en Reverse español». Los idiomas los calcula la base (911) y aquí se
// corrigen encima; las versiones de un idioma no existían. Lo escriben
// `catalogo_idioma_de_set` y `catalogo_version_de_idioma`
// (supabase-migration-956). Entra por `import()` desde el editor de un set:
// lo usa el admin y poco.
import { supabase } from '../../js/supabase.js'
import { escapeHtml } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { banderaHtml } from '../../js/precio-vista.js'
import { nombreDeSet } from '../../js/catalogo-series.js'
import { faltaLaMigracion } from './catalogo-puro.js'
import { estadoDeIdiomas, idiomasParaPoner, versionesDelSet, salio, versionesDeUnaCarta, casillaDeCarta, alTocarCasilla, AVISO_956 } from './idiomas-set-puro.js'

const $ = (id) => document.getElementById(id)
const AVISO_958 = 'Falta ejecutar supabase-migration-958-versiones-por-idioma-de-una-carta.sql en el SQL Editor.'
const ROTULO = { auto: 'lo dicen Cardmarket o TCGdex · tócalo para quitarlo', quitado: 'quitado a mano · tócalo para devolverlo', puesto: 'puesto a mano · tócalo para quitarlo' }

async function leerIdiomas(set, mercado) {
  const [calc, mano] = await Promise.all([
    supabase.rpc('idiomas_de_set_calculados', { p_set: set.id, p_market: mercado }),
    supabase.from('tcg_set_idiomas_mano').select('idioma,hay').eq('set_id', set.id).eq('market', mercado),
  ])
  if (calc.error || mano.error) return { error: calc.error || mano.error }
  return { calculados: calc.data || [], mano: mano.data || [] }
}

// La sección del editor del set: los idiomas como chapas y el botón de las
// versiones por idioma. `caja` es su hueco en la hoja.
export async function pintarIdiomasDeSet({ set, mercado, caja, abrirVersiones }) {
  if (!caja) return
  caja.innerHTML = '<p class="admin-note">Mirando en qué idiomas salió…</p>'
  const leido = await leerIdiomas(set, mercado)
  if (leido.error) {
    caja.innerHTML = `<p class="admin-note">${escapeHtml(faltaLaMigracion(leido.error) ? AVISO_956 : `No se han podido leer los idiomas: ${leido.error.message}`)}</p>`
    return
  }
  let { calculados, mano } = leido
  const pintar = () => {
    const estado = estadoDeIdiomas(calculados, mano)
    const poner = idiomasParaPoner(estado)
    caja.innerHTML = `
      <span class="lote-rotulo">Idiomas en los que salió</span>
      <div class="idi-fila">${estado.map((i) => `<button type="button" class="idi-chapa idi-${i.estado}" data-idioma-set="${escapeHtml(i.id)}" title="${escapeHtml(`${i.nombre}: ${ROTULO[i.estado]}`)}" aria-label="${escapeHtml(`${i.nombre}, ${ROTULO[i.estado]}`)}">${banderaHtml(i.id)}<span>${escapeHtml(i.id.toUpperCase())}</span></button>`).join('') || '<span class="admin-note">Nadie dice nada todavía.</span>'}
        ${poner.length ? `<select id="idiPoner" aria-label="Añadir un idioma"><option value="">+ Añadir idioma</option>${poner.map((i) => `<option value="${escapeHtml(i.id)}">${escapeHtml(i.nombre)}</option>`).join('')}</select>` : ''}
      </div>
      <p class="admin-note">Azul: lo dicen Cardmarket o TCGdex. Tachado: lo has quitado tú. Verde: lo has puesto tú. Lo quitado deja de ofrecerse al añadir una carta de este set.</p>
      <p><button type="button" class="btn-secondary btn-small" id="idiVersiones">Versiones por idioma →</button></p>`
    caja.querySelectorAll('[data-idioma-set]').forEach((b) => b.addEventListener('click', () => {
      const i = estado.find((x) => x.id === b.dataset.idiomaSet)
      if (i) void cambiar(i.id, i.alTocar)
    }))
    $('idiPoner')?.addEventListener('change', (e) => { if (e.target.value) void cambiar(e.target.value, true) })
    $('idiVersiones')?.addEventListener('click', () => abrirVersiones())
  }
  // Cambia YA y deshace si la base dice que no (896).
  const cambiar = async (idioma, hay) => {
    const antes = mano
    mano = [...mano.filter((f) => f.idioma !== idioma), ...(hay === null ? [] : [{ idioma, hay }])]
    pintar()
    const { error } = await supabase.rpc('catalogo_idioma_de_set', { p_set: set.id, p_market: mercado, p_idioma: idioma, p_hay: hay })
    if (error) {
      mano = antes
      pintar()
      showToast(faltaLaMigracion(error) ? AVISO_956 : error.message.slice(0, 140), 'error')
    }
  }
  pintar()
}

// Las cartas del set con sus versiones, a trozos (la 808).
async function cartasDelSet(set, mercado) {
  const cartas = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from('tcg_cards').select('id,set_id,market,local_id,name,name_en,rarity,rarity_en,variants,category,tcg_sets(release_date,serie_id)')
      .eq('set_id', set.id).eq('market', mercado).order('id').range(desde, desde + 999)
    if (error) return null
    cartas.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  const porId = new Map(cartas.map((c) => [c.id, c]))
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from('tcg_card_versions').select('card_id,etiqueta,origen,clase')
      .eq('set_id', set.id).eq('market', mercado).order('tcggo_id').range(desde, desde + 999)
    if (error) break
    for (const f of data || []) { const c = porId.get(f.card_id); if (c) (c.versiones ||= []).push(f) }
    if (!data || data.length < 1000) break
  }
  for (const c of cartas) c.versiones ||= []
  return cartas
}

// La matriz: una fila por versión del set, una columna por idioma en que
// salió. Un toque cambia ✓ por ✕ y se guarda en el momento. Debajo, la de una
// carta suelta (958).
export async function abrirVersionesPorIdioma({ set, mercado, hoja, volver }) {
  hoja.abrir('<p class="admin-note">Mirando las versiones del set…</p>')
  const [cartas, idiomas, filasR] = await Promise.all([
    cartasDelSet(set, mercado),
    supabase.rpc('idiomas_de_set', { p_set: set.id, p_market: mercado }),
    // `*`: antes de la 958 no hay `card_id` y nombrarlo tumbaría la consulta.
    supabase.from('tcg_version_idioma').select('*').eq('set_id', set.id).eq('market', mercado),
  ])
  if (filasR.error) {
    hoja.abrir(`<p class="admin-note">${escapeHtml(faltaLaMigracion(filasR.error) ? AVISO_956 : filasR.error.message)}</p><p><button class="btn-secondary btn-small" id="vpiVolver">← Colección</button></p>`)
    $('vpiVolver').addEventListener('click', () => volver())
    return
  }
  let filas = filasR.data || []
  const versiones = versionesDelSet(cartas || [], filas.filter((f) => !f.card_id))
  const lenguas = (idiomas.data || [])
  let cartaId = ''
  const porCarta = () => {
    const carta = (cartas || []).find((c) => c.id === cartaId)
    if (!carta) return ''
    return `<div class="vpi-caja"><table class="vpi-matriz">
      <thead><tr><th scope="col">Versión</th>${lenguas.map((l) => `<th scope="col">${banderaHtml(l)} ${escapeHtml(l.toUpperCase())}</th>`).join('')}</tr></thead>
      <tbody>${versionesDeUnaCarta(carta, filas).map((v) => `<tr><th scope="row">${escapeHtml(v.nombre)}</th>${lenguas.map((l) => {
        const { si, propia } = casillaDeCarta(carta, filas, v.id, l)
        return `<td><button type="button" class="vpi-celda ${si ? 'vpi-si' : 'vpi-no'}${propia ? ' vpi-propia' : ''}" data-vpc-v="${escapeHtml(v.id)}" data-vpc-l="${escapeHtml(l)}" aria-pressed="${si ? 'true' : 'false'}" aria-label="${escapeHtml(`${v.nombre} en ${l.toUpperCase()}: ${si ? 'existe' : 'no existe'}${propia ? ', puesto en esta carta' : ''}`)}">${si ? '✓' : '✕'}</button></td>`
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>`
  }
  const conPropias = new Set(filas.filter((f) => f.card_id).map((f) => f.card_id))
  const pintar = () => {
    hoja.abrir(`
      <div class="cat-cab">
        <button class="btn-secondary btn-small" id="vpiVolver">← Colección</button>
        <h3>Versiones por idioma · ${escapeHtml(nombreDeSet(set) || set.id)}</h3>
      </div>
      <p class="admin-note">Marca con ✕ la versión que NO salió en un idioma (la Reverse de Stormfront en español). Vale para el set entero y se guarda al tocar. Las columnas son los idiomas en que salió el set.</p>
      ${!cartas ? '<p class="admin-note"><strong>No se han podido leer las cartas del set: solo salen las versiones que ya tienen algo puesto.</strong></p>' : ''}
      ${!lenguas.length ? '<p class="admin-note">No se sabe en qué idiomas salió el set: ponlos primero en la colección.</p>' : ''}
      <div class="vpi-caja"><table class="vpi-matriz">
        <thead><tr><th scope="col">Versión</th>${lenguas.map((l) => `<th scope="col">${banderaHtml(l)} ${escapeHtml(l.toUpperCase())}</th>`).join('')}</tr></thead>
        <tbody>${versiones.map((v) => `<tr><th scope="row">${escapeHtml(v.nombre)}</th>${lenguas.map((l) => {
          const si = salio(filas, v.id, l)
          return `<td><button type="button" class="vpi-celda ${si ? 'vpi-si' : 'vpi-no'}" data-vpi-v="${escapeHtml(v.id)}" data-vpi-l="${escapeHtml(l)}" aria-pressed="${si ? 'false' : 'true'}" aria-label="${escapeHtml(`${v.nombre} en ${l.toUpperCase()}: ${si ? 'salió' : 'no salió'}`)}">${si ? '✓' : '✕'}</button></td>`
        }).join('')}</tr>`).join('')}</tbody>
      </table></div>
      ${cartas?.length && lenguas.length ? `<h4>Una carta con sus propias versiones</h4>
      <p class="admin-note">Para la que no sigue al set: el Duskull SH2 es Holo en español y Reverse en los demás. Aquí salen todas las versiones, también las que la carta no trae: un ✓ en una que no trae la pone en ese idioma. Con borde, lo puesto en esta carta; tocarlo otra vez lo devuelve a lo del set. Si en un idioma quitas todas, se ofrecen todas: pon primero la que sí.</p>
      <select id="vpiCarta" aria-label="Elegir una carta"><option value="">Elige una carta…</option>${[...cartas].sort((a, b) => Number(conPropias.has(b.id)) - Number(conPropias.has(a.id))).map((c) => `<option value="${escapeHtml(c.id)}"${c.id === cartaId ? ' selected' : ''}>${conPropias.has(c.id) ? '• ' : ''}${escapeHtml([c.local_id, c.name_en || c.name].filter(Boolean).join(' · '))}</option>`).join('')}</select>
      <div id="vpiDeCarta">${porCarta()}</div>` : ''}`)
    $('vpiVolver').addEventListener('click', () => volver())
    document.querySelectorAll('[data-vpi-v]').forEach((b) => b.addEventListener('click', () => void cambiar(b.dataset.vpiV, b.dataset.vpiL)))
    $('vpiCarta')?.addEventListener('change', (e) => { cartaId = e.target.value; pintar() })
    document.querySelectorAll('[data-vpc-v]').forEach((b) => b.addEventListener('click', () => void cambiarEnCarta(b.dataset.vpcV, b.dataset.vpcL)))
  }
  // Igual que en el set: cambia YA y deshace si la base dice que no (896).
  const cambiarEnCarta = async (variante, idioma) => {
    const carta = (cartas || []).find((c) => c.id === cartaId)
    if (!carta) return
    const antes = filas
    const hay = alTocarCasilla(carta, filas, variante, idioma)
    const esa = (f) => f.card_id === carta.id && f.variante === variante && f.idioma === idioma
    filas = [...filas.filter((f) => !esa(f)), ...(hay === null ? [] : [{ card_id: carta.id, variante, idioma, hay }])]
    if (hay !== null) conPropias.add(carta.id)
    pintar()
    const { error } = await supabase.rpc('catalogo_version_de_idioma', { p_set: set.id, p_market: mercado, p_variante: variante, p_idioma: idioma, p_hay: hay, p_carta: carta.id })
    if (error) {
      filas = antes
      pintar()
      showToast(faltaLaMigracion(error) || /p_carta|function/i.test(error.message || '') ? AVISO_958 : error.message.slice(0, 140), 'error')
    }
  }
  const cambiar = async (variante, idioma) => {
    const antes = filas
    const ahoraSalio = !salio(filas, variante, idioma)
    filas = [...filas.filter((f) => f.card_id || !(f.variante === variante && f.idioma === idioma)), ...(ahoraSalio ? [] : [{ variante, idioma, hay: false }])]
    pintar()
    const { error } = await supabase.rpc('catalogo_version_de_idioma', { p_set: set.id, p_market: mercado, p_variante: variante, p_idioma: idioma, p_hay: ahoraSalio })
    if (error) {
      filas = antes
      pintar()
      showToast(faltaLaMigracion(error) ? AVISO_956 : error.message.slice(0, 140), 'error')
    }
  }
  pintar()
}
