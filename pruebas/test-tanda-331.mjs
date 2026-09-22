// Tanda 331 — la ficha se completa sola.
//
// PINGU: «entro al Mew ex y solo me sale Mew y su número, colección y
// cuándo salió. No me sale nada más».
//
// Y era verdad: esa carta todavía no la había engordado la tarea
// programada, así que no teníamos ni ataques, ni PS, ni debilidad. Sin
// ataques tampoco hay huella, así que tampoco salían sus reimpresiones.
// Con 23.000 cartas y el engorde yendo de lo más nuevo a lo más viejo,
// eso son días de fichas a medias.
//
// Ahora, si la carta no está engordada, la ficha se la pide a TCGdex EN
// EL MOMENTO. Una petición, y solo para la carta que alguien ha abierto
// de verdad — que es la excepción que la norma de la casa admite: lo
// caro es pedir las 23.000, no pedir la que se está mirando.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { detalleDeCarta, detalleEnEspanol } from '/home/user/pingu/js/carta-detalle.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()
const browser = await chromium.launch()

const MEW_ES = {
  id: '30c-25', name: 'Mew ex', category: 'Pokemon', hp: 180, types: ['Psychic'], stage: 'Basic',
  retreat: 1, rarity: 'Double rare', illustrator: 'PLANETA', regulationMark: 'J',
  weaknesses: [{ type: 'Darkness', value: '×2' }],
  attacks: [
    { name: 'Búsqueda Genética', cost: ['Psychic'], effect: 'Busca una carta.' },
    { name: 'Impulso Psíquico', cost: ['Psychic', 'Colorless'], damage: '180', effect: 'Descarta 2 Energías.' },
  ],
}
// Tal y como está HOY en la base: el listado del set y nada más.
// Con TODAS las columnas del detalle a null, que es como llegan de
// verdad: la consulta las PIDE por su nombre, así que Supabase las
// devuelve vacías en vez de no devolverlas. Sin ellas en el fixture, el
// relleno de huecos parecía que sobraba — y no sobra: sin él, esos null
// pisarían lo que acaba de llegar de TCGdex.
const EN_LA_BASE = {
  id: '30c-25', set_id: '30c', market: 'WEST', local_id: '25', name: 'Mew ex',
  image_path: 'sv/30c/25', detalle_at: null, regulation_mark: 'J',
  category: null, rarity: null, types: null, hp: null, illustrator: null,
  stage: null, evolve_from: null, retreat: null, attacks: null, abilities: null,
  weaknesses: null, resistances: null, trainer_type: null, energy_type: null,
  suffix: null, description: null,
}
const SET = { id: '30c', name: '30th Celebration', market: 'WEST', serie_name: 'Mega',
  release_date: '2026-09-16', card_count_official: 128 }

// TCGdex está bloqueado desde aquí, así que se contesta en el navegador.
const conTCGdex = async (page, { hayEspanol = true, cae = false } = {}) => {
  const pedidas = []
  await page.route('**/api.tcgdex.net/**', async (ruta) => {
    const url = ruta.request().url()
    pedidas.push(url.includes('/es/') ? 'es' : 'en')
    if (cae) return ruta.abort()
    if (url.includes('/es/') && !hayEspanol) return ruta.fulfill({ status: 404, body: '' })
    const cuerpo = url.includes('/es/')
      ? MEW_ES
      : { ...MEW_ES, name: 'Mew ex', attacks: [{ name: 'Genome Hacking', cost: ['Psychic'] }] }
    await ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) })
  })
  return pedidas
}

const abrir = async (opciones = {}, cartas = [EN_LA_BASE]) => {
  const page = await browser.newPage({ viewport: { width: 1150, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  const pedidas = await conTCGdex(page, opciones)
  await page.addInitScript((c) => {
    window.__FAKE_SETS__ = [{ id: '30c', name: '30th Celebration', market: 'WEST', serie_name: 'Mega',
      release_date: '2026-09-16', card_count_official: 128 }]
    window.__FAKE_CARTAS__ = c
  }, cartas)
  await page.goto(`${BASE}/carta/mew-ex-30c-25`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores, pedidas }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Una carta sin engordar se pinta ENTERA ──')
{
  const { page, errores, pedidas } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el subtítulo ya dice lo que es',
    limpio(await page.locator('.carta-sub').textContent()) === 'Básico · 180 PS · Tipo Psíquico',
    await page.locator('.carta-sub').textContent())
  const movs = (await page.locator('.carta-mov-nombre').allTextContents()).map(limpio)
  check('salen sus dos ataques', movs.length === 2, movs.join(' | '))
  check('…y EN ESPAÑOL', movs[0].includes('Búsqueda Genética'), movs.join(' | '))
  check('…con su daño', movs[1].includes('180'), movs.join(' | '))
  check('sale la debilidad, con su icono',
    (await page.locator('.carta-combate div').first().locator('.carta-energia').count()) === 1)
  const ficha = limpio((await page.locator('.carta-ficha div').allTextContents()).join(' | '))
  check('y la rareza y el ilustrador, que tampoco estaban', /Doble rara/.test(ficha) && /PLANETA/.test(ficha), ficha)
  // Español primero, y sin pedir el inglés de más.
  check('solo se pide el español', pedidas.join(',') === 'es', pedidas.join(','))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Lo de la base MANDA sobre lo que llega ──')
{
  // La marca de regulación y el número los curamos nosotros y son más
  // de fiar que lo que conteste una API comunitaria. Lo de fuera solo
  // rellena huecos: si pisara, una respuesta rara cambiaría la
  // legalidad de una carta en la lista de un mazo.
  const { page } = await abrir({}, [{ ...EN_LA_BASE, regulation_mark: 'H', local_id: '999' }])
  const ficha = limpio((await page.locator('.carta-ficha div').allTextContents()).join(' | '))
  check('la marca de la base gana', /Marca de regulaciónH/.test(ficha), ficha)
  check('…y el número también', /999/.test(ficha), ficha)
  check('pero lo que faltaba se rellena', /PLANETA/.test(ficha), ficha)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Si TCGdex no contesta, la página va igual ──')
{
  // Es la regla de siempre: peor ficha, nunca página en blanco.
  const { page, errores } = await abrir({ cae: true })
  check('sin errores aunque falle la red', errores.length === 0, errores.join(' | '))
  check('el nombre sigue ahí', limpio(await page.locator('#cartaNucleo h1').textContent()) === 'Mew ex')
  check('y su número también',
    /25/.test(limpio((await page.locator('.carta-ficha div').allTextContents()).join(' | '))))
  check('…sin inventarse ataques', (await page.locator('.carta-ataques').count()) === 0)
  await page.close()

  // Y una carta vieja sin traducir: cae al inglés y se pinta igual.
  const { page: p2, pedidas } = await abrir({ hayEspanol: false })
  check('una sin traducir pide los dos idiomas', pedidas.join(',') === 'es,en', pedidas.join(','))
  check('…y se pinta con el inglés',
    (await p2.locator('.carta-mov-nombre').allTextContents()).some((t) => /Genome Hacking/.test(t)),
    (await p2.locator('.carta-mov-nombre').allTextContents()).join(' | '))
  await p2.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Una carta ya engordada NO se vuelve a pedir ──')
{
  // 23.000 cartas y un catálogo comunitario y gratuito: pedir lo que ya
  // tenemos guardado sería portarse como un abusón por nada.
  const { page, pedidas } = await abrir({}, [{
    ...EN_LA_BASE, detalle_at: '2026-09-22T10:00:00Z', category: 'Pokemon', hp: 180,
    stage: 'Basic', types: ['Psychic'], attacks: [{ name: 'Impulso Psíquico', cost: ['Psychic'], damage: '180' }],
  }])
  check('no se pide nada a TCGdex', pedidas.length === 0, pedidas.join(','))
  check('y la ficha sale igual de completa',
    (await page.locator('.carta-mov-nombre').count()) === 1)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. El módulo mudado no arrastra nada ──')
{
  // Vive en js/ para que lo use el navegador, y la función de Netlify lo
  // reexporta. Si algún día alguien le mete un import, deja de poder
  // vivir en los dos sitios.
  const fuente = readFileSync(`${RAIZ}/js/carta-detalle.js`, 'utf8')
  check('js/carta-detalle.js no importa nada', !/^import /m.test(fuente))
  check('…ni toca el DOM', !/document\.|window\./.test(fuente))
  const srv = readFileSync(`${RAIZ}/netlify/lib/carta-detalle.mjs`, 'utf8')
  check('el servidor lo importa Y lo reexporta',
    /import \{[^}]*detalleDeCarta[^}]*\} from '\.\.\/\.\.\/js\/carta-detalle\.js'/.test(srv) &&
    /export \{[^}]*detalleDeCarta/.test(srv),
    'un `export … from` no crearía el enlace local y aquí se usa por dentro')
  check('y sigue mapeando lo mismo', detalleDeCarta(MEW_ES).hp === 180)
  check('…y el español sigue primero', (await detalleEnEspanol('x', async (u) => (u.includes('/es/') ? MEW_ES : null))).idioma === 'es')
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
