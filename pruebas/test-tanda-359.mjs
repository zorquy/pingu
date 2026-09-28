// Tanda 359: «Usar un mazo del constructor» en la decklist de un
// torneo (con un usuario inscrito), y el constructor que se abre VACÍO
// ofreciendo el borrador en una línea en vez de cargarlo solo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}

const b = await chromium.launch()
const page = await b.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
page.on('dialog', (d) => d.accept())

await page.addInitScript(() => {
  window.__FAKE_SESSION__ = 'user-1'
  window.__FAKE_TORNEOS__ = [{ id: 'torneo-1', slug: 'copa', name: 'Copa de Prueba', status: 'registration_open', admin_id: 'admin-1', max_players: 8, swiss_rounds: 3 }]
  window.__FAKE_INSCRIPCIONES__ = [{ id: 'ins-1', tournament_id: 'torneo-1', user_id: 'user-1', status: 'active', tcg_live_username: 'AshKetchum' }]
  window.__FAKE_SETS__ = [
    { id: 'sv04.5', name: 'Destinos de Paldea', market: 'WEST', tcg_online_code: 'PAF', release_date: '2024-01-26', card_count_official: 91 },
    { id: 'mee', name: 'Energías Mega Evolución', market: 'WEST', tcg_online_code: 'MEE', release_date: '2025-08-01', card_count_official: 16 },
    { id: 'svp', name: 'Promos EP', market: 'WEST', tcg_online_code: 'PR-SV', release_date: '2023-03-01', card_count_official: 100 },
  ]
  window.__FAKE_CARTAS__ = [
    { id: 'sv04.5-7', set_id: 'sv04.5', market: 'WEST', local_id: '7', name: 'Charmander', name_es: 'Charmander', name_key: 'charmander', name_search: 'charmander', category: 'Pokemon', stage: 'Basic', regulation_mark: 'H', image_path: 'x/7' },
    { id: 'mee-002', set_id: 'mee', market: 'WEST', local_id: '2', name: 'Fire Energy', name_es: 'Energía Fuego', name_key: 'fire energy', name_search: 'fire energy', category: 'Energy', energy_type: 'Normal', image_path: null },
    { id: 'svp-92', set_id: 'svp', market: 'WEST', local_id: '92', name: 'Pikachu', name_es: 'Pikachu', name_key: 'pikachu', name_search: 'pikachu', category: 'Pokemon', stage: 'Basic', regulation_mark: 'H', image_path: 'x/92' },
  ]
  window.__FAKE_MAZOS__ = [{ id: 'mazo-1', name: 'Fueguito', cards: [{ id: 'sv04.5-7', n: 4 }, { id: 'mee-002', n: 3 }, { id: 'svp-92', n: 1 }] }]
})

await page.goto('http://localhost:8892/torneo?slug=copa', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2600)

check('sin errores al cargar la ficha', errores.length === 0, errores.join(' | '))
// La decklist vive en la pestaña «Jugar» del inscrito.
await page.locator('[data-pestana="jugar"]').click()
await page.waitForTimeout(600)
check('el botón «Usar un mazo del constructor» está', (await page.locator('#btnUsarMazo').count()) === 1)
await page.locator('#btnUsarMazo').click()
await page.waitForTimeout(800)
check('al pulsarlo salen mis mazos', (await page.locator('.torneo-mazo-opcion').count()) === 1)
const ficha = await page.locator('.torneo-mazo-opcion').innerText()
check('con nombre y cuenta', /Fueguito/.test(ficha) && /8\/60/.test(ficha), ficha.replace(/\n/g, ' · '))
await page.locator('.torneo-mazo-opcion').click()
await page.waitForTimeout(1200)
const texto = await page.locator('#decklistTexto').inputValue()
check('el texto se escribe en el editor', texto.length > 0)
check('con la carta y su colección', texto.includes('4 Charmander PAF 7'), texto)
check('la energía básica como la exporta TCG Live', texto.includes('3 Basic {R} Energy MEE 2'), texto)
// La promo va con el código de Limitless (SVP), no «PR-SV»: el motor de
// torneos no lee códigos con guion.
check('la promo va como SVP y no PR-SV', texto.includes('1 Pikachu SVP 92') && !texto.includes('PR-SV'), texto)
check('NO se ha entregado sola: sigue el botón de guardar', (await page.locator('#btnGuardarDecklist').count()) === 1)
const cuenta = await page.locator('#decklistCuenta').innerText()
check('la cuenta del editor la lee (8 cartas)', /8/.test(cuenta), cuenta)
check('sin errores de página al final', errores.length === 0, errores.join(' | '))
await page.close()

console.log('\n── El constructor se abre VACÍO y ofrece el borrador ──')
{
  const p2 = await b.newPage()
  const errs = []
  p2.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))
  await p2.addInitScript(() => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = [{ id: 'sv04.5', name: 'Destinos de Paldea', market: 'WEST', tcg_online_code: 'PAF', release_date: '2024-01-26', card_count_official: 91 }]
    window.__FAKE_CARTAS__ = [{ id: 'sv04.5-7', set_id: 'sv04.5', market: 'WEST', local_id: '7', name: 'Charmander', name_es: 'Charmander', name_key: 'charmander', name_search: 'charmander', category: 'Pokemon', stage: 'Basic', regulation_mark: 'H', image_path: 'x/7' }]
    // El borrador de «la última vez»: antes se cargaba solo al entrar.
    localStorage.setItem('pokedoc-constructor-borrador', JSON.stringify({
      id: null, nombre: 'Mi borrador', formato: 'standard', publico: false,
      cartas: [{ id: 'sv04.5-7', n: 4 }], cambiado: true, cuando: 1,
    }))
  })
  await p2.goto('http://localhost:8892/constructor.html', { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(2400)
  check('el mazo llega VACÍO aunque haya borrador', (await p2.locator('#cmTabCuenta').innerText()) === '0')
  const aviso = await p2.locator('#cmAviso').innerText()
  check('el borrador se ofrece en una línea, con nombre y cuenta', /Mi borrador/.test(aviso) && /4 cartas/.test(aviso), aviso)
  await p2.locator('#cmRecuperar').click()
  await p2.waitForTimeout(800)
  check('«Seguir con él» lo recupera entero', (await p2.locator('#cmTabCuenta').innerText()) === '4')
  check('con su nombre', (await p2.locator('#cmNombre').inputValue()) === 'Mi borrador')
  check('sin errores de página', errs.length === 0, errs.join(' | '))
  await p2.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
