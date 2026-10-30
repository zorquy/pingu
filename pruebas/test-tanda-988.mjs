// Tanda 988 — Retos, más limpios (1.ª tanda): el buscador de «¿Qué carta
// es?» con la carta entera, el final de tres salidas y «Jugar otra vez»
// (una partida libre que no da XP).
//
// PINGU: «cuando vas a buscar una carta salen todas apiladísimas… que se vea
// la carta completa»; «cuando acabas el reto hay demasiados botones»; «que
// puedas repetir el minijuego las veces que quieras… que te avise de que esa
// vez ya no te da experiencia».
//   1. Lo puro de las partidas libres (js/retos-libre.js).
//   2. Las funciones de Netlify: con `libre`, ni leen ni escriben la tabla
//      del día, eligen lo mismo para el mismo número y otra cosa para otro.
//   3. El buscador: las filas no se montan, la carta entera, el nombre DEBAJO,
//      tres por fila en el móvil y seis en el PC.
//   4. «¿Quién es?» libre: el aviso, sin XP, sin compartir, sin tocar la de
//      hoy ni la base; y la de hoy acaba con las tres salidas.
//   5. «¿Qué carta es?» libre pide su carta a la función con `?libre=N`, y la
//      carta resuelta se toca y abre su ficha.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hoy = new Date().toISOString().slice(0, 10)

console.log('── 1. Lo puro ──')
const L = await import(`${RAIZ}/js/retos-libre.js`)
{
  check('numeroLibre: del 1 al LIBRES, enteros', L.numeroLibre('1') === 1 && L.numeroLibre(L.LIBRES) === L.LIBRES && L.numeroLibre(0) === null && L.numeroLibre(L.LIBRES + 1) === null && L.numeroLibre('2.5') === null && L.numeroLibre('x') === null && L.numeroLibre(null) === null)
  check('libreDeDireccion lee ?libre=N', L.libreDeDireccion('?libre=42') === 42 && L.libreDeDireccion('?x=1') === null && L.libreDeDireccion('') === null)
  const dias = new Set(Array.from({ length: L.LIBRES }, (_, i) => L.diaLibre(i + 1)))
  check('cada partida libre es un día distinto', dias.size === L.LIBRES)
  check('  …y ninguno es un día de verdad (todos antes de 1903)', [...dias].every((d) => d < '1903-01-01' && d > '1899-12-31'))
  check('otraLibre nunca repite la que se acaba de jugar', [1, 500, L.LIBRES].every((n) => [0, 0.4999, 0.9999].every((a) => L.otraLibre(n, () => a) !== n)) && L.otraLibre(null, () => 0) === 1)
  check('claveLibre: la de hoy no se toca', L.claveLibre('pokedoc-quien-es', null) === 'pokedoc-quien-es' && L.claveLibre('pokedoc-quien-es', 3) === 'pokedoc-quien-es-libre')
  check('rutaLibre', L.rutaLibre('/mas-caro', 7) === '/mas-caro?libre=7')
}

console.log('\n── 2. Las funciones ──')
{
  const carta = await import(`${RAIZ}/netlify/functions/carta-del-dia.mjs`)
  const caro = await import(`${RAIZ}/netlify/functions/mas-caro.mjs`)
  const ordena = await import(`${RAIZ}/netlify/functions/ordena-precio.mjs`)
  check('libreDePeticion lee la consulta', carta.libreDePeticion(new Request('https://x/.netlify/functions/carta-del-dia?libre=12')) === 12 && carta.libreDePeticion(new Request('https://x/.netlify/functions/carta-del-dia')) === null && carta.libreDePeticion(new Request('https://x/?libre=99999')) === null)
  check('  …y la CDN guarda una libre un día', /durable/.test(carta.CABECERAS_LIBRE['netlify-cdn-cache-control']) && /max-age=86400/.test(carta.CABECERAS_LIBRE['netlify-cdn-cache-control']))
  check('las tres que usan mas-caro.mjs reciben las mismas piezas', caro.libreDePeticion === carta.libreDePeticion && caro.CABECERAS_LIBRE === carta.CABECERAS_LIBRE)
  // Un doble de PostgREST: 50 cartas elegibles; se apunta lo que se pide.
  const doble = () => {
    const pedidas = []
    const guardadas = []
    return {
      pedidas, guardadas,
      pedir: async (ruta) => {
        pedidas.push(ruta)
        if (/^carta_del_dia/.test(ruta)) return { datos: [{ card_id: 'c-del-dia' }] }
        if (/^tcg_cards\?select=id&.*limit=1$/.test(ruta) && !/offset/.test(ruta)) return { datos: [], total: 50 }
        const off = ruta.match(/offset=(\d+)/)
        if (off) return { datos: [{ id: `c-${off[1]}`, image_path: `x/c-${off[1]}` }] }
        const id = ruta.match(/id=eq\.([^&]+)/)
        if (id) return { datos: [{ id: decodeURIComponent(id[1]), name: 'X', tcg_sets: {} }] }
        return { datos: [] }
      },
      guardar: async (t, f) => { guardadas.push([t, f]) },
    }
  }
  const d1 = doble()
  const r1 = await carta.elegirCartaDelDia({ dia: hoy, libre: 5, ...d1 })
  check('¿Qué carta es? libre: no lee la carta del día ni guarda nada', !d1.pedidas.some((p) => /^carta_del_dia/.test(p)) && d1.guardadas.length === 0, JSON.stringify(d1.pedidas))
  check('  …contesta su día y su número, sin «ayer»', r1.libre === 5 && r1.dia === L.diaLibre(5) && r1.ayer === null && /^c-\d+$/.test(r1.carta?.id), JSON.stringify(r1))
  const r1b = await carta.elegirCartaDelDia({ dia: hoy, libre: 5, ...doble() })
  check('  …la misma libre da la misma carta', r1b.carta.id === r1.carta.id)
  const otras = new Set()
  for (let n = 1; n <= 12; n++) otras.add((await carta.elegirCartaDelDia({ dia: hoy, libre: n, ...doble() })).carta.id)
  check('  …y doce libres dan cartas distintas (casi todas)', otras.size >= 9, String(otras.size))
  const d2 = doble()
  const r2 = await carta.elegirCartaDelDia({ dia: hoy, ...d2 })
  check('la de hoy sigue saliendo de la tabla del día', r2.carta?.id === 'c-del-dia' && d2.pedidas[0].startsWith('carta_del_dia'))
  // Más caro y Ordena: con libre, ni la tabla ni guardar.
  const precios = () => {
    const pedidas = []
    const guardadas = []
    return {
      pedidas, guardadas,
      pedir: async (ruta) => {
        pedidas.push(ruta)
        if (/^(mas_caro_del_dia|retos_reto_del_dia)/.test(ruta)) return { datos: [] }
        if (/^tcg_card_prices\?select=card_id&.*limit=1$/.test(ruta)) return { datos: [], total: 400 }
        const off = ruta.match(/offset=(\d+)/)
        if (off) return { datos: [{ card_id: `p-${off[1]}` }] }
        const ids = ruta.match(/id=in\.\(([^)]*)\)/)
        if (ids && ruta.startsWith('tcg_cards')) return { datos: ids[1].split(',').map((x) => ({ id: x.replace(/"/g, ''), name: x, image_path: 'x/1', tcg_sets: {} })) }
        if (ids && ruta.startsWith('tcg_card_prices')) return { datos: ids[1].split(',').map((x, i) => ({ card_id: x.replace(/"/g, ''), cm_trend: 1 + i * 3.7 })) }
        return { datos: [] }
      },
      guardar: async (t, f) => { guardadas.push([t, f]) },
    }
  }
  const d3 = precios()
  const r3 = await caro.elegirMasCaro({ dia: hoy, libre: 9, ...d3 })
  check('¿Más caro? libre: no lee ni escribe la tabla del día', !d3.pedidas.some((p) => /^mas_caro_del_dia/.test(p)) && d3.guardadas.length === 0 && r3.libre === 9 && r3.cartas?.length >= 6, JSON.stringify(r3).slice(0, 200))
  const d4 = precios()
  const r4 = await ordena.elegirOrdena({ dia: hoy, libre: 9, ...d4 })
  check('Ordena libre: tampoco', !d4.pedidas.some((p) => /^retos_reto_del_dia/.test(p)) && d4.guardadas.length === 0 && r4.libre === 9 && r4.cartas?.length === 4, JSON.stringify(r4).slice(0, 200))
  const d5 = precios()
  await caro.elegirMasCaro({ dia: hoy, ...d5 })
  check('  …y la de hoy sí guarda', d5.guardadas.length === 1 && d5.guardadas[0][0] === 'mas_caro_del_dia')
}

const browser = await chromium.launch()
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#f7d354"/></svg>'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const SETS = [
  { id: 'sv8', name: 'Surging Sparks', market: 'WEST', serie_id: 'sv', release_date: '2024-11-08', card_count_official: 191, tcg_online_code: 'SSP' },
  { id: 'sv3pt5', name: '151', market: 'WEST', serie_id: 'sv', release_date: '2023-09-22', card_count_official: 165, tcg_online_code: 'MEW' },
]
const setDe = (id) => SETS.find((s) => s.id === id)
const cartaDe = (id, set, n, name) => ({ id, market: 'WEST', set_id: set, local_id: String(n), name, name_es: name, image_path: `sv/${set}/${n}`, category: 'Pokemon', rarity: 'Rare', rarity_en: 'Rare', types: ['Lightning'], tcg_sets: { name: setDe(set).name, tcg_online_code: setDe(set).tcg_online_code, serie_id: 'sv', release_date: setDe(set).release_date } })
const CARTAS = []
for (const s of SETS) for (let i = 1; i <= 9; i++) CARTAS.push(cartaDe(`${s.id}-${i}`, s.id, i, i % 2 ? 'Pikachu ex' : 'Pikachu'))

async function abrirCarta(vp, ruta = '/carta-del-dia.html', pedidas = []) {
  const page = await browser.newPage({ viewport: vp })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route('**/.netlify/functions/carta-del-dia**', (r) => {
    pedidas.push(r.request().url())
    const libre = new URL(r.request().url()).searchParams.get('libre')
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(libre ? { dia: L.diaLibre(Number(libre)), libre: Number(libre), carta: CARTAS[4], ayer: null } : { dia: hoy, numero: 1, carta: CARTAS[0], ayer: null }) })
  })
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: SVG }))
  await page.route(/limitlesstcg|pokemontcg\.io|images\.tcggo|scrydex/, (r) => r.abort())
  await page.addInitScript(([sets, cartas]) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_ERAS__ = [{ id: 'sv', market: 'WEST', nombre: 'Escarlata y Púrpura', orden: 10 }]
  }, [SETS, CARTAS])
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  return { page, errores }
}

console.log('\n── 3. El buscador de «¿Qué carta es?» ──')
for (const [nombre, vp, porFila] of [['móvil', { width: 390, height: 844 }, 3], ['PC', { width: 1280, height: 860 }, 6]]) {
  const { page, errores } = await abrirCarta(vp)
  await page.locator('#cdAdivinar').click()
  await page.fill('#nvBuscar', 'pikachu')
  await page.waitForTimeout(1200)
  const r = await page.$$eval('#nvResultados .nv-resultado', (bs) => bs.map((b) => {
    const c = b.querySelector('.nv-resultado-carta').getBoundingClientRect()
    const p = b.querySelector('.nv-resultado-pie').getBoundingClientRect()
    const r = b.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), cw: c.width, ch: c.height, cb: c.bottom, pt: p.top, nombre: b.querySelector('.nv-resultado-pie b')?.textContent, num: b.querySelector('.nv-resultado-pie small')?.textContent }
  }))
  check(`${nombre}: salen las 18, en dos grupos`, r.length === 18 && (await page.locator('.nv-grupo').count()) === 2, String(r.length))
  const primeraFila = r.filter((x) => x.top === r[0].top).length
  check(`  …${porFila} por fila`, primeraFila === porFila, String(primeraFila))
  check('  …la carta entera: su proporción, sin aplastar', r.every((x) => Math.abs(x.ch - (x.cw * 342) / 245) < 2), JSON.stringify(r[0]))
  // Ninguna fila se monta sobre la de debajo (lo de «apiladísimas»).
  const filas = [...new Set(r.map((x) => x.top))].sort((a, b) => a - b)
  const montadas = r.filter((x) => r.some((y) => y.top > x.top && y.top < Math.max(x.bottom, x.cb) - 1 && Math.abs(y.left - x.left) < 2))
  check('  …ninguna se monta sobre la de debajo', montadas.length === 0 && filas.length >= 2, JSON.stringify(montadas.slice(0, 2)))
  check('  …el nombre y el número DEBAJO de la carta', r.every((x) => x.pt >= x.cb - 1) && r[0].nombre === 'Pikachu' && /^\d+\/191$/.test(r[0].num), JSON.stringify(r[0]))
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 4. «¿Quién es?»: la de hoy y la libre ──')
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.route(/jsdelivr|githubusercontent/, (r) => r.fulfill({ contentType: 'image/png', body: PNG }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/quien-es.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const jugar = async () => {
    for (let i = 0; i < 4; i++) {
      const b = page.locator('.qe-opcion:not([disabled])').first()
      if (!(await b.count()) || (await page.locator('#qeFinal:not(.hidden)').count())) break
      await b.click()
      await page.waitForTimeout(300)
    }
    await page.waitForTimeout(400)
  }
  await jugar()
  const salidas = await page.locator('#qeFinal .rj-salidas a, #qeFinal .rj-salidas button').evaluateAll((es) => es.map((e) => ({ t: e.innerText.trim(), h: e.getAttribute('href'), alto: e.getBoundingClientRect().height })))
  check('la de hoy acaba con tres salidas: el siguiente, Compartir y Jugar otra vez', salidas.length === 3 && /^Siguiente: /.test(salidas[0].t) && salidas[1].t === 'Compartir' && salidas[2].t === 'Jugar otra vez' && /^\/quien-es\?libre=\d+$/.test(salidas[2].h), JSON.stringify(salidas))
  check('  …de 44 px', salidas.every((s) => s.alto >= 44), JSON.stringify(salidas.map((s) => s.alto)))
  check('  …sin «Compartir mi día», «Volver a los retos» ni «Sus cartas» de botón', (await page.locator('#qeFinal [data-mi-dia], #qeFinal .rj-volver-retos, #qeFinal .rj-salidas a[href*="pokedex"]').count()) === 0)
  check('  …y «sus cartas» va en la frase', (await page.locator('#qeFinal .subtext a[href*="ver=pokedex"]').count()) === 1)
  check('  …la cuenta atrás: «Mañana, otro:»', /Mañana, otro:/.test(await page.locator('#qeCuenta').innerText()))
  const hoyGuardada = await page.evaluate(() => localStorage.getItem('pokedoc-quien-es'))
  // A la libre, por el botón.
  await page.locator('#qeFinal .rj-otra').click()
  await page.waitForURL(/libre=\d+/)
  await page.waitForTimeout(1500)
  const aviso = page.locator('.rj-libre')
  check('libre: el aviso arriba, que no da XP y que la de hoy ya la tienes', (await aviso.count()) === 1 && /Partida libre: esta no da XP\. La de hoy ya la tienes\./.test(await aviso.innerText()), await aviso.innerText().catch(() => ''))
  check('  …sin el «Ahora vale +N XP»', await page.locator('#qeBote').isHidden())
  check('  …y el subtítulo lo dice', /^Partida libre · intento 1 de 3/.test(await page.locator('#qeSub').innerText()))
  await jugar()
  const libres = await page.locator('#qeFinal .rj-salidas a, #qeFinal .rj-salidas button').evaluateAll((es) => es.map((e) => e.innerText.trim()))
  check('  …al acabar, sin Compartir: el siguiente y «Otra más»', libres.length === 2 && /^Siguiente: /.test(libres[0]) && libres[1] === 'Otra más', JSON.stringify(libres))
  check('  …sin premios de XP', (await page.locator('#qePremios .rj-premio').count()) === 0)
  check('  …la de hoy, intacta en el navegador', (await page.evaluate(() => localStorage.getItem('pokedoc-quien-es'))) === hoyGuardada)
  check('  …la libre, en su llave', JSON.parse((await page.evaluate(() => localStorage.getItem('pokedoc-quien-es-libre'))) || 'null')?.dia < '1903')
  check('  …y no se manda nada a la base', !(await page.evaluate(() => (window.__RPCS__ || []).some((r) => r.nombre === 'retos_guardar'))))
  check('sin errores', errores.length === 0, errores.join(' | '))
  // Una libre con la de hoy SIN hacer: el botón grande lleva a la de hoy.
  const otro = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await otro.route(/jsdelivr|githubusercontent/, (r) => r.fulfill({ contentType: 'image/png', body: PNG }))
  const p2 = await otro.newPage()
  await p2.goto(`${BASE}/quien-es.html?libre=3`, { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(1500)
  check('libre sin la de hoy hecha: el aviso manda a la de hoy', /Juega antes la de hoy/.test(await p2.locator('.rj-libre').innerText()) && (await p2.locator('.rj-libre a').getAttribute('href')) === '/quien-es')
  for (let i = 0; i < 4; i++) { const b = p2.locator('.qe-opcion:not([disabled])').first(); if (!(await b.count()) || (await p2.locator('#qeFinal:not(.hidden)').count())) break; await b.click(); await p2.waitForTimeout(300) }
  await p2.waitForTimeout(400)
  check('  …y al acabar, el botón grande es «Jugar la de hoy»', (await p2.locator('#qeFinal .rj-siguiente').getAttribute('href')) === '/quien-es' && /Jugar la de hoy/.test(await p2.locator('#qeFinal .rj-siguiente').innerText()))
  await otro.close()
  await ctx.close()
}

console.log('\n── 5. «¿Qué carta es?»: libre por la función, y la carta se toca ──')
{
  const pedidas = []
  const { page, errores } = await abrirCarta({ width: 390, height: 844 }, '/carta-del-dia.html?libre=17', pedidas)
  check('pide su carta con ?libre=17', pedidas.some((u) => /carta-del-dia\?libre=17$/.test(u)), pedidas.join(' '))
  check('  …con el aviso y sin bote', (await page.locator('.rj-libre').count()) === 1 && (await page.locator('#cdBote').isHidden()))
  // Acierta a la primera: la respuesta de la libre es CARTAS[4] (sv8-5).
  await page.locator('#cdAdivinar').click()
  await page.fill('#nvBuscar', 'pikachu')
  await page.waitForTimeout(1200)
  await page.locator('[data-elegir="sv8-5"]').click()
  await page.waitForTimeout(2200)
  check('  …acertada, sin Compartir y con «Otra más»', !(await page.locator('#cdFinal').evaluate((e) => e.classList.contains('hidden'))) && (await page.locator('#cdCompartir').count()) === 0 && (await page.locator('#cdFinal .rj-otra').innerText()).trim() === 'Otra más')
  check('  …sin «Ver la carta»: la frase dice que se toca', !/Ver la carta/.test(await page.locator('#cdFinal').innerText()) && /toca la carta para ver su ficha/.test(await page.locator('#cdFinal').innerText()))
  check('  …la carta es un enlace accesible', (await page.locator('#cdRecorte').getAttribute('role')) === 'link' && (await page.locator('#cdRecorte').getAttribute('tabindex')) === '0')
  check('  …y no guardó la de hoy', (await page.evaluate(() => localStorage.getItem('pokedoc-carta-del-dia'))) === null)
  await Promise.all([page.waitForURL(/\/carta\//, { timeout: 5000 }).catch(() => null), page.locator('#cdRecorte').click()])
  check('tocar la carta abre su ficha', /\/carta\/[a-z-]*sv8-5$/.test(page.url()), page.url())
  check('sin errores', errores.filter((e) => !/carta\.js|Carta no encontrada/.test(e)).length === 0, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
