// Tanda 1424 — Cada protector de racha cubre UN día sin entrar (una persona,
// por mensaje a PINGU: «he estado dos días fuera sin poder entrar (tenía 2
// protectores) y perdí la racha pero mantengo esos protectores»). Antes solo
// se perdonaba perder exactamente un día, aunque hubiera dos guardados.
//   · Entró ayer: la racha sube y los protectores no se tocan.
//   · Un día fuera con 2: sube, queda 1.
//   · Dos días fuera con 2: sube, quedan 0, y la portada dice «Tus 2
//     protectores salvaron la racha».
//   · Tres días fuera con 2: no alcanzan; vuelve a 1 y se quedan los 2.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const diaUTC = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10)
const b = await chromium.launch()

async function caso(nombre, { ultima, escudos, racha = 10 }, espera) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES' })
  await ctx.addInitScript((p) => { window.__FAKE_SESSION__ = 'user-1'; window.__FAKE_PERFIL__ = p }, { current_streak: racha, last_active_date: ultima, streak_shields: escudos })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/ViewTransition|Transition was/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const leer = () => page.evaluate(async () => {
    const { supabase } = await import('/js/supabase.js')
    const { data } = await supabase.from('user_profiles').select('current_streak,last_active_date,streak_shields').eq('id', 'user-1').single()
    return data
  })
  const p = await leer()
  let chip = await page.evaluate(() => document.querySelector('.bienvenida-salvada')?.textContent.trim() || '')
  if (!chip) {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    chip = await page.evaluate(() => document.querySelector('.bienvenida-salvada')?.textContent.trim() || '')
  }
  check(`${nombre}: racha ${espera.racha}, protectores ${espera.escudos}, hoy apuntado`, p?.current_streak === espera.racha && p?.streak_shields === espera.escudos && p?.last_active_date === diaUTC(0), JSON.stringify(p))
  if (espera.chip !== undefined) check(`${nombre}: el aviso de la portada`, espera.chip ? chip === espera.chip : chip === '', JSON.stringify(chip))
  check(`${nombre}: sin errores`, !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Los protectores, uno por día ──')
await caso('entró ayer', { ultima: diaUTC(1), escudos: 2 }, { racha: 11, escudos: 2, chip: '' })
await caso('un día fuera con 2', { ultima: diaUTC(2), escudos: 2 }, { racha: 11, escudos: 1, chip: 'Tu protector salvó la racha' })
await caso('dos días fuera con 2', { ultima: diaUTC(3), escudos: 2 }, { racha: 11, escudos: 0, chip: 'Tus 2 protectores salvaron la racha' })
await caso('tres días fuera con 2', { ultima: diaUTC(4), escudos: 2 }, { racha: 1, escudos: 2, chip: '' })
await caso('dos días fuera con 1', { ultima: diaUTC(3), escudos: 1 }, { racha: 1, escudos: 1 })

await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo bien')
process.exit(fails ? 1 : 0)
