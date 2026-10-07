// Tanda 420 — «No se ha guardado: este mazo no es tuyo».
//
// PINGU: «no entiendo este error al guardar un mazo; cada uno puede
// guardar el mazo que quiera en su cuenta». Tenía razón, y el mazo SÍ era
// suyo: era un borrador de este navegador («AlakaClefa», 29 cartas) que
// apuntaba a un mazo que ya no existía en su cuenta. «Seguir con él» lo
// recuperaba CON ese id, «Guardar» intentaba pisar ese mazo, la base no
// tocaba nada (una política que dice que no no da error) y salía el aviso,
// sin forma de guardarlo.
//
// Dos arreglos, cada uno con su caso:
//   1. Recuperar un borrador comprueba que su mazo sigue siendo tuyo; si
//      no, es un mazo nuevo.
//   2. Guardar un mazo que ya no está en tu cuenta (borrado en otra
//      pestaña mientras lo editabas) lo guarda como NUEVO, sin error.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const BORRADOR = 'pokedoc-constructor-borrador'

const carta = (set_id, local_id, name, category, extra = {}) => ({
  id: `${set_id}-${local_id}`, set_id, market: 'WEST', local_id, name, name_es: name, name_key: name.toLowerCase(), name_search: name.toLowerCase(),
  category, regulation_mark: 'I', image_path: `${set_id}/${local_id}`, ...extra,
})
const SEMILLAS = {
  __FAKE_SETS__: [{ id: 'me01', name: 'Megaevolución', market: 'WEST', tcg_online_code: 'MEG', release_date: '2025-09-26', card_count_official: 132 }],
  __FAKE_CARTAS__: [
    carta('me01', '077', 'Mega Lucario ex', 'Pokemon', { stage: 'Stage 1' }),
    carta('me01', '076', 'Riolu', 'Pokemon', { stage: 'Basic' }),
  ],
  __FAKE_MAZOS__: [
    { id: 'mazo-mio', user_id: 'user-2', name: 'El mío', cards: [{ id: 'me01-077', n: 2 }], cover_card: 'me01-077' },
    // De OTRA cuenta, privado: la base de verdad ni siquiera lo enseña.
    { id: 'mazo-ajeno', user_id: 'user-1', name: 'De Ash', cards: [{ id: 'me01-076', n: 4 }], cover_card: 'me01-076' },
  ],
}

const browser = await chromium.launch()
async function abrir(ruta, { borrador = null } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  page.on('dialog', (d) => d.accept())
  await page.route(/^https:\/\/[^/]+\/.*\.(png|webp|jpg)(\?.*)?$/i, (r) => r.fulfill({ status: 404, body: '' }))
  await page.addInitScript(([se, clave, b]) => {
    window.__FAKE_SESSION__ = 'user-2'
    for (const [k, v] of Object.entries(se)) window[k] = v
    // El borrador se pone UNA vez: si se repusiera en cada carga, pisaría
    // el que la página guarda al guardar el mazo.
    if (b && !sessionStorage.getItem('borrador-puesto')) {
      localStorage.setItem(clave, JSON.stringify(b))
      sessionStorage.setItem('borrador-puesto', '1')
    }
  }, [SEMILLAS, BORRADOR, borrador])
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}
const toasts = (page) => page.locator('.toast').allInnerTexts()
const mazos = (page) => page.evaluate(() => window.__TABLAS__.user_decks.map((m) => ({ ...m })))
const borradorDe = (id, nombre = 'AlakaClefa') => ({
  id, nombre, formato: 'standard', publico: false, portada: null, portadaDeFuera: false,
  cartas: [{ id: 'me01-077', n: 3 }, { id: 'me01-076', n: 2 }], cambiado: true, cuando: Date.now() - 86400e3,
})

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Un borrador de un mazo que ya no existe (el caso de PINGU) ──')
{
  const { page, errores } = await abrir('/constructor', { borrador: borradorDe('mazo-borrado') })
  check('se ofrece el borrador', /AlakaClefa/.test(await page.locator('#cmAviso').innerText()))
  await page.click('#cmRecuperar')
  await page.waitForTimeout(900)
  check('  …y se recupera entero (5 cartas)', (await page.locator('#cmTabCuenta').innerText()) === '5')
  const antes = (await mazos(page)).length
  await page.click('#cmGuardar')
  await page.waitForTimeout(1200)
  const t = await toasts(page)
  const ahora = await mazos(page)
  const nuevo = ahora.find((m) => m.name === 'AlakaClefa')
  check('se guarda, sin «este mazo no es tuyo»', !t.some((x) => /no es tuyo|no está en tu cuenta/.test(x)) && t.some((x) => /^Mazo guardado\.$/.test(x)), t.join(' | '))
  check('  …como mazo NUEVO en tu cuenta', ahora.length === antes + 1 && Boolean(nuevo) && nuevo.id !== 'mazo-borrado', JSON.stringify(ahora.map((m) => m.id)))
  check('  …con sus cartas', nuevo?.cards?.length === 2 && nuevo.cards.reduce((s, c) => s + c.n, 0) === 5)
  check('  …y la dirección pasa a ser la suya', page.url().endsWith(`/constructor?mazo=${nuevo?.id}`), page.url())
  const b = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), BORRADOR)
  check('  …y el borrador ya apunta al nuevo', b?.id === nuevo?.id, b?.id)
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Un borrador que apunta al mazo de OTRA cuenta ──')
{
  // Pasa cuando dos cuentas entran en el mismo navegador: el borrador es
  // del navegador, no de la cuenta.
  const { page, errores } = await abrir('/constructor', { borrador: borradorDe('mazo-ajeno', 'Copia de lo de Ash') })
  await page.click('#cmRecuperar')
  await page.waitForTimeout(900)
  await page.click('#cmGuardar')
  await page.waitForTimeout(1200)
  const ahora = await mazos(page)
  const ajeno = ahora.find((m) => m.id === 'mazo-ajeno')
  check('el mazo de la otra cuenta NO se toca', ajeno?.name === 'De Ash' && ajeno.cards.length === 1 && ajeno.cards[0].n === 4, JSON.stringify(ajeno))
  check('  …y el tuyo se guarda aparte, en tu cuenta', ahora.some((m) => m.name === 'Copia de lo de Ash' && m.id !== 'mazo-ajeno'))
  check('  …sin error', !(await toasts(page)).some((x) => /no es tuyo|no está en tu cuenta|No se ha/.test(x)), (await toasts(page)).join(' | '))
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. El mazo se borra en otra pestaña mientras lo editas ──')
{
  const { page, errores } = await abrir('/constructor?mazo=mazo-mio')
  check('se abre el tuyo', (await page.locator('#cmNombre').inputValue()) === 'El mío')
  // «Borrar» en «Mis mazos», en otra pestaña.
  await page.evaluate(() => {
    window.__TABLAS__.user_decks = window.__TABLAS__.user_decks.filter((m) => m.id !== 'mazo-mio')
  })
  await page.locator('#cmMazo [data-id="me01-077"] [data-mas]').click()
  await page.click('#cmGuardar')
  await page.waitForTimeout(1200)
  const t = await toasts(page)
  const nuevo = (await mazos(page)).find((m) => m.name === 'El mío')
  check('se guarda igual, como mazo nuevo', Boolean(nuevo) && nuevo.id !== 'mazo-mio' && nuevo.cards[0].n === 3, JSON.stringify(nuevo))
  check('  …y lo dice, sin error', t.some((x) => /Guardado como mazo nuevo/.test(x)) && !t.some((x) => /no es tuyo|no está en tu cuenta/.test(x)), t.join(' | '))
  check('  …la dirección pasa al nuevo', page.url().endsWith(`/constructor?mazo=${nuevo?.id}`), page.url())
  // Y el siguiente guardado ya va a ese, no a crear otro.
  await page.locator('#cmMazo [data-id="me01-077"] [data-menos]').click()
  await page.click('#cmGuardar')
  await page.waitForTimeout(1200)
  const otraVez = (await mazos(page)).filter((m) => m.name === 'El mío')
  check('  …y el siguiente «Guardar» pisa ese, no crea otro', otraVez.length === 1 && otraVez[0].cards[0].n === 2, JSON.stringify(otraVez))
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Lo normal sigue igual ──')
{
  const { page, errores } = await abrir('/constructor?mazo=mazo-mio')
  const antes = (await mazos(page)).length
  await page.locator('#cmMazo [data-id="me01-077"] [data-mas]').click()
  await page.click('#cmGuardar')
  await page.waitForTimeout(1200)
  const ahora = await mazos(page)
  check('tu mazo se guarda en su sitio, sin crear otro', ahora.length === antes && ahora.find((m) => m.id === 'mazo-mio')?.cards[0].n === 3)
  check('  …con «Mazo guardado.»', (await toasts(page)).some((x) => /^Mazo guardado\.$/.test(x)), (await toasts(page)).join(' | '))
  await page.close()

  // Un borrador TUYO se recupera como tuyo: «Guardar» pisa ese mismo.
  const r = await abrir('/constructor', { borrador: borradorDe('mazo-mio', 'El mío') })
  await r.page.click('#cmRecuperar')
  await r.page.waitForTimeout(900)
  const n = (await mazos(r.page)).length
  await r.page.click('#cmGuardar')
  await r.page.waitForTimeout(1200)
  const tras = await mazos(r.page)
  check('un borrador de tu propio mazo sigue guardando en ese mazo', tras.length === n && tras.find((m) => m.id === 'mazo-mio')?.cards.length === 2)
  check('sin errores de página', errores.length === 0 && r.errores.length === 0, [...errores, ...r.errores].join(' | '))
  await r.page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
