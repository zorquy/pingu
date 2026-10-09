// /ilustrador/<nombre> (tanda 791, NU6): todas las cartas de un ilustrador,
// por fecha, con cuántas tienes y la más cara. El buscador ya encontraba por
// ilustrador (la 447); esto es la página con nombre propio que faltaba.
import { supabase } from './supabase.js'
import { getSession } from './app.js'
import { escapeHtml } from './html.js'
import { rutaDeCarta, slugDeIlustrador } from './carta-ruta.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'

const $ = (id) => document.getElementById(id)
const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const COLUMNAS = 'id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,image_tcggo,illustrator,tcg_sets(id,name,name_en,release_date,tcg_online_code,serie_id,serie_name,serie_name_en)'

// El nombre sale de la DIRECCIÓN, no de la consulta: una reescritura de
// Netlify deja la URL original (la 633), así que se lee la ruta.
export function slugDeDireccion(loc = location) {
  const m = loc.pathname.match(/^\/ilustrador\/([^/?#]+)/)
  if (m) return slugDeIlustrador(decodeURIComponent(m[1]))
  return slugDeIlustrador(new URLSearchParams(loc.search).get('n') || '')
}

// Por partes y con comodines: «mitsuhiro-arita» casa «Mitsuhiro Arita» y
// también la carta que firma con otro. Luego se afina con el slug exacto.
export function patronDeSlug(slug) {
  return `%${String(slug).split('-').filter(Boolean).join('%')}%`
}

// Las que son SUYAS: la firma entera, o él como uno de varios («A & B»).
export function esDelIlustrador(carta, slug) {
  const firma = slugDeIlustrador(carta?.illustrator)
  return firma === slug || firma.split(/-(?:and|y|x)-/).includes(slug) || ` ${firma.replace(/-/g, ' ')} `.includes(` ${slug.replace(/-/g, ' ')} `)
}

export function ordenarPorFecha(cartas) {
  const num = (c) => Number.parseInt(String(c.local_id).replace(/\D+/g, ''), 10) || 0
  return [...cartas].sort((a, b) =>
    String(a.tcg_sets?.release_date || '9999').localeCompare(String(b.tcg_sets?.release_date || '9999')) ||
    String(a.set_id).localeCompare(String(b.set_id)) || num(a) - num(b))
}

// El nombre que se enseña: la firma más repetida entre las suyas.
export function nombreMasComun(cartas) {
  const cuenta = new Map()
  for (const c of cartas) if (c.illustrator) cuenta.set(c.illustrator, (cuenta.get(c.illustrator) || 0) + 1)
  return [...cuenta].sort((a, b) => b[1] - a[1])[0]?.[0] || ''
}

async function enTrozos(ids, pedir) {
  const filas = []
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await pedir(ids.slice(i, i + 150))
    if (error) throw error
    filas.push(...(data || []))
  }
  return filas
}

function tarjeta(c, tengo, precio) {
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const nombre = nombreDeCarta(c)
  return `<a class="il-carta${tengo ? ' tengo' : ''}" href="${escapeHtml(rutaDeCarta(c))}">
    ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : '<span class="il-sin-foto"></span>'}
    <span class="il-carta-nombre">${escapeHtml(nombre)}</span>
    <small>${escapeHtml(nombreDeSet(c.tcg_sets) || c.set_id)}${precio ? ` · ${escapeHtml(euros.format(precio))}` : ''}</small>
    ${tengo ? '<span class="il-tengo">La tienes</span>' : ''}
  </a>`
}

async function iniciar() {
  const rejilla = $('ilRejilla')
  const slug = slugDeDireccion()
  if (!slug) { location.replace('/cartas'); return }
  const { data, error } = await supabase.from('tcg_cards').select(COLUMNAS)
    .eq('market', 'WEST').ilike('illustrator', patronDeSlug(slug)).limit(1500)
  rejilla.removeAttribute('aria-busy')
  if (error) {
    rejilla.innerHTML = '<p class="empty-state">No se ha podido preguntar por sus cartas. Prueba otra vez en un momento.</p>'
    return
  }
  const cartas = ordenarPorFecha((data || []).filter((c) => esDelIlustrador(c, slug)))
  if (!cartas.length) {
    rejilla.innerHTML = `<p class="empty-state">No tenemos ninguna carta de «${escapeHtml(slug.replace(/-/g, ' '))}». <a href="/cartas">Ver el catálogo</a></p>`
    return
  }
  const nombre = nombreMasComun(cartas)
  $('ilNombre').textContent = nombre
  document.title = `Las cartas de ${nombre} — PokeDoc`
  const ids = cartas.map((c) => c.id)
  const sesion = await getSession().catch(() => null)
  const [precios, mias] = await Promise.all([
    enTrozos(ids, (t) => supabase.from('tcg_card_prices').select('card_id,cm_trend,cm_low').in('card_id', t)).catch(() => []),
    sesion ? enTrozos(ids, (t) => supabase.from('user_collection').select('card_id').eq('user_id', sesion.user.id).in('card_id', t)).catch(() => null) : null,
  ])
  const precio = new Map(precios.map((p) => [p.card_id, Number(p.cm_trend || p.cm_low) || 0]))
  const tengo = new Set((mias || []).map((f) => f.card_id))
  const cara = cartas.reduce((m, c) => ((precio.get(c.id) || 0) > (precio.get(m?.id) || 0) ? c : m), null)
  const trozos = [`${cartas.length.toLocaleString('es-ES')} ${cartas.length === 1 ? 'carta' : 'cartas'}`]
  if (mias) trozos.push(`tienes ${tengo.size}`)
  if (cara && precio.get(cara.id)) trozos.push(`la más cara, ${nombreDeCarta(cara)} (${euros.format(precio.get(cara.id))})`)
  $('ilCifras').textContent = trozos.join(' · ')
  const q = new URLSearchParams({ ver: 'buscar', q: nombre })
  $('ilAcciones').innerHTML = `${sesion ? `<button type="button" class="btn-primary" id="ilAlbum">Hacer el álbum de ${escapeHtml(nombre)}</button>` : ''}<a class="btn-secondary" href="/mi-coleccion?${escapeHtml(q.toString())}">Buscarlas en Mi colección</a>`
  $('ilAcciones').classList.remove('hidden')
  // El álbum de un toque (798, NU6): sus cartas por fecha, en un álbum tuyo
  // (las 1.080 primeras: el tope de un álbum en la base).
  $('ilAlbum')?.addEventListener('click', async (e) => {
    const b = e.currentTarget
    b.disabled = true
    const { data, error } = await supabase.from('user_albums')
      .insert({ nombre: `Las cartas de ${nombre}`.slice(0, 80), descripcion: `Todas las cartas de ${nombre}, por fecha.`.slice(0, 500), cartas: cartas.slice(0, 1080).map((c) => ({ id: c.id })) })
      .select('id').single()
    if (error || !data?.id) {
      b.disabled = false
      b.textContent = 'No se ha podido crear: prueba otra vez'
      return
    }
    location.href = `/mi-coleccion?album=${encodeURIComponent(data.id)}`
  })
  rejilla.innerHTML = cartas.map((c) => tarjeta(c, tengo.has(c.id), precio.get(c.id))).join('')
}

if (typeof document !== 'undefined' && document.getElementById('ilRejilla')) iniciar()
