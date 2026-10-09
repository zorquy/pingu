// El escaparate para quien llega sin cuenta (tanda 785, PA3). Lo primero que
// ve quien viene de Google tiene que ser una carta de verdad: las tres que
// más han subido esta semana, con su precio y cuánto han subido, en el
// abanico del hero. Se baja con `import()` solo sin sesión.
//
// «Esta semana» es la media de 7 días contra la de 30 (`cm_avg7` sobre
// `cm_avg30`, de Cardmarket). PostgREST no compara dos columnas, así que se
// piden las 120 más caras y se ordena aquí. Si no salen tres, el hero se
// queda como estaba (las tres del set más nuevo, 362): mejor eso que un
// abanico a medias.
import { supabase } from './supabase.js'
import { rutaDeCarta, urlDeImagen } from './carta-ruta.js'
import { escapeHtml } from './html.js'
import { nombreDeCarta } from './catalogo-series.js'

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' })

// Puro: de las filas de precio, las N que más suben (con un mínimo de 5 %).
export function lasQueMasSuben(filas, n = 3) {
  return (filas || [])
    .map((r) => ({ ...r, siete: Number(r.cm_avg7), treinta: Number(r.cm_avg30) }))
    .filter((r) => r.siete > 0 && r.treinta > 0 && r.siete / r.treinta >= 1.05)
    .map((r) => ({ id: r.card_id, precio: Number(r.cm_trend) || r.siete, sube: r.siete / r.treinta - 1 }))
    .sort((a, b) => b.sube - a.sube)
    .slice(0, n)
}

export async function pintarEscaparate(doc = document) {
  const marcos = [...doc.querySelectorAll('.hero-portada .card-stack .tcg-card')]
  const lista = doc.getElementById('heroSuben')
  if (!marcos.length || !lista) return false
  const { data: precios, error } = await supabase
    .from('tcg_card_prices')
    .select('card_id, cm_trend, cm_avg7, cm_avg30')
    .gt('cm_trend', 10)
    .order('cm_trend', { ascending: false })
    .limit(120)
  if (error) return false
  const suben = lasQueMasSuben(precios, 6)
  if (suben.length < 3) return false
  const { data: cartas } = await supabase
    .from('tcg_cards')
    .select('id, name, name_es, name_en, image_path, market, set_id, local_id')
    .eq('market', 'WEST')
    .in('id', suben.map((s) => s.id))
  const porId = new Map((cartas || []).filter((c) => c.image_path).map((c) => [c.id, c]))
  const tres = suben.filter((s) => porId.has(s.id)).slice(0, 3)
  if (tres.length < 3) return false
  marcos.forEach((marco, i) => {
    const c = porId.get(tres[i % 3].id)
    marco.querySelector('img')?.remove()
    const img = doc.createElement('img')
    img.className = 'tcg-card-foto'
    img.decoding = 'async'
    img.alt = ''
    img.addEventListener('error', () => img.remove())
    img.src = urlDeImagen(c.image_path, 'low', c.market)
    marco.appendChild(img)
  })
  lista.innerHTML = tres.map((s) => {
    const c = porId.get(s.id)
    return `<li><a href="${escapeHtml(rutaDeCarta(c))}"><span>${escapeHtml(nombreDeCarta(c))}</span><b>${escapeHtml(euros.format(s.precio))}</b><small>+${Math.round(s.sube * 100)} %</small></a></li>`
  }).join('')
  lista.closest('.hero-suben')?.classList.remove('hidden')
  return true
}
