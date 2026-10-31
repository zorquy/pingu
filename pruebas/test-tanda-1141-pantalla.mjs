// Tanda 1141 — mensajes privados: responder a un mensaje (botón y deslizar),
// reacciones (las cuatro del foro, una por persona), fijar y archivar. Sin la
// migración no se ofrece nada de esto; con ella, se escribe en su sitio y se
// pinta como toca.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── 1. Lo puro ──')
{
  const P = await import(`${RAIZ}/js/mensajes-puro.js`)
  const ultimo = (h) => ({ created_at: new Date(Date.now() - h * 3600e3).toISOString() })
  check('archivada hasta que llega algo posterior', P.estaArchivada({ archivadaAt: new Date().toISOString(), lastMessage: ultimo(1) }) && !P.estaArchivada({ archivadaAt: new Date(Date.now() - 2 * 3600e3).toISOString(), lastMessage: ultimo(1) }) && !P.estaArchivada({ lastMessage: ultimo(1) }))
  const orden = P.ordenarConversaciones([{ conversationId: 'a', lastMessage: ultimo(1) }, { conversationId: 'b', lastMessage: ultimo(9), fijadaAt: ultimo(5).created_at }, { conversationId: 'c', lastMessage: ultimo(0) }]).map((c) => c.conversationId).join()
  check('las fijadas arriba y luego por el último mensaje', orden === 'b,c,a', orden)
  const r = P.reaccionesDeMensaje([{ message_id: 'm', user_id: 'u', kind: 'love' }, { message_id: 'm', user_id: 'v', kind: 'love' }, { message_id: 'm', user_id: 'w', kind: 'like' }, { message_id: 'x', user_id: 'u', kind: 'wow' }], 'm', 'u')
  check('las reacciones de un mensaje, contadas en el orden del foro y con la tuya', JSON.stringify(r) === '{"cuentas":[{"kind":"like","n":1},{"kind":"love","n":2}],"mia":"love"}', JSON.stringify(r))
  const c = P.citaDe({ id: '1', sender_id: 'a', body: 'x'.repeat(120) }, () => 'Misty')
  check('la cita: quién y un trozo', c.quien === 'Misty' && c.que.length === 91 && c.que.endsWith('…'))
  check('  …y de uno eliminado o de una carta, lo que era', P.citaDe({ id: '1', deleted_at: 'x' }, () => '').que === 'Mensaje eliminado' && P.citaDe({ id: '1', body: '', adjuntos: [{ tipo: 'carta' }] }, () => '').que === 'Una carta')
}

const conMensajes = (con1141) => {
  const ahora = Date.now()
  const hace = (h) => new Date(ahora - h * 3600e3).toISOString()
  const F = (window.__FAKE_FILAS__ ||= {})
  const extra = con1141 ? { fijada_at: null, archivada_at: null } : {}
  F.conversation_participants = [
    { conversation_id: 'conv-1', user_id: 'user-1', last_read_at: hace(1), ...extra }, { conversation_id: 'conv-1', user_id: 'user-2', last_read_at: hace(1), ...extra },
    { conversation_id: 'conv-2', user_id: 'user-1', last_read_at: hace(1), ...extra }, { conversation_id: 'conv-2', user_id: 'extra-3', last_read_at: hace(60), ...extra },
  ]
  if (con1141) F.private_message_reactions = [{ message_id: 'pm-2', conversation_id: 'conv-1', user_id: 'user-2', kind: 'love' }]
}
const abrir = async (b, movil, con1141 = true) => {
  const ctx = await contexto(b, movil, 'user-1', `(${conMensajes.toString()})(${con1141})`)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  page.errores = errores
  return { ctx, page }
}
const filas = (page, t) => page.evaluate((t) => window.__TABLAS__[t] || [], t)

const b = await chromium.launch()
console.log('── 2. Sin la migración, nada de esto ──')
{
  const { ctx, page } = await abrir(b, false, false)
  await page.goto(`${BASE}/mensajes.html?c=conv-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  check('ni responder, ni reaccionar, ni «⋯»', !(await page.$('[data-responder]')) && !(await page.$('[data-reaccionar]')) && !(await page.$('#msgMas')) && (await page.$$('.msg-burbuja')).length >= 3)
  check('sin errores', !page.errores.length, page.errores.join(' | '))
  await ctx.close()
}

for (const movil of [false, true]) {
  console.log(`── 3. ${movil ? 'Móvil' : 'PC'}: responder ──`)
  const { ctx, page } = await abrir(b, movil)
  await page.goto(`${BASE}/mensajes.html?c=conv-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  if (movil) {
    // Deslizar la burbuja de Misty a la derecha.
    await page.evaluate(() => {
      const bb = document.getElementById('msg-pm-1')
      const r = bb.getBoundingClientRect()
      const t = (x) => new Touch({ identifier: 1, target: bb, clientX: x, clientY: r.top + 10 })
      bb.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(r.left + 10)] }))
      bb.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [t(r.left + 90)] }))
      bb.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [] }))
    })
  } else {
    await page.hover('#msg-pm-1')
    await page.click('#msg-pm-1 [data-responder]')
  }
  await page.waitForTimeout(300)
  const barra = await page.$eval('#msgRespondiendo', (e) => (e.hidden ? '' : e.innerText.replace(/\s+/g, ' ')))
  check(`${movil ? 'deslizar' : 'el botón'} pone «Respondiendo a Misty» con su texto`, /Respondiendo a Misty/.test(barra) && /Giratina/.test(barra), barra)
  await page.fill('#msgBody', 'Sí, el Giratina en español')
  await page.click('#btnSendMsg')
  await page.waitForTimeout(1200)
  const nuevo = (await filas(page, 'private_messages')).find((m) => m.body === 'Sí, el Giratina en español')
  check('  …se manda con su `reply_to_id`', nuevo?.reply_to_id === 'pm-1', JSON.stringify(nuevo))
  check('  …y la barra se va', await page.$eval('#msgRespondiendo', (e) => e.hidden))
  const cita = await page.$eval(`#msg-${nuevo?.id} .msg-cita`, (c) => c.innerText.replace(/\s+/g, ' ')).catch(() => '')
  check('  …la respuesta lleva la cita de Misty', /Misty/.test(cita) && /Giratina/.test(cita), cita)
  await page.click(`#msg-${nuevo?.id} .msg-cita`)
  await page.waitForTimeout(300)
  check('  …tocarla destella el original', await page.$eval('#msg-pm-1', (e) => e.classList.contains('msg-destello')))
  if (!movil) await page.screenshot({ path: '/tmp/1141-responder.png' })

  console.log(`── 4. ${movil ? 'Móvil' : 'PC'}: reacciones ──`)
  const enLaMia = await page.$eval('#msg-pm-2 .msg-reacciones', (e) => ({ txt: e.innerText.trim(), botones: e.querySelectorAll('button').length })).catch(() => null)
  check('en tu mensaje sale la de Misty, contada y sin botón', enLaMia && enLaMia.botones === 0 && !!(await page.$('#msg-pm-2 .msg-reaccion svg')), JSON.stringify(enLaMia))
  check('  …y en el tuyo no hay «reaccionar»', !(await page.$('#msg-pm-2 [data-reaccionar]')))
  if (!movil) await page.hover('#msg-pm-1')
  await page.click('#msg-pm-1 [data-reaccionar]')
  await page.waitForTimeout(200)
  check('reaccionar abre las cuatro del foro', (await page.$$('.msg-selector [data-elegir-reaccion]')).length === 4)
  await page.click('.msg-selector [data-elegir-reaccion="like"]')
  await page.waitForTimeout(800)
  const r1 = (await filas(page, 'private_message_reactions')).filter((r) => r.user_id === 'user-1')
  check('  …elegir una la guarda (con su conversación) y sale resaltada', r1.length === 1 && r1[0].kind === 'like' && r1[0].conversation_id === 'conv-1' && !!(await page.$('#msg-pm-1 .msg-reaccion.mia')), JSON.stringify(r1))
  if (movil) await page.screenshot({ path: '/tmp/1141-reaccion-movil.png' })
  await page.click('#msg-pm-1 .msg-reaccion.mia')
  await page.waitForTimeout(800)
  check('  …y pulsarla otra vez la quita', !(await filas(page, 'private_message_reactions')).some((r) => r.user_id === 'user-1') && !(await page.$('#msg-pm-1 .msg-reaccion')))

  console.log(`── 5. ${movil ? 'Móvil' : 'PC'}: fijar y archivar ──`)
  await page.click('#msgMas')
  await page.click('#msgMasMenu [data-poner="fijar"]')
  await page.waitForTimeout(800)
  const p1 = (await filas(page, 'conversation_participants')).find((p) => p.conversation_id === 'conv-1' && p.user_id === 'user-1')
  check('fijar escribe en TU fila', !!p1?.fijada_at && !p1?.archivada_at, JSON.stringify(p1))
  await page.goto(`${BASE}/mensajes.html?c=conv-2`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  await page.click('#msgMas')
  await page.click('#msgMasMenu [data-poner="archivar"]')
  await page.waitForTimeout(800)
  const p2 = (await filas(page, 'conversation_participants')).find((p) => p.conversation_id === 'conv-2' && p.user_id === 'user-1')
  check('archivar, también', !!p2?.archivada_at, JSON.stringify(p2))
  // Al volver a cargar, la base del doble se siembra de nuevo: se le pasa lo hecho.
  await page.addInitScript(([f1, f2]) => {
    for (const p of window.__FAKE_FILAS__.conversation_participants) {
      if (p.user_id !== 'user-1') continue
      if (p.conversation_id === 'conv-1') p.fijada_at = f1
      if (p.conversation_id === 'conv-2') p.archivada_at = f2
    }
  }, [p1?.fijada_at, p2?.archivada_at])
  await page.goto(`${BASE}/mensajes.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const bandeja = await page.evaluate(() => ({
    vivas: [...document.querySelectorAll('.msg-filas > .msg-fila')].map((a) => [a.getAttribute('href').split('c=')[1], !!a.querySelector('.msg-fijada')]),
    archivadas: [...document.querySelectorAll('.msg-archivadas .msg-fila')].map((a) => a.getAttribute('href').split('c=')[1]),
    rotulo: document.querySelector('.msg-archivadas summary')?.textContent.trim(),
  }))
  check('la bandeja: la fijada arriba con su chincheta, la archivada aparte y plegada', bandeja.vivas[0]?.[0] === 'conv-1' && bandeja.vivas[0]?.[1] && bandeja.archivadas.join() === 'conv-2' && /Archivadas \(1\)/.test(bandeja.rotulo || ''), JSON.stringify(bandeja))
  if (movil) await page.screenshot({ path: '/tmp/1141-bandeja-movil.png' })
  check('sin errores', !page.errores.length, page.errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
