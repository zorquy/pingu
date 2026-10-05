// Tanda 647 — la expansión por dentro: los filtros (rareza, tipo,
// impresión, ilustrador, precio, «las que me faltan»), el orden y la ficha
// de rejilla con precio, rareza e impresiones. Lo puro, en Node.
import { readFileSync } from 'node:fs'
import { opcionesDeFiltros, cumpleFiltros, ordenarCartas, impresionesDe, RANGOS_DE_PRECIO, ORDENES } from '/home/user/pingu/js/coleccion-filtros.js'
import { fichaDeRejilla, rejillaDeCartas } from '/home/user/pingu/js/carta-nucleo.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')

const CARTAS = [
  { id: 'me05-1', set_id: 'me05', local_id: '1', name: 'Tropius', name_es: 'Tropius', rarity_en: 'Common', types: ['Grass'], illustrator: 'Akino Fukuji', variants: { normal: true, reverse: true } },
  { id: 'me05-45', set_id: 'me05', local_id: '45', name: 'Mega Lucario ex', name_es: 'Mega Lucario ex', rarity_en: 'Double Rare', types: ['Fighting'], illustrator: '5ban Graphics', variants: { holo: true } },
  { id: 'me05-112', set_id: 'me05', local_id: '112', name: 'Mega Lucario ex', name_es: 'Mega Lucario ex', rarity_en: 'Special Illustration Rare', types: ['Fighting'], illustrator: 'toriyufu', variants: { holo: true } },
  { id: 'me05-tg1', set_id: 'me05', local_id: 'TG1', name: 'Riolu', name_es: 'Riolu', rarity: 'Rare', types: ['Fighting'], illustrator: 'Akino Fukuji', variants: null },
  { id: 'me05-9', set_id: 'me05', local_id: '9', name: 'Energía Planta', name_es: 'Energía Planta', rarity_en: 'Common', types: [], illustrator: '', variants: { normal: true } },
]
const PRECIOS = new Map([['me05-1', 0.05], ['me05-45', 6.2], ['me05-112', 118], ['me05-tg1', 0.3]])

console.log('── 1. Las opciones salen de las cartas que hay ──')
{
  const op = opcionesDeFiltros(CARTAS, PRECIOS)
  check('las rarezas, en español y de más rara a menos', op.rarezas.join(' | ') === 'Rara Ilustración Especial | Rara Doble | Rara | Común', op.rarezas.join(' | '))
  check('los tipos que hay (sin el vacío de la energía)', op.tipos.join(',') === 'Grass,Fighting')
  check('las impresiones que hay, con su corto', op.impresiones.map((i) => i.corto).join(',') === 'N,RH,H', JSON.stringify(op.impresiones))
  check('los ilustradores, por orden y sin el vacío', op.ilustradores.join(' | ') === '5ban Graphics | Akino Fukuji | toriyufu', op.ilustradores.join(' | '))
  check('los tramos de precio solo si alguna carta tiene precio', op.precios.length === RANGOS_DE_PRECIO.length && opcionesDeFiltros(CARTAS, new Map()).precios.length === 0)
  check('una carta sin `variants` no afirma ninguna impresión', impresionesDe(CARTAS[3]).length === 0 && impresionesDe(CARTAS[0]).map((i) => i.id).join(',') === 'normal,reverse')
}

console.log('── 2. Pasar o no pasar ──')
{
  const ctx = { precios: PRECIOS, tengo: new Set(['me05-1', 'me05-45']) }
  const ids = (f) => CARTAS.filter((c) => cumpleFiltros(c, f, ctx)).map((c) => c.id).join(',')
  check('sin filtros pasan todas', ids({}) === CARTAS.map((c) => c.id).join(','))
  check('por rareza (en español)', ids({ rareza: 'Común' }) === 'me05-1,me05-9')
  check('por tipo', ids({ tipo: 'Fighting' }) === 'me05-45,me05-112,me05-tg1')
  check('por impresión (la reverse solo la tiene Tropius)', ids({ impresion: 'reverse' }) === 'me05-1')
  check('por ilustrador', ids({ ilustrador: 'Akino Fukuji' }) === 'me05-1,me05-tg1')
  check('por precio: 5–20 € es el Lucario de 6,20; sin precio no entra en ningún tramo', ids({ precio: '5a20' }) === 'me05-45' && ids({ precio: 'hasta1' }) === 'me05-1,me05-tg1' && ids({ precio: 'mas100' }) === 'me05-112')
  check('«las que me faltan» quita las que tienes', ids({ soloFaltan: true }) === 'me05-112,me05-tg1,me05-9')
  check('por texto, también por número', ids({ texto: 'lucario' }) === 'me05-45,me05-112' && ids({ texto: 'tg1' }) === 'me05-tg1')
  check('y se combinan', ids({ tipo: 'Fighting', soloFaltan: true, precio: 'hasta1' }) === 'me05-tg1')
}

console.log('── 3. El orden ──')
{
  const ctx = { precios: PRECIOS }
  const ids = (o) => ordenarCartas(CARTAS, o, ctx).map((c) => c.id).join(',')
  check('por número: numérico, y el TG detrás', ids('numero') === 'me05-1,me05-9,me05-45,me05-112,me05-tg1', ids('numero'))
  check('por precio, de más a menos; sin precio al final', ids('precio') === 'me05-112,me05-45,me05-tg1,me05-1,me05-9', ids('precio'))
  check('por rareza, de más a menos; a igual rareza, por número', ids('rareza') === 'me05-112,me05-45,me05-tg1,me05-1,me05-9', ids('rareza'))
  check('por nombre', ids('nombre').startsWith('me05-9,me05-45,me05-112'), ids('nombre'))
  check('no toca la lista que recibe', CARTAS[0].id === 'me05-1' && ORDENES.length === 4)
}

console.log('── 4. La ficha de rejilla ──')
{
  const html = fichaDeRejilla(CARTAS[0], 'PBL', { precio: '0,05 €', tengo: true })
  check('lleva el número y la rareza, el precio y las marcas de impresión', /coleccion-carta-num">1 · Común</.test(html) && /<b>0,05 €<\/b>/.test(html) && /<em title="Normal">N<\/em><em title="Reverse holo">RH<\/em>/.test(html) && /class="coleccion-carta coleccion-carta-tengo"/.test(html), html)
  const sin = fichaDeRejilla(CARTAS[3], 'PBL')
  check('  …y sin precio ni impresiones no hay pie, ni marca de tenerla', !/coleccion-carta-pie/.test(sin) && !/coleccion-carta-tengo/.test(sin) && /TG1 · Rara/.test(sin))
  check('  …una sola impresión no se marca (la chapa de una sola no dice nada)', !/coleccion-marcas/.test(fichaDeRejilla(CARTAS[4], 'PBL', { precio: '0,02 €' })) && /<b>0,02 €<\/b>/.test(fichaDeRejilla(CARTAS[4], 'PBL', { precio: '0,02 €' })))
  check('la rejilla pasa el extra por carta, y sin él es la de siempre', (rejillaDeCartas(CARTAS.slice(0, 2), 'PBL', (c) => ({ precio: c.id === 'me05-1' ? '0,05 €' : '' })).match(/<b>0,05 €<\/b>/g) || []).length === 1 && !/coleccion-carta-pie/.test(rejillaDeCartas([CARTAS[1]], 'PBL')))
}

console.log('── 5. Lo estático ──')
{
  const html = leer('coleccion.html')
  check('los seis desplegables y el chip de «las que me faltan»', ['filtroRareza', 'filtroTipo', 'filtroImpresion', 'filtroIlustrador', 'filtroPrecio', 'filtroOrden'].every((id) => html.includes(`id="${id}"`)) && /id="filtroFaltan" aria-pressed="false"/.test(html))
  const js = leer('js/coleccion.js')
  check('la página pide rareza, ilustrador e impresiones, los precios, lo tuyo y el valor del set, sin bloquear la rejilla', /rarity,rarity_en,illustrator,variants'\)/.test(js) && /void cargarPrecios\(\)\n\s*void cargarLoQueTienes\(\)\n\s*void pintarCifras\(set\)/.test(js) && /from\('tcg_set_valor'\)/.test(js) && /from\('user_collection'\)\.select\('card_id'\)/.test(js))
  const css = leer('css/carta.css')
  check('el chip de faltan mide 44, y las cifras de la cabecera existen', /\.coleccion-faltan \{\n  min-height: 44px;/.test(css) && /\.coleccion-cifras \{/.test(css) && /\.coleccion-carta-pie \{/.test(css))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
