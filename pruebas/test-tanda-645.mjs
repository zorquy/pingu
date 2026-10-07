// Tanda 645 — la ficha nueva: burbujas, impresiones, tabla por idioma con
// enlace a Cardmarket en cada fila, TCGplayer con su botón, y el
// histórico y el resumen de tu copia en la ficha de /mi-coleccion.
import { readFileSync } from 'node:fs'
import { bloqueDePrecio, burbujasDe, chapasDeImpresiones, fuenteCardmarket, fuenteTcgplayer, rangoDeIdiomas, psa10De, banderaHtml } from '/home/user/pingu/js/precio-vista.js'
import { precioDeFila } from '/home/user/pingu/js/cardmarket.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ')
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')

const fila = {
  card_id: 'xy5-150', cm_id_product: 273681, cm_low: 39, cm_trend: 196.68, cm_avg30: 131.56,
  cm_low_es: 140, cm_low_en: 194, cm_low_fr: 150, cm_low_it: 590, tp_market_eur: 171.08, tp_mid_eur: 180,
  cm_gradeadas: { psa: { psa10: 2621, psa9: 184 } }, ebay_gradeadas: { bgs: { 10: { median_price: 3500, sample_size: 3 } } },
  tcggo_updated: '2026-10-05T12:00:00Z', origen: 'tcggo',
}
const p = precioDeFila(fila)
const variantes = [{ id: 'normal', nombre: 'Normal' }, { id: 'reverse', nombre: 'Reverse holo' }]

console.log('── 1. Las piezas ──')
{
  const rango = rangoDeIdiomas(p)
  check('el rango entre idiomas: del español (140) al italiano (590)', rango.min === 140 && rango.max === 590 && rango.barato === 'es' && rango.caro === 'it', JSON.stringify(rango))
  check('  …y con un solo idioma no hay rango', rangoDeIdiomas(precioDeFila({ card_id: 'x', cm_low_es: 3 })) === null && rangoDeIdiomas(null) === null)
  check('la PSA 10 sale de las gradeadas (la de Cardmarket, en euros)', psa10De(p.gradeadas)?.valor === 2621 && psa10De(p.gradeadas).moneda === 'EUR' && psa10De(null) === null)
  check('la bandera es un <i> dibujado por el CSS, sin emoji', banderaHtml('es') === '<i class="pv-bandera" data-idioma="es" aria-hidden="true"></i>')
  const b = limpio(burbujasDe(p, { idioma: 'es', estado: 'NM' }))
  check('cuatro burbujas: precio, TCGplayer, PSA 10 y entre idiomas', (b.match(/class="pv-burbuja[ "]/g) || []).length === 4 && /<p class="pv-cifra">140,00 €<\/p><p class="pv-de">mínimo en español en Cardmarket · NM · 5 oct/.test(b) && /TCGplayer<\/span><p class="pv-cifra-2">171,08 €/.test(b) && /PSA 10<\/span><p class="pv-cifra-2">2\.621,00 €/.test(b) && /140 – 590 €<\/p><p class="pv-de">español, la más barata/.test(b), b.slice(0, 500))
  check('  …y sin datos, solo la primera', (limpio(burbujasDe(precioDeFila({ card_id: 'x', cm_low: 3 }), { idioma: 'es' })).match(/class="pv-burbuja[ "]/g) || []).length === 1 && /Sin precio/.test(burbujasDe(null, {})))
  const imp = chapasDeImpresiones(variantes, 'reverse', { pulsables: true, precio: p, idioma: 'es' })
  check('las impresiones: botones, la elegida marcada y con el precio, la otra sin cifra', /<button type="button" class="pv-impresion" data-variante="normal"><b>Normal<\/b><\/button>/.test(imp) && /<button type="button" class="pv-impresion pv-activa" data-variante="reverse" aria-pressed="true"><b>Reverse holo<\/b><span>140,00 €<\/span><\/button>/.test(limpio(imp)), imp)
  check('  …sin pulsar son <span>, y con una sola no hay nada', /<span class="pv-impresion pv-activa" data-variante="normal">/.test(chapasDeImpresiones(variantes, 'normal')) && !/<button/.test(chapasDeImpresiones(variantes, 'normal')) && chapasDeImpresiones([variantes[0]], 'normal') === '' && chapasDeImpresiones([], 'normal') === '')
  const cm = limpio(fuenteCardmarket(p, { idioma: 'en', estado: 'NM', nombre: 'Groudon-EX', rotuloActivo: 'elegido' }))
  const hrefs = [...cm.matchAll(/class="pv-fila-enlace" href="([^"]+)"/g)].map((m) => m[1])
  check('la tabla: una fila por idioma con precio (es, en, fr, it), cada una con SU enlace a Cardmarket', hrefs.length === 4 && hrefs.every((h) => /idProduct=273681/.test(h) && /minCondition=2/.test(h)) && /language=4/.test(hrefs[0]) && /language=1/.test(hrefs[1]) && /language=2/.test(hrefs[2]) && /language=5/.test(hrefs[3]), hrefs.join(' | '))
  check('  …la del inglés marcada con «elegido», y el botón de arriba con el inglés', /pv-fila pv-activa"><td><a[^>]*language=1[^>]*>[^]*?Inglés<\/span><span class="pv-chapa pv-chapa-tuya">elegido<\/span>/.test(cm) && /btn-cardmarket pv-boton" href="[^"]*language=1/.test(cm) && /Cada fila abre Cardmarket/.test(cm))
  check('  …y la cabecera de la tabla dice el estado', /<th>Mínimo NM<\/th>/.test(cm) && /<th>Mínimo GD<\/th>/.test(fuenteCardmarket(p, { idioma: 'es', estado: 'GD' })))
  const tp = limpio(fuenteTcgplayer(p, 96048))
  check('TCGplayer: su botón en su azul (btn-tcgplayer) con el icono de cartas, y sus dos filas en euros', /btn-tcgplayer pv-boton" href="https:\/\/www\.tcgplayer\.com\/product\/96048"[^>]*><svg/.test(tp) && /Precio de mercado, en euros<\/span><\/td><td class="pv-precio">171,08 €/.test(tp) && /Precio medio<\/span><\/td><td class="pv-precio">180,00 €/.test(tp), tp)
  check('  …sin id ni euros, nada; sin id pero con euros, la fila sin botón', fuenteTcgplayer(precioDeFila({ card_id: 'x', cm_low: 3 }), null) === '' && /171,08/.test(fuenteTcgplayer(p, null)) && !/btn-tcgplayer/.test(fuenteTcgplayer(p, null)))
  const todo = limpio(bloqueDePrecio(p, { idioma: 'es', estado: 'NM', variante: 'normal', nombre: 'Groudon-EX', tcgplayerId: 96048, variantes, impresionesPulsables: true }))
  check('el bloque entero, en orden: burbujas, impresiones, Cardmarket, TCGplayer, gradeadas', [/pv-burbujas/, /pv-impresiones/, /pv-cardmarket/, /pv-tcgplayer/, /pv-gradeadas-fuente/].map((re) => todo.search(re)).every((i, k, a) => i >= 0 && (k === 0 || i > a[k - 1])))
  check('  …y las chapas de idioma de antes ya no están', !/pv-idiomas/.test(todo))
}

console.log('── 2. Lo estático ──')
{
  const css = leer('css/cardmarket.css')
  check('el botón de TCGplayer va en su azul fijo con blanco encima', /\.btn-tcgplayer \{[^}]*--tp-azul: #1a6eff;[^}]*background: var\(--tp-azul\);[^}]*color: var\(--blanco-fijo\)/.test(css))
  check('las seis banderas, dibujadas en CSS', ['es', 'en', 'de', 'fr', 'it', 'ja'].every((id) => new RegExp(`\\.pv-bandera\\[data-idioma='${id}'\\] \\{ background:`).test(css)))
  check('la fila de la tabla mide 44 px (el enlace)', /\.pv-fila-enlace \{[^}]*min-height: 44px/.test(css))
  check('el histórico vive en cardmarket.css (lo pintan /carta y la ficha) y no en carta.css', /\.carta-historial-linea \{/.test(css) && !/\.carta-historial-linea \{/.test(leer('css/carta.css')))
  const html = leer('mi-coleccion.html')
  check('la ficha: el resumen de tu copia, los campos plegados y el histórico', /id="mcEdCopiaResumen"/.test(html) && /class="mc-editor-campos hidden" id="mcEdCopiaCampos"/.test(html) && /id="mcEdEditar" aria-expanded="false" aria-controls="mcEdCopiaBloque"/.test(html) && /id="mcEdQuitarResumen"/.test(html) && /class="carta-historial hidden" id="mcEdHistorial"/.test(html))
  const js = leer('js/mi-coleccion.js')
  check('  …y el JS pinta el resumen al abrir y al guardar, y pide el histórico', (js.match(/pintarResumenDeCopia\(/g) || []).length >= 3 && /import\('\.\/carta-historial\.js'\)/.test(js) && /mcEdQuitarResumen'\)\?\.addEventListener\('click', \(\) => \$\('mcEdQuitar'\)\?\.click\(\)\)/.test(js))
  const cm = leer('js/carta-mercado.js')
  check('/carta pasa las impresiones pulsables y cambia la versión al pulsar una', /impresionesPulsables: true/.test(cm) && /closest\('\.pv-impresion\[data-variante\]'\)/.test(cm))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
