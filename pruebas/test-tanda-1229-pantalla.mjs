// Tanda 1229 — el buscador de Aprender en el móvil (la A de la propuesta,
// PINGU: «que no se coma texto de la banda»).
//   · en el móvil no hay fila fija de buscar: una lupa de 44 al lado del
//     lápiz, y las cifras de la banda no la pisan (390, 360 y 340 px);
//   · tocar la lupa abre la caja DEBAJO de la banda con el foco dentro,
//     escribir filtra la lista, y la «×» la cierra y borra lo escrito;
//   · en el PC la caja sigue en su fila y la lupa no se ve.
import { contexto, chromium } from './fixtures-app.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const b = await chromium.launch()
const mirar = (p) => p.evaluate(() => {
  const cifras = [...document.querySelectorAll('.ap-cab .banda-s-cifra')].filter((c) => c.getClientRects().length)
  const lupa = document.getElementById('apLupa')
  const lr = lupa.getBoundingClientRect()
  const sitio = document.getElementById('apBuscarSitio')
  const banda = document.querySelector('.ap-cab').getBoundingClientRect()
  return {
    pisa: cifras.some((c) => { const r = c.getBoundingClientRect(); return r.right > lr.left - 2 && r.bottom > lr.top && r.top < lr.bottom }),
    lupa: [Math.round(lr.width), Math.round(lr.height)],
    abierto: !sitio.hidden,
    debajo: sitio.hidden ? null : sitio.getBoundingClientRect().top >= banda.bottom - 1,
    filaFija: !!document.querySelector('#categoriesList .ap-herramientas .ap-buscar'),
    foco: document.activeElement?.id || '',
    valor: document.getElementById('apBuscar')?.value,
    guias: document.querySelectorAll('#apLista .guia-tarjeta, #apLista .guia-fila').length,
  }
})
for (const ancho of [390, 360, 340]) {
  const ctx = await contexto(b, true)
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(e.message))
  await p.setViewportSize({ width: ancho, height: 844 })
  await p.goto(`${BASE}/aprender`, { waitUntil: 'networkidle' }).catch(() => {})
  await p.waitForSelector('#apLupa', { timeout: 8000 }).catch(() => {})
  await p.waitForTimeout(800)
  let m = await mirar(p)
  check(`${ancho}: sin fila fija de buscar, la lupa de 44 y las cifras sin pisarla`, !m.filaFija && !m.abierto && m.lupa[0] === 44 && m.lupa[1] === 44 && !m.pisa, JSON.stringify(m))
  const todas = m.guias
  await p.click('#apLupa')
  m = await mirar(p)
  check(`${ancho}: la lupa abre la caja debajo de la banda, con el foco`, m.abierto && m.debajo && m.foco === 'apBuscar', JSON.stringify(m))
  await p.keyboard.type('mulligan')
  await p.waitForTimeout(300)
  m = await mirar(p)
  check(`${ancho}: escribir filtra la lista`, m.guias >= 1 && m.guias < todas, `${m.guias} de ${todas}`)
  await p.click('.ap-buscar-cerrar')
  await p.waitForTimeout(300)
  m = await mirar(p)
  check(`${ancho}: la «×» la cierra y borra lo escrito`, !m.abierto && m.valor === '' && m.guias === todas, JSON.stringify(m))
  check(`${ancho}: sin errores de JavaScript`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const ctx = await contexto(b, false)
  const p = await ctx.newPage()
  await p.goto(`${BASE}/aprender`, { waitUntil: 'networkidle' }).catch(() => {})
  await p.waitForTimeout(1200)
  const r = await p.evaluate(() => ({ fila: !!document.querySelector('#categoriesList .ap-herramientas .ap-buscar'), lupa: getComputedStyle(document.getElementById('apLupa')).display }))
  check('PC: la caja en su fila y sin lupa', r.fila && r.lupa === 'none', JSON.stringify(r))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
