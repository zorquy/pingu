// El bloque de precio de una carta, UNA vez para las dos pantallas que lo
// enseñan: la ficha emergente de /mi-coleccion y «Precio y colección» de
// /carta (tanda 589).
//
// Lo pidió PINGU así: «un precio, no un desde y tendencia; los dos
// botones, Cardmarket y TCGplayer; gradeadas si las hay; y quitar texto».
// Así que el bloque es:
//
//   · LA CIFRA: el mínimo en TU idioma (o lo que diga `precioParaIdioma`),
//     con un renglón pequeño que dice de qué es («mínimo en español en
//     Cardmarket · NM · 5 oct»). Un número sin decir de qué es se lee
//     como el tuyo (la 563), pero cabe en un renglón.
//   · LOS IDIOMAS: una chapa por idioma con precio, la tuya marcada. Son
//     códigos («ES 140 €») y no banderas: los iconos de la casa son SVG
//     y las banderas de otros países no son una excepción (la 🇪🇸 sí).
//   · LOS BOTONES: Cardmarket (con tu idioma y estado filtrados) y
//     TCGplayer, cada uno solo si hay adónde ir.
//   · LAS GRADEADAS: una chapa por casa y nota, con el color de la casa.
//     Cardmarket en euros; eBay en dólares y dicho.
//
// Sin DOM: devuelve HTML. El CSS vive en css/cardmarket.css, que cargan
// las dos páginas y nadie más.
import { escapeHtml } from './html.js'
import { euros, dolares, precioParaIdioma, idiomaDe, estadoDe, enlaceCardmarket, enlaceTcgplayer, IDIOMAS_CON_PRECIO, IDIOMA_POR_DEFECTO, ESTADO_POR_DEFECTO } from './cardmarket.js'
import { marcaCardmarket } from './cardmarket-marca.js'

// Las casas de gradeo que TCGGO distingue, en su orden, con el color que
// cada una usa. PINGU: «PSA rojo, Beckett amarillo, CGC azul, ACE naranja
// y TAG rosa». El color va en `data-casa` y lo pinta el CSS.
export const CASAS_GRADEO = ['psa', 'bgs', 'cgc', 'ace', 'tag', 'sgc']

const fecha = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

// Las gradeadas, aplanadas: [{ casa: 'PSA', nota: '10', valor, moneda }].
// Cardmarket viene como { psa: { psa10: 2700, psa9: 114 } } y eBay como
// { psa: { "10": { median_price, sample_size } } }: dos formas, una lista.
export function gradeadasDe(gradeadas, { maximo = 8 } = {}) {
  const fuera = []
  const meter = (casa, nota, valor, moneda, ventas = null) => {
    const v = Number(valor)
    const n = String(nota || '').replace(new RegExp(`^${casa}`, 'i'), '').trim()
    if (!CASAS_GRADEO.includes(casa) || !n || !Number.isFinite(v) || v <= 0) return
    // Si Cardmarket y eBay traen la misma nota, se queda la de Cardmarket
    // (euros, y lo que se ve desde aquí).
    if (fuera.some((g) => g.casa === casa.toUpperCase() && g.nota === n)) return
    fuera.push({ casa: casa.toUpperCase(), nota: n, valor: v, moneda, ventas })
  }
  for (const [casa, notas] of Object.entries(gradeadas?.cardmarket || {})) {
    if (!notas || typeof notas !== 'object') continue
    for (const [nota, valor] of Object.entries(notas)) meter(casa.toLowerCase(), nota, valor, 'EUR')
  }
  for (const [casa, notas] of Object.entries(gradeadas?.ebay || {})) {
    if (!notas || typeof notas !== 'object') continue
    for (const [nota, dato] of Object.entries(notas)) meter(casa.toLowerCase(), nota, dato?.median_price, 'USD', dato?.sample_size ?? null)
  }
  const orden = (g) => CASAS_GRADEO.indexOf(g.casa.toLowerCase()) * 100 - (parseFloat(g.nota) || 0)
  return fuera.sort((a, b) => orden(a) - orden(b)).slice(0, maximo)
}

export function chapasDeGradeadas(gradeadas) {
  const lista = gradeadasDe(gradeadas)
  if (!lista.length) return ''
  const hayEbay = lista.some((g) => g.moneda === 'USD')
  return `<div class="pv-gradeadas"><span class="pv-rotulo">Gradeadas</span>${lista
    .map((g) => `<span class="pv-chapa pv-gradeada" data-casa="${escapeHtml(g.casa)}" title="${escapeHtml(g.moneda === 'USD' ? `Vendida en eBay${g.ventas ? ` (${g.ventas} ${g.ventas === 1 ? 'venta' : 'ventas'})` : ''}` : 'En venta en Cardmarket')}"><b>${escapeHtml(g.casa)} ${escapeHtml(g.nota)}</b> ${g.moneda === 'USD' ? dolares(g.valor) : euros(g.valor)}</span>`)
    .join('')}${hayEbay ? '<span class="pv-pie">Los dólares son ventas en eBay.</span>' : ''}</div>`
}

// Las chapas de idioma: las que tienen precio, la tuya marcada. Sin
// ninguna (una carta sin TCGGO) no se pinta nada: una fila vacía es ruido.
export function chapasDeIdiomas(precio, idioma) {
  const por = precio?.porIdioma || null
  if (!por) return ''
  const chapas = IDIOMAS_CON_PRECIO.filter((id) => por[id]).map((id) => `<span class="pv-chapa${id === idioma ? ' pv-activa' : ''}" title="${escapeHtml(idiomaDe(id).nombre)}"><b>${escapeHtml(id.toUpperCase())}</b> ${euros(por[id])}</span>`)
  if (precio.tpEur) chapas.push(`<span class="pv-chapa pv-tp" title="TCGplayer, en euros"><b>TCGplayer</b> ${euros(precio.tpEur)}</span>`)
  return chapas.length ? `<div class="pv-idiomas">${chapas.join('')}</div>` : ''
}

// La frase pequeña bajo la cifra: de qué es ese número.
export function deQueEs(p, { idioma, estado = ESTADO_POR_DEFECTO, precio = null } = {}) {
  if (!p) return ''
  const cuando = precio?.actualizadoTcggo || precio?.actualizado
  const dia = cuando ? ` · ${fecha(cuando)}` : ''
  if (p.origen === 'cardmarket-idioma') return `mínimo en ${idiomaDe(idioma).nombre.toLowerCase()} en Cardmarket · NM${dia}`
  if (p.origen === 'cardmarket') return `mínimo en Cardmarket, cualquier idioma${dia}`
  return p.dolares ? `TCGplayer, ${dolares(p.dolares)} convertidos a ojo` : `TCGplayer, en euros${dia}`
}

// El bloque entero.
export function bloqueDePrecio(precio, { idioma = IDIOMA_POR_DEFECTO, estado = ESTADO_POR_DEFECTO, variante = 'normal', nombre = '', tcgplayerId = null, extraBotones = '' } = {}) {
  const p = precioParaIdioma(precio, idioma)
  const cm = enlaceCardmarket({ idProduct: precio?.idProduct, url: precio?.url, dudoso: precio?.dudoso, idioma, estado, variante, nombre })
  const tp = enlaceTcgplayer(tcgplayerId)
  const e = estadoDe(estado)
  const botones = [
    `<a class="btn-cardmarket pv-boton" href="${escapeHtml(cm)}" target="_blank" rel="noopener" title="${escapeHtml(precio?.idProduct && !precio?.dudoso ? `Cardmarket, ${idiomaDe(idioma).nombre.toLowerCase()} · ${e.nombre}` : 'Buscar en Cardmarket')}">${marcaCardmarket(18)}<span>Cardmarket</span></a>`,
    tp ? `<a class="btn-tcgplayer pv-boton" href="${escapeHtml(tp)}" target="_blank" rel="noopener">TCGplayer</a>` : '',
    extraBotones,
  ].filter(Boolean).join('')
  return `<div class="pv">
    ${p ? `<p class="pv-cifra">${euros(p.valor)}</p><p class="pv-de">${escapeHtml(deQueEs(p, { idioma, estado, precio }))}</p>` : '<p class="pv-cifra pv-sin">Sin precio</p>'}
    ${chapasDeIdiomas(precio, idioma)}
    <div class="pv-botones">${botones}</div>
    ${chapasDeGradeadas(precio?.gradeadas)}
  </div>`
}
