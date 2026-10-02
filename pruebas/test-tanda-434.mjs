// Tanda 434 — la ruta del asset de TCGdex, montada a mano.
//
// TCGdex tiene un fallo conocido y abierto (cards-database#2362): hay
// imágenes SUBIDAS A SU CDN que su `datas.json` no lista, así que la API
// devuelve el campo `image` vacío y nuestro `image_path` nace a null. El
// issue nombra tres sets que son de los nuestros —`mep`, `P-A`, `svp`— y
// da la dirección que sí responde:
//
//     https://assets.tcgdex.net/en/sv/svp/196/high.png → 200
//
// Y esa dirección es la que ya montamos: `image_path` ES `serie/set/nº`.
//
// Lo que se prueba, y por qué cada cosa:
//   · que la ruta solo se monte cuando NO hay `image_path` (si no, la
//     misma dirección saldría dos veces en la cadena);
//   · que sin serie NO se invente una dirección — una dirección inventada
//     es una imagen rota, y eso ya está escrito en el módulo;
//   · y que ningún trozo pueda llevar una barra, que cambiaría de carpeta.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const { cadenaDeEscaneo, rutaDeAssetDeTCGdex } = await import(`${RAIZ}/js/escaneo-carta.js`)
const { urlDeLogoPorPartes, urlDeImagen } = await import(`${RAIZ}/js/carta-ruta.js`)

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La ruta, en Node ──')
{
  // El caso exacto del issue de TCGdex.
  const svp = { id: 'svp-196', set_id: 'svp', local_id: '196', image_path: null, market: 'WEST',
    tcg_sets: { serie_id: 'sv', tcg_online_code: 'PR-SV' } }
  check('la ruta es serie/set/número', rutaDeAssetDeTCGdex(svp) === 'sv/svp/196', rutaDeAssetDeTCGdex(svp))
  check('  …y da la dirección que el issue dice que responde',
    urlDeImagen(rutaDeAssetDeTCGdex(svp), 'high') === 'https://assets.tcgdex.net/en/sv/svp/196/high.webp',
    urlDeImagen(rutaDeAssetDeTCGdex(svp), 'high'))

  // La serie puede llegar por tres caminos distintos según de qué
  // consulta venga la carta.
  check('la serie vale desde el set embebido', rutaDeAssetDeTCGdex(svp) === 'sv/svp/196')
  check('  …desde la carta', rutaDeAssetDeTCGdex({ set_id: 'svp', local_id: '1', serie_id: 'sv' }) === 'sv/svp/1')
  check('  …y desde quien llama', rutaDeAssetDeTCGdex({ set_id: 'svp', local_id: '1' }, 'sv') === 'sv/svp/1')

  // Sin serie no hay dirección: inventarla daría una que no es, y una
  // dirección inventada es una imagen rota.
  check('sin serie, nada', rutaDeAssetDeTCGdex({ set_id: 'mcd', local_id: '1' }) === null)
  check('sin set, nada', rutaDeAssetDeTCGdex({ local_id: '1', serie_id: 'sv' }) === null)
  check('sin número, nada', rutaDeAssetDeTCGdex({ set_id: 'svp', serie_id: 'sv' }) === null)
  check('sin carta, nada', rutaDeAssetDeTCGdex(null) === null)
  // Los tres trozos van en una dirección: una barra dentro cambiaría de
  // carpeta, y un espacio la partiría.
  check('una barra dentro no se cuela', rutaDeAssetDeTCGdex({ set_id: 'a/b', local_id: '1', serie_id: 'sv' }) === null)
  check('  …ni en la serie', rutaDeAssetDeTCGdex({ set_id: 'svp', local_id: '1', serie_id: '../sv' }) === null)
  check('  …ni un espacio en el número', rutaDeAssetDeTCGdex({ set_id: 'svp', local_id: '1 2', serie_id: 'sv' }) === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La cadena de escaneo ──')
{
  const base = { set_id: 'svp', local_id: '196', market: 'WEST', tcg_sets: { serie_id: 'sv', tcg_online_code: 'PR-SV' } }
  const sinRuta = cadenaDeEscaneo({ ...base, image_path: null }, null, 'high')
  check('sin `image_path`, la monta a mano', sinRuta[0] === 'https://assets.tcgdex.net/en/sv/svp/196/high.webp', JSON.stringify(sinRuta))
  check('  …y Limitless se queda de respaldo detrás', /limitless/i.test(sinRuta[1] || ''), JSON.stringify(sinRuta))

  // Con la columna puesta NO se monta nada a mano. Y el `image_path` del
  // ejemplo apunta a OTRO sitio a propósito: si apuntara a `sv/svp/196`
  // —que es lo que montaría la mano— la cadena deduplica y esta
  // comprobación saldría verde con la guarda puesta y sin ella.
  const conRuta = cadenaDeEscaneo({ ...base, image_path: 'viejo/camino/9' }, null, 'high')
  check('con `image_path`, se usa el SUYO', conRuta[0] === 'https://assets.tcgdex.net/en/viejo/camino/9/high.webp',
    JSON.stringify(conRuta))
  check('  …y no se monta ninguno a mano', !conRuta.some((u) => /\/sv\/svp\/196\//.test(u)), JSON.stringify(conRuta))
  check('  …así que la cadena son dos: el suyo y Limitless', conRuta.length === 2, JSON.stringify(conRuta))

  // Una carta sin serie y sin código se queda como estaba: sin nada que
  // enseñar. No se inventa.
  const nada = cadenaDeEscaneo({ set_id: '2021swsh', local_id: '1', image_path: null, market: 'WEST' }, null, 'high')
  check('sin serie y sin código, la cadena sigue vacía', nada.length === 0, JSON.stringify(nada))

  // Y el idioma: una japonesa no se enseña con el arte inglés de
  // Limitless, pero su asset de TCGdex sí vale (lo monta `urlDelEspejo`).
  const jp = cadenaDeEscaneo({ set_id: 'sv1', local_id: '1', image_path: null, market: 'JP',
    tcg_sets: { serie_id: 'sv' } }, null, 'high', (r, c) => `https://assets.tcgdex.net/ja/${r}/${c}.webp`)
  check('una japonesa la monta en SU idioma', jp[0] === 'https://assets.tcgdex.net/ja/sv/sv1/1/high.webp', JSON.stringify(jp))
  check('  …y no se le cuela el arte inglés de Limitless', !jp.some((u) => /limitless/i.test(u)), JSON.stringify(jp))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. El logo de un set ──')
{
  check('la ruta del logo es serie/set/logo',
    urlDeLogoPorPartes('swsh', 'swsh12.5tg') === 'https://assets.tcgdex.net/en/swsh/swsh12.5tg/logo.webp',
    urlDeLogoPorPartes('swsh', 'swsh12.5tg'))
  check('sin serie, nada', urlDeLogoPorPartes(null, 'x') === null)
  check('sin set, nada', urlDeLogoPorPartes('swsh', null) === null)
  check('una barra dentro no se cuela', urlDeLogoPorPartes('swsh', 'a/b') === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. En la pantalla ──')
const browser = await chromium.launch()
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  // Se mira QUÉ PIDE la página, no qué queda pintado. Aquí la red está
  // cerrada, así que el asset de TCGdex no llega y el respaldo de la tanda
  // 415 quita la imagen y saca el nombre — que es justo lo que tiene que
  // hacer. Mirar el resultado comprobaría el respaldo; lo que se prueba es
  // que la dirección se monta y se pide.
  const pedidas = []
  page.on('request', (r) => { if (r.resourceType() === 'image') pedidas.push(r.url()) })
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [
      // Con logo: no se monta nada a mano.
      // El `logo_path` va a un camino DISTINTO del que montaría la mano
      // (`sv/sv1/logo`) a propósito: si fueran iguales, la comprobación de
      // «no monta ninguna de más» no distinguiría nada.
      { id: 'sv1', name: 'Scarlet & Violet', market: 'WEST', serie_id: 'sv', logo_path: 'viejo/camino/logo',
        card_count_official: 2, card_count_total: 2, release_date: '2023-03-31', tcg_online_code: 'SVI' },
      // Sin logo NI símbolo: el caso de los 37 sets de PINGU.
      { id: 'svp', name: 'SVP Black Star Promos', market: 'WEST', serie_id: 'sv', logo_path: null,
        symbol_url: null, card_count_official: 2, card_count_total: 2, release_date: '2023-03-31',
        tcg_online_code: 'PR-SV' },
    ]
    window.__FAKE_CARTAS__ = [
      { id: 'svp-196', set_id: 'svp', local_id: '196', name: 'Charizard ex', image_path: null,
        market: 'WEST', rarity: 'Common', category: 'Pokemon', variants: { normal: true } },
      { id: 'svp-1', set_id: 'svp', local_id: '1', name: 'Pikachu', image_path: 'sv/svp/1',
        market: 'WEST', rarity: 'Common', category: 'Pokemon', variants: { normal: true } },
    ]
    window.__FAKE_COLECCION__ = []
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)

  // El set sin logo monta la ruta a mano: la tarjeta pide el fichero en
  // vez de quedarse con el nombre pelado sin intentar nada.
  check('el set sin logo PIDE la ruta montada a mano',
    pedidas.includes('https://assets.tcgdex.net/en/sv/svp/logo.webp'),
    JSON.stringify(pedidas.filter((u) => /tcgdex/.test(u))))
  // Y el fondo borroso de la tarjeta lo lleva también: ese no lo quita el
  // respaldo, así que sirve para ver que la dirección llegó al HTML.
  const arte = await page.locator('.mc-set-tarjeta').filter({ hasText: 'SVP' })
    .locator('.mc-set-arte').getAttribute('style')
  check('  …y la lleva en el fondo de la tarjeta', /assets\.tcgdex\.net\/en\/sv\/svp\/logo\.webp/.test(arte || ''), arte)
  // El que SÍ tiene logo no monta nada a mano: saldría la misma dirección
  // dos veces.
  check('el set con logo usa el SUYO y no monta ninguno de más',
    pedidas.includes('https://assets.tcgdex.net/en/viejo/camino/logo.webp') &&
    !pedidas.some((u) => u.endsWith('/sv/sv1/logo.webp')),
    JSON.stringify(pedidas.filter((u) => /logo/.test(u))))

  // Y dentro de la expansión, la carta sin `image_path`.
  await page.locator('.mc-set-tarjeta').filter({ hasText: 'SVP' }).click()
  await page.waitForTimeout(1500)
  const deLaCarta = pedidas.filter((u) => /\/sv\/svp\/196\//.test(u))
  check('la carta sin `image_path` pide el asset montado a mano', deLaCarta.length > 0,
    JSON.stringify(pedidas.filter((u) => /tcgdex/.test(u)).slice(0, 6)))
  // Y cuando el asset no llega, el respaldo de la 415 sigue haciendo lo
  // suyo: fuera la imagen y el nombre en el hueco. Lo que NO puede pasar
  // es que se quede un icono roto.
  await page.waitForTimeout(800)
  const rotas = await page.locator('#mcAlbum img').evaluateAll((ns) => ns.filter((n) => n.complete && n.naturalWidth === 0).length)
  check('  …y si no llega, no se queda un icono roto', rotas === 0, String(rotas))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
