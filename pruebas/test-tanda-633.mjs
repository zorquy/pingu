// Tanda 633 — el menú lateral desplegable, las repeticiones con el estadio
// que se va, la Boss's Orders de la Galería, Hassel en la imagen y el Mew
// del 30 aniversario.
//
// PINGU: «que el menú nuevo sea desplegable y tenga animaciones y
// transiciones; y ajustable a todas las pantallas, que en la mía Jugar se
// ve con barra de desplazamiento». Rubén: «cuando le pega 60 al Kanga no es
// a ese: ese ya no está, se ha quitado el estadio y lo he descartado».
// «1 Boss's Orders LOR-TG 24 no la coge bien al importar». «Hassel no la
// coge bien al exportar una imagen». «Mew solo enseña el de 151 en el
// constructor y en las repeticiones».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'

// ═════════════════════════════════════════════════════════════════════
console.log('── 1. El estadio que se va y la banca que sobra (repeticiones) ──')
{
  const R = await import(`${RAIZ}/js/repeticiones/registro.js`)
  const E = await import(`${RAIZ}/js/repeticiones/estado.js`)
  const partida = (quitaEstadio, descartaKanga, { banca = ['Kangaskhan', 'Pikachu', 'Raichu', 'Ditto', 'Eevee', 'Kangaskhan'], conEstadio = true, mano = 'Kangaskhan, Kangaskhan, Kangaskhan, Kangaskhan, Kangaskhan, Kangaskhan, Kangaskhan' } = {}) => `Preparación
Rojo ha elegido cruz para el lanzamiento de moneda inicial.
Azul ha ganado el lanzamiento de moneda.
Azul ha decidido empezar en segundo lugar.
Rojo ha robado 7 cartas de la mano inicial.
- 7 cartas robadas.
   • ${mano}
Azul ha robado 7 cartas de la mano inicial.
- 7 cartas robadas.
Rojo ha puesto en juego a Kangaskhan en el Puesto Activo.
Azul ha puesto en juego a Shaymin en el Puesto Activo.

Turno de Rojo
Rojo ha robado Área Cero.
${conEstadio ? 'Rojo ha puesto en juego la carta de Estadio Área Cero.' : ''}
${banca.map((b) => `Rojo ha puesto en juego a ${b} en la Banca.`).join('\n')}
Rojo ha terminado su turno.

Turno de Azul
Azul ha robado una carta.
Azul ha jugado Aspiradora Perdida.
${quitaEstadio}
${descartaKanga}
El Shaymin de Azul ha infligido 60 puntos de daño usando Golpe contra el Kangaskhan de Rojo.`
  const final = (texto) => {
    const lec = R.leerRegistro(texto)
    const f = E.fotos(lec).at(-1)
    const r = f.jugadores.Rojo
    return { sinLeer: lec.sinLeer, estadio: f.estadio?.carta || null, banca: r.banca.map((x) => x.cartas.at(-1)), kangas: r.banca.filter((x) => x.cartas.at(-1) === 'Kangaskhan').length, activoDanio: r.activo?.danio, bancaDanio: r.banca.reduce((s, x) => s + (x.danio || 0), 0), descarte: r.descarte }
  }
  const a = final(partida('- Azul ha descartado Área Cero.', 'Rojo ha descartado Kangaskhan.'))
  check('«Azul ha descartado Área Cero» quita el estadio de la mesa (al descarte de su dueño)', a.estadio === null && a.descarte.includes('Área Cero'), JSON.stringify(a))
  check('  …y «Rojo ha descartado Kangaskhan» con la banca de seis lo saca de la banca', a.banca.length === 5 && a.kangas === 1 && a.descarte.includes('Kangaskhan'), JSON.stringify(a))
  check('  …y los 60 de después caen en el Kangaskhan que queda, no en el descartado', a.activoDanio === 60 && a.bancaDanio === 0, JSON.stringify(a))
  const b = final(partida('- Se ha descartado Área Cero.', 'Se han descartado 1 cartas del Kangaskhan de Rojo.'))
  check('«Se ha descartado Área Cero» y «Se han descartado 1 cartas del Kangaskhan»: el de la BANCA, no el activo', b.estadio === null && b.banca.length === 5 && b.kangas === 1 && b.activoDanio === 60 && !b.sinLeer.length, JSON.stringify(b))
  const c = final(partida('- Azul discarded Área Cero.', 'Kangaskhan was discarded.'))
  check('y en inglés («was discarded»)', c.estadio === null && c.banca.length === 5 && !c.sinLeer.length, JSON.stringify(c))
  // Lo que NO tiene que pasar: con cinco en la banca y el estadio puesto,
  // descartar un Kangaskhan es de la MANO.
  const d = final(partida('', 'Rojo ha descartado Kangaskhan.', { banca: ['Kangaskhan', 'Pikachu'], conEstadio: false }))
  check('con la banca en regla, un Kangaskhan descartado es de la mano (la banca no se toca)', d.banca.length === 2 && d.kangas === 1, JSON.stringify(d))
  // Con el estadio TODAVÍA en juego, la banca de seis es legal: el
  // Kangaskhan descartado sale de la mano.
  const g = final(partida('', 'Rojo ha descartado Kangaskhan.'))
  check('con Área Cero aún en juego, la banca de seis se respeta (el descartado es de la mano)', g.estadio === 'Área Cero' && g.banca.length === 6, JSON.stringify(g))
  // Y el estadio en juego con una copia a la vista en la mano: es la copia.
  const e = final(partida('Rojo ha descartado Área Cero.', '', { mano: 'Área Cero, Pikachu, Kangaskhan, Kangaskhan, Kangaskhan, Kangaskhan, Kangaskhan', banca: ['Pikachu'] }).replace('Rojo ha robado Área Cero.', 'Rojo ha robado Área Cero.').replace('Azul ha jugado Aspiradora Perdida.\n', ''))
  check('el estadio en juego con una copia en la mano de quien descarta: se va la copia', e.estadio === 'Área Cero', JSON.stringify(e))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Boss\'s Orders LOR-TG 24, al leer la lista ──')
{
  const { leerLista } = await import(`${RAIZ}/js/constructor/nucleo.js`)
  const l = leerLista("1 Boss's Orders LOR-TG 24\n2 Professor's Research LOR-TG 6\n1 Arceus V BRS-GG 1\n4 Iono PAL 185").lineas.map((x) => [x.nombre, x.set, x.numero])
  check('«LOR-TG 24» es Boss\'s Orders, LOR, TG24', JSON.stringify(l[0]) === JSON.stringify(["Boss's Orders", 'LOR', 'TG24']), JSON.stringify(l))
  check('  …y «LOR-TG 6» TG6, «BRS-GG 1» GG1, y una normal igual', l[1][2] === 'TG6' && l[2][1] === 'BRS' && l[2][2] === 'GG1' && JSON.stringify(l[3]) === JSON.stringify(['Iono', 'PAL', '185']), JSON.stringify(l))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. /escaneo y /sprite leen la ruta ──')
{
  const { parametrosDeEscaneo } = await import(`${RAIZ}/netlify/functions/escaneo.mjs`)
  const { nombreDeSprite } = await import(`${RAIZ}/netlify/functions/sprite.mjs`)
  check('/escaneo/TWM/151, sin consulta (como llega de verdad): TWM y 151', JSON.stringify(parametrosDeEscaneo('https://pokedoc.es/escaneo/TWM/151')) === '{"set":"TWM","numero":"151"}', JSON.stringify(parametrosDeEscaneo('https://pokedoc.es/escaneo/TWM/151')))
  check('  …y llamada a pelo con ?set=&n=, también', JSON.stringify(parametrosDeEscaneo('https://pokedoc.es/.netlify/functions/escaneo?set=LOR&n=TG24')) === '{"set":"LOR","numero":"TG24"}')
  check('/sprite/charizard: charizard', nombreDeSprite('https://pokedoc.es/sprite/charizard') === 'charizard' && nombreDeSprite('https://pokedoc.es/.netlify/functions/sprite?n=mew') === 'mew')
  const { fuentesDeCarta } = await import(`${RAIZ}/js/torneos/decklist-imagen.js`).catch(() => ({}))
  if (fuentesDeCarta) {
    const f = fuentesDeCarta({ name: 'Hassel', set: 'TWM', number: '151', carta: { image_path: 'sv/sv06/151' } })
    check('Hassel: Limitless, TCGdex en inglés y, si no, TCGdex en español', f[0] === '/escaneo/TWM/151' && f.some((u) => /\/en\/sv\/sv06\/151/.test(u)) && f.at(-1).includes('/es/sv/sv06/151'), JSON.stringify(f))
  }
}

const browser = await chromium.launch()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. El Mew del 30 aniversario, y la TG24 contra el catálogo ──')
{
  const SETS = [
    { id: 'sv08', name: 'Surging Sparks', market: 'WEST', tcg_online_code: 'SSP', release_date: '2024-11-08', card_count_official: 191 },
    { id: 'sv03.5', name: '151', market: 'WEST', tcg_online_code: 'MEW', release_date: '2023-09-22', card_count_official: 165 },
    { id: '30th', name: '30th Celebration', market: 'WEST', tcg_online_code: '30C', release_date: '2026-09-16', card_count_official: 0 },
    { id: 'swsh11', name: 'Lost Origin', market: 'WEST', tcg_online_code: 'LOR', release_date: '2022-09-09', card_count_official: 196 },
    { id: 'swsh11tg', name: 'Lost Origin Trainer Gallery', market: 'WEST', tcg_online_code: 'LOR', release_date: '2022-09-09', card_count_official: 30 },
  ]
  const CARTAS = [
    { id: 'sv08-057', set_id: 'sv08', market: 'WEST', local_id: '057', name: 'Pikachu ex', category: 'Pokemon', regulation_mark: 'H', image_path: 'sv/sv08/057' },
    { id: 'sv03.5-151', set_id: 'sv03.5', market: 'WEST', local_id: '151', name: 'Mew ex', category: 'Pokemon', regulation_mark: 'G', hp: 180, image_path: 'sv/sv03.5/151' },
    // Otro Mew ex legal, CON letra y de una colección anterior: entre dos
    // legales, el del 30 aniversario gana por ser el más nuevo.
    { id: 'sv08-200', set_id: 'sv08', market: 'WEST', local_id: '200', name: 'Mew ex', category: 'Pokemon', regulation_mark: 'H' },
    { id: 'tcggo-65689', set_id: '30th', market: 'WEST', local_id: '066', name: 'Mew ex', category: 'Pokemon', regulation_mark: null },
    { id: 'swsh11-189', set_id: 'swsh11', market: 'WEST', local_id: '189', name: 'Rotom V', category: 'Pokemon', regulation_mark: 'F' },
    { id: 'swsh11tg-TG24', set_id: 'swsh11tg', market: 'WEST', local_id: 'TG24', name: "Boss's Orders", category: 'Trainer', trainer_type: 'Supporter', regulation_mark: 'D' },
  ]
  const page = await browser.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.route(/\.(png|webp|jpg)(\?|$)/, (r) => r.abort())
  await page.addInitScript(({ s, c }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = s
    window.__FAKE_CARTAS__ = c
  }, { s: SETS, c: CARTAS })
  await page.goto(`${BASE}/constructor`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const r = await page.evaluate(async () => {
    const D = await import('/js/constructor/datos.js')
    const busca = await D.buscarCartas({ texto: 'mew', formato: 'standard' })
    const libre = await D.buscarCartas({ texto: 'mew', formato: 'libre' })
    const porNombre = await D.resolverLineas([{ n: 1, nombre: 'Mew ex', original: '1 Mew ex' }])
    const tg = await D.resolverLineas([{ n: 1, nombre: "Boss's Orders", set: 'LOR', numero: 'TG24', original: "1 Boss's Orders LOR-TG 24" }])
    const recientes = [...(await D.coleccionesRecientes())].sort()
    const reimp = [...(await D.nombresConReimpresionLegal([{ id: 'sv03.5-151', name: 'Mew ex', name_key: 'mew ex', category: 'Pokemon' }]))]
    return { busca: busca.cartas.map((x) => x.id), libre: libre.cartas.map((x) => x.id).sort(), porNombre: porNombre.resueltas.map((x) => x.carta.id), tg: tg.resueltas.map((x) => [x.carta.id, x.exacta]), sin: tg.sinResolver.length, recientes, reimp }
  })
  check('las colecciones nuevas sin letra: las de después de la primera con marca H (30th y Surging Sparks)', JSON.stringify(r.recientes) === '["30th","sv08"]', JSON.stringify(r.recientes))
  check('buscar «mew» en Estándar enseña el Mew ex del 30 aniversario (sin letra) y no el de 151 (G)', r.busca.includes('tcggo-65689') && !r.busca.includes('sv03.5-151'), JSON.stringify(r.busca))
  check('  …y sin filtro de formato, los dos', r.libre.includes('tcggo-65689') && r.libre.includes('sv03.5-151'), JSON.stringify(r.libre))
  check('«Mew ex» a secas (una repetición, una lista sin código): el del 30 aniversario, aunque haya otro legal con letra', r.porNombre[0] === 'tcggo-65689', JSON.stringify(r.porNombre))
  check('el Mew ex de 151 tiene reimpresión legal (la del 30 aniversario, sin letra)', r.reimp.includes('mew ex'), JSON.stringify(r.reimp))
  check('«LOR TG24» se encuentra exacta en la Galería (swsh11tg), no por el nombre', JSON.stringify(r.tg) === '[["swsh11tg-TG24",true]]' && r.sin === 0, JSON.stringify(r.tg))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. La barra lateral, desplegable ──')
const abrir = async (ancho, alto, { movimiento = 'no-preference', estado = null } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, reducedMotion: movimiento })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript((e) => {
    window.__FAKE_SESSION__ = 'user-1'
    if (e) localStorage.setItem('pokedoc-lateral-plegada', e)
  }, estado)
  await page.goto(`${BASE}/repeticiones`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.lat:not([hidden])', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(900)
  return { ctx, page, errores }
}
const leer = (page) =>
  page.evaluate(() => {
    const l = document.querySelector('.lat')
    const flechas = [...l.querySelectorAll('.lat-flecha')].map((b) => {
      const c = l.querySelector(`#${b.getAttribute('aria-controls')}`)
      return { seccion: b.closest('.lat-seccion').querySelector('.lat-seccion-enlace span').textContent, abierta: b.getAttribute('aria-expanded'), inerte: c.inert, alto: Math.round(c.getBoundingClientRect().height) }
    })
    return { flechas, ancho: Math.round(l.getBoundingClientRect().width), cuerpo: getComputedStyle(document.body).paddingLeft, prieta: l.classList.contains('lat-prieta'), cabe: l.scrollHeight <= l.clientHeight + 1, plegada: document.documentElement.classList.contains('lat-plegada') }
  })
{
  const { ctx, page, errores } = await abrir(1440, 900)
  let a = await leer(page)
  const jugar = a.flechas.find((f) => f.seccion === 'Jugar')
  // 758: Cartas ya no tiene cajón (es solo «Mi colección»); el cerrado que
  // se mira es el de Comunidad.
  const cartas = a.flechas.find((f) => f.seccion === 'Comunidad')
  check('en /repeticiones sale abierto Jugar (con sus páginas a la vista) y cerrado lo demás', jugar?.abierta === 'true' && !jugar.inerte && jugar.alto > 200 && cartas?.abierta === 'false' && cartas.inerte && cartas.alto === 0, JSON.stringify(a.flechas))
  await page.click('.lat-flecha[aria-label$="Comunidad"]')
  await page.waitForTimeout(450)
  a = await leer(page)
  const j2 = a.flechas.find((f) => f.seccion === 'Jugar')
  const c2 = a.flechas.find((f) => f.seccion === 'Comunidad')
  check('abrir Comunidad la despliega (con su alto) y pliega Jugar: una a la vez', c2.abierta === 'true' && !c2.inerte && c2.alto > 60 && j2.abierta === 'false' && j2.inerte && j2.alto === 0, JSON.stringify(a.flechas))
  const animado = await page.$eval('.lat-cajon', (c) => getComputedStyle(c).transitionDuration)
  check('  …con transición', /0\.3s/.test(animado), animado)
  check('a 900 de alto cabe sin desplazarse y no hace falta apretarla', a.cabe && !a.prieta, JSON.stringify(a))
  check('  …y sus enlaces miden 44', await page.$$eval('.lat .lat-seccion-enlace, .lat .lat-cajon.lat-abierto a', (as) => as.every((x) => x.getBoundingClientRect().height >= 44)))
  // Plegarla.
  await page.click('.lat-plegar')
  const alPulsar = await page.evaluate(() => getComputedStyle(document.body).transitionDuration)
  check('  …plegar se anima al pulsar', /0\.3s/.test(alPulsar), alPulsar)
  await page.waitForTimeout(450)
  a = await leer(page)
  check('«Plegar la barra»: una columna de iconos de 72 y el contenido se arrima', a.plegada && a.ancho === 72 && a.cuerpo === '72px', JSON.stringify(a))
  check('  …sin palabras ni cajones a la vista', await page.$$eval('.lat .lat-seccion-enlace span, .lat .lat-cajon', (xs) => xs.every((x) => getComputedStyle(x).display === 'none')))
  check('  …y se recuerda', (await page.evaluate(() => localStorage.getItem('pokedoc-lateral-plegada'))) === '1')
  check('sin errores', !errores.length, errores[0])
  await ctx.close()
}
{
  const { ctx, page } = await abrir(1440, 900, { estado: '1' })
  const a = await leer(page)
  check('al volver, sigue plegada (72 y el contenido arrimado)', a.plegada && a.ancho === 72 && a.cuerpo === '72px', JSON.stringify(a))
  const t = await page.evaluate(() => getComputedStyle(document.body).transitionDuration)
  check('  …y al cargar no se anima (solo al pulsar)', /^0s/.test(t), t)
  await ctx.close()
}
{
  // Una pantalla bajita: lo de dentro no cabe a 44 y se aprieta.
  const { ctx, page } = await abrir(1440, 560)
  const a = await leer(page)
  check('a 560 de alto se aprieta (renglones de 36) y cabe entera, sin barra de desplazamiento', a.prieta && a.cabe, JSON.stringify({ ...a, flechas: a.flechas.map((f) => f.alto) }))
  await ctx.close()
}
{
  const { ctx, page } = await abrir(1440, 900, { movimiento: 'reduce' })
  const t = await page.$eval('.lat-cajon', (c) => getComputedStyle(c).transitionDuration)
  check('con «menos movimiento», sin transiciones', /^0s/.test(t), t)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
