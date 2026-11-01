// Tanda 1169 — «Por aquí hoy» con la cuenta de verdad (PINGU: «aquí el
// límite es 40? nunca he visto más de 40»): el número era el tamaño de una
// lista con tope de 40 en el foro, y de los 200 con más XP en Gente. Ahora
// el número es la cuenta exacta de la base; el foro enseña 40 nombres y el
// resto tras «y N más».
import { chromium, contexto, BASE } from './fixtures-app.mjs'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const b = await chromium.launch()
const muchos = () => {
  const hoy = new Date().toISOString().slice(0, 10)
  window.__FAKE_PERFILES__ = [...Array(57)].map((_, i) => ({ id: `p-${i}`, username: `persona${i}`, display_name: `Persona ${i}`, total_xp: 5000 - i * 10, level: 5, current_streak: 1, last_active_date: hoy, created_at: '2026-01-01T00:00:00Z', achievements: [], hide_activity: i === 3 }))
}
const abrir = async (ruta, extra) => {
  const ctx = await contexto(b, false, 'user-1', extra); const p = await ctx.newPage()
  await p.setViewportSize({ width: 1280, height: 900 })
  const errores = []; p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000)
  return { p, ctx, errores }
}
console.log('── El foro: 58 hoy (uno esconde su actividad) ──')
{
  const { p, ctx, errores } = await abrir('/foro', muchos)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await p.evaluate(() => ({ cuenta: document.querySelector('.foro-gente')?.closest('.foro-panel')?.querySelector('.foro-panel-cuenta')?.textContent, nombres: document.querySelectorAll('.foro-gente a').length, visibles: [...document.querySelectorAll('.foro-gente a')].filter((a) => a.getBoundingClientRect().height > 0).length, mas: document.querySelector('[data-gente-mas]')?.textContent }))
  check('el número es 57 (los 58 de hoy menos quien se esconde), no 40', r.cuenta === '57', JSON.stringify(r))
  check('  …40 nombres a la vista y «y 17 más»', r.visibles === 40 && r.nombres === 57 && r.mas === 'y 17 más', JSON.stringify(r))
  await p.click('[data-gente-mas]'); await p.waitForTimeout(200)
  const d = await p.evaluate(() => ({ visibles: [...document.querySelectorAll('.foro-gente a')].filter((a) => a.getBoundingClientRect().height > 0).length, boton: Boolean(document.querySelector('[data-gente-mas]')) }))
  check('  …y al pulsarlo salen los 57 y el botón se va', d.visibles === 57 && !d.boton, JSON.stringify(d))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/foro', null)
  const r = await p.evaluate(() => ({ cuenta: document.querySelector('.foro-gente')?.closest('.foro-panel')?.querySelector('.foro-panel-cuenta')?.textContent, mas: document.querySelector('[data-gente-mas]') }))
  check('con poca gente, como siempre: el número y sin «y N más»', Number(r.cuenta) >= 1 && !r.mas, JSON.stringify(r))
  await ctx.close()
}
console.log('── Gente ──')
{
  const { p, ctx, errores } = await abrir('/usuarios', muchos)
  const r = await p.evaluate(() => document.getElementById('comHoy')?.innerText.replace(/\s+/g, ' ').trim())
  check('«Por aquí hoy · 58» con la cuenta de la base y «+51» tras las siete caras', /Por aquí hoy · 58/.test(r) && /\+51/.test(r) && errores.length === 0, r + ' ' + errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
