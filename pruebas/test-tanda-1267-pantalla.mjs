// Tanda 1267 — en Mensajes, cambiar de conversación NO recarga la página
// (PINGU: «vas de una conversación a otra y te recarga toda la página. No
// debería»). Una fila de la lista, «‹» a la bandeja, Atrás y Adelante del
// navegador cambian el hilo sin navegar; el hilo de antes deja de escuchar
// (su canal en vivo y su sondeo se paran) y la lista de la izquierda se queda
// con la nueva marcada. Un ancla de la misma conversación (una cita) no
// cambia de vista, y lo puro lo dice `esOtraVistaDeMensajes`.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { esOtraVistaDeMensajes } = await import(`${RAIZ}/js/mensajes-puro.js`)

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── Lo puro ──')
const aqui = 'https://pokedoc.es/mensajes.html?c=conv-1'
check('otra conversación, la bandeja y «Nueva» son otra vista', esOtraVistaDeMensajes('/mensajes.html?c=conv-2', aqui) && esOtraVistaDeMensajes('/mensajes.html', aqui) && esOtraVistaDeMensajes('/mensajes?new=1', aqui))
check('un ancla de la misma conversación no', !esOtraVistaDeMensajes('#msg-9', aqui) && !esOtraVistaDeMensajes('/mensajes.html?c=conv-1#msg-9', aqui))
check('lo de fuera tampoco', !esOtraVistaDeMensajes('/perfil.html', aqui) && !esOtraVistaDeMensajes('https://otra.web/mensajes.html', aqui) && !esOtraVistaDeMensajes('/mensajes-viejo.html', aqui))

const tres = () => {
  const hace = (m) => new Date(Date.now() - m * 60000).toISOString()
  const q = window.__FAKE_SESSION__
  const otros = ['user-2', 'user-3', 'extra-3']
  window.__FAKE_FILAS__.conversations = otros.map((o, i) => ({ id: `conv-${i + 1}`, participants: [q, o], updated_at: hace(i + 1), last_message: `Hola ${i + 1}` }))
  window.__FAKE_FILAS__.conversation_participants = otros.flatMap((o, i) => [{ conversation_id: `conv-${i + 1}`, user_id: q, last_read_at: hace(i ? 60 : 0) }, { conversation_id: `conv-${i + 1}`, user_id: o }])
  window.__FAKE_FILAS__.private_messages = otros.flatMap((o, i) => Array.from({ length: 4 }, (_, k) => ({ id: `pm-${i}-${k}`, conversation_id: `conv-${i + 1}`, sender_id: k % 2 ? q : o, body: `Conversación ${i + 1}, mensaje ${k}`, created_at: hace(30 - k) })))
}

const b = await chromium.launch()
console.log('── En el PC: la lista a la izquierda ──')
{
  const ctx = await contexto(b, false, 'user-1', tres)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  let cargas = 0
  page.on('load', () => cargas++)
  await page.goto(`${BASE}/mensajes.html?c=conv-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#msgBody', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.evaluate(() => { window.__sigoAqui = true })
  const texto = () => page.evaluate(() => document.getElementById('threadMessages')?.innerText || '')
  check('abre la primera', /Conversación 1/.test(await texto()))
  await page.click('#msgLista .msg-fila[href*="conv-2"]')
  await page.waitForTimeout(1200)
  check('pulsar otra fila: la página NO se recarga', (await page.evaluate(() => window.__sigoAqui === true)) && cargas === 1, `cargas: ${cargas}`)
  check('  …la dirección cambia y sale la otra conversación', /c=conv-2/.test(page.url()) && /Conversación 2/.test(await texto()) && !/Conversación 1/.test(await texto()))
  check('  …y en la lista, la nueva marcada (y solo ella)', (await page.$$eval('#msgLista .msg-fila.activa', (as) => as.map((a) => a.getAttribute('href')))).join() === '/mensajes.html?c=conv-2')
  const vivo = await page.evaluate(() => window.__VIVO__.suscripciones.filter((s) => s.viva).map((s) => s.nombre))
  check('  …el hilo de antes deja de escuchar en vivo; el nuevo, sí', !vivo.includes('mensajes-conv-1') && vivo.includes('mensajes-conv-2'), vivo.join())
  const llamadas = await page.evaluate(() => window.__RPCS__?.length || 0)
  await page.evaluate(() => window.__VIVO__.emitir('mensajes-conv-1'))
  await page.waitForTimeout(500)
  check('  …y un aviso del hilo de antes no repinta nada', /Conversación 2/.test(await texto()) && (await page.evaluate(() => window.__RPCS__?.length || 0)) === llamadas)
  await page.click('#msgLista .msg-fila[href*="conv-3"]')
  await page.waitForTimeout(1200)
  check('otra más, igual', /Conversación 3/.test(await texto()) && (await page.evaluate(() => window.__sigoAqui === true)))
  await page.goBack()
  await page.waitForTimeout(1200)
  check('Atrás del navegador vuelve a la anterior sin recargar', /c=conv-2/.test(page.url()) && /Conversación 2/.test(await texto()) && (await page.evaluate(() => window.__sigoAqui === true)))
  await page.goForward()
  await page.waitForTimeout(1200)
  check('  …y Adelante, a la siguiente', /c=conv-3/.test(page.url()) && /Conversación 3/.test(await texto()))
  const vivas = await page.evaluate(() => window.__VIVO__.suscripciones.filter((s) => s.viva).map((s) => s.nombre).filter((n) => n.startsWith('mensajes-')))
  check('  …y solo una conversación escucha a la vez', vivas.length === 1 && vivas[0] === 'mensajes-conv-3', vivas.join())
  check('escribir sigue funcionando en la nueva', await page.evaluate(() => !!document.getElementById('msgBody')) && (await page.isVisible('#btnSendMsg')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── En el móvil: bandeja ⇄ conversación ──')
{
  const ctx = await contexto(b, true, 'user-1', tres)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mensajes.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  await page.evaluate(() => { window.__sigoAqui = true })
  await page.tap('#inboxList .msg-fila[href*="conv-2"]')
  await page.waitForTimeout(1500)
  check('de la bandeja a una conversación, sin recargar', (await page.evaluate(() => window.__sigoAqui === true)) && /Conversación 2/.test(await page.evaluate(() => document.getElementById('threadMessages')?.innerText || '')))
  check('  …con el hilo a pantalla (la clase del hilo puesta)', await page.evaluate(() => document.body.classList.contains('msg-hilo-abierto')))
  await page.tap('.msg-atras')
  await page.waitForTimeout(1200)
  check('«‹» vuelve a la bandeja sin recargar', (await page.evaluate(() => window.__sigoAqui === true)) && (await page.isVisible('#inboxList')) && /\/mensajes(\.html)?$/.test(new URL(page.url()).pathname) && !new URL(page.url()).search)
  check('  …y el hilo suelta lo suyo (sin la clase ni el canal)', !(await page.evaluate(() => document.body.classList.contains('msg-hilo-abierto') || document.body.hasAttribute('data-sin-refrescar'))) && !(await page.evaluate(() => window.__VIVO__.suscripciones.some((s) => s.viva && s.nombre.startsWith('mensajes-')))))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
