// Tanda 511 — las megas, megas también en la imagen del meta.
//
// PINGU: «al exportar la imagen los sprites de las megas no salen bien,
// salen los pokemons normales».
//
// Medido el 2026-10-04 desde el navegador, en pokedoc.es: /sprite y
// /escaneo daban 404 a TODO (megas y no megas) mientras la CDN de Limitless
// contestaba al navegador. La imagen del meta, que no puede pintar el
// sprite de Limitless (no da CORS), caía en la cadena de respaldos, y el
// primer peldaño de una mega era la ESPECIE BASE. De ahí el Lucario donde
// tocaba Mega Lucario.
//
//   1. La cadena: una forma prueba antes SU dibujo en PokeAPI (por las dos
//      puertas) que la especie base. Para todas las megas de la lista,
//      para las que se registran solas, y para Ogerpon y Ursaluna.
//   2. /sprite y /escaneo dicen POR QUÉ no han traído nada (cabecera
//      `x-motivo`) y piden sin disfrazarse.
//   3. La imagen del meta, con /sprite caído como en producción: la mega
//      sale de SU sitio en PokeAPI, recortada a lo que ocupa (los de
//      PokeAPI traen un marco transparente que la dejaba a un tercio).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { deflateSync } from 'node:zlib'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const S = await import(`${RAIZ}/js/torneos/sprites-pokemon.js`)
const { CDN_SPRITES, FORMAS_TCG, spriteDeCarta, cadenaDeRespaldos, respaldoDeSprite } = S
const JSD = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon'
const GH = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'

console.log('\n── 1. La cadena: la forma antes que la especie ──')
{
  const cadena = (n) => {
    const u = spriteDeCarta(n)
    return [u, ...cadenaDeRespaldos(u)]
  }
  const g = cadena('Mega Gardevoir ex')
  check('Mega Gardevoir: Limitless, su mega en PokeAPI (las dos puertas), Gardevoir en Limitless y en PokeAPI', JSON.stringify(g) === JSON.stringify([`${CDN_SPRITES}/gardevoir-mega.png`, `${JSD}/10051.png`, `${GH}/10051.png`, `${CDN_SPRITES}/gardevoir.png`, `${JSD}/282.png`, `${GH}/282.png`]), g.join(' → '))
  check('  …en español también («Mega-Lucario ex» → 10059)', cadena('Mega-Lucario ex')[1] === `${JSD}/10059.png`)
  check('  …las de dos sabores, cada una la suya (X 10034, Y 10035)', cadena('Mega Charizard X ex')[1] === `${JSD}/10034.png` && cadena('Mega Charizard Y ex')[1] === `${JSD}/10035.png`)
  check('  …una que se registra sola, sin estar en la lista (Mega Heatran → 10311)', cadena('Mega Heatran ex')[1] === `${JSD}/10311.png` && cadena('Mega Heatran ex')[3] === `${CDN_SPRITES}/heatran.png`, cadena('Mega Heatran ex').join(' → '))
  check('  …y Ogerpon Fuente y Ursaluna Luna Carmesí, con su número de PokeAPI', cadena('Wellspring Mask Ogerpon ex')[1] === `${JSD}/10273.png` && cadena('Bloodmoon Ursaluna ex')[1] === `${JSD}/10272.png`)
  check('Mega Zygarde (que PokeAPI no tiene dibujada) va directa a Zygarde', cadena('Mega Zygarde ex')[1] === `${CDN_SPRITES}/zygarde.png`)
  check('una especie normal no cambia: Limitless y PokeAPI por las dos puertas', JSON.stringify(cadena('Dragapult ex')) === JSON.stringify([`${CDN_SPRITES}/dragapult.png`, `${JSD}/887.png`, `${GH}/887.png`]))
  // Contra la FORMA del fallo: TODAS las megas de la lista.
  const malas = FORMAS_TCG.filter((f) => /^Mega /.test(f.nombre) && f.slug && f.slug !== 'zygarde-mega').filter((f) => !/^https:\/\/cdn\.jsdelivr\.net\/.*\/1\d{4}\.png$/.test(respaldoDeSprite(`${CDN_SPRITES}/${f.slug}.png`) || ''))
  check(`las ${FORMAS_TCG.filter((f) => /^Mega /.test(f.nombre)).length} megas de la lista prueban antes su dibujo en PokeAPI (menos Zygarde)`, malas.length === 0, malas.map((f) => f.slug).join(' '))
  const largas = FORMAS_TCG.filter((f) => f.slug).filter((f) => cadenaDeRespaldos(`${CDN_SPRITES}/${f.slug}.png`).length > 5)
  check('  …y toda cadena termina (cinco pasos como mucho, en el tope de seis)', largas.length === 0)
  const final = (n) => cadena(n).at(-1)
  check('  …acabando siempre en la especie por GitHub, que es el último sitio', final('Mega Gardevoir ex') === `${GH}/282.png` && final('Wellspring Mask Ogerpon ex') === `${GH}/1017.png`)
}

console.log('\n── 2. /sprite y /escaneo dicen por qué ──')
{
  const { traerSprite, default: sprite } = await import(`${RAIZ}/netlify/functions/sprite.mjs`)
  const { traerEscaneo, default: escaneo } = await import(`${RAIZ}/netlify/functions/escaneo.mjs`)
  const cabeceras = []
  const falso = (status, tipo = 'image/png') => async (url, op) => {
    cabeceras.push(op?.headers || {})
    return new Response(status === 200 ? new Uint8Array([137, 80, 78, 71]) : '<html>', { status, headers: { 'content-type': tipo } })
  }
  const motivos = []
  await traerSprite('dragapult', { fetchImpl: falso(403, 'text/html'), alFallar: (m) => motivos.push(m) })
  await traerSprite('dragapult', { fetchImpl: falso(200, 'text/html'), alFallar: (m) => motivos.push(m) })
  await traerSprite('dragapult', { fetchImpl: async () => { throw Object.assign(new Error('x'), { name: 'TimeoutError' }) }, alFallar: (m) => motivos.push(m) })
  await traerSprite('../x', { fetchImpl: falso(200), alFallar: (m) => motivos.push(m) })
  check('/sprite sabe por qué no ha traído nada: «origen 403», «tipo text/html», «tiempo», «nombre»', motivos.join(' | ') === 'origen 403 | tipo text/html | tiempo | nombre', motivos.join(' | '))
  check('  …y pide diciendo quién es (sin disfrazarse de navegador)', /^PokeDoc\/1\.0 \(\+https:\/\/pokedoc\.es\)$/.test(cabeceras[0]?.['user-agent'] || ''), JSON.stringify(cabeceras[0]))
  const original = globalThis.fetch
  globalThis.fetch = falso(403, 'text/html')
  const r1 = await sprite(new Request('https://pokedoc.es/.netlify/functions/sprite?n=dragapult'))
  const r2 = await escaneo(new Request('https://pokedoc.es/.netlify/functions/escaneo?set=TWM&n=130'))
  globalThis.fetch = original
  check('el 404 lo lleva en la cabecera x-motivo (los dos)', r1.status === 404 && r1.headers.get('x-motivo') === 'origen 403' && r2.status === 404 && r2.headers.get('x-motivo') === 'origen 403', `${r1.headers.get('x-motivo')} / ${r2.headers.get('x-motivo')}`)
  const m2 = []
  await traerEscaneo('', '1', { fetchImpl: falso(200), alFallar: (m) => m2.push(m) })
  check('  …y /escaneo distingue lo que no es una carta', m2.join() === 'carta', m2.join())
}

// Un PNG de un color con un MARCO transparente alrededor, como los de
// PokeAPI (96×96 con el Pokémon en medio).
function pngConMarco(lado, dentro, [r, g, b]) {
  const crc = (buf) => {
    let c = ~0
    for (const x of buf) {
      c ^= x
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
    }
    return ~c >>> 0
  }
  const trozo = (tipo, datos) => {
    const t = Buffer.concat([Buffer.from(tipo), datos])
    const largo = Buffer.alloc(4)
    largo.writeUInt32BE(datos.length)
    const suma = Buffer.alloc(4)
    suma.writeUInt32BE(crc(t))
    return Buffer.concat([largo, t, suma])
  }
  const cab = Buffer.alloc(13)
  cab.writeUInt32BE(lado, 0)
  cab.writeUInt32BE(lado, 4)
  cab.set([8, 6, 0, 0, 0], 8)
  const m = (lado - dentro) / 2
  const filas = []
  for (let y = 0; y < lado; y++) {
    const fila = [0]
    for (let x = 0; x < lado; x++) {
      const lleno = x >= m && x < m + dentro && y >= m && y < m + dentro
      fila.push(...(lleno ? [r, g, b, 255] : [0, 0, 0, 0]))
    }
    filas.push(Buffer.from(fila))
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', cab), trozo('IDAT', deflateSync(Buffer.concat(filas))), trozo('IEND', Buffer.alloc(0))])
}
const VERDE = pngConMarco(96, 40, [0, 255, 0])
const MAGENTA = pngConMarco(96, 40, [255, 0, 255])

console.log('\n── 3. La imagen del meta, con /sprite caído como en producción ──')
{
  const L = (quantity, name, set, number) => ({ quantity, name, set, number })
  const mazo = { pokemon: [L(3, 'Mega Lucario ex', 'MEG', '77'), L(4, 'Riolu', 'MEG', '76'), L(2, 'Hariyama', 'MEG', '72')], trainer: [], energy: [] }
  const otro = { pokemon: [L(3, 'Dragapult ex', 'TWM', '130'), L(3, 'Drakloak', 'TWM', '129'), L(4, 'Dreepy', 'TWM', '128')], trainer: [], energy: [] }
  const total = (p) => p.pokemon.reduce((n, l) => n + l.quantity, 0)
  const semillas = {
    __FAKE_TORNEOS__: [{ id: 'torneo-1', slug: 'copa', name: 'Copa', status: 'finished', admin_id: 'admin-1', swiss_rounds: 1, top_cut_size: 0, current_round_id: null, decklist_visibility: 'al_terminar', start_at: '2026-09-30T16:00:00Z', format: 'standard' }],
    __FAKE_INSCRIPCIONES__: ['user-1', 'user-2'].map((u, i) => ({ id: `insc-${i + 1}`, tournament_id: 'torneo-1', user_id: u })),
    __FAKE_RONDAS__: [{ id: 'ronda-1', round_number: 1, status: 'finished', phase: 'swiss', started_at: hace(60) }],
    __FAKE_MESAS__: [{ id: 'm1', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'finished', check_in_a_at: hace(59), check_in_b_at: hace(59) }],
    __FAKE_RESULTADOS__: [{ id: 'r-1', match_id: 'm1', result: 'a_wins', winner_id: 'user-1' }],
    __FAKE_DECKLISTS__: [['user-1', mazo], ['user-2', otro]].map(([u, p], i) => ({ id: `deck-${i}`, tournament_id: 'torneo-1', user_id: u, raw_text: p.pokemon.map((l) => `${l.quantity} ${l.name} ${l.set} ${l.number}`).join('\n'), parsed_cards: { ...p, total: total(p) }, locked_at: hace(90) })),
  }
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  // Limitless sin permiso, /sprite caído, y PokeAPI con su permiso: la mega
  // de VERDE y cualquier especie de MAGENTA.
  await page.route(/^https:\/\/r2\.limitlesstcg\.net\//, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: MAGENTA }))
  await page.route(/\/sprite\/[^/?]+$/, (r) => r.fulfill({ status: 404, body: 'Sin sprite', headers: { 'x-motivo': 'origen 403' } }))
  await page.route(/^https:\/\/(cdn\.jsdelivr\.net|raw\.githubusercontent\.com)\//, (r) =>
    r.fulfill({ status: 200, contentType: 'image/png', body: /\/1\d{4}\.png$/.test(r.request().url()) ? VERDE : MAGENTA, headers: { 'access-control-allow-origin': '*' } })
  )
  await page.addInitScript((se) => {
    window.__FAKE_SESSION__ = 'admin-1'
    for (const [k, v] of Object.entries(se)) window[k] = v
    window.__dibujos = []
    const dibujar = CanvasRenderingContext2D.prototype.drawImage
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
      if (this.canvas.width > 1000 && a.length === 8) window.__dibujos.push({ src: img.src || '', sx: a[0], sy: a[1], sw: a[2], sh: a[3], w: a[6], h: a[7] })
      return dibujar.call(this, img, ...a)
    }
  }, semillas)
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.click('[data-pestana="meta"]')
  await page.waitForTimeout(500)
  await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[data-meta-imagen]')])
  const dibujos = await page.evaluate(() => window.__dibujos)
  const mega = dibujos.filter((d) => /\/10059\.png$/.test(d.src))
  check('con /sprite caído, la Mega Lucario sale de SU sitio en PokeAPI (10059), no de Lucario', mega.length >= 1 && !dibujos.some((d) => /\/448\.png$/.test(d.src) || /lucario\.png$/.test(d.src)), dibujos.map((d) => d.src.split('/').pop()).join(' '))
  check('  …recortada a lo que ocupa: el cuadro de 40 del medio, no los 96 con su marco', mega.every((d) => d.sx === 28 && d.sy === 28 && d.sw === 40 && d.sh === 40), JSON.stringify(mega[0]))
  // Dos veces: en el anillo (caja de más de 45) y en el top 4 (caja de
  // 40). Con el marco, el Pokémon se quedaba en 40 de 96: en el top, 17 px.
  check('  …y pintada al tamaño de su caja: el anillo y el top 4 (40 justos)', mega.some((d) => d.w > 45) && mega.some((d) => d.w === 40), JSON.stringify(mega.map((d) => d.w)))
  check('el Dragapult, de PokeAPI también (su especie)', dibujos.some((d) => /\/887\.png$/.test(d.src)))
  check('sin errores de página', !errores.length, errores.join(' | '))
  await browser.close()
}

console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
