// Tanda 1041 — Deseos y cambios en el móvil: el Modo evento es una burbuja
// flotante encima de la de Mi colección (PINGU: «como teníamos antes lo de
// escribir en el foro, ahí abajo a la derecha»), y la fila de arriba queda
// entera para Mercado · Quiero · Doy · Cruces, con cuentas de tres cifras
// (las de PINGU: 116 · 118 · 14 · 6). Y dos de la misma captura: la flecha
// del desplegable de idioma ya no se pisa con el texto, que es «Idioma».
// La excepción a «nada flota» y que no tape nada la vigila la 1023.
import { chromium, contexto } from '../herramientas/propuesta-compacta/comun.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const b = await chromium.launch()
async function abrir(ruta, { movil = true, ancho } = {}) {
  const ctx = await contexto(b, movil, 'user-1', () => { try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {} })
  const page = await ctx.newPage()
  if (ancho) await page.setViewportSize({ width: ancho, height: 700 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { ctx, page, errores }
}

// Con las cuentas de PINGU puestas, cómo queda la fila y dónde está Evento.
const medir = (page) => page.evaluate(() => {
  for (const [k, n] of Object.entries({ mercado: 116, quiero: 118, doy: 14, cruces: 6 })) for (const e of document.querySelectorAll(`[data-deseos-n="${k}"]`)) { e.textContent = n; e.classList.remove('cero') }
  const panel = [...document.querySelectorAll('section[id^=mcPanel]')].find((s) => !s.classList.contains('hidden'))
  const seg = panel.querySelector('.mc-deseos-seg')
  const sr = seg.getBoundingClientRect()
  const bs = [...seg.querySelectorAll('.seg-btn')]
  const ev = panel.querySelector('.mc-evento-boton')
  const er = ev.getBoundingClientRect()
  const pe = document.querySelector('.mc-pestanias').getBoundingClientRect()
  const cab = panel.querySelector('.mc-deseos-cabeza').getBoundingClientRect()
  const visibles = [...document.querySelectorAll('.mc-evento-boton')].filter((x) => x.getBoundingClientRect().width > 0).length
  return {
    fila: { ancho: Math.round(sr.width), cabeza: Math.round(cab.width), dentro: bs.every((x) => { const r = x.getBoundingClientRect(); return r.left >= sr.left - 1 && r.right <= sr.right + 1 }), sinCortar: bs.every((x) => x.scrollWidth <= x.clientWidth + 1) },
    evento: { pos: getComputedStyle(ev).position, ancho: Math.round(er.width), alto: Math.round(er.height), derecha: Math.round(innerWidth - er.right), hueco: Math.round(pe.top - er.bottom), etiqueta: ev.getAttribute('aria-label'), href: ev.getAttribute('href'), texto: ev.innerText.trim(), visibles },
  }
})

for (const [vista, ancho] of [['mercado'], ['quiero'], ['cambios'], ['quiero', 320]]) {
  console.log(`── ${vista}${ancho ? ` a ${ancho} px` : ''} ──`)
  const { ctx, page, errores } = await abrir(`/mi-coleccion?ver=${vista}`, { ancho })
  const r = await medir(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la fila de las cuatro vistas ocupa la cabecera entera', r.fila.ancho >= r.fila.cabeza - 1, JSON.stringify(r.fila))
  check('  …y con 116 · 118 · 14 · 6 caben las cuatro sin salirse ni cortarse', r.fila.dentro && r.fila.sinCortar, JSON.stringify(r.fila))
  check('Evento flota: un círculo de 56 con su icono, abajo a la derecha', r.evento.pos === 'fixed' && r.evento.ancho === 56 && r.evento.alto === 56 && r.evento.texto === '' && r.evento.derecha === 24, JSON.stringify(r.evento))
  check('  …encima de la burbuja de Colección, sin tocarla', r.evento.hueco >= 8 && r.evento.hueco <= 24, JSON.stringify(r.evento))
  check('  …uno solo a la vista, a /evento y con su nombre para el lector', r.evento.visibles === 1 && r.evento.href === '/evento' && r.evento.etiqueta === 'Modo evento', JSON.stringify(r.evento))
  await ctx.close()
}

console.log('── El idioma del Mercado ──')
{
  const { ctx, page } = await abrir('/mi-coleccion?ver=mercado')
  const s = await page.evaluate(() => { const e = document.getElementById('mcMercadoIdioma'); const cs = getComputedStyle(e); return { texto: e.options[e.selectedIndex].textContent, flecha: parseFloat(cs.paddingRight), fondo: /svg/.test(cs.backgroundImage) } })
  check('dice «Idioma»', s.texto === 'Idioma', s.texto)
  check('  …y deja sus 36 px a la flecha', s.flecha >= 36 && s.fondo, JSON.stringify(s))
  await ctx.close()
}

console.log('── En el PC, como estaba ──')
{
  const { ctx, page } = await abrir('/mi-coleccion?ver=quiero', { movil: false })
  const r = await page.evaluate(() => { const ev = document.querySelector('#mcPanelQuiero .mc-evento-boton'); return { pos: getComputedStyle(ev).position, texto: ev.innerText.trim(), enCabeza: !!ev.closest('.mc-deseos-cabeza') } })
  check('«Modo evento» con su texto, en la cabecera y sin flotar', r.pos === 'static' && r.texto === 'Modo evento' && r.enCabeza, JSON.stringify(r))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
