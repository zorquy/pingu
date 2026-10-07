// Tanda 435 — el CDN de pokemontcg.io, de último recurso.
//
// PINGU abrió las direcciones a mano, que es como se resuelven estas cosas
// cuando el contenedor no tiene red: de su Bulbasaur SWSH303 no hay
// escaneo ni en TCGdex —lo confirmé en su propio código: el fichero
// `SWSH303.ts` no tiene campo de imagen— ni en Limitless, con ninguno de
// los dos nombres de carpeta que probamos. Y pokemontcg.io sí lo tiene.
//
// Lo que hace que esto NO sea una dependencia de verdad: sus fotos no
// piden clave. La clave es para su API de datos; `images.pokemontcg.io` es
// un CDN a secas. Es una dirección más que probar, y si no contesta la
// cadena sigue como antes.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const { cadenaDeEscaneo, imagenDePokemonTCG, setDePokemonTCG } = await import(`${RAIZ}/js/escaneo-carta.js`)

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El identificador de set ──')
{
  // Casi siempre es el nuestro.
  check('un set normal pasa tal cual', setDePokemonTCG('swshp') === 'swshp')
  check('  …y otro también', setDePokemonTCG('sv1') === 'sv1')

  // Salvo McDonald's, que ellos nombran por el AÑO. Se DEDUCE: una tabla
  // de doce entradas se queda vieja a la siguiente colaboración, y el
  // patrón es el mismo desde 2011 (la lección de la tanda 323).
  check('McDonald\'s de Espada y Escudo', setDePokemonTCG('2021swsh') === 'mcd21', setDePokemonTCG('2021swsh'))
  check('  …de Escarlata y Púrpura', setDePokemonTCG('2023sv') === 'mcd23', setDePokemonTCG('2023sv'))
  check('  …de XY', setDePokemonTCG('2014xy') === 'mcd14', setDePokemonTCG('2014xy'))
  check('  …y de Blanco y Negro', setDePokemonTCG('2012bw') === 'mcd12', setDePokemonTCG('2012bw'))
  // Y una era NUEVA con el mismo patrón se deduciría sola el día que
  // salga, que es de lo que iba hacerlo con una regla y no con una lista.
  check('  …una era futura con el mismo patrón, sola', setDePokemonTCG('2027sv') === 'mcd27', setDePokemonTCG('2027sv'))

  // Lo que NO encaja en el patrón se deja pasar: si el identificador no es
  // el suyo, la dirección da 404 y la cadena sigue. No se inventa nada.
  check('un trainer kit se deja pasar tal cual', setDePokemonTCG('tk-sm-r') === 'tk-sm-r')
  check('un año suelto no es McDonald\'s', setDePokemonTCG('2021') === '2021')
  check('  …ni un año con una era que no existe', setDePokemonTCG('2021zz') === '2021zz')

  check('sin set, nada', setDePokemonTCG(null) === null && setDePokemonTCG('') === null)
  // Va en una dirección: una barra cambiaría de carpeta.
  check('una barra no se cuela', setDePokemonTCG('a/b') === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La dirección ──')
{
  check('la pequeña no lleva sufijo',
    imagenDePokemonTCG('swshp', 'SWSH303', 'low') === 'https://images.pokemontcg.io/swshp/SWSH303.png',
    imagenDePokemonTCG('swshp', 'SWSH303', 'low'))
  // `_hires` es su versión grande, y se elige con la MISMA palabra que el
  // resto de la cadena: quien pide 'high' la recibe grande en los tres
  // sitios.
  check('la grande lleva `_hires`',
    imagenDePokemonTCG('swshp', 'SWSH303', 'high') === 'https://images.pokemontcg.io/swshp/SWSH303_hires.png',
    imagenDePokemonTCG('swshp', 'SWSH303', 'high'))
  check('  …y es la que PINGU comprobó que carga',
    imagenDePokemonTCG('swshp', 'SWSH303', 'high').endsWith('/swshp/SWSH303_hires.png'))
  check('McDonald\'s, con su nombre',
    imagenDePokemonTCG('2021swsh', '1', 'low') === 'https://images.pokemontcg.io/mcd21/1.png',
    imagenDePokemonTCG('2021swsh', '1', 'low'))
  check('sin número, nada', imagenDePokemonTCG('swshp', null) === null)
  check('un número con barra no se cuela', imagenDePokemonTCG('swshp', '1/2') === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Dónde va en la cadena ──')
{
  const carta = { set_id: 'swshp', local_id: 'SWSH303', image_path: null, market: 'WEST',
    tcg_sets: { serie_id: 'swsh', tcg_online_code: 'PR-SW' } }
  const c = cadenaDeEscaneo(carta, null, 'high')
  // La ÚLTIMA a propósito: las dos de delante son el escaneo oficial de
  // TPCi, y esta es la red de seguridad.
  check('va la última', c[c.length - 1] === 'https://images.pokemontcg.io/swshp/SWSH303_hires.png', JSON.stringify(c))
  check('  …detrás de TCGdex', c.indexOf('https://images.pokemontcg.io/swshp/SWSH303_hires.png') > c.findIndex((u) => /tcgdex/.test(u)))
  check('  …y detrás de Limitless', c.indexOf('https://images.pokemontcg.io/swshp/SWSH303_hires.png') > c.findIndex((u) => /limitless/.test(u)))
  check('son tres sitios', c.length === 3, JSON.stringify(c))

  // Una japonesa NO: su catálogo es el inglés, igual que el de Limitless.
  // Enseñar la impresión inglesa de una japonesa cuenta otra cosa.
  const jp = cadenaDeEscaneo({ ...carta, market: 'JP' }, null, 'high')
  check('a una japonesa no se le cuela', !jp.some((u) => /pokemontcg\.io/.test(u)), JSON.stringify(jp))

  // Y una carta que no tiene NI set NI número no monta nada.
  check('sin datos, la cadena sigue vacía',
    cadenaDeEscaneo({ market: 'WEST' }, null, 'high').length === 0)

  // La que SÍ tiene escaneo propio lo sigue teniendo el primero: esto no
  // le quita el sitio a nadie.
  const buena = cadenaDeEscaneo({ ...carta, image_path: 'swsh/swshp/SWSH1' }, null, 'high')
  check('la que ya tiene escaneo no cambia de primero', /assets\.tcgdex\.net/.test(buena[0]), JSON.stringify(buena))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. En la pantalla ──')
const browser = await chromium.launch()
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  // Se mira QUÉ PIDE la página: aquí la red está cerrada, así que ninguna
  // de las tres llega y el respaldo de la 415 quita la imagen. Mirar el
  // resultado sería mirar el respaldo (la lección de la 434).
  const pedidas = []
  page.on('request', (r) => { if (r.resourceType() === 'image') pedidas.push(r.url()) })
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'swshp', name: 'SWSH Black Star Promos', market: 'WEST', serie_id: 'swsh',
      logo_path: 'swsh/swshp/logo', card_count_official: 1, card_count_total: 1,
      release_date: '2019-11-15', tcg_online_code: 'PR-SW' }]
    window.__FAKE_CARTAS__ = [{ id: 'swshp-SWSH303', set_id: 'swshp', local_id: 'SWSH303',
      name: 'Bulbasaur', image_path: null, market: 'WEST', rarity: 'Promo', category: 'Pokemon',
      variants: { normal: true } }]
    window.__FAKE_COLECCION__ = []
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(2000)
  // El navegador solo pide el siguiente cuando el anterior falla, así que
  // se espera a que la cadena se agote.
  await page.waitForTimeout(1500)
  check('la carta acaba pidiendo el CDN de pokemontcg.io',
    pedidas.some((u) => /images\.pokemontcg\.io\/swshp\/SWSH303/.test(u)),
    JSON.stringify(pedidas.slice(0, 8)))
  check('  …después de haber probado TCGdex', pedidas.some((u) => /assets\.tcgdex\.net\/en\/swsh\/swshp\/SWSH303/.test(u)),
    JSON.stringify(pedidas.slice(0, 8)))
  check('  …y Limitless', pedidas.some((u) => /limitless/.test(u)), JSON.stringify(pedidas.slice(0, 8)))
  check('y si no llega ninguna, no se queda un icono roto',
    (await page.locator('#mcAlbum img').evaluateAll((ns) => ns.filter((n) => n.complete && n.naturalWidth === 0).length)) === 0)
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
