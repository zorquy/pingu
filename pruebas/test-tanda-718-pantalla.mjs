// Tanda 718 — un buscador para todo (N2) y la paleta con Ctrl+K (D3), las
// dos de la lista de propuestas, elegidas por PINGU.
//
// Lo que se mira: que /buscar encuentre a la vez cartas (con su foto, su
// set y su precio), guías, hilos y gente, cada fila llevando adonde debe;
// que «Ver más» se quede con un grupo y lo apunte en la dirección; que se
// acuerde de lo que buscaste y lo puedas borrar; que un grupo que FALLA lo
// diga y no se confunda con «no hay»; que el escáner esté a mano; y en el
// escritorio, que Ctrl+K, «/» y la lupa abran la paleta, que se maneje con
// el teclado (flechas, Intro, Mayús+Intro para añadir la carta, Esc) y que
// sus acciones hagan lo que dicen.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

const browser = await chromium.launch()
const semilla = ({ falla }) => {
  window.__FAKE_SESSION__ = 'user-1'
  if (falla) window.__FAKE_FALLA__ = falla
  window.__FAKE_SETS__ = [{ id: 'base1', name: 'Set Básico', serie_id: 'base', market: 'WEST', release_date: '1999-01-09', card_count_official: 102, card_count_total: 102 }]
  const c = (n, nombre) => ({ id: `base1-${n}`, market: 'WEST', set_id: 'base1', local_id: String(n), name: nombre, name_es: nombre, image_path: `base/base1/${n}`, rarity: 'Rare', category: 'Pokemon', tcg_sets: { id: 'base1', name: 'Set Básico', serie_id: 'base' } })
  window.__FAKE_CARTAS__ = [c(4, 'Charizard'), c(46, 'Charmander'), c(24, 'Charmeleon'), c(60, 'Charizard ex'), c(61, 'Charizard V'), c(58, 'Pikachu')]
  window.__FAKE_PRECIOS__ = [{ card_id: 'base1-4', cm_low: 250, cm_low_es: 240.5, cm_trend: 260, checked_at: new Date().toISOString() }]
  window.__FAKE_GUIAS__ = [{ slug: 'guia-charizard', title: 'Cómo jugar Charizard ex', description: 'Lista y consejos' }]
  window.__FAKE_TEMAS__ = [{ id: 'tema-9', title: '¿Charizard o Dragapult?' }]
  window.__FAKE_PERFILES__ = [{ id: 'user-9', username: 'charlie', display_name: 'Charlie' }]
  window.__FAKE_COLECCION__ = []
}
async function abrir(ruta, { movil = true, falla = null } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, { falla })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#e8564a"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, ctx, errores }
}
const grupos = (page) => page.$$eval('#searchResults .bs-grupo', (gs) => gs.map((g) => ({
  titulo: g.querySelector('.bs-seccion')?.textContent.trim(),
  filas: [...g.querySelectorAll('.bs-fila')].map((a) => ({ href: a.getAttribute('href'), texto: a.textContent.replace(/\s+/g, ' ').trim(), alto: a.getBoundingClientRect().height })),
  mas: g.querySelector('.bs-mas')?.textContent.trim() || null,
  aviso: g.querySelector('.bs-aviso')?.textContent.replace(/\s+/g, ' ').trim() || null,
})))

console.log('── 1. /buscar en un iPhone: todo a la vez ──')
{
  const { page, ctx, errores } = await abrir('/buscar.html?q=char')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const gs = await grupos(page)
  check('cuatro grupos, en orden: Cartas, Guías, Foro, Gente', gs.map((g) => g.titulo).join() === 'Cartas,Guías,Foro,Gente', JSON.stringify(gs.map((g) => g.titulo)))
  const cartas = gs[0]?.filas || []
  check('las cartas: cuatro, y «Ver más cartas» porque hay más', cartas.length === 4 && gs[0].mas === 'Ver más cartas', JSON.stringify(gs[0]))
  const ch = cartas.find((f) => f.href?.endsWith('-base1-4'))
  check('Charizard lleva a su ficha, con su set, su número y su precio (el mínimo en español)', ch && ch.href === '/carta/charizard-base1-4' && /Charizard/.test(ch.texto) && /Set Básico · 4/.test(ch.texto) && /240,50\s?€/.test(ch.texto), JSON.stringify(ch))
  const foto = await page.$eval('#searchResults .bs-cartas .bs-foto', (i) => ({ w: i.getAttribute('width'), h: i.getAttribute('height'), src: i.getAttribute('src') }))
  check('  …con su foto, el hueco reservado (36×50)', foto.w === '36' && foto.h === '50' && /^https?:/.test(foto.src), JSON.stringify(foto))
  check('  …y sin precio no se inventa uno', cartas.filter((f) => !f.href.endsWith('-base1-4')).every((f) => !/€/.test(f.texto)))
  check('la guía lleva a /guia/<slug>', gs[1]?.filas[0]?.href === '/guia/guia-charizard', JSON.stringify(gs[1]))
  check('el hilo lleva a /tema/<id>', gs[2]?.filas[0]?.href === '/tema/tema-9', JSON.stringify(gs[2]))
  check('la persona lleva a su perfil, con su @', gs[3]?.filas[0]?.href === '/usuario/charlie' && /@charlie/.test(gs[3].filas[0].texto), JSON.stringify(gs[3]))
  check('cada fila mide al menos 44 de alto', gs.every((g) => g.filas.every((f) => f.alto >= 44)))
  const esc = await page.$eval('#bsEscanear', (a) => ({ href: a.getAttribute('href'), w: a.getBoundingClientRect().width, h: a.getBoundingClientRect().height, svg: !!a.querySelector('svg') }))
  check('el escáner, al lado de la caja: un icono de 44 que abre la cámara en Mi colección', esc.href === '/mi-coleccion?ver=buscar&escanear=1' && esc.w >= 44 && esc.h >= 44 && esc.svg, JSON.stringify(esc))
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('la página no se va de ancho', ancho <= 1, String(ancho))

  await page.click('#searchResults [data-ver="cartas"]')
  await page.waitForTimeout(600)
  const solo = await grupos(page)
  check('«Ver más cartas» se queda con las cartas: cinco, sin los demás grupos', solo.length === 1 && solo[0].titulo === 'Cartas' && solo[0].filas.length === 5, JSON.stringify(solo.map((g) => [g.titulo, g.filas.length])))
  check('  …con su chip puesto y apuntado en la dirección', (await page.getAttribute('#bsChips [data-grupo="cartas"]', 'aria-pressed')) === 'true' && /[?&]en=cartas/.test(page.url()) && /[?&]q=char/.test(page.url()), page.url())
  await page.click('#bsChips [data-grupo="gente"]')
  await page.waitForTimeout(600)
  check('en Gente, sin nadie con eso, lo dice', (await grupos(page)).length === 1 || /Nada en gente/.test(await page.innerText('#searchResults')))
  await ctx.close()
}

console.log('── 2. Lo que buscaste, y borrarlo ──')
{
  const { page, ctx } = await abrir('/buscar.html')
  await page.fill('#searchInput', 'pikachu')
  await page.press('#searchInput', 'Enter')
  await page.waitForTimeout(600)
  check('buscar con Intro encuentra a Pikachu', /Pikachu/.test(await page.innerText('#searchResults')))
  await page.fill('#searchInput', '')
  await page.dispatchEvent('#searchInput', 'input')
  await page.waitForTimeout(500)
  check('con la caja vacía sale «Lo que buscaste» con «pikachu»', limpio(await page.innerText('#bsRecientes')).includes('pikachu'), limpio(await page.innerText('#bsRecientes')))
  await page.click('#bsRecientes [data-reciente="pikachu"]')
  await page.waitForTimeout(600)
  check('  …y tocarla la vuelve a buscar', (await page.inputValue('#searchInput')) === 'pikachu' && /Pikachu/.test(await page.innerText('#searchResults')))
  await page.fill('#searchInput', '')
  await page.dispatchEvent('#searchInput', 'input')
  await page.waitForTimeout(500)
  await page.click('#bsOlvidar')
  check('«Borrar» las olvida', (await page.locator('#bsRecientes [data-reciente]').count()) === 0)
  await ctx.close()
}

console.log('── 3. Un grupo que falla lo dice; «nada» es otra cosa ──')
{
  const { page, ctx } = await abrir('/buscar.html?q=char', { falla: { forum_threads: true } })
  const gs = await grupos(page)
  const foro = gs.find((g) => g.titulo === 'Foro')
  check('el foro dice que no se ha podido buscar, con Reintentar', foro && /No se ha podido buscar en foro/.test(foro.aviso || '') && /Reintentar/.test(foro.aviso), JSON.stringify(foro))
  check('  …y los demás grupos salen igual', gs.find((g) => g.titulo === 'Cartas')?.filas.length === 4 && gs.find((g) => g.titulo === 'Guías')?.filas.length === 1)
  await page.fill('#searchInput', 'zzzz')
  await page.dispatchEvent('#searchInput', 'input')
  await page.waitForTimeout(700)
  const texto = limpio(await page.innerText('#searchResults'))
  check('con «zzzz» y el foro fallando NO dice «nada»: no se sabe', !/^Nada con/.test(texto) && /No se ha podido buscar en foro/.test(texto), texto)
  await ctx.close()
  const otra = await abrir('/buscar.html?q=zzzz')
  check('sin fallos, «Nada con «zzzz»»', /Nada con «zzzz»/.test(limpio(await otra.page.innerText('#searchResults'))), limpio(await otra.page.innerText('#searchResults')))
  await otra.ctx.close()
}

console.log('── 4. La paleta en el escritorio ──')
{
  const { page, ctx, errores } = await abrir('/index.html', { movil: false })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(700)
  const abierta = await page.evaluate(() => ({ open: !!document.querySelector('dialog.paleta')?.open, foco: document.activeElement?.id, secciones: [...document.querySelectorAll('#paletaLista .bs-seccion')].map((s) => s.textContent) }))
  check('Ctrl+K la abre, con el foco en la caja', abierta.open && abierta.foco === 'paletaInput', JSON.stringify(abierta))
  check('  …y vacía enseña acciones y adónde ir', abierta.secciones.includes('Acciones') && abierta.secciones.includes('Ir a'), JSON.stringify(abierta.secciones))
  const estilo = await page.$eval('dialog.paleta', (d) => ({ display: getComputedStyle(d).display, ancho: d.getBoundingClientRect().width }))
  check('  …con su hoja (se inyecta al abrir)', estilo.display === 'flex' && estilo.ancho <= 640 && estilo.ancho > 400, JSON.stringify(estilo))
  await page.keyboard.type('foro')
  await page.waitForTimeout(500)
  const opciones = await page.$$eval('#paletaLista [role="option"]', (os) => os.map((o) => o.getAttribute('href') || o.textContent.trim()))
  check('escribir «foro» ofrece ir al Foro (sale de la barra de arriba)', opciones.includes('/foro.html'), JSON.stringify(opciones))
  // Bajar con las flechas hasta el Foro e Intro.
  const i = opciones.indexOf('/foro.html')
  for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown')
  check('  …las flechas lo eligen (aria-activedescendant)', (await page.$eval('#paletaInput', (x) => x.getAttribute('aria-activedescendant'))) === `paleta-${i}`)
  await Promise.all([page.waitForURL(/foro\.html/, { timeout: 5000 }).catch(() => null), page.keyboard.press('Enter')])
  check('  …e Intro lleva', /foro\.html/.test(page.url()), page.url())
  await ctx.close()
}

console.log('── 5. La paleta: cartas, Mayús+Intro, el tema, Esc, «/» y la lupa ──')
{
  const { page, ctx } = await abrir('/index.html', { movil: false })
  await page.keyboard.press('/')
  await page.waitForTimeout(600)
  check('«/» también la abre', await page.evaluate(() => !!document.querySelector('dialog.paleta')?.open))
  await page.keyboard.type('charizard')
  await page.waitForTimeout(900)
  const ops = await page.$$eval('#paletaLista [role="option"]', (os) => os.map((o) => o.getAttribute('href') || ''))
  const i = ops.indexOf('/carta/charizard-base1-4')
  check('busca cartas: Charizard, con su ficha', i >= 0, JSON.stringify(ops))
  for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown')
  check('  …y con una carta elegida dice que Mayús+Intro la añade', /Mayús Intro la añade a tu colección/.test(limpio(await page.innerText('#paletaPista'))))
  await Promise.all([page.waitForURL(/carta/, { timeout: 5000 }).catch(() => null), page.keyboard.press('Shift+Enter')])
  check('Mayús+Intro lleva a la ficha con #anadir', /\/carta\/charizard-base1-4#anadir$/.test(page.url()), page.url())
  await ctx.close()

  const b = await abrir('/index.html', { movil: false })
  await b.page.click('#navSearchBtn')
  await b.page.waitForTimeout(600)
  check('la lupa la abre', await b.page.evaluate(() => !!document.querySelector('dialog.paleta')?.open))
  await b.page.keyboard.type('tema')
  await b.page.waitForTimeout(400)
  const primera = limpio(await b.page.locator('#paletaLista [role="option"]').first().innerText())
  check('«tema» ofrece «Poner el tema oscuro» lo primero', /Poner el tema oscuro/.test(primera), primera)
  await b.page.keyboard.press('Enter')
  await b.page.waitForTimeout(300)
  check('  …e Intro lo pone, y cierra la paleta', (await b.page.evaluate(() => document.documentElement.dataset.theme)) === 'dark' && !(await b.page.evaluate(() => document.querySelector('dialog.paleta')?.open)))
  await b.page.keyboard.press('Control+k')
  await b.page.waitForTimeout(300)
  await b.page.keyboard.press('Escape')
  await b.page.waitForTimeout(300)
  check('Esc la cierra, y cerrada no se ve', !(await b.page.evaluate(() => document.querySelector('dialog.paleta')?.open)) && (await b.page.$eval('dialog.paleta', (d) => getComputedStyle(d).display)) === 'none')
  // Ctrl+K vale también desde dentro de un campo.
  await b.page.evaluate(() => { const i = document.createElement('input'); i.id = 'campoPrueba'; document.body.prepend(i); i.focus() })
  await b.page.keyboard.press('Control+k')
  await b.page.waitForTimeout(300)
  check('Ctrl+K desde un campo de texto también la abre', await b.page.evaluate(() => !!document.querySelector('dialog.paleta')?.open))
  await b.ctx.close()
}

console.log('── 6. #anadir en la ficha abre el diálogo de añadir ──')
{
  const { page, ctx, errores } = await abrir('/carta.html?id=base1-4#anadir', { movil: false })
  await page.waitForTimeout(1200)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el diálogo de añadir está abierto', await page.evaluate(() => !!document.getElementById('cmAdDialogo')?.open))
  check('  …y #anadir sale de la dirección (recargar no lo reabre)', !page.url().includes('#anadir'), page.url())
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
