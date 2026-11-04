// Tanda 1230 — «Leída» arriba a la izquierda, en verde (PINGU: «para que no
// haya cambio entre uno y otro»), y Guardados solo con guías y noticias.
//   · una portada leída lleva la chapa en la esquina de arriba, y el tema y el
//     título quedan a la MISMA altura que en una sin leer y en una a medias;
//   · la chapa va en el color de la sección (el acento), no en otro;
//   · /guardados no pide ni pinta los temas del foro que sigues.
import { readFileSync } from 'node:fs'
import { contexto, chromium } from './fixtures-app.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const b = await chromium.launch()
for (const movil of [false]) {
  const ctx = await contexto(b, movil); const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(e.message))
  await p.goto(`${BASE}/aprender`, { waitUntil: 'networkidle' }).catch(() => {})
  await p.waitForTimeout(800)
  const r = await p.evaluate(async () => {
    const m = await import('/js/guia-portada.js')
    const g = (id, t) => ({ id, slug: id, title: t, estimated_mins: 6, kind: 'guide', categories: { name: 'Coleccionar', slug: 'coleccionar' } })
    const caja = document.createElement('div')
    caja.style.cssText = 'display:grid;grid-template-columns:repeat(3,240px);gap:16px;grid-auto-rows:220px'
    caja.innerHTML = [m.portadaDeGuia(g('a', 'Las Gold Stars'), { progreso: { a: { status: 'completed', current_block: 9 } }, tema: { nombre: 'Coleccionar' } }),
      m.portadaDeGuia(g('b', 'Las rarezas'), { progreso: {}, tema: { nombre: 'Coleccionar' } }),
      m.portadaDeGuia(g('c', 'A medias'), { progreso: { c: { status: 'in_progress', current_block: 2 } }, tema: { nombre: 'Coleccionar' } })].join('')
    document.body.prepend(caja)
    await new Promise((res) => setTimeout(res, 200))
    const acento = getComputedStyle(document.documentElement).getPropertyValue('--acento').trim()
    const prueba = document.createElement('i'); prueba.style.color = acento; document.body.append(prueba)
    const colorAcento = getComputedStyle(prueba).color
    return { acento: colorAcento, portadas: [...caja.querySelectorAll('.guia-portada')].map((a) => {
      const ar = a.getBoundingClientRect(); const t = a.querySelector('.guia-portada-tema').getBoundingClientRect(); const l = a.querySelector('.guia-portada-leida')
      return { tema: Math.round(t.top - ar.top), leida: l ? { x: Math.round(l.getBoundingClientRect().left - ar.left), y: Math.round(l.getBoundingClientRect().top - ar.top), fondo: getComputedStyle(l).backgroundColor, texto: l.textContent.trim() } : null }
    }) }
  })
  const [leida, sin, medias] = r.portadas
  check('la leída lleva «Leída» en la esquina de arriba a la izquierda', leida.leida && leida.leida.x <= 16 && leida.leida.y <= 16 && leida.leida.texto === 'Leída', JSON.stringify(leida))
  check('  …en el color de la sección', leida.leida?.fondo === r.acento, `${leida.leida?.fondo} / ${r.acento}`)
  check('las otras dos, sin chapa', !sin.leida && !medias.leida, JSON.stringify(r.portadas))
  check('el tema, a la misma altura en las tres', leida.tema === sin.tema && sin.tema === medias.tema, r.portadas.map((x) => x.tema).join())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const js = readFileSync(`${REPO}/js/guardados.js`, 'utf8')
  check('Guardados no pide los temas que sigues', !/forum_subscriptions|forum_threads/.test(js))
  const ctx = await contexto(b, false); const p = await ctx.newPage()
  const pide = []
  p.on('request', (q) => { if (/forum_subscriptions|forum_threads/.test(q.url())) pide.push(q.url()) })
  await p.goto(`${BASE}/guardados`, { waitUntil: 'networkidle' }).catch(() => {})
  await p.waitForTimeout(800)
  const n = await p.locator('.gd-item-tema, [data-gd-filtro="temas"]').count()
  check('/guardados: ningún tema ni chip «Temas», y no pregunta al foro', n === 0 && pide.length === 0, `${n} · ${pide.join(' ')}`)
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
