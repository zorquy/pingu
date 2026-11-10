// Foto de Gente con muchas personas (1279), PC y móvil, y dónde empieza la lista.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
const b = await chromium.launch()
for (const movil of [false, true]) {
  const ctx = await contexto(b, movil, 'user-1')
  await ctx.addInitScript(() => {
    const mas = Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, username: `persona${i}`, display_name: `Persona ${i}`, total_xp: 800 - i * 10, level: 3, current_streak: i % 5, last_active_date: '2026-11-01' }))
    window.__FAKE_PERFILES__ = [...(window.__FAKE_PERFILES__ || []), ...mas]
  })
  const p = await ctx.newPage()
  if (!movil) await p.setViewportSize({ width: 1280, height: 900 })
  await p.goto(`${BASE}/usuarios`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const r = await p.evaluate(() => ({ primera: Math.round(document.querySelector('#userDirectoryGrid > *')?.getBoundingClientRect().top), vh: innerHeight, n: document.querySelectorAll('#userDirectoryGrid .com-persona').length, pag: !!document.querySelector('#userDirectoryArriba .paginacion') }))
  console.log(movil ? 'móvil' : 'PC', JSON.stringify(r))
  await p.screenshot({ path: `/tmp/caps1278/1279-${movil ? 'movil' : 'pc'}.png`, fullPage: true })
  await ctx.close()
}
await b.close()
