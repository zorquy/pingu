// Tanda 943 — «la tienes» y «la quieres» en todas partes.
//
// PINGU: «en la Pokédex no tenemos el corazoncito de las cartas que ya
// tienes marcadas como me gusta. En las expansiones sí está, pero en la
// Pokédex no. Los iconos de que la tienes, todo eso debería estar en todos
// los lados de la web».
//
// Lo que se mira:
//   1. La Pokédex: el ✓ con sus insignias (cuántas, y la otra versión) y el
//      corazón en la que quieres y no tienes; separadas, igual por versión.
//      Y al ponerle el corazón desde la ficha, sale en su casilla al momento.
//   2. Buscar de Mi colección: lo mismo, sin separar las versiones.
//   3. La lista de una expansión: el corazón en la columna de la cuenta.
//   4. El Mercado: el ✓ en la carta que da otro y tú ya tienes.
//   5. Fuera de Mi colección: /buscar, la vitrina de otra persona; y sin
//      cuenta, nada (ni se pregunta).
//   6. Lo puro de js/marcas-carta.js y que los demás pintores lo usan.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const SETS = [{ id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 160, card_count_total: 164, tcg_online_code: 'PRC' }]
const carta = (n, nombre, dex, extra = {}) => ({ id: `xy5-${n}`, market: 'WEST', set_id: 'xy5', local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [dex], variants: { normal: true, reverse: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', release_date: '2015-02-04' }, ...extra })
// Tres Weedle: el 1 lo tengo (una normal y una reverse), el 3 lo quiero y
// no lo tengo, el 5 ni lo tengo ni lo quiero.
const CARTAS = [carta(1, 'Weedle', 13), carta(3, 'Weedle', 13), carta(5, 'Weedle', 13), carta(9, 'Kakuna', 14)]
const linea = (id, user, card, variante = 'normal', o = {}) => ({ id, user_id: user, card_id: card, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z', ...o })
const COLECCION = [
  linea('l1', 'admin-1', 'xy5-1'), linea('l2', 'admin-1', 'xy5-1', 'reverse'),
  // Lo de la otra persona: da el Weedle 1 (que yo tengo) y el 5.
  linea('o1', 'user-2', 'xy5-1', 'normal', { cambio: 1 }), linea('o2', 'user-2', 'xy5-5', 'normal', { cambio: 1 }),
]
const DESEOS = [{ id: 'd1', user_id: 'admin-1', card_id: 'xy5-3', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }]
const PERFILES = [{ id: 'admin-1', username: 'pingu' }, { id: 'user-2', username: 'danipoke', display_name: 'Dani', coleccion_publica: true }]
const VITRINA = [1, 3, 5].map((n, i) => ({ user_id: 'user-2', posicion: i + 1, card_id: `xy5-${n}`, market: 'WEST' }))

const browser = await chromium.launch()
async function abrir({ sesion = true, split = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion ? 'admin-1' : 'none'
    try { localStorage.setItem('mc-split', d.split ? '1' : '0') } catch {}
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = d.COLECCION
    window.__FAKE_DESEOS__ = d.DESEOS
    window.__FAKE_PERFILES__ = d.PERFILES
    window.__FAKE_VITRINA__ = d.VITRINA
    window.__FAKE_PRECIOS__ = []
    window.__FAKE_GUIAS__ = []
    window.__FAKE_TEMAS__ = []
  }, { SETS, CARTAS, COLECCION, DESEOS, PERFILES, VITRINA, sesion, split })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
const ir = async (page, ruta) => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
}
// Lo que lleva cada casilla: ✓, cuántas, las insignias de versión y el corazón.
const marcasDe = (page, sel) => page.$$eval(sel, (as) => as.map((a) => {
  const id = a.dataset.carta + (a.dataset.version ? `/${a.dataset.version}` : '')
  const ins = [...a.querySelectorAll('.mc-insignia')].map((i) => (i.classList.contains('mc-insignia-n') ? i.textContent : i.dataset.var)).join('+')
  return `${id}:${a.querySelector('.mc-tengo-marca') ? '✓' : ''}${ins ? `[${ins}]` : ''}${a.querySelector('.mc-quiero-marca') ? '♥' : ''}`
}).join(' '))

console.log('── 1. La Pokédex ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=pokedex')
  await page.evaluate(() => document.querySelector('button[data-dex="13"]')?.scrollIntoView())
  await page.locator('button[data-dex="13"]').first().click({ force: true })
  await page.waitForTimeout(1500)
  const m = await marcasDe(page, '#mcPokedexPanel .pdx-carta')
  check('la que tienes: ✓, «2» y la insignia de la reverse; la que quieres, el corazón; la otra, nada', m === 'xy5-1:✓[2+reverse] xy5-3:♥ xy5-5:', m)
  const etiqueta = await page.getAttribute('#mcPokedexPanel .pdx-carta[data-carta="xy5-3"]', 'aria-label')
  check('  …y la que quieres lo dice en voz alta', /te falta y la quieres$/.test(etiqueta || ''), etiqueta)
  const color = await page.$eval('#mcPokedexPanel .pdx-carta[data-carta="xy5-3"] .mc-quiero-marca', (e) => ({ pos: getComputedStyle(e).position, color: getComputedStyle(e).color, filtro: getComputedStyle(e.closest('.pdx-carta').querySelector('img')).filter }))
  check('  …el corazón va encima de la foto y en rosa (la foto sigue en gris)', color.pos === 'absolute' && color.color !== 'rgb(128, 128, 128)' && color.filtro !== 'none', JSON.stringify(color))
  // Ponerle el corazón desde la ficha: sale en su casilla al momento.
  await page.locator('#mcPokedexPanel .pdx-carta[data-carta="xy5-5"]').click()
  await page.waitForTimeout(900)
  await page.click('#mcEdQuiero')
  await page.waitForTimeout(600)
  if (await page.locator('#iddApuntar').isVisible().catch(() => false)) await page.click('#iddApuntar')
  await page.waitForTimeout(900)
  const tras = await marcasDe(page, '#mcPokedexPanel .pdx-carta')
  check('al ponerle el corazón en la ficha, sale en la Pokédex sin recargar', tras.includes('xy5-5:♥'), tras)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir({ split: true })
  await ir(page, '/mi-coleccion.html?ver=pokedex')
  await page.evaluate(() => document.querySelector('button[data-dex="13"]')?.scrollIntoView())
  await page.locator('button[data-dex="13"]').first().click({ force: true })
  await page.waitForTimeout(1500)
  const m = await marcasDe(page, '#mcPokedexPanel .pdx-carta')
  check('separadas: cada versión tuya con su ✓ (sin insignias), las que quieres con el corazón', m === 'xy5-1/normal:✓ xy5-1/reverse:✓ xy5-3/normal:♥ xy5-3/reverse:♥ xy5-5/normal: xy5-5/reverse:', m)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Buscar ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=buscar&q=weedle')
  const m = await marcasDe(page, '#mcBuscarResultados .mc-resultado')
  check('Buscar: el ✓ con sus insignias en la tuya, el corazón en la que quieres', m === 'xy5-1:✓[2+reverse] xy5-3:♥ xy5-5:', m)
  const clases = await page.$$eval('#mcBuscarResultados .mc-resultado', (as) => as.map((a) => a.classList.contains('tengo')))
  check('  …y la tuya lleva `tengo` (la que mira refrescarCorazones)', clases.join() === 'true,false,false', clases.join())
  const etiqueta = await page.getAttribute('#mcBuscarResultados .mc-resultado[data-carta="xy5-1"]', 'aria-label')
  check('  …y lo dice en voz alta: cuántas y con qué versión', /tienes 2, con Reverse/.test(etiqueta || ''), etiqueta)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. La lista de una expansión ──')
{
  const { ctx, page, errores } = await abrir()
  await page.addInitScript(() => { try { localStorage.setItem('mc-album-vista', 'lista') } catch {} })
  await ir(page, '/mi-coleccion.html?ver=album&set=xy5')
  const filas = await page.$$eval('#mcAlbum .mc-album-fila', (fs) => fs.map((f) => `${f.dataset.carta}:${f.querySelector('.mc-album-fila-quiero') ? '♥' : f.querySelector('.mc-album-fila-cuenta').textContent.trim()}`).join(' '))
  check('la lista: ×2 en la tuya, el corazón en la que quieres, la raya en las demás', filas === 'xy5-1:×2 xy5-3:♥ xy5-5:— xy5-9:—', filas)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. El Mercado ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=mercado')
  const m = await page.$$eval('#mcMercadoRejilla .mc-merc', (as) => as.map((a) => `${a.dataset.merc}:${a.querySelector('.mc-merc-foto .mc-tengo-marca') ? '✓' : ''}${a.querySelector('.mc-insignia-n')?.textContent || ''}`).sort().join(' '))
  check('el Mercado: el ✓ (con cuántas) en la que da otro y tú ya tienes', m === 'xy5-1:✓2 xy5-5:', m)
  const etiqueta = await page.getAttribute('#mcMercadoRejilla [data-merc-ficha="xy5-1"]', 'aria-label')
  check('  …y lo dice en voz alta', /tienes 2/.test(etiqueta || ''), etiqueta)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Fuera de Mi colección ──')
const marcasFuera = (page, sel) => page.$$eval(sel, (es) => es.map((e) => `${e.dataset.marcaCarta}:${e.querySelector('.mk-tengo, .mk-fila-tengo')?.textContent.replace(/\s+/g, '') || ''}${e.querySelector('.mk-quiero, .mk-fila-quiero') ? '♥' : ''}`).join(' '))
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/buscar.html?q=weedle&en=cartas')
  const m = await marcasFuera(page, '#searchResults [data-marca-carta]')
  check('/buscar: «✓2» en la tuya, el corazón en la que quieres, nada en la otra', m === 'xy5-1:✓2 xy5-3:♥ xy5-5:', m)
  const hueco = await page.$eval('#searchResults [data-marca-carta="xy5-5"]', (e) => getComputedStyle(e).display)
  check('  …y la que no lleva nada no deja hueco en la fila', hueco === 'none', hueco)
  const etiqueta = await page.$eval('#searchResults [data-marca-carta="xy5-3"]', (e) => e.closest('a').getAttribute('aria-label'))
  check('  …y el enlace lo dice en voz alta, con sus espacios', etiqueta === 'Weedle Duelos Primigenios · 3, la quieres', etiqueta)
  check('sin errores', errores.length === 0, errores.join(' | '))

  await ir(page, '/usuario.html?id=user-2')
  const v = await marcasFuera(page, '#perfilVitrina [data-marca-carta]')
  check('la vitrina de otra persona: lo que tú tienes y lo que quieres', v === 'xy5-1:✓2 xy5-3:♥ xy5-5:', v)
  const pos = await page.$eval('#perfilVitrina [data-marca-carta="xy5-1"] .mk-tengo', (e) => {
    const r = e.getBoundingClientRect()
    const f = e.closest('a').querySelector('img').getBoundingClientRect()
    return { dentro: r.top >= f.top && r.right <= f.right + 1 && r.top < f.top + 40, pos: getComputedStyle(e).position, color: getComputedStyle(e).color, fondo: getComputedStyle(e).backgroundColor }
  })
  check('  …el ✓ va en la esquina de la foto', pos.dentro && pos.pos === 'absolute', JSON.stringify(pos))
  // La hoja de la vitrina pinta `.vitrina-carta span` en gris: sin el
  // atributo delante, el ✓ salía gris sobre verde (se vio en una captura).
  check('  …en blanco sobre verde, no con el gris de los rótulos de la vitrina', pos.color === 'rgb(255, 255, 255)' && pos.fondo === 'rgb(10, 122, 85)', JSON.stringify(pos))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir({ sesion: false })
  const preguntas = []
  page.on('request', (r) => { if (/user_collection|user_wants/.test(r.url())) preguntas.push(r.url()) })
  await ir(page, '/buscar.html?q=weedle&en=cartas')
  const n = await page.$$eval('#searchResults .mk-fila', (es) => es.length)
  check('sin cuenta, ninguna marca', n === 0, String(n))
  // El doble de Supabase vive en la página y no hace peticiones: lo que
  // delata que se ha preguntado es la hoja, que se mete DESPUÉS de mirar
  // quién eres y antes de pintar.
  const hoja = await page.$$eval('link[href*="marcas-carta.css"]', (ls) => ls.length)
  check('  …y no se pregunta por la colección de nadie (ni se baja la hoja)', preguntas.length === 0 && hoja === 0, `${preguntas.join(' ')} hoja=${hoja}`)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 6. Lo puro y quién lo usa ──')
{
  globalThis.window = globalThis.window || { __FAKE_SESSION__: 'none' }
  const { marcasHtml, marcasTexto } = await import(`${RAIZ}/js/marcas-carta.js`)
  check('con copias, el ✓ (y cuántas si son dos o más)', /mk-tengo/.test(marcasHtml({ n: 1 })) && !/<b>/.test(marcasHtml({ n: 1 })) && /<b>3<\/b>/.test(marcasHtml({ n: 3 })))
  check('  …y aunque la quieras, si la tienes manda el ✓', !/mk-quiero/.test(marcasHtml({ n: 1, quiere: true })))
  check('sin copias y queriéndola, el corazón; si no, nada', /mk-quiero/.test(marcasHtml({ quiere: true })) && marcasHtml({}) === '')
  check('en fila, chapas', /mk-fila-tengo/.test(marcasHtml({ n: 2, forma: 'fila' })) && /mk-fila-quiero/.test(marcasHtml({ quiere: true, forma: 'fila' })))
  check('lo que se lee: «tienes 2», «la tienes», «la quieres»', marcasTexto({ n: 2 }) === 'tienes 2' && marcasTexto({ n: 1 }) === 'la tienes' && marcasTexto({ quiere: true }) === 'la quieres' && marcasTexto({}) === '')
  const lee = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
  for (const [f, marca] of [['js/buscador-filas.js', 'data-marca-carta'], ['js/vitrina.js', 'data-marca-carta'], ['js/cards-block.js', 'data-marca-carta'], ['js/carta.js', 'data-marca-carta']]) check(`${f} pinta el hueco de la marca`, lee(f).includes(marca))
  for (const f of ['js/search.js', 'js/paleta.js', 'js/vitrina.js', 'js/cards-block.js', 'js/carta.js']) check(`${f} llama a marcarCartas`, /import\('\.\/marcas-carta\.js'\)\.then\(\(m\) => m\.marcarCartas\(/.test(lee(f)))
  check('los álbumes ponen el corazón en las que te faltan', /ctx\.quiero\?\.\(c\.id\)/.test(lee('js/mi-coleccion/albumes.js')))
  check('la hoja va inyectada con su literal (lo lee la prueba 299)', lee('js/marcas-carta.js').includes("hojaInyectada('css/marcas-carta.css')"))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
