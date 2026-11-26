// PARA CARDMARKET, la pantalla (tanda 1459). Lo puro —el formato de la lista
// y el CSV— vive en cardmarket-wants.js; aquí la hoja, la base y TCGdex.
//
// Desde el ⋯ de «La quiero»: lo que buscas, como lista para pegar en tus
// Wants de Cardmarket, y, si quieres, lo que te falta de las expansiones que
// elijas (Ibai: «las faltantes de mis colecciones»; tú eliges cuáles, que
// «todas las empezadas» no siempre es lo que alguien está completando).
// Desde el ⋯ de «Las que doy»: un CSV con el id de Cardmarket de cada una.
//
// Los ataques en inglés: los guardados si la ficha está en inglés y, si no,
// los de TCGdex en inglés, de cuarenta en cuarenta en UNA consulta GraphQL
// (el catálogo es comunitario y gratis: nada de una petición por carta).
import { supabase } from '../supabase.js'
import { escapeHtml } from '../html.js'
import { showToast } from '../toast.js'
import { nombreDeCarta } from '../catalogo-series.js'
import { enlaceCardmarket } from '../cardmarket.js'
import * as datos from './datos.js'
import { textoDeWants, datosEnIngles, faltaPreguntar, idDeTcgdex, consultaDeTcgdex, csvDeLoQueDoy } from './cardmarket-wants.js'

const $ = (id) => document.getElementById(id)
const TCGDEX_GRAPHQL = 'https://api.tcgdex.net/v2/graphql'

// Lo que hace falta de cada carta para escribirla en inglés.
async function fichas(ids, mercado) {
  const mapa = new Map()
  const unicos = [...new Set(ids.filter(Boolean))]
  for (let i = 0; i < unicos.length; i += 150) {
    const { data, error } = await supabase
      .from('tcg_cards')
      .select('id,market,set_id,local_id,name,name_en,name_es,category,attacks,abilities,detalle_lang,cm_id_product_propio,tcg_sets(name,name_en)')
      .eq('market', mercado)
      .in('id', unicos.slice(i, i + 150))
    if (error) throw new Error('No se han podido leer las cartas.')
    for (const c of data || []) mapa.set(c.id, c)
  }
  return mapa
}

// TCGdex en inglés, de cuarenta en cuarenta. Lo que no conteste se queda sin.
async function enIngles(ids, alAvanzar = () => {}) {
  const out = new Map()
  for (let i = 0; i < ids.length; i += 40) {
    const trozo = ids.slice(i, i + 40)
    try {
      const r = await fetch(TCGDEX_GRAPHQL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: consultaDeTcgdex(trozo) }) })
      const j = r.ok ? await r.json() : null
      trozo.forEach((id, k) => {
        const c = j?.data?.[`c${k}`]
        if (c) out.set(id, c)
      })
    } catch {
      // Sin respuesta: esas cartas saldrán en «a mano».
    }
    alAvanzar(Math.min(i + 40, ids.length), ids.length)
  }
  return out
}

// ── La hoja ──
function hoja() {
  let d = $('mcCmHoja')
  if (d) return d
  d = document.createElement('dialog')
  d.id = 'mcCmHoja'
  d.className = 'mc-listas-hoja'
  d.setAttribute('aria-labelledby', 'mcCmTitulo')
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-cm-cerrar]')) d.close()
  })
  document.body.append(d)
  return d
}

// Las expansiones que tienes empezadas, con cuántas tienes de cuántas.
function setsEmpezados(ctx) {
  const porSet = new Map()
  for (const l of ctx.lineasDeTodas() || []) {
    if ((l.market || 'WEST') !== 'WEST') continue
    const c = ctx.cartaDeDoy(l)
    const s = c?.tcg_sets
    if (!c?.set_id || !s) continue
    if (!porSet.has(c.set_id)) porSet.set(c.set_id, { id: c.set_id, nombre: s.name || s.name_en || c.set_id, total: s.card_count_total || s.card_count_official || null, fecha: s.release_date || '', tengo: new Set() })
    porSet.get(c.set_id).tengo.add(c.id)
  }
  return [...porSet.values()].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
}

// «La quiero» (o la lista abierta) y lo que falta de las expansiones elegidas.
export async function abrirLaQuiero(ctx, { lista = null, cartasDeLista = null } = {}) {
  const d = hoja()
  const deseos = (Array.isArray(ctx.deseos) ? ctx.deseos : []).filter((x) => !x.provisional && (!cartasDeLista || cartasDeLista.has(`${x.card_id}|WEST`)))
  const idsQuiero = [...new Set(deseos.map((x) => x.card_id))]
  const sets = setsEmpezados(ctx)
  const tituloQuiero = lista ? `La lista «${escapeHtml(lista.nombre)}»` : 'Lo que tienes en «La quiero»'
  d.innerHTML = `<div class="mc-listas-cab"><h2 id="mcCmTitulo">Para tus Wants de Cardmarket</h2><button type="button" class="mc-listas-cerrar" data-cm-cerrar aria-label="Cerrar">✕</button></div>
    <div class="mc-listas-cuerpo mc-cm-cuerpo">
      <p class="subtext">Una lista para pegar en una lista de deseos de Cardmarket: una carta por línea, con su nombre y sus ataques en inglés, que es como Cardmarket la reconoce.</p>
      <label class="mc-imp-check"><input type="checkbox" id="mcCmQuiero"${idsQuiero.length ? ' checked' : ' disabled'} /> ${tituloQuiero} (${idsQuiero.length} ${idsQuiero.length === 1 ? 'carta' : 'cartas'})</label>
      ${sets.length ? `<p class="mc-imp-titulo">Y lo que te falta de estas expansiones <button type="button" class="link-btn" data-cm-todas>Todas</button> · <button type="button" class="link-btn" data-cm-ninguna>Ninguna</button></p>
      <ul class="mc-cm-sets">${sets.map((s) => `<li><label class="mc-imp-check"><input type="checkbox" data-cm-set="${escapeHtml(s.id)}" /> ${escapeHtml(s.nombre)} <small class="subtext">tienes ${s.tengo.size}${s.total ? ` de ${s.total}` : ''}</small></label></li>`).join('')}</ul>` : ''}
      <div class="mc-imagen-botones"><button type="button" class="btn-primary" id="mcCmPreparar">Preparar la lista</button></div>
      <p class="mc-nota" id="mcCmEstado" role="status"></p>
      <div id="mcCmResultado"></div>
    </div>`
  d.querySelector('[data-cm-todas]')?.addEventListener('click', () => d.querySelectorAll('[data-cm-set]').forEach((x) => { x.checked = true }))
  d.querySelector('[data-cm-ninguna]')?.addEventListener('click', () => d.querySelectorAll('[data-cm-set]').forEach((x) => { x.checked = false }))
  $('mcCmPreparar').addEventListener('click', () => preparar(ctx, { idsQuiero, sets }).catch((err) => { $('mcCmEstado').textContent = err.message || 'No se ha podido preparar.' }))
  if (!d.open) d.showModal()
}

async function preparar(ctx, { idsQuiero, sets }) {
  const estado = $('mcCmEstado')
  const boton = $('mcCmPreparar')
  boton.disabled = true
  try {
    const ids = $('mcCmQuiero')?.checked ? [...idsQuiero] : []
    const elegidos = [...document.querySelectorAll('#mcCmHoja [data-cm-set]:checked')].map((x) => x.dataset.cmSet)
    for (const setId of elegidos) {
      estado.textContent = 'Mirando lo que te falta…'
      const s = sets.find((x) => x.id === setId)
      const suyas = await datos.cartasDeSet(setId, 'WEST')
      for (const c of suyas) if (!s?.tengo.has(c.id)) ids.push(c.id)
    }
    const unicos = [...new Set(ids)]
    if (!unicos.length) {
      estado.textContent = 'No hay nada que poner: marca «La quiero» o alguna expansión.'
      return
    }
    estado.textContent = `Leyendo ${unicos.length} cartas…`
    const mapa = await fichas(unicos, 'WEST')
    const preguntar = unicos.map((id) => mapa.get(id)).filter(faltaPreguntar).map((c) => idDeTcgdex(c.id))
    const ingles = preguntar.length ? await enIngles(preguntar, (n, t) => { estado.textContent = `Buscando los ataques en inglés… ${n} de ${t}` }) : new Map()
    const filas = unicos.map((id) => {
      const c = mapa.get(id)
      const en = datosEnIngles(c, ingles.get(id))
      return { card_id: id, carta: c, cantidad: 1, nombre: en?.nombre || null, ataques: en?.ataques || [], pokemon: en?.pokemon ?? true }
    })
    const { texto, lineas, sinDatos } = textoDeWants(filas)
    estado.textContent = ''
    $('mcCmResultado').innerHTML = `
      ${lineas ? `<p class="mc-imp-titulo">${lineas} ${lineas === 1 ? 'carta' : 'cartas'} para pegar</p>
      <textarea class="mc-cm-texto" id="mcCmTexto" readonly>${escapeHtml(texto)}</textarea>
      <div class="mc-imagen-botones"><button type="button" class="btn-primary" id="mcCmCopiar">Copiar la lista</button></div>
      <p class="mc-nota">En Cardmarket, abre tus listas de deseos (Wants), crea una y pega esto en el cuadro para añadir una lista de cartas. Lo que no reconozca te lo dice al añadirla.</p>` : ''}
      ${sinDatos.length ? `<p class="mc-imp-titulo">${sinDatos.length} ${sinDatos.length === 1 ? 'no se puede' : 'no se pueden'} preparar: añádelas a mano</p>
      <p class="subtext">Para un Pokémon, Cardmarket pide el nombre y los ataques en inglés, y de ${sinDatos.length === 1 ? 'esta' : 'estas'} no los tenemos (suelen ser cartas recién salidas).</p>
      <ul class="mc-cm-faltan">${sinDatos.slice(0, 80).map((f) => {
        const c = f.carta
        const href = enlaceCardmarket({ idProduct: c?.cm_id_product_propio || null, nombre: c?.name_en || c?.name || '' })
        return `<li><span>${escapeHtml(c ? nombreDeCarta(c) : f.card_id)} <small class="subtext">${escapeHtml([c?.tcg_sets?.name, c?.local_id].filter(Boolean).join(' · '))}</small></span> <a href="${escapeHtml(href)}" target="_blank" rel="noopener">En Cardmarket</a></li>`
      }).join('')}${sinDatos.length > 80 ? `<li class="subtext">…y ${sinDatos.length - 80} más</li>` : ''}</ul>` : ''}`
    $('mcCmCopiar')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(texto)
        showToast('Lista copiada: pégala en Cardmarket.', 'success')
      } catch {
        $('mcCmTexto')?.select()
        showToast('Selecciona el texto y cópialo.', 'info')
      }
    })
  } finally {
    boton.disabled = false
  }
}

// «Las que doy» como CSV con el id de Cardmarket de cada una.
export function descargarLoQueDoy(ctx) {
  const filas = (ctx.loQueDoy() || []).map((l) => ({ linea: l, carta: ctx.cartaDeDoy(l) })).filter((f) => f.carta)
  if (!filas.length) return showToast('Marca primero lo que das.', 'info')
  const csv = csvDeLoQueDoy(filas)
  const sinId = filas.filter((f) => !f.carta.cm_id_product_propio).length
  // El BOM es para Excel: sin él abre las tildes como basura.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'las-que-doy-cardmarket.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  showToast(`${filas.length} ${filas.length === 1 ? 'carta' : 'cartas'} en el CSV${sinId ? ` (${sinId} sin id de Cardmarket: van con su nombre, expansión y número)` : ''}.`, 'success')
}
