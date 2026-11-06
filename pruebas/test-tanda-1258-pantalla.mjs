// Tanda 1258 — un mensaje privado en el móvil no te devuelve abajo mientras
// lees arriba (PINGU: «se actualiza la página cuando vas a subir y te lleva
// abajo otra vez»). El hilo bajaba al final sin mirar dónde estabas cada vez
// que la ventana cambiaba de alto (en el iPhone, al deslizar entra y sale la
// barra del navegador), cada vez que cambiaba una clase de <html>, y el sondeo
// volvía a pintar el hilo entero aunque no hubiera nada nuevo. Y la bandera de
// Corea, que con un sol a secas se confundía con la de Japón.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const larga = () => {
  const hace = (m) => new Date(Date.now() - m * 60000).toISOString()
  const q = window.__FAKE_SESSION__
  window.__FAKE_FILAS__.conversations = [{ id: 'conv-1', participants: [q, 'user-2'], updated_at: hace(1), last_message: 'Hola' }]
  window.__FAKE_FILAS__.conversation_participants = [{ conversation_id: 'conv-1', user_id: q, last_read_at: hace(0) }, { conversation_id: 'conv-1', user_id: 'user-2' }]
  window.__FAKE_FILAS__.private_messages = Array.from({ length: 40 }, (_, i) => ({ id: `pm-${i}`, conversation_id: 'conv-1', sender_id: i % 2 ? q : 'user-2', body: `Mensaje número ${i} con algo de texto para que ocupe una línea o dos en el móvil`, created_at: hace(80 - i) }))
}

const b = await chromium.launch()
console.log('── Leyendo arriba, nada te baja ──')
{
  const ctx = await contexto(b, true, 'user-1', larga)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mensajes.html?c=conv-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#msgBody', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1800)
  const pos = () => page.evaluate(() => { const s = document.getElementById('msgScroll'); return { top: Math.round(s.scrollTop), alFinal: Math.round(s.scrollHeight - s.scrollTop - s.clientHeight) } })
  const inicio = await pos()
  check('al abrir, abajo del todo', inicio.alFinal < 4 && inicio.top > 300, JSON.stringify(inicio))
  // Sube como un dedo: el hilo hace scroll y se apunta dónde estás.
  await page.evaluate(() => { const s = document.getElementById('msgScroll'); s.scrollTop = 100; s.dispatchEvent(new Event('scroll')) })
  await page.waitForTimeout(200)
  await page.evaluate(() => window.visualViewport?.dispatchEvent(new Event('resize')))
  await page.waitForTimeout(200)
  check('la ventana cambia de alto (la barra del navegador): sigues donde estabas', (await pos()).top === 100, JSON.stringify(await pos()))
  await page.evaluate(() => document.documentElement.classList.add('cualquier-cosa'))
  await page.waitForTimeout(200)
  check('cambia una clase de la página: sigues donde estabas', (await pos()).top === 100, JSON.stringify(await pos()))
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow')))
  await page.waitForTimeout(200)
  check('vuelves a la página: sigues donde estabas', (await pos()).top === 100)
  const fotoAntes = await page.evaluate(() => document.querySelector('#msg-pm-3') && (document.querySelector('#msg-pm-3').dataset.marca = 'sigo'))
  // Lo que dispara un repintado: el vivo (un cambio de la base) o el sondeo.
  await page.evaluate(() => window.__VIVO__.emitir('mensajes-conv-1'))
  await page.waitForTimeout(800)
  const tras = await pos()
  const mismo = await page.evaluate(() => document.querySelector('#msg-pm-3')?.dataset.marca === 'sigo')
  check('llega un aviso del vivo sin nada nuevo: no repinta ni te mueve', tras.top === 100 && (fotoAntes ? mismo : true), JSON.stringify({ ...tras, mismo }))
  // Llega un mensaje mientras lees arriba: la pastilla, no el salto.
  await page.evaluate(() => {
    window.__TABLAS__.private_messages.push({ id: 'pm-nuevo', conversation_id: 'conv-1', sender_id: 'user-2', body: '¿Sigues ahí?', created_at: new Date().toISOString() })
  })
  await page.evaluate(() => window.__VIVO__.emitir('mensajes-conv-1'))
  await page.waitForTimeout(800)
  check('llega uno nuevo: sigues donde estabas y sale «1 nuevo»', (await pos()).top === 100 && !(await page.evaluate(() => document.getElementById('msgNuevos').classList.contains('hidden'))) && /1 nuevo/.test(await page.textContent('#msgNuevos')), JSON.stringify(await pos()))
  // Abajo del todo, lo de siempre: el cambio de alto te deja abajo.
  await page.evaluate(() => { const s = document.getElementById('msgScroll'); s.scrollTop = s.scrollHeight; s.dispatchEvent(new Event('scroll')) })
  await page.waitForTimeout(200)
  await page.evaluate(() => { document.getElementById('msgScroll').insertAdjacentHTML('beforeend', '<div style="height:300px"></div>'); window.visualViewport?.dispatchEvent(new Event('resize')) })
  await page.waitForTimeout(200)
  check('estando abajo, un cambio de alto te deja abajo', (await pos()).alFinal < 4, JSON.stringify(await pos()))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── La bandera de Corea no es la de Japón ──')
{
  const ctx = await contexto(b, false, null, () => {})
  const page = await ctx.newPage()
  await page.goto(`${BASE}/cartas.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  const fondos = await page.evaluate(async () => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/css/cardmarket.css'; document.head.appendChild(l)
    await new Promise((r) => { l.onload = r; setTimeout(r, 1500) })
    const de = (id) => { const i = document.createElement('i'); i.className = 'pv-bandera'; i.dataset.idioma = id; document.body.appendChild(i); return getComputedStyle(i).backgroundImage }
    return { ja: de('ja'), ko: de('ko') }
  })
  check('Corea lleva su círculo partido (rojo y azul) y los trigramas en negro', /rgb\(205, 46, 58\)/.test(fondos.ko) && /rgb\(0, 71, 160\)/.test(fondos.ko) && /rgb\(0, 0, 0\)/.test(fondos.ko) && fondos.ko !== fondos.ja, fondos.ko.slice(0, 200))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
