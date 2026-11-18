// Tanda 1399 — las pantallas que celebran («PokeDoc en modo app», PINGU: «las
// pantallas que celebran… también me gusta»). Subir de nivel, una racha de 7,
// 30 o 100 días y completar una expansión dejan de ser un aviso pequeño: una
// pantalla con la mascota, el molde de la de campeón (js/celebrar-momento.js):
//   · nivel: el nombre en grande, su icono, «N de 10» y Compartir; una vez;
//   · racha: al entrar el día que llegas a 7 (con el protector ganado); las
//     demás rachas, nada; una vez al día;
//   · la hoja (css/celebra.css) no la baja la portada: llega al celebrar;
//   · la expansión completa lo mira test-tanda-725-pantalla.mjs (sin capa).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const b = await chromium.launch()
const pantalla = (p) => p.evaluate(() => {
  const d = document.querySelector('dialog.celebra[open]')
  if (!d) return null
  const r = d.getBoundingClientRect()
  return {
    clase: d.className, modal: d.matches(':modal'), titulo: d.querySelector('.celebra-titulo')?.textContent, ceja: d.querySelector('.celebra-ceja')?.textContent,
    mascota: d.querySelector('[data-mascota]')?.dataset.mascota, insignia: !!d.querySelector('.celebra-insignia svg, .celebra-insignia img'),
    cifras: [...d.querySelectorAll('.celebra-cifras span')].map((s) => s.textContent.trim()), botones: [...d.querySelectorAll('.celebra-botones button')].map((x) => x.textContent.trim()),
    fondo: getComputedStyle(d.querySelector('.celebra-caja')).backgroundImage.slice(0, 15), dentro: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0,
  }
})

console.log('── 1. Subir de nivel ──')
for (const movil of [true, false]) {
  const ctx = await contexto(b, movil, 'user-1')
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)
  const hojaAntes = await p.evaluate(() => !!document.querySelector('link[href*="celebra.css"]'))
  check('la portada no baja la hoja de las celebraciones', !hojaAntes)
  await p.evaluate(() => import('/js/gamification.js').then((m) => m.celebrarSiSubeDeNivel(100, 200)))
  await p.waitForSelector('dialog.celebra[open]', { timeout: 5000 }).catch(() => {})
  const r = await pantalla(p)
  check(`${movil ? 'móvil' : 'PC'}: de Novato a Aprendiz, la pantalla con la mascota y su icono`, r && r.modal && r.titulo === 'Aprendiz' && /SUBES DE NIVEL/.test(r.ceja) && r.mascota === 'contento' && r.insignia, JSON.stringify(r))
  check('  …«2 de 10», Compartir y Seguir, dentro de la pantalla y en el panel de juego', r && r.cifras[0] === '2de 10' && r.botones.join('|') === 'Compartir|Seguir' && r.dentro && /gradient/.test(r.fondo), JSON.stringify(r))
  check('  …y sin el toast de antes', !(await p.evaluate(() => [...document.querySelectorAll('.toast, [role="status"]')].some((t) => /Has subido de nivel/.test(t.textContent)))))
  await p.click('dialog.celebra [data-cerrar]')
  await p.waitForTimeout(200)
  check('  …«Seguir» la cierra', (await pantalla(p)) === null)
  await p.evaluate(() => import('/js/gamification.js').then((m) => m.celebrarSiSubeDeNivel(100, 200)))
  await p.waitForTimeout(600)
  check('  …y no se repite en este navegador', (await pantalla(p)) === null)
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. La racha ──')
{
  // Ayer llevabas 6 días: hoy, al entrar, 7.
  const seis = () => { const ayer = new Date(Date.now() - 86400e3).toISOString().slice(0, 10); Object.assign(window.__FAKE_PERFIL__, { current_streak: 6, last_active_date: ayer, streak_shields: 0 }) }
  const ctx = await contexto(b, true, 'user-1', seis)
  const p = await ctx.newPage()
  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('dialog.celebra[open]', { timeout: 8000 }).catch(() => {})
  const r = await pantalla(p)
  check('al llegar a 7 días, «¡7 días seguidos!» con la llama y el protector ganado', r && /celebra-racha/.test(r.clase) && r.titulo === '¡7 días seguidos!' && r.insignia && r.cifras.join('|') === '7días|+1protector', JSON.stringify(r))
  await ctx.close()
  const otro = await contexto(b, true, 'user-1')
  const q = await otro.newPage()
  await q.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await q.waitForTimeout(1500)
  const n = await q.evaluate(async () => {
    const m = await import('/js/celebrar-momento.js')
    const ocho = await m.celebrarRacha(8)
    const treinta = await m.celebrarRacha(30, { hoy: '2026-11-18' })
    const otraVez = await m.celebrarRacha(30, { hoy: '2026-11-18' })
    return { ocho: ocho === null, treinta: treinta?.querySelector('.celebra-titulo')?.textContent, otraVez: otraVez === null }
  })
  check('8 días no se celebra en grande; 30 sí, y una sola vez ese día', n.ocho && n.treinta === '¡30 días seguidos!' && n.otraVez, JSON.stringify(n))
  await otro.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLO(S)` : '\nTodo bien')
process.exit(fails ? 1 : 0)
