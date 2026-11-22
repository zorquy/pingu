// «QUIÉN TIENE LO QUE BUSCAS» en la ficha de un evento (tanda 1415, PINGU, de
// «Dónde va cada función»: «9, sí»). Debajo de «Quién va», solo si has dicho
// «Voy»: los que van y dan cartas de tu La quiero, y los que buscan cartas que
// tú das, cada uno con sus cartas y «Escribir». Lo cruza la base
// (`evento_cruces`, supabase-migration-1415-evento-cruces.sql) con lo que cada
// uno pone para cambio, nunca con colecciones privadas. Entra por `import()`
// desde eventos.js.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { avatarStyle, getInitial, profileUrl } from './app.js'
import { icons } from './icons.js'
import { rutaDeCarta } from './carta-ruta.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { sinMigracion } from './sin-migracion.js'

const nombre = (p) => p?.display_name || p?.username || 'Alguien'
export const CARTAS_POR_LADO = 4

// ── Lo puro ──

// La frase de cada persona: «Da 3 de tu La quiero · Busca 1 tuya».
export function chapasDe(f) {
  const out = []
  if (f.tiene_n) out.push({ clase: 'da', texto: `Da ${f.tiene_n} de tu La quiero` })
  if (f.busca_n) out.push({ clase: 'busca', texto: `Busca ${f.busca_n} ${f.busca_n === 1 ? 'tuya' : 'tuyas'}` })
  return out
}

// El resumen de arriba: cuántos dan y cuántos buscan.
export function resumenDe(filas) {
  const dan = filas.filter((f) => f.tiene_n > 0).length
  const buscan = filas.filter((f) => f.busca_n > 0).length
  const partes = []
  if (dan) partes.push(`${dan} ${dan === 1 ? 'da' : 'dan'} cartas de tu La quiero`)
  if (buscan) partes.push(`${buscan} ${buscan === 1 ? 'busca' : 'buscan'} cartas que tú das`)
  return partes.length ? `De los que van, ${partes.join(' y ')}.` : ''
}

// Los ids de carta que hay que pedir para las fotos (los primeros de cada lado).
export function idsParaFotos(filas, n = CARTAS_POR_LADO) {
  return [...new Set(filas.flatMap((f) => [...(f.tiene || []).slice(0, n), ...(f.busca || []).slice(0, n)].map((c) => c.id)))]
}

// ── La base ──

// Las filas y sus cartas, o `null` si no hay migración (y no se pinta nada).
export async function pedirCruces(eventoId) {
  const { data, error } = await supabase.rpc('evento_cruces', { p_evento: eventoId })
  if (error) {
    if (sinMigracion(error)) return null
    throw error
  }
  const filas = data || []
  const ids = idsParaFotos(filas)
  const cartas = new Map()
  if (ids.length) {
    const { data: cs } = await supabase.from('tcg_cards')
      .select('id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,image_tcggo')
      .in('id', ids.slice(0, 300))
    for (const c of cs || []) cartas.set(`${c.id}|${c.market}`, c)
  }
  return { filas, cartas }
}

// ── El dibujo ──

const cara = (p) => `<span class="ev-cara" style="width:40px;height:40px;${avatarStyle(p)}" aria-hidden="true">${p?.avatar_url ? '' : escapeHtml(getInitial(nombre(p)))}</span>`

function cartaHtml(ref, cartas) {
  const c = cartas.get(`${ref.id}|${ref.market || 'WEST'}`)
  const nom = c ? c.name_es || c.name || c.name_en || ref.id : ref.id
  const esc = c ? atributosDeEscaneo(cadenaDeEscaneo(c, null, 'low')) : ''
  return `<a class="ev-cruce-carta" href="${escapeHtml(c ? rutaDeCarta(c) : '#')}" title="${escapeHtml(nom)}">${esc ? `<img ${esc} alt="${escapeHtml(nom)}" width="245" height="342" loading="lazy" />` : `<span>${escapeHtml(nom)}</span>`}</a>`
}

function ladoHtml(lista, n, rotulo, cartas) {
  if (!n) return ''
  const mas = n - Math.min(n, CARTAS_POR_LADO)
  return `<div class="ev-cruce-lado"><small>${escapeHtml(rotulo)}</small><span class="ev-cruce-cartas">${lista.slice(0, CARTAS_POR_LADO).map((r) => cartaHtml(r, cartas)).join('')}${mas > 0 ? `<span class="ev-cruce-mas">+${mas}</span>` : ''}</span></div>`
}

export function crucesHtml(datos) {
  if (!datos) return ''
  const { filas, cartas } = datos
  const cabeza = `<h2 id="evCrucesT">${icons.arrowLeftRight(18)} Quién tiene lo que buscas</h2>`
  if (!filas.length) {
    return `<section class="ev-caja ev-cruces" id="evCruces" aria-labelledby="evCrucesT">
      ${cabeza}
      <p class="ev-cruces-vacio">De los que van, nadie da todavía cartas de tu La quiero ni busca las que das. Apunta lo que buscas y pon para cambio lo que das: esto se mira cada vez que entras.</p>
      <p class="ev-cruces-salidas"><a href="/mi-coleccion?ver=quiero">La quiero</a><a href="/mi-coleccion?ver=cambios">Las que doy</a></p>
    </section>`
  }
  return `<section class="ev-caja ev-cruces" id="evCruces" aria-labelledby="evCrucesT">
    ${cabeza}
    <p class="ev-cruces-intro">${escapeHtml(resumenDe(filas))} Quedad allí.</p>
    <ul class="ev-cruces-lista">${filas.map((f) => {
      const p = { id: f.user_id, username: f.username, display_name: f.display_name, avatar_url: f.avatar_url }
      return `<li class="ev-cruce">
        <a class="ev-cruce-quien" href="${profileUrl(p)}">${cara(p)}<span><b>${escapeHtml(nombre(p))}</b><span class="ev-cruce-chapas">${chapasDe(f).map((c) => `<span class="ev-cruce-chapa ${c.clase}">${escapeHtml(c.texto)}</span>`).join('')}</span></span></a>
        <div class="ev-cruce-lados">
          ${ladoHtml(f.tiene || [], f.tiene_n, 'Da', cartas)}
          ${ladoHtml(f.busca || [], f.busca_n, 'Busca', cartas)}
        </div>
        <a class="ev-cruce-escribir" href="/mensajes.html?with=${encodeURIComponent(f.user_id)}" aria-label="Escribir a ${escapeHtml(nombre(p))}">${icons.mail(16)}<span>Escribir</span></a>
      </li>`
    }).join('')}</ul>
  </section>`
}

