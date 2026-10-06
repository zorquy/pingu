// El bloque de precio de una carta, UNA vez para las dos pantallas que lo
// enseñan: la ficha emergente de /mi-coleccion y «Precio y colección» de
// /carta (tanda 589, rehecho en la 645).
//
// La forma la pidió PINGU con la ficha de TCGGO delante: «demasiada
// información, todo pegado; salen demasiados precios en chapas; mejor una
// tabla por idioma que al pulsar vaya a Cardmarket con ese filtro; más
// burbujas, más visual». Así que el bloque es, de arriba abajo:
//
//   · LAS BURBUJAS: el precio de TU idioma (o lo que diga
//     `precioParaIdioma`, con su renglón de «de qué es»), TCGplayer en
//     euros, la PSA 10 y el rango entre idiomas. Cada una solo si hay
//     dato: una burbuja con una raya es un hueco con marco.
//   · LAS IMPRESIONES: normal, reverse, holo, 1.ª edición — las que la
//     carta tiene de verdad—, con el precio en la elegida. TCGGO no da
//     precio por impresión, así que las demás van sin cifra y no con una
//     inventada.
//   · CARDMARKET: una fila por idioma con precio, la tuya marcada, y cada
//     fila abre Cardmarket con ESE idioma y tu estado ya filtrados. Las
//     banderas van dibujadas en CSS (`.pv-bandera`): aquí no hay emojis.
//   · TCGPLAYER: su botón, en su azul, y el precio de mercado en euros.
//   · LAS GRADEADAS: una chapa por casa y nota, con el color de la casa.
//     Cardmarket en euros; eBay en dólares y dicho.
//
// Sin DOM: devuelve HTML. El CSS vive en css/cardmarket.css, que cargan
// las dos páginas y nadie más.
import { escapeHtml } from './html.js'
import { euros, dolares, precioParaIdioma, idiomaDe, estadoDe, enlaceCardmarket, enlaceTcgplayer, IDIOMAS_CON_PRECIO, IDIOMA_POR_DEFECTO, ESTADO_POR_DEFECTO } from './cardmarket.js'
import { marcaCardmarket } from './cardmarket-marca.js'
import { icons } from './icons.js'

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

const cifraGradeada = (g) => (g.moneda === 'USD' ? dolares(g.valor) : euros(g.valor))

// El rango va sin céntimos: «140 – 590 €» cabe en una burbuja de móvil y
// «140,00 € – 590,00 €» se parte en tres renglones.
const fmtEntero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' })
const rangoHtml = (min, max) => `${fmtEntero.format(min)} – ${fmtEntero.format(max)} €`.replace(/ /g, '\u00a0')

// POR CASA Y PLEGADAS (673). PINGU: «muestra datos pero es un poco lioso;
// mejor que te ponga las casas, que se despliegue». Un <details> con la
// cifra que más se mira en el resumen (la PSA 10, o la mejor nota que
// haya) y dentro una fila por casa: la chapa de la casa con su color y
// sus notas en orden, cada una con su cifra. Lo que viene de eBay son
// ventas en dólares y lo dice el pie, como antes.
export function chapasDeGradeadas(gradeadas) {
  const lista = gradeadasDe(gradeadas, { maximo: 24 })
  if (!lista.length) return ''
  const hayEbay = lista.some((g) => g.moneda === 'USD')
  const casas = [...new Set(lista.map((g) => g.casa))]
  const mejor = lista.find((g) => g.casa === 'PSA' && g.nota === '10') || lista[0]
  const filas = casas.map((casa) => `<div class="pv-casa-fila"><span class="pv-chapa pv-gradeada pv-casa" data-casa="${escapeHtml(casa)}"><b>${escapeHtml(casa)}</b></span><span class="pv-casa-notas">${lista.filter((g) => g.casa === casa)
    .map((g) => `<span class="pv-nota" title="${escapeHtml(g.moneda === 'USD' ? `Vendida en eBay${g.ventas ? ` (${g.ventas} ${g.ventas === 1 ? 'venta' : 'ventas'})` : ''}` : 'En venta en Cardmarket')}"><b>${escapeHtml(g.nota)}</b> ${cifraGradeada(g)}</span>`)
    .join('')}</span></div>`).join('')
  return `<details class="pv-fuente pv-gradeadas-fuente"><summary class="pv-fuente-cab pv-gradeadas-cab"><span class="pv-fuente-nombre">Gradeadas</span><span class="pv-gradeadas-resumen"><span class="pv-chapa pv-gradeada" data-casa="${escapeHtml(mejor.casa)}"><b>${escapeHtml(mejor.casa)} ${escapeHtml(mejor.nota)}</b> ${cifraGradeada(mejor)}</span><span class="pv-pie">${lista.length} ${lista.length === 1 ? 'nota' : 'notas'} · ${casas.length} ${casas.length === 1 ? 'casa' : 'casas'}</span></span></summary><div class="pv-gradeadas pv-casas">${filas}</div>${hayEbay ? '<p class="pv-pie">Los dólares son ventas en eBay; los euros, en venta en Cardmarket.</p>' : ''}</details>`
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

// La bandera de un idioma, dibujada por el CSS (sin emojis: la norma de
// la casa). `aria-hidden` porque el nombre va escrito al lado.
export function banderaHtml(idioma) {
  return `<i class="pv-bandera" data-idioma="${escapeHtml(idioma)}" aria-hidden="true"></i>`
}

// El rango entre idiomas: el más barato y el más caro, con quién es cada
// uno. Con menos de dos idiomas no hay rango que valga.
export function rangoDeIdiomas(precio) {
  const por = precio?.porIdioma || null
  if (!por) return null
  const lista = IDIOMAS_CON_PRECIO.filter((id) => por[id]).map((id) => ({ id, valor: por[id] }))
  if (lista.length < 2) return null
  const orden = [...lista].sort((a, b) => a.valor - b.valor)
  return { min: orden[0].valor, max: orden[orden.length - 1].valor, barato: orden[0].id, caro: orden[orden.length - 1].id }
}

// La PSA 10, que es la cifra que la gente mira primero de las gradeadas.
export function psa10De(gradeadas) {
  return gradeadasDe(gradeadas, { maximo: 50 }).find((g) => g.casa === 'PSA' && g.nota === '10') || null
}

// Las cuatro burbujas de arriba. La primera siempre (aunque sea «Sin
// precio»); las otras tres, solo con dato.
export function burbujasDe(precio, { idioma = IDIOMA_POR_DEFECTO, estado = ESTADO_POR_DEFECTO } = {}) {
  const p = precioParaIdioma(precio, idioma)
  const burbujas = [
    `<div class="pv-burbuja pv-burbuja-principal"><span class="pv-rotulo">Precio</span>${p ? `<p class="pv-cifra">${euros(p.valor)}</p><p class="pv-de">${escapeHtml(deQueEs(p, { idioma, estado, precio }))}</p>` : '<p class="pv-cifra pv-sin">Sin precio</p><p class="pv-de">Ni Cardmarket ni TCGplayer la tienen todavía.</p>'}</div>`,
  ]
  if (precio?.tpEur) burbujas.push(`<div class="pv-burbuja"><span class="pv-rotulo">TCGplayer</span><p class="pv-cifra-2">${euros(precio.tpEur)}</p><p class="pv-de">mercado US, en euros</p></div>`)
  const psa = psa10De(precio?.gradeadas)
  if (psa) burbujas.push(`<div class="pv-burbuja"><span class="pv-rotulo">PSA 10</span><p class="pv-cifra-2">${cifraGradeada(psa)}</p><p class="pv-de">${psa.moneda === 'USD' ? `vendidas en eBay${psa.ventas ? ` · ${psa.ventas} ${psa.ventas === 1 ? 'venta' : 'ventas'}` : ''}` : 'en venta en Cardmarket'}</p></div>`)
  const rango = rangoDeIdiomas(precio)
  if (rango) burbujas.push(`<div class="pv-burbuja"><span class="pv-rotulo">Entre idiomas</span><p class="pv-cifra-2">${rangoHtml(rango.min, rango.max)}</p><p class="pv-de">${escapeHtml(idiomaDe(rango.barato).nombre.toLowerCase())}, la más barata</p></div>`)
  return `<div class="pv-burbujas">${burbujas.join('')}</div>`
}

// Las impresiones de ESTA carta, la elegida con su precio. Solo con más
// de una: con una sola, la chapa de arriba ya lo dice. Pulsables en
// /carta (cambian la versión); en la ficha de tu copia, informativas.
export function chapasDeImpresiones(variantes, variante, { pulsables = false, precio = null, idioma = IDIOMA_POR_DEFECTO } = {}) {
  const lista = (variantes || []).filter((v) => v?.id && v?.nombre)
  if (lista.length < 2) return ''
  const p = precioParaIdioma(precio, idioma)
  return `<div class="pv-impresiones"><span class="pv-rotulo">Impresión</span>${lista
    .map((v) => {
      const activa = v.id === variante
      const dentro = `<b>${escapeHtml(v.nombre)}</b>${activa && p ? `<span>${euros(p.valor)}</span>` : ''}`
      return pulsables
        ? `<button type="button" class="pv-impresion${activa ? ' pv-activa' : ''}" data-variante="${escapeHtml(v.id)}"${activa ? ' aria-pressed="true"' : ''}>${dentro}</button>`
        : `<span class="pv-impresion${activa ? ' pv-activa' : ''}" data-variante="${escapeHtml(v.id)}">${dentro}</span>`
    })
    .join('')}</div>`
}

// Cardmarket: el botón y la tabla por idioma. Cada fila lleva SU enlace,
// con ese idioma y tu estado filtrados: es lo que convierte la tabla en
// «dónde está el mínimo exacto» y no en una lista de números.
export function fuenteCardmarket(precio, { idioma = IDIOMA_POR_DEFECTO, estado = ESTADO_POR_DEFECTO, variante = 'normal', nombre = '', rotuloActivo = 'tu idioma' } = {}) {
  const enlace = (id) => enlaceCardmarket({ idProduct: precio?.idProduct, url: precio?.url, dudoso: precio?.dudoso, idioma: id, estado, variante, nombre })
  const e = estadoDe(estado)
  const conProducto = Boolean(precio?.idProduct && !precio?.dudoso)
  const boton = `<a class="btn-cardmarket pv-boton" href="${escapeHtml(enlace(idioma))}" target="_blank" rel="noopener" title="${escapeHtml(conProducto ? `Cardmarket, ${idiomaDe(idioma).nombre.toLowerCase()} · ${e.nombre}` : 'Buscar en Cardmarket')}">${marcaCardmarket(18)}<span>Cardmarket</span></a>`
  const por = precio?.porIdioma || null
  const filas = []
  if (por) {
    for (const id of IDIOMAS_CON_PRECIO) {
      if (!por[id]) continue
      const activa = id === idioma
      filas.push(`<tr class="pv-fila${activa ? ' pv-activa' : ''}"><td><a class="pv-fila-enlace" href="${escapeHtml(enlace(id))}" target="_blank" rel="noopener" title="${escapeHtml(`Cardmarket, ${idiomaDe(id).nombre.toLowerCase()} · ${e.nombre}`)}">${banderaHtml(id)}<span>${escapeHtml(idiomaDe(id).nombre)}</span>${activa ? `<span class="pv-chapa pv-chapa-tuya">${escapeHtml(rotuloActivo)}</span>` : ''}</a></td><td class="pv-precio">${euros(por[id])}</td></tr>`)
    }
  } else {
    // Sin TCGGO, lo que diga la guía general de Cardmarket (vía TCGdex),
    // que es de la carta en cualquier idioma.
    const general = !precio?.dudoso ? precio?.desde || precio?.tendencia || precio?.media30 || null : null
    if (general) filas.push(`<tr class="pv-fila"><td><a class="pv-fila-enlace" href="${escapeHtml(enlace(idioma))}" target="_blank" rel="noopener"><span>Cualquier idioma</span></a></td><td class="pv-precio">${euros(general)}</td></tr>`)
  }
  return `<div class="pv-fuente pv-cardmarket"><div class="pv-fuente-cab"><span class="pv-fuente-nombre">Cardmarket</span>${boton}</div>${
    filas.length
      ? `<table class="pv-tabla"><thead><tr><th>Idioma</th><th>Mínimo ${escapeHtml(e.id)}</th></tr></thead><tbody>${filas.join('')}</tbody></table><p class="pv-pie">${por ? 'Cada fila abre Cardmarket con ese idioma puesto.' : 'Precio de la guía general; el botón abre Cardmarket con tu idioma y estado.'}</p>`
      : ''
  }</div>`
}

// TCGplayer: su botón y su precio de mercado en euros (lo convierte TCGGO).
// Solo si hay adónde ir o algo que decir.
export function fuenteTcgplayer(precio, tcgplayerId) {
  const tp = enlaceTcgplayer(tcgplayerId)
  if (!tp && !precio?.tpEur) return ''
  const filas = []
  if (precio?.tpEur) filas.push(`<tr class="pv-fila"><td><span class="pv-fila-enlace">Precio de mercado, en euros</span></td><td class="pv-precio">${euros(precio.tpEur)}</td></tr>`)
  if (precio?.tpMidEur) filas.push(`<tr class="pv-fila"><td><span class="pv-fila-enlace">Precio medio</span></td><td class="pv-precio">${euros(precio.tpMidEur)}</td></tr>`)
  return `<div class="pv-fuente pv-tcgplayer"><div class="pv-fuente-cab"><span class="pv-fuente-nombre">TCGplayer</span>${tp ? `<a class="btn-tcgplayer pv-boton" href="${escapeHtml(tp)}" target="_blank" rel="noopener">${icons.zap(16)}<span>TCGplayer</span></a>` : ''}</div>${filas.length ? `<table class="pv-tabla"><tbody>${filas.join('')}</tbody></table>` : ''}</div>`
}

// El bloque entero.
export function bloqueDePrecio(precio, { idioma = IDIOMA_POR_DEFECTO, estado = ESTADO_POR_DEFECTO, variante = 'normal', nombre = '', tcgplayerId = null, extraBotones = '', variantes = [], impresionesPulsables = false, rotuloActivo = 'tu idioma' } = {}) {
  return `<div class="pv">
    ${burbujasDe(precio, { idioma, estado })}
    ${chapasDeImpresiones(variantes, variante, { pulsables: impresionesPulsables, precio, idioma })}
    ${fuenteCardmarket(precio, { idioma, estado, variante, nombre, rotuloActivo })}
    ${fuenteTcgplayer(precio, tcgplayerId)}
    ${extraBotones ? `<div class="pv-botones">${extraBotones}</div>` : ''}
    ${chapasDeGradeadas(precio?.gradeadas)}
  </div>`
}
