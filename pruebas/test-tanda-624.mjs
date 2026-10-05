// Tanda 624 — UNA norma para todas las cartas: la impresión de rareza más
// baja, de cualquier colección.
//
// PINGU: «en las repeticiones no salen las cartas con su mínima rareza, eso
// debería de ser así al igual que el constructor de mazos, deberíamos de
// seguir un estándar para todas las cartas».
//
// La norma vive en UN sitio (`canonizarEntradas`, regla 0), así que la
// siguen a la vez el constructor, las repeticiones, /laboratorio, las listas
// de los torneos y el meta. Y la escala de rareza es UNA para toda la web
// (js/rareza-escala.js): la misma que ordena una expansión en /mi-coleccion.
//
//   1. La escala: los dos idiomas, `rarity_en` primero, y lo que no se sabe
//      no se inventa (TCG Pocket incluido).
//   2. `impresionMasComun`: cuándo cambia y, sobre todo, cuándo NO.
//   3. /mi-coleccion ordena con la misma escala.
//   4. En el navegador: la regla dentro de `canonizarEntradas`, la lista de
//      un torneo (código y número de la colección nueva) y una repetición.
//   5. La que casa con lo que se le ve hacer (481), traída por su id.
//   6. Y de paso: `searchCards` llevaba rota desde la 447.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const escala = await import(`${RAIZ}/js/rareza-escala.js`)
const orden = await import(`${RAIZ}/js/mi-coleccion/orden.js`)
const { impresionMasComun } = await import(`${RAIZ}/js/impresion-canonica.js`)
const { rangoDeRareza, rangoDeCarta } = escala

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Una escala, en los dos idiomas ──')
{
  check('la de /mi-coleccion ES esta (no una copia)', orden.rangoDeRareza === rangoDeRareza)
  const pares = [
    ['Común', 'Common'],
    ['Infrecuente', 'Uncommon'],
    ['Poco común', 'Uncommon'],
    ['Rara', 'Rare'],
    ['Rara Doble', 'Double rare'],
    ['Ultra Rara', 'Ultra Rare'],
    ['Rara Ilustración', 'Illustration rare'],
    ['Rara Ilustración Especial', 'Special illustration rare'],
    ['Rara Híper', 'Hyper rare'],
    ['Rara AS TÁCTICO', 'ACE SPEC Rare'],
  ]
  const malos = pares.filter(([es, en]) => rangoDeRareza(es) == null || rangoDeRareza(es) !== rangoDeRareza(en))
  check('el español vale lo mismo que el inglés', !malos.length, malos.map(([es, en]) => `${es}=${rangoDeRareza(es)} ${en}=${rangoDeRareza(en)}`).join(', '))
  check('con tilde o sin ella («Rara Híper», «Rara Hiper»)', rangoDeRareza('Rara Hiper') === rangoDeRareza('Rara Híper') && rangoDeRareza('Rara Híper') === 11)
  check('la Galería de Entrenadores no es una holo del montón', rangoDeRareza('Trainer Gallery Rare Holo') > rangoDeRareza('Rare Holo'))
  check('las de siempre siguen donde estaban', rangoDeRareza('Common') === 1 && rangoDeRareza('Rare Holo') === 4 && rangoDeRareza('Promo') === 0 && rangoDeRareza('Rare Rainbow') === 11)
  // Lo que no se sabe no se inventa (la regla de la 319).
  const pocket = ['Un Diamante', 'One Diamond', 'Una Estrella', 'Corona', 'Ninguno', 'None']
  check('las de TCG Pocket y «sin rareza» no tienen escalón', pocket.every((r) => rangoDeRareza(r) === null), pocket.map((r) => `${r}=${rangoDeRareza(r)}`).join(' '))
  check('  …ni «Rareza», que CONTIENE «rare»', rangoDeRareza('Rareza inventada') === null)
  // `rarity_en` primero: «Ultra Rara» en español es tanto un GX normal
  // como su arte completo.
  check('una carta: manda `rarity_en`', rangoDeCarta({ rarity: 'Ultra Rara', rarity_en: 'Rare Holo GX' }) === 4, rangoDeCarta({ rarity: 'Ultra Rara', rarity_en: 'Rare Holo GX' }))
  check('  …y si `rarity_en` no se reconoce, `rarity`', rangoDeCarta({ rarity: 'Común', rarity_en: 'Algo Nuevo' }) === 1)
  check('  …y sin ninguna, no se sabe', rangoDeCarta({}) === null && rangoDeCarta({ rarity: 'Ninguno' }) === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La impresión más común ──')
const LEGALES = ['H', 'I', 'J']
const img = (id) => `x/${id.replace('-', '/')}`
const t = (id, extra = {}) => ({ id, set_id: id.split('-')[0], local_id: id.split('-')[1], category: 'Trainer', image_path: img(id), regulation_mark: 'I', ...extra })
const p = (id, extra = {}) => t(id, { category: 'Pokemon', hp: 80, attacks: [{ name: 'Aleteo', cost: ['Colorless'], damage: '10' }], ...extra })
const elegir = (carta, cands, op = {}) => impresionMasComun(carta, cands, { legales: LEGALES, ...op }).id
{
  // El caso de la tanda: la Ultra Rara por el nombre, y la común de OTRA
  // colección escrita en español (desde la 330 hay filas así). Solo cruza
  // el nombre español.
  const ur = t('me05-107', { name: 'Energy Switch', name_key: 'energy switch', name_es: 'Interruptor de Energía', rarity: 'Ultra Rara' })
  const comun = t('me01-115', { name: 'Interruptor de Energía', name_key: 'interruptor de energia', name_es: 'Interruptor de Energía', rarity: 'Común' })
  check('la Ultra Rara pasa a la Común de otra colección, por el nombre español', elegir(ur, [ur, comun]) === 'me01-115', elegir(ur, [ur, comun]))
  // La candidata comparte nombre de verdad (el español): si no, ni siquiera
  // sería candidata y esto no probaría nada.
  const otraComun = t('sv01-173', { name: 'Energy Switch', name_key: 'energy switch', name_es: 'Interruptor de Energía', rarity: 'Common' })
  check('a igual rareza se queda la que venía', elegir(comun, [ur, comun, otraComun]) === 'me01-115', elegir(comun, [ur, comun, otraComun]))
  check('  …(y esa otra sí es candidata: con la Ultra Rara, gana una común)', ['me01-115', 'sv01-173'].includes(elegir(ur, [ur, otraComun])))

  // Lo que NO puede pasar.
  const ilegal = t('sv01-173', { name: 'Energy Switch', name_key: 'energy switch', rarity: 'Common', regulation_mark: 'G' })
  check('una carta legal no pasa a una impresión que no lo es', elegir(ur, [ur, ilegal]) === 'me05-107', elegir(ur, [ur, ilegal]))
  const sinMarca = t('base1-95', { name: 'Switch', name_key: 'switch', rarity: 'Common', regulation_mark: null })
  const switchD = t('swsh1-183', { name: 'Switch', name_key: 'switch', rarity: 'Uncommon', regulation_mark: 'D' })
  const switchG = t('sv01-194', { name: 'Switch', name_key: 'switch', rarity: 'Común', regulation_mark: 'G' })
  check('una carta con marca no pasa a una de antes de las marcas', elegir(switchD, [switchD, sinMarca]) === 'swsh1-183')
  check('  …y entre las que quedan, la común con marca', elegir(switchD, [switchD, sinMarca, switchG]) === 'sv01-194')
  const sinDibujo = { ...comun, id: 'me01-116', image_path: null }
  check('nunca a una sin imagen', elegir(ur, [ur, sinDibujo]) === 'me05-107')
  const promo = t('mep-007', { name: 'Energy Switch', name_key: 'energy switch', rarity: 'Promo' })
  check('una promo no sustituye a una carta de colección', elegir(ur, [ur, promo]) === 'me05-107')
  const promoObjeto = t('svp-050', { name: 'Energy Switch', name_key: 'energy switch', name_es: 'Interruptor de Energía', rarity: 'Promo' })
  check('…pero la promo de un objeto sí pasa a su común', elegir(promoObjeto, [promoObjeto, comun]) === 'me01-115')
  const exPromo = p('svp-149', { name: 'Pecharunt ex', name_key: 'pecharunt ex', rarity: 'Promo' })
  const exRd = p('sv06.5-039', { name: 'Pecharunt ex', name_key: 'pecharunt ex', rarity: 'Rara Doble' })
  check('y la promo de un ex no «baja» a su Rara Doble', elegir(exPromo, [exPromo, exRd]) === 'svp-149')
  const pocket = t('P-A-001', { set_id: 'P-A', local_id: '001', name: 'Interruptor de Energía', name_key: 'interruptor de energia', rarity: 'Ninguno' })
  const pocketDiamante = t('P-A-061', { set_id: 'P-A', local_id: '061', name: 'Interruptor de Energía', name_key: 'interruptor de energia', rarity: 'Un Diamante' })
  check('lo de TCG Pocket no entra (sin rareza o con diamantes)', elegir(ur, [ur, pocket, pocketDiamante]) === 'me05-107')
  const sinRareza = t('x3-001', { name: 'Energy Switch', name_key: 'energy switch', rarity: 'Ninguno' })
  check('una impresión cuya rareza no se sabe no es «más baja»', elegir(ur, [ur, sinRareza]) === 'me05-107', elegir(ur, [ur, sinRareza]))
  // …ni el día que la escala entienda sus rarezas: no es el juego de cartas.
  const pocketComun = t('P-A-007', { set_id: 'P-A', local_id: '007', name: 'Interruptor de Energía', name_key: 'interruptor de energia', rarity: 'Común' })
  check('  …ni aunque su rareza se entendiera', elegir(ur, [ur, pocketComun]) === 'me05-107')

  // Los Pokémon: mismo nombre no es misma carta.
  const ir = p('me02-112', { name: 'Shaymin', name_key: 'shaymin', rarity: 'Illustration Rare', regulation_mark: 'J' })
  const otro = p('sv10-010', { name: 'Shaymin', name_key: 'shaymin', rarity: 'Uncommon', hp: 70, attacks: [{ name: 'Otro', cost: ['Grass', 'Colorless'], damage: '30' }] })
  check('un Pokémon con el mismo nombre y otros ataques es OTRA carta', elegir(ir, [ir, otro]) === 'me02-112')
  const mismo = p('sv10-010', { name: 'Shaymin', name_key: 'shaymin', rarity: 'Uncommon' })
  check('  …y con los mismos, la misma', elegir(ir, [ir, mismo]) === 'sv10-010')
  // Ataques en español en una y en inglés en otra (la 330): por su forma.
  const enEspanol = p('sv10-011', { name: 'Shaymin', name_key: 'shaymin', rarity: 'Común', attacks: [{ name: 'Flap', cost: ['Incolora'], damage: '10' }] })
  check('  …aunque los ataques estén en otro idioma (PS, coste y daño)', elegir(ir, [ir, enEspanol]) === 'sv10-011')
  const sinAtaques = p('sv10-012', { name: 'Shaymin', name_key: 'shaymin', rarity: 'Común', attacks: null })
  check('  …y sin ataques no se afirma nada', elegir(ir, [ir, sinAtaques]) === 'me02-112')

  // A igual rareza: la de su colección, la legal, la marca más nueva.
  const c1 = t('q1-001', { name: 'Ball', name_key: 'ball', rarity: 'Uncommon', regulation_mark: 'H' })
  const deSuSet = t('r1-090', { name: 'Ball', name_key: 'ball', rarity: 'Común', regulation_mark: 'H' })
  const deOtro = t('s1-010', { name: 'Ball', name_key: 'ball', rarity: 'Common', regulation_mark: 'J' })
  const alta = t('r1-200', { name: 'Ball', name_key: 'ball', rarity: 'Ultra Rara', regulation_mark: 'H' })
  check('a igual rareza, la de su misma colección', elegir(alta, [alta, deOtro, deSuSet]) === 'r1-090', elegir(alta, [alta, deOtro, deSuSet]))
  check('…y si no hay, la marca más nueva', elegir(c1, [c1, deSuSet, deOtro]) === 's1-010', elegir(c1, [c1, deSuSet, deOtro]))
  const vieja = t('u1-010', { name: 'Ball', name_key: 'ball', rarity: 'Common', regulation_mark: 'J' })
  check('…y a igual marca, la colección más reciente', elegir(c1, [c1, deOtro, vieja], { fechaDeSet: (s) => ({ s1: '2025-01-01', u1: '2026-01-01' })[s] }) === 'u1-010')

  // Si la propia no se sabe, solo se cambia la que no tiene dibujo.
  const rara = t('x1-001', { name: 'Cosa', name_key: 'cosa', rarity: 'Trofeo de 1999' })
  const comunX = t('x2-001', { name: 'Cosa', name_key: 'cosa', rarity: 'Common' })
  check('una rareza que no se sabe no se cambia', elegir(rara, [rara, comunX]) === 'x1-001')
  check('  …salvo que no tenga imagen', elegir({ ...rara, image_path: null }, [rara, comunX].map((c) => (c.id === 'x1-001' ? { ...c, image_path: null } : c))) === 'x2-001')
  check('sin candidatas, la misma carta (y sin carta, nada)', impresionMasComun(ur, [], { legales: LEGALES }) === ur && impresionMasComun(null, [ur]) === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. /mi-coleccion ordena con la misma escala ──')
{
  const cartas = [
    { local_id: '1', rarity: 'Común' },
    { local_id: '2', rarity: 'Rara Doble' },
    { local_id: '3', rarity: 'Ultra Rara', rarity_en: 'Rare Holo GX' },
    { local_id: '4', rarity: 'Rara Ilustración Especial' },
    { local_id: '5', rarity: 'Un Diamante' },
  ]
  const ids = orden.ordenar(cartas, 'rareza').map((c) => c.local_id).join(',')
  // 4 (SIR) · 2 (Rara Doble) · 3 (holo GX por `rarity_en`) · 1 · y la que
  // no se sabe al final.
  check('las españolas ya no van al final como «no se sabe»', ids === '4,2,3,1,5', ids)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. En el navegador ──')
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/></svg>'
const SETS = [
  { id: 'me01', name: 'Megaevolución', market: 'WEST', tcg_online_code: 'MEG', release_date: '2025-09-26', card_count_official: 132 },
  { id: 'me05', name: 'Colección Cinco', market: 'WEST', tcg_online_code: 'ASC', release_date: '2026-08-01', card_count_official: 180 },
  { id: 'sv10', name: 'Rivales Predestinados', market: 'WEST', tcg_online_code: 'DRI', release_date: '2025-05-30', card_count_official: 182 },
  { id: 'me02', name: 'Llamas Fantasmales', market: 'WEST', tcg_online_code: 'PFL', release_date: '2026-11-14', card_count_official: 94 },
]
const ATAQUES = [{ name: 'Aleteo', cost: ['Colorless'], damage: '10' }]
const INTERRUPTOR = [
  // La Ultra Rara con el español metido en `name` (330) y la común en
  // inglés con su `name_es`: así la clave no las cruza y solo las junta la
  // consulta por el nombre español.
  { id: 'me05-107', set_id: 'me05', local_id: '107', name: 'Interruptor de Energía', name_es: 'Interruptor de Energía', category: 'Trainer', trainer_type: 'Item', rarity: 'Ultra Rara', regulation_mark: 'J', image_path: 'me/me05/107' },
  { id: 'me01-115', set_id: 'me01', local_id: '115', name: 'Energy Switch', name_es: 'Interruptor de Energía', category: 'Trainer', trainer_type: 'Item', rarity: 'Común', regulation_mark: 'I', image_path: 'me/me01/115' },
]
const shaymin = (extra) => [
  { id: 'me02-112', set_id: 'me02', local_id: '112', name: 'Shaymin', name_es: 'Shaymin', hp: 80, attacks: ATAQUES, category: 'Pokemon', rarity: 'Illustration Rare', regulation_mark: 'J', image_path: 'me/me02/112' },
  { id: 'sv10-010', set_id: 'sv10', local_id: '010', name: 'Shaymin', name_es: 'Shaymin', hp: 80, attacks: ATAQUES, category: 'Pokemon', rarity: 'Uncommon', regulation_mark: 'I', image_path: 'sv/sv10/010', ...extra },
]
const conMercado = (l) => l.map((c) => ({ market: 'WEST', ...c }))
const browser = await chromium.launch()
async function abrir(cartas) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  await page.addInitScript(({ cartas, sets }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_META_CARTAS__ = []
    // El doble devuelve SOLO las columnas pedidas, como la base: sin esto
    // la fila entera llega siempre y la caché por columnas no se podría
    // observar (ni lo que cada quien se olvida de pedir).
    window.__PROYECTAR__ = ['tcg_cards']
  }, { cartas: conMercado(cartas), sets: SETS })
  await page.goto(`${BASE}/repeticiones.html`, { waitUntil: 'domcontentloaded' })
  return { page, errores }
}

{
  const { page, errores } = await abrir([...INTERRUPTOR, ...shaymin()])
  // La lista de un torneo PRIMERO: pide menos columnas, y la caché de
  // reimpresiones no puede darle esas filas cortas al constructor después.
  // La lista enseña código y número de la colección NUEVA, nunca el código
  // de una con el número de otra (la imagen de respaldo sería otra carta).
  const l = await page.evaluate(async () => {
    const { listaParaEnsenar } = await import('/js/lista-canonica.js')
    const { porSeccion } = await listaParaEnsenar({ pokemon: [], trainer: [{ quantity: 2, name: 'Energy Switch', set: 'ASC', number: '107' }], energy: [] })
    const x = porSeccion.trainer[0] || {}
    return { set: x.set, number: x.number, quantity: x.quantity, id: x.carta?.id }
  })
  check('la lista de un torneo enseña la Común, con SU código y SU número', l.id === 'me01-115' && l.set === 'MEG' && l.number === '115' && l.quantity === 2, JSON.stringify(l))

  const r = await page.evaluate(async () => {
    const { canonizarEntradas } = await import('/js/impresiones-del-set.js')
    const { COLUMNAS } = await import('/js/constructor/datos.js')
    const { supabase } = await import('/js/supabase.js')
    const { data } = await supabase.from('tcg_cards').select(COLUMNAS).eq('id', 'me05-107')
    const [e] = await canonizarEntradas([{ carta: data[0], n: 2 }], { columnas: COLUMNAS })
    return { id: e.carta.id, n: e.n, tipo: e.carta.trainer_type, cambio: e.carta.cambio_de_set, codigo: e.carta.codigo_set }
  })
  check('`canonizarEntradas` (la puerta de todos): a la Común de MEG', r.id === 'me01-115' && r.n === 2, JSON.stringify(r))
  check('  …con las columnas de quien pregunta, aunque antes preguntara otro con menos', r.tipo === 'Item', JSON.stringify(r))
  check('  …y avisando de que cambia de colección, con su código', r.cambio === true && r.codigo === 'MEG', JSON.stringify(r))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

// Y la queja de PINGU, en una repetición: el Shaymin que se resuelve por
// el nombre es el más nuevo (la Rara Ilustración de PFL); se enseña su
// Infrecuente de DRI, que es la misma carta.
const REGISTRO = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8')
async function shayminDeLaRepeticion(cartas) {
  const { page, errores } = await abrir(cartas)
  await page.fill('#repTexto', REGISTRO)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
    const r = document.getElementById('repProgreso')
    r.value = '12'
    r.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page
    .waitForFunction(() => /\/(me02|sv10)\//.test(document.querySelector('#repLadoArriba .lab-slot-activo img')?.getAttribute('src') || ''), null, { timeout: 8000 })
    .catch(() => {})
  await page.waitForTimeout(600)
  const src = await page.evaluate(() => document.querySelector('#repLadoArriba .lab-slot-activo img')?.getAttribute('src') || '')
  await page.close()
  return { src, errores }
}
{
  const { src, errores } = await shayminDeLaRepeticion(shaymin())
  check('en la repetición, el Shaymin sale con su rareza más baja (DRI 010)', /sv10\/010/.test(src) && !/me02/.test(src), src)
  check('  …sin errores', !errores.length, errores.join(' | '))
}
{
  // Los contrastes: si cualquiera saliera DRI, lo de arriba no probaría
  // nada.
  const otro = await shayminDeLaRepeticion(shaymin({ hp: 70, attacks: [{ name: 'Otro', cost: ['Grass', 'Grass'], damage: '40' }] }))
  check('con otros ataques es OTRA carta: se queda la de PFL', /me02\/112/.test(otro.src), otro.src)
  const ilegal = await shayminDeLaRepeticion(shaymin({ regulation_mark: 'G' }))
  check('si la común no es legal, se queda la legal', /me02\/112/.test(ilegal.src), ilegal.src)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. La que casa con lo que se le ve hacer, también a su común ──')
{
  // El camino de la 481 cuando la colección buena no tiene código de TCG
  // Live: se trae POR SU ID. Era el único que se saltaba la norma.
  const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
  const lectura = leerRegistro(REGISTRO)
  const fotoDelAtaque = lectura.eventos.findIndex((e) => e.tipo === 'ataque' && e.pokemon === 'Greninja ex') + 1
  const RAFAGA = [{ name: 'Ráfaga Espejismo', cost: ['Water', 'Water'], damage: '' }]
  const cartas = conMercado([
    { id: 'me03-021', set_id: 'me03', local_id: '021', name: 'Greninja ex', name_es: 'Greninja ex', hp: 300, attacks: [{ name: 'Tajo Sigiloso', cost: ['Water'], damage: '60' }, { name: 'Filo Acuático', cost: ['Water', 'Water'], damage: '170' }], category: 'Pokemon', rarity: 'Double Rare', regulation_mark: 'J', image_path: 'me/me03/021' },
    { id: 'sv06-106', set_id: 'sv06', local_id: '106', name: 'Greninja ex', name_es: 'Greninja ex', hp: 310, attacks: RAFAGA, category: 'Pokemon', rarity: 'Special Illustration Rare', regulation_mark: 'H', image_path: 'sv/sv06/106' },
    { id: 'sv08.5-040', set_id: 'sv08.5', local_id: '040', name: 'Greninja ex', name_es: 'Greninja ex', hp: 310, attacks: RAFAGA, category: 'Pokemon', rarity: 'Double Rare', regulation_mark: 'H', image_path: 'sv/sv08.5/040' },
  ])
  const sets = [
    // SIN código: así la buena se trae por su id.
    { id: 'sv06', name: 'Máscaras del Crepúsculo', market: 'WEST', release_date: '2024-05-24', card_count_official: 167 },
    { id: 'me03', name: '30th Celebration', market: 'WEST', tcg_online_code: 'CEL', release_date: '2026-06-01', card_count_official: 128 },
    { id: 'sv08.5', name: 'Evoluciones Prismáticas', market: 'WEST', tcg_online_code: 'PRE', release_date: '2025-01-17', card_count_official: 131 },
  ]
  const FICHAS = {
    'me03-021': { id: 'me03-021', localId: '021', name: 'Greninja ex', set: { id: 'me03' }, attacks: [{ name: 'Tajo Sigiloso' }, { name: 'Filo Acuático' }] },
    'sv06-106': { id: 'sv06-106', localId: '106', name: 'Greninja ex', set: { id: 'sv06' }, attacks: [{ name: 'Ráfaga Espejismo' }] },
  }
  const LISTA = [{ id: 'me03-021', localId: '021', name: 'Greninja ex' }, { id: 'sv06-106', localId: '106', name: 'Greninja ex' }]
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => {
    const url = r.request().url()
    if (!url.includes('/v2/es/')) return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
    if (/\/cards\?name=/.test(url)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LISTA) })
    const id = decodeURIComponent(url.split('/cards/')[1] || '')
    return FICHAS[id] ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FICHAS[id]) }) : r.fulfill({ status: 404, body: '{}' })
  })
  await page.addInitScript(({ cartas, sets }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_META_CARTAS__ = []
    window.__PROYECTAR__ = ['tcg_cards']
  }, { cartas, sets })
  await page.goto(`${BASE}/repeticiones.html`, { waitUntil: 'domcontentloaded' })
  await page.fill('#repTexto', REGISTRO)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate((n) => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
    const r = document.getElementById('repProgreso')
    r.value = String(n)
    r.dispatchEvent(new Event('input', { bubbles: true }))
  }, fotoDelAtaque)
  await page.waitForFunction(() => /310/.test(document.querySelector('#repLadoArriba .lab-slot-activo .lab-ps-texto')?.textContent || ''), null, { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  const g = await page.evaluate(() => {
    const s = document.querySelector('#repLadoArriba .lab-slot-activo')
    return { ps: s?.querySelector('.lab-ps-texto')?.textContent || '', src: s?.querySelector('img')?.getAttribute('src') || '' }
  })
  check('el Greninja ex que hace Ráfaga Espejismo es el teracristal (310 PS)…', /^310\/310/.test(g.ps), JSON.stringify(g))
  check('  …y se enseña su Rara Doble, no la ilustración especial', /sv08\.5\/040/.test(g.src) && !/sv06\/106/.test(g.src), JSON.stringify(g))
  check('  …sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. El buscador de cartas vuelve a contestar ──')
{
  // `js/tcgdex.js` reexportaba `normalizeSearch` sin importarla y la llamaba
  // en `searchCards`: un ReferenceError en cada búsqueda desde la 447, que
  // el `try` de quien llama convertía en «no hay nada».
  const { page, errores } = await abrir([...INTERRUPTOR, ...shaymin()])
  const r = await page.evaluate(async () => {
    const { searchCards } = await import('/js/tcgdex.js')
    let busqueda
    try {
      const { cartas, total } = await searchCards('energy switch', { limite: 10 })
      busqueda = { n: cartas.length, total, ids: cartas.map((c) => c.id).join(',') }
    } catch (e) {
      busqueda = { error: String(e.message || e) }
    }
    // Y el respaldo por nombre de una lista: un código de colección que no
    // conocemos ya no deja la línea sin carta.
    const { resolverCarta } = await import('/js/lista-canonica.js')
    const carta = await resolverCarta({ name: 'Energy Switch', set: 'ZZZ', number: '999', quantity: 1 })
    return { busqueda, porNombre: carta?.id || null }
  })
  check('`searchCards` contesta (y no con un ReferenceError)', !r.busqueda.error && r.busqueda.n >= 1 && /me01-115/.test(r.busqueda.ids), JSON.stringify(r.busqueda))
  check('una línea con un código que no conocemos se resuelve por el nombre', r.porNombre === 'me01-115', JSON.stringify(r))
  check('  …sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
