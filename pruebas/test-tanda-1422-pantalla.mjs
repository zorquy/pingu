// Tanda 1422 — la ficha de un torneo del meta (/meta/torneo/<id>).
//   · Cabecera: ceja, nombre, chapa, fecha, jugadores, «se sabe el mazo de N»
//     si no son todos, cuántas listas, Compartir y «Ver en Limitless».
//   · El Top 8 como podio: el campeón en grande (oro), luego plata y bronce,
//     cada uno con su mazo (que lleva a su ficha) y «Ver lista» si la hay.
//   · Lo que se jugó: los mazos con su % y cuántos en el Top, y «el que más
//     rindió» (Grimmsnarl en los datos de prueba).
//   · La clasificación: 40 filas, la raya debajo del 8.º, chips para
//     quedarse con un mazo, sin el id interno del jugador en ninguna parte.
//   · «Ver lista» abre el pop-up con las acciones y se cierra.
//   · Un torneo que no existe lo dice; uno de PokeDoc lleva a La arena.
//   · En el móvil nada se sale de lado; en oscuro se lee.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { INICIO } from './datos-meta-torneos.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ESCRATCH = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
const b = await chromium.launch()
async function abrir(ruta, { movil = false, oscuro = false } = {}) {
  const ctx = await contexto(b, movil, null)
  await ctx.addInitScript(INICIO)
  await ctx.addInitScript((t) => localStorage.setItem('pokedoc-theme', t), oscuro ? 'dark' : 'light')
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/ViewTransition|Transition was/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mtfFilas .mtf-fila', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(600)
  return { ctx, page, errores }
}

console.log('── Un regional ──')
{
  const { ctx, page, errores } = await abrir('/meta/torneo/oficial-900?dias=30')
  const r = await page.evaluate(() => ({
    titulo: document.title,
    h1: document.getElementById('mtfNombre').textContent,
    ceja: document.getElementById('mtfCeja').textContent,
    datos: document.getElementById('mtfDatos').textContent.replace(/\s+/g, ' '),
    botones: [...document.querySelectorAll('#mtfBotones a, #mtfBotones button')].map((x) => x.textContent.trim()),
    volver: document.getElementById('mtfVolver').getAttribute('href'),
  }))
  check('el nombre en el título, el h1 y la miga', r.h1 === 'Regional de Stuttgart' && /^Regional de Stuttgart/.test(r.titulo), JSON.stringify(r))
  check('  …ceja de oficial, chapa, jugadores, «se sabe el mazo de 40» y las 4 listas', r.ceja === 'Torneo oficial' && /Regional/.test(r.datos) && /1\.842 jugadores/.test(r.datos) && /se sabe el mazo de 40/.test(r.datos) && /4 listas/.test(r.datos), r.datos)
  check('  …Compartir y «Ver en Limitless»', r.botones.some((t) => /Compartir/.test(t)) && r.botones.includes('Ver en Limitless'), JSON.stringify(r.botones))
  check('  …y la miga vuelve a «Por torneo» con el periodo', r.volver === '/meta?ver=torneos&dias=30', r.volver)

  const p = await page.evaluate(() => [...document.querySelectorAll('#mtfPodio .mtf-puesto')].map((x) => ({ clase: x.className, num: x.querySelector('.mtf-num').textContent, mazo: x.querySelector('.mtf-mazo').textContent, href: x.querySelector('.mtf-mazo').getAttribute('href'), lista: !!x.querySelector('[data-lista]') })))
  check('el podio tiene los 8, el campeón primero y en grande', p.length === 8 && /mtf-p1/.test(p[0].clase) && /Campeón/.test(p[0].num) && p[0].mazo === 'Dragapult Dusknoir', JSON.stringify(p[0]))
  check('  …plata el 2.º y bronce el 3.º', /mtf-p2/.test(p[1].clase) && /mtf-p3/.test(p[2].clase), JSON.stringify(p.slice(1, 3).map((x) => x.clase)))
  check('  …cada mazo lleva a su ficha', p[0].href === '/meta/dragapult-dusknoir', p[0].href)
  check('  …«Ver lista» solo en los cuatro con lista', p.filter((x) => x.lista).length === 4, JSON.stringify(p.map((x) => x.lista)))

  const rep = await page.evaluate(() => ({
    filas: [...document.querySelectorAll('.mtf-reparto li')].map((li) => [li.querySelector('a').textContent, li.querySelector('.mtf-pct').textContent, li.querySelector('.mtf-t8').textContent]),
    rinde: document.querySelector('.mtf-rindio')?.textContent || '',
    total: document.getElementById('mtfJugoCuantos').textContent,
  }))
  check('lo que se jugó: los seis mazos, del más jugado al menos', rep.filas.length === 6 && rep.filas[0][0] === 'Dragapult Dusknoir', JSON.stringify(rep.filas))
  check('  …con «N en el Top»', rep.filas.some((f) => /2 en el Top/.test(f[2])), JSON.stringify(rep.filas))
  check('  …y «el que más rindió» es Grimmsnarl', /más rindió: Grimmsnarl ex/.test(rep.rinde), rep.rinde)

  const c = await page.evaluate(() => ({
    filas: document.querySelectorAll('#mtfFilas .mtf-fila:not(.mtf-fila-cab)').length,
    corte: [...document.querySelectorAll('#mtfFilas .mtf-fila:not(.mtf-fila-cab)')].findIndex((li) => li.classList.contains('mtf-corte')),
    texto: document.getElementById('mtfContenido').textContent,
    chips: [...document.querySelectorAll('#mtfChips .mtf-chip')].map((x) => x.textContent),
  }))
  check('la clasificación entera (40) con la raya debajo del 8.º', c.filas === 40 && c.corte === 7, JSON.stringify({ filas: c.filas, corte: c.corte }))
  check('  …sin el id interno de nadie («lista-12»)', !/lista-\d|puesto-\d|pokedoc-u/.test(c.texto))
  check('  …chips: Todos y los mazos', c.chips[0] === 'Todos' && c.chips.includes('Grimmsnarl ex'), JSON.stringify(c.chips))
  await page.click('#mtfChips [data-mazo="grimmsnarl-ex"]')
  await page.waitForTimeout(200)
  const g = await page.evaluate(() => [...document.querySelectorAll('#mtfFilas .mtf-fila:not(.mtf-fila-cab)')].map((li) => li.querySelector('.mtf-mazo-fila a').textContent))
  check('el chip de Grimmsnarl deja solo los Grimmsnarl', g.length >= 1 && g.every((x) => x === 'Grimmsnarl ex'), JSON.stringify(g))

  await page.click('#mtfPodio [data-lista]')
  await page.waitForSelector('#mtfLista[open] [data-copiar]', { timeout: 5000 }).catch(() => {})
  const d = await page.evaluate(() => ({ abierto: document.getElementById('mtfLista').open, titulo: document.getElementById('mtfListaTitulo').textContent, acciones: [...document.querySelectorAll('#mtfListaCuerpo .mtf-dialogo-acciones > *')].map((x) => x.textContent.trim()) }))
  check('«Ver lista» abre el pop-up con su título y las acciones', d.abierto && /Dragapult Dusknoir · 1\.º · Jonas Weber/.test(d.titulo) && d.acciones.includes('Copiar para TCG Live') && d.acciones.includes('Abrir en el constructor'), JSON.stringify(d))
  await page.screenshot({ path: `${ESCRATCH}/1422-lista.png` }).catch(() => {})
  await page.click('#mtfListaCerrar')
  await page.waitForTimeout(200)
  check('  …y se cierra', !(await page.evaluate(() => document.getElementById('mtfLista').open)) && !(await page.isVisible('#mtfLista')))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.click('#mtfChips [data-mazo=""]')
  await page.screenshot({ path: `${ESCRATCH}/1422-pc.png`, fullPage: true }).catch(() => {})
  await ctx.close()
}

console.log('── Uno de PokeDoc y uno que no existe ──')
{
  const { ctx, page } = await abrir('/meta/torneo/pokedoc-liga-6')
  const r = await page.evaluate(() => ({ ceja: document.getElementById('mtfCeja').textContent, botones: [...document.querySelectorAll('#mtfBotones a')].map((a) => [a.textContent, a.getAttribute('href')]), rinde: !!document.querySelector('.mtf-rindio'), rec: document.querySelector('#mtfPodio .mtf-rec')?.textContent }))
  check('PokeDoc: ceja propia y «Ver en La arena» a su torneo', r.ceja === 'Torneo de PokeDoc' && r.botones.some(([t, h]) => t === 'Ver en La arena' && h === '/torneo?slug=liga-del-friki'), JSON.stringify(r))
  check('  …con 10 mazos no se inventa «el que más rindió»', !r.rinde)
  check('  …y su récord, que sí lo tiene', r.rec === '5-0-0', r.rec)
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir('/meta/torneo/no-existe')
  const r = await page.evaluate(() => ({ aviso: document.getElementById('mtfAviso').textContent, oculto: document.getElementById('mtfContenido').hidden }))
  check('un torneo que no existe lo dice y no pinta cajas vacías', /no está en el meta/.test(r.aviso) && r.oculto, JSON.stringify(r))
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── En el móvil, en los dos temas ──')
for (const oscuro of [false, true]) {
  const { ctx, page, errores } = await abrir('/meta/torneo/oficial-900', { movil: true, oscuro })
  const r = await page.evaluate(() => {
    const fuera = [...document.querySelectorAll('#contenido *')].filter((el) => { const x = el.getBoundingClientRect(); return x.width && (x.right > innerWidth + 1 || x.left < -1) && !el.closest('dialog') }).map((el) => el.className || el.tagName).slice(0, 5)
    const h1 = document.getElementById('mtfNombre')
    return { ancho: document.documentElement.scrollWidth - innerWidth, fuera, color: getComputedStyle(h1).color, fondo: getComputedStyle(document.querySelector('.mtf-cab')).backgroundColor }
  })
  check(`${oscuro ? 'oscuro' : 'claro'}: nada se sale de lado`, r.ancho <= 0 && !r.fuera.length, JSON.stringify(r))
  check(`${oscuro ? 'oscuro' : 'claro'}: el título se lee`, r.color !== r.fondo, JSON.stringify(r))
  // El podio (el campeón, plata y bronce): su letra contrasta con su fondo.
  const lum = (c) => { const enUno = /^color\(srgb/.test(c); const [r1, g, b1] = c.match(/[\d.]+/g).map(Number).map((v) => (enUno ? v : v / 255)).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r1 + 0.7152 * g + 0.0722 * b1 }
  const pod = await page.evaluate(() => [...document.querySelectorAll('.mtf-p1, .mtf-p2, .mtf-p3')].map((x) => [getComputedStyle(x.querySelector('.mtf-mazo')).color, getComputedStyle(x).backgroundColor]))
  const contrastes = pod.map(([c, f]) => { const a = lum(c), z = lum(f); return Math.round(((Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05)) * 10) / 10 })
  check(`${oscuro ? 'oscuro' : 'claro'}: el podio se lee (contraste ≥ 4,5)`, contrastes.length >= 3 && contrastes.every((x) => x >= 4.5), JSON.stringify({ contrastes, pod }))
  check(`${oscuro ? 'oscuro' : 'claro'}: sin errores`, !errores.length, errores.join(' | '))
  await page.screenshot({ path: `${ESCRATCH}/1422-movil${oscuro ? '-oscuro' : ''}.png`, fullPage: true }).catch(() => {})
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo bien')
process.exit(fails ? 1 : 0)
