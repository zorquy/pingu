// Tanda 1164 — una cabecera y una fila (C1, J1, J2 de «PokeDoc entera»):
// con una expansión abierta solo queda su cabecera (también en el PC);
// Torneos en el PC lleva una fila de mandos y la semana solo en Calendario;
// Mis partidas pone el «+» en la fila de mandos del móvil y cada fila dice
// cuándo y dónde, corto, con el mazo guardado en una chapa.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const b = await chromium.launch()
const abrir = async (ruta, movil = false) => {
  const ctx = await contexto(b, movil, 'user-1')
  const p = await ctx.newPage()
  if (!movil) await p.setViewportSize({ width: 1280, height: 800 })
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  return { p, ctx, errores }
}
const visible = (p, sel) => p.evaluate((s) => { const n = document.querySelector(s); if (!n) return false; const r = n.getBoundingClientRect(); return getComputedStyle(n).display !== 'none' && r.height > 0 }, sel)

console.log('── C1: dentro de una expansión manda la expansión ──')
for (const ruta of ['/cartas?ver=album&set=sv08', '/mi-coleccion?ver=album&set=sv08']) {
  const { p, ctx, errores } = await abrir(ruta)
  check(`${ruta} sin errores`, errores.length === 0, errores.join(' | '))
  const r = await p.evaluate(() => ({ clase: document.documentElement.classList.contains('mc-set-abierta'), hero: getComputedStyle(document.getElementById('mcHero')).display, primero: Math.round(document.querySelector('#mcArchivadorZona .mc-album-barra, #mcArchivadorZona')?.getBoundingClientRect().top || 0), fondo: getComputedStyle(document.querySelector('.mc-album-fondo') || document.body).top }))
  check('  la cabecera de la página no se pinta (desde el primer pintado, por la clase)', r.clase && r.hero === 'none', JSON.stringify(r))
  check('  …y la de la expansión empieza arriba, antes de 200 px', r.primero > 0 && r.primero < 200, JSON.stringify(r))
  check('  …y el brillo del logo no sale por arriba de su tira', r.fondo === '0px', JSON.stringify(r))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/cartas?ver=cartas')
  check('en la estantería, la cabecera de la página sigue', (await visible(p, '#mcHero')) && !(await p.evaluate(() => document.documentElement.classList.contains('mc-set-abierta'))))
  await ctx.close()
}

console.log('── J1: Torneos, una fila de mandos en el PC ──')
{
  const { p, ctx, errores } = await abrir('/torneos')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await p.evaluate(() => {
    const chips = document.querySelector('.torneo-pestanas-chips')
    const conm = document.querySelector('.torneo-vista-conmutador')
    const filas = new Set([...chips.children].map((x) => Math.round(x.getBoundingClientRect().top)))
    return { dentro: conm?.parentElement === chips, primero: chips.firstElementChild === conm, filas: filas.size, semana: getComputedStyle(document.getElementById('torneosSemana')).display, mandos: getComputedStyle(document.querySelector('.torneos-mandos')).display, primerTorneo: Math.round(document.querySelector('.torneo-card, .torneo-tarjeta, #listaTorneos article')?.getBoundingClientRect().top || 0) }
  })
  check('Lista/Calendario delante de los chips de estado, en una fila', r.dentro && r.primero && r.filas === 1, JSON.stringify(r))
  check('  …sin la semana ni su fila', r.semana === 'none' && r.mandos === 'none', JSON.stringify(r))
  check('  …y el primer torneo antes de 480 px', r.primerTorneo > 0 && r.primerTorneo < 480, JSON.stringify(r))
  await p.click('[data-vista-torneos="calendario"]')
  await p.waitForTimeout(600)
  const c = await p.evaluate(() => ({ conmEnMandos: document.querySelector('.torneo-vista-conmutador').parentElement.classList.contains('torneos-mandos'), semana: getComputedStyle(document.getElementById('torneosSemana')).display, hay: document.getElementById('torneosSemana').dataset.hay }))
  check('en Calendario, el conmutador vuelve a su fila con la semana', c.conmEnMandos && (c.hay !== '1' || c.semana !== 'none'), JSON.stringify(c))
  await p.click('[data-vista-torneos="lista"]')
  await p.waitForTimeout(600)
  check('  …y al volver a la lista, otra vez en la fila de chips', await p.evaluate(() => document.querySelector('.torneo-vista-conmutador').parentElement.classList.contains('torneo-pestanas-chips')))
  await ctx.close()
}

console.log('── J2: Mis partidas ──')
{
  const { p, ctx, errores } = await abrir('/mis-partidas?ver=sueltas', true)
  check('móvil sin errores', errores.length === 0, errores.join(' | '))
  const r = await p.evaluate(() => {
    const b = document.getElementById('btnApuntarPartida')
    const rb = b.getBoundingClientRect()
    const seg = document.getElementById('partidasTabs').getBoundingClientRect()
    const f = document.getElementById('listaFiltrar').getBoundingClientRect()
    const acciones = document.getElementById('partidasAcciones')
    return { donde: b.parentElement.id, redondo: Math.round(rb.width) === 44 && Math.round(rb.height) === 44, delante: rb.right <= seg.left, mismaFila: Math.abs(rb.top - f.top) < 6, palabra: b.querySelector('.cab-palabra').getBoundingClientRect().width, etiqueta: b.getAttribute('aria-label'), accionesVacias: acciones.children.length === 0 && getComputedStyle(acciones).display === 'none', primera: Math.round(document.querySelector('#partidasHero').getBoundingClientRect().top) }
  })
  check('el «+» redondo de 44, delante de las pestañas y en su fila, con su etiqueta', r.donde === 'partidasMandosMas' && r.redondo && r.delante && r.mismaFila && r.palabra === 0 && r.etiqueta === 'Apuntar una partida', JSON.stringify(r))
  check('  …y arriba no queda una fila para el botón solo: el resumen empieza antes de 160 px', r.accionesVacias && r.primera < 160, JSON.stringify(r))
  const fila = await p.evaluate(() => {
    const f = [...document.querySelectorAll('#partidasLista .partidas-fila')].find((x) => x.querySelector('.partidas-chapa-mazo'))
    if (!f) return null
    const chapa = f.querySelector('.partidas-chapa-mazo')
    const cuando = f.querySelector('.partidas-fila-cuando')
    const cr = chapa.getBoundingClientRect()
    return { cuando: cuando.textContent.trim(), chapa: chapa.textContent.trim(), cabe: cr.right <= innerWidth && cr.width > 20, corta: cuando.scrollWidth > cuando.clientWidth, href: chapa.getAttribute('href') }
  })
  check('cada fila dice «29 oct · fuera» y el mazo va en una chapa entera, con su enlace', fila && /^\d{1,2} [a-z]{3,4}( \d{4})? · fuera$/.test(fila.cuando) && fila.chapa.length > 2 && fila.cabe && !fila.corta && /^\/constructor\?mazo=/.test(fila.href), JSON.stringify(fila))
  await ctx.close()
  const pc = await abrir('/mis-partidas?ver=sueltas')
  const q = await pc.p.evaluate(() => ({ donde: document.getElementById('btnApuntarPartida').parentElement.id, texto: document.getElementById('btnApuntarPartida').textContent.replace(/\s+/g, ' ').trim(), sinPokeDoc: ![...document.querySelectorAll('#partidasLista .partidas-fila-donde')].some((x) => /Fuera de PokeDoc|Con tu mazo/.test(x.textContent)) }))
  check('en el PC, el botón con su palabra junto al título, y las filas sin «Fuera de PokeDoc · Con tu mazo»', q.donde === 'partidasAcciones' && /^\+ ?Apuntar una partida$/.test(q.texto) && q.sinPokeDoc, JSON.stringify(q))
  await pc.ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
