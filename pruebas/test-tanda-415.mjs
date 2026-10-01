// Tanda 415 — los dibujos que faltaban y la tira con flechas.
//
// PINGU, mirando las expansiones en producción: «hay expansiones que no
// tienen logo, no sé de dónde los estáis sacando pero hay un montón que
// no salen»; «has metido McDonald's Collection entre Espada y Escudo y
// Escarlata y Púrpura, y McDonald's no es un set como tal»; «hay un
// montón de cartas en la colección que no se muestran»; «en el panel,
// dale sin scroll y que haya una flechita para moverlo».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { esEspecial } from '/home/user/pingu/js/mi-coleccion/estanteria.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const browser = await chromium.launch()

console.log('\n── 1. Lo que no es un set de su era ──')
{
  for (const n of ["McDonald's Collection 2021", 'Pokémon Futsal Collection', 'Battle Academy',
    'Trick or Trade BOOster Bundle', 'My First Battle', 'XY Trainer Kit: Latias', 'POP Series 5']) {
    check(`«${n}» va al fondo`, esEspecial({ name: n }))
  }
  for (const n of ['Sword & Shield', 'Celebrations', '30th Classic Collection', 'SVP Black Star Promos']) {
    check(`  …y «${n}» se queda`, !esEspecial({ name: n }))
  }
}

const abrir = async (ruta, ancho = 1280) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 } })
  const errores = []
  const pedidas = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  // Qué direcciones se PIDEN, que es lo que se quiere comprobar. Mirar el
  // `<img>` después no sirve: aquí ninguna imagen carga —la CDN está
  // cortada— y para cuando se mira, la cadena ya se ha agotado y el
  // elemento ya no está.
  page.on('request', (r) => pedidas.push(r.url()))
  await page.addInitScript(() => {
    const S = (id, name, logo_path, symbol_url, dia) => ({ id, name, serie_id: 'sv',
      serie_name: 'Escarlata y Púrpura', market: 'WEST', card_count_official: 10, card_count_total: 10,
      release_date: `2024-01-0${dia}`, logo_path, symbol_url })
    window.__FAKE_SETS__ = [
      S('conlogo', 'Con logo', 'x/logo', 'https://x/simbolo', 1),
      S('solosimbolo', 'Solo símbolo', null, 'https://x/simbolo', 2),
      S('nada', 'Ni logo ni símbolo', null, null, 3),
    ]
    window.__FAKE_CARTAS__ = [{ id: 'nada-1', set_id: 'nada', local_id: '1', name: 'Bulbasaur',
      image_path: null, market: 'WEST', rarity: 'Common', category: 'Pokemon', variants: { normal: true } }]
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'nada-1', cantidad: 1, idioma: 'es',
      estado: 'NM', variante: 'normal', notas: null }]
  })
  await page.goto('http://localhost:8892' + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores, pedidas }
}

console.log('\n── 2. Una tarjeta de expansión NUNCA se queda sin decir qué es ──')
{
  const { page, errores, pedidas } = await abrir('/mi-coleccion.html?ver=album')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const sinSimbolo = await page.locator('[data-set="nada"] .mc-set-logo img').count()
  check('sin logo ni símbolo no se pide ninguna imagen', sinSimbolo === 0, String(sinSimbolo))
  check('  …y el nombre se pinta en la cabecera',
    await page.locator('[data-set="nada"] .mc-set-rotulo').isVisible())
  await page.waitForTimeout(1200)
  // El símbolo llevaba guardado desde que se importa el catálogo y no lo
  // usaba nadie. Ahora es el segundo sitio donde mirar.
  check('se pide el logo', pedidas.some((u) => /\/x\/logo/.test(u)), '')
  check('  …y, al fallar, el símbolo', pedidas.some((u) => /simbolo\.webp/.test(u)),
    pedidas.filter((u) => /simbolo|logo/.test(u)).join(' | ').slice(0, 160))
  const rotulos = await page.locator('.mc-set-rotulo:visible').count()
  check('cuando ninguna imagen llega, las tres dicen su nombre', rotulos === 3, String(rotulos))
  // Y no lo dice DOS veces: el de abajo se queda SOLO para el lector de
  // pantalla. (`:visible` no vale aquí: un `sr-only` mide 1x1 px, no está
  // en `display: none`, así que para Playwright se ve.)
  check('  …y solo una vez cada una',
    await page.locator('[data-set="nada"] .mc-set-nombre').evaluate((e) => e.classList.contains('sr-only')))
  await page.close()
}

console.log('\n── 3. Una carta sin escaneo dice su nombre ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=album')
  await page.locator('[data-set="nada"]').click()
  await page.waitForTimeout(900)
  check('el bolsillo lleva el nombre', /Bulbasaur/.test(
    (await page.locator('.mc-bolsillo .mc-carta-sinfoto').first().textContent().catch(() => '')) || ''))
  await page.close()
}

console.log('\n── 4. La tira, sin barra y con flechas ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=resumen')
  const estado = () => page.evaluate(() => ({
    izq: !document.getElementById('mcTiraIzq').hidden,
    der: !document.getElementById('mcTiraDer').hidden,
    x: Math.round(document.getElementById('mcTira').scrollLeft),
  }))
  check('al abrir, no hay flecha hacia atrás', (await estado()).izq === false)
  check('  …y sí hacia delante', (await estado()).der === true)
  check('  …y la apagada no se ve de verdad',
    (await page.locator('#mcTiraIzq').isVisible()) === false)
  await page.locator('#mcTiraDer').click()
  await page.waitForTimeout(900)
  const tras = await estado()
  check('la flecha mueve una tarjeta entera', tras.x > 200, String(tras.x))
  check('  …y entonces sí hay vuelta atrás', tras.izq)
  const barra = await page.locator('#mcTira').evaluate((e) => ({
    oculta: getComputedStyle(e).scrollbarWidth, desliza: getComputedStyle(e).overflowX }))
  check('la barra está escondida', barra.oculta === 'none', JSON.stringify(barra))
  check('  …pero se sigue pudiendo deslizar', barra.desliza === 'auto', JSON.stringify(barra))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
