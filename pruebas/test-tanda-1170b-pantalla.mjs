// Tanda 1170b — el buscador y las letras del glosario (pegados arriba) suben
// con la barra del móvil al bajar: pegados a 72 px con la barra escondida
// dejaban una franja por la que se leía el texto de detrás (PINGU, captura).
import { chromium, contexto, BASE } from './fixtures-app.mjs'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const b = await chromium.launch()
const ctx = await contexto(b, true, 'user-1'); const p = await ctx.newPage()
await p.goto(`${BASE}/glosario`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
await p.mouse.wheel(0, 900); await p.waitForTimeout(600); await p.mouse.wheel(0, 300); await p.waitForTimeout(800)
const r = await p.evaluate(() => {
  const m = document.querySelector('.glosario-mandos'); const caja = m.getBoundingClientRect()
  const bg = getComputedStyle(m).backgroundColor
  // Lo que hay justo encima del buscador tiene que ser el fondo de la página: ningún término asoma.
  const arriba = document.elementFromPoint(innerWidth / 2, Math.max(0, caja.top - 2))
  return { escondidas: document.documentElement.classList.contains('bm-escondidas'), top: Math.round(caja.top), opaco: bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent', arriba: arriba?.closest('.glosario-termino') ? 'un término' : 'nada' }
})
check('con la barra escondida, el buscador queda pegado a 0 y es opaco', r.escondidas && r.top === 0 && r.opaco, JSON.stringify(r))
// Al subir vuelve la barra; con el buscador pegado (más abajo de su sitio
// natural) tiene que quedar DEBAJO de ella, no detrás.
await p.mouse.wheel(0, -200); await p.waitForTimeout(1200)
const v = await p.evaluate(() => ({ escondidas: document.documentElement.classList.contains('bm-escondidas'), top: Math.round(document.querySelector('.glosario-mandos').getBoundingClientRect().top), nav: Math.round(document.querySelector('.navbar').getBoundingClientRect().bottom), scroll: Math.round(scrollY) }))
check('al subir vuelve la barra y el buscador baja a su sitio, sin pisarla', !v.escondidas && v.top >= v.nav - 1, JSON.stringify(v))
await ctx.close(); await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK'); process.exit(fails ? 1 : 0)
