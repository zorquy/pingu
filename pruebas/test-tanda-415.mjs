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
  check('  …y el nombre se lee igualmente',
    await page.locator('[data-set="nada"] .mc-set-nombre').isVisible())
  await page.waitForTimeout(1200)
  // El símbolo llevaba guardado desde que se importa el catálogo y no lo
  // usaba nadie. Ahora es el segundo sitio donde mirar.
  check('se pide el logo', pedidas.some((u) => /\/x\/logo/.test(u)), '')
  check('  …y, al fallar, el símbolo', pedidas.some((u) => /simbolo\.webp/.test(u)),
    pedidas.filter((u) => /simbolo|logo/.test(u)).join(' | ').slice(0, 160))
  // EL NOMBRE ESTÁ SIEMPRE desde la tanda 456, llegue la imagen o no. Esta
  // comprobación nació porque el nombre se escondía detrás del logo —un
  // logo occidental lo lleva escrito— y había que sacarlo cuando el dibujo
  // fallaba; con los sets japoneses eso dejó de valer (un logo en kanji no
  // dice el nombre a quien no lee kanji), así que ahora el nombre es texto
  // y el logo es un dibujo al lado. Lo que se defiende sigue siendo lo
  // mismo: que una tarjeta NUNCA se quede sin decir qué es.
  const conNombre = await page.locator('.mc-set-nombre:visible').count()
  check('todas las tarjetas dicen su nombre, llegue o no la imagen', conNombre === 3, String(conNombre))
  // Y una sola vez: el truco viejo dejaba dos sitios donde escribirlo.
  const veces = await page.locator('[data-set="nada"] .mc-set-nombre').count()
  check('  …y solo una vez cada una', veces === 1, String(veces))
  await page.close()
}

console.log('\n── 3. Una carta sin escaneo dice su nombre ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=album')
  await page.locator('[data-set="nada"]').click()
  // SE ESPERA AL RESPALDO, no 900 ms. El nombre sale cuando la cadena de
  // imágenes se AGOTA, y la cadena ha ido creciendo —la 434 le añadió la
  // ruta montada a mano y la 435 pokemontcg.io—, así que cada fuente nueva
  // alarga la espera y un número fijo se queda corto sin avisar: la prueba
  // falla por el reloj y parece que falla la web.
  const nombre = page.locator('.mc-bolsillo .mc-carta-sinfoto').first()
  await nombre.waitFor({ state: 'attached', timeout: 15000 }).catch(() => {})
  check('el bolsillo lleva el nombre', /Bulbasaur/.test((await nombre.textContent().catch(() => '')) || ''))
  await page.close()
}

// LA TIRA YA NO EXISTE (tanda 440), igual que en test-tanda-410: aquella
// tanda cambió el carrusel por una rejilla porque las diapositivas llevan
// CIFRAS y una cifra cortada por el borde se lee como un fallo. Esta
// sección llevaba rota desde entonces —reventaba con un `null` al buscar
// `#mcTiraIzq`— y no se veía porque el fallo salía DESPUÉS de los de
// arriba. Es el tercer sitio con el mismo resto de la 440.
console.log('\n── 4. Las diapositivas, sin tira ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=resumen')
  check('no queda ninguna tira deslizable', (await page.locator('#mcTira').count()) === 0)
  check('  …ni sus flechas', (await page.locator('#mcTiraIzq, #mcTiraDer').count()) === 0)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
