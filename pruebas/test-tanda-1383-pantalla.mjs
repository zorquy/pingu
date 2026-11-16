// Tanda 1383 — escribir en el foro (PINGU: «cada vez quería subir otra vez al
// panel a darle al spoiler… el panel se debería quedar siempre ahí fijo»;
// «editar el título del spoiler es difícil, porque parece que lo pliegas»;
// «pensaba que iba a ser más como un código de los foros antiguos»; «no sé si
// todas las menciones funcionan»; eligió lo recomendado):
//   · la barra de la caja del foro se queda pegada arriba al escribir largo;
//   · el botón dice «Spoiler»; al ponerlo, se escribe primero el título, y
//     tocar el título no pliega nada;
//   · [spoiler]…[/spoiler] y [spoiler=Título]…[/spoiler] se guardan como el
//     desplegable; sin cerrar, texto;
//   · una @mención que no lleva a nadie se avisa, y con alguien parecido se
//     propone y se cambia.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const largo = 'Mi carta favorita es sin duda este Reshiram & Charizard GX por el significado que tiene para mí. '.repeat(2)
const MUNDO = {
  __FAKE_SESSION__: 'user-1',
  __FAKE_SECCIONES__: [{ id: 'sec-1', name: 'General', slug: 'general' }],
  __FAKE_FOROS__: [{ id: 'foro-1', section_id: 'sec-1', name: 'Dudas', slug: 'dudas' }],
  __FAKE_TEMAS__: [{ id: 'tema-1', board_id: 'foro-1', title: 'Hilo de prueba', author_id: 'user-2', post_count: 3 }],
  __FAKE_MENSAJES__: Array.from({ length: 3 }, (_, i) => ({ id: `post-${i + 1}`, thread_id: 'tema-1', author_id: i % 2 ? 'user-3' : 'user-2', body_html: `<p>${largo}</p>`, created_at: `2026-10-20T1${i}:00:00Z` })),
}
const browser = await chromium.launch()
async function abrir(movil) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, MUNDO)
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/tema?t=tema-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#respuestaCuerpo', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  return { ctx, page, errores }
}

console.log('── Los códigos de spoiler, al guardar ──')
{
  const { ctx, page } = await abrir(false)
  const r = await page.evaluate(async () => {
    const { sanitizeRichText } = await import('/js/richtext-format.js')
    const ver = (h) => {
      const d = document.createElement('div')
      d.innerHTML = sanitizeRichText(h)
      return [...d.children].map((e) => (e.tagName === 'DETAILS' ? `D[${e.querySelector('summary').textContent}|${[...e.children].slice(1).map((c) => c.tagName + ':' + c.textContent).join(',')}]` : `${e.tagName}:${e.textContent}`)).join(' ')
    }
    return {
      bloques: ver('<p>Mi lista:</p><p>[spoiler=Lista de Dragapult]</p><p>4 Dreepy</p><p>3 Dragapult ex</p><p>[/spoiler]</p><p>Fin</p>'),
      enLinea: ver('<p>antes [spoiler]oculto[/spoiler] después</p>'),
      sinCerrar: ver('<p>esto [spoiler] no se cierra</p>'),
      dos: ver('<p>[spoiler=A]uno[/spoiler]</p><p>[spoiler=B]dos[/spoiler]</p>'),
      negrita: ver('<p>[spoiler]<b>fuerte</b> y no[/spoiler]</p>'),
      mayus: ver('<p>[SPOILER=Mayús]x[/Spoiler]</p>'),
    }
  })
  check('en bloques: título, dos párrafos dentro y lo de alrededor fuera', r.bloques === 'P:Mi lista: D[Lista de Dragapult|P:4 Dreepy,P:3 Dragapult ex] P:Fin', r.bloques)
  check('en una línea: antes, el spoiler y después', r.enLinea === 'P:antes  D[Spoiler|P:oculto] P: después', r.enLinea)
  check('sin cerrar se queda como texto', r.sinCerrar === 'P:esto [spoiler] no se cierra', r.sinCerrar)
  check('dos seguidos, dos spoilers', r.dos === 'D[A|P:uno] D[B|P:dos]', r.dos)
  check('lo de dentro conserva su formato', /D\[Spoiler\|P:fuerte y no\]/.test(r.negrita), r.negrita)
  check('sin distinguir mayúsculas', r.mayus === 'D[Mayús|P:x]', r.mayus)
  await ctx.close()
}

for (const movil of [false, true]) {
  const quien = movil ? 'móvil' : 'PC'
  console.log(`── El editor, ${quien} ──`)
  const { ctx, page, errores } = await abrir(movil)
  await page.locator('#respuestaCuerpo').click()
  await page.waitForTimeout(300)
  // El botón dice «Spoiler»
  check(`${quien}: el botón de spoiler dice «Spoiler»`, (await page.textContent('#respuestaBarra .rte-btn-spoiler').catch(() => '')).trim() === 'Spoiler')
  // Un mensaje largo y la barra pegada
  for (let i = 0; i < 40; i++) {
    await page.keyboard.type(`Línea ${i} del mensaje largo`)
    await page.keyboard.press('Enter')
  }
  await page.waitForTimeout(300)
  const pegada = await page.evaluate(() => {
    const b = document.getElementById('respuestaBarra').getBoundingClientRect()
    const s = document.getElementById('respuestaCuerpo').getBoundingClientRect()
    return { arriba: Math.round(b.top), barraAlto: Math.round(b.height), cajaArriba: Math.round(s.top), ventana: innerHeight, pos: getComputedStyle(document.getElementById('respuestaBarra')).position }
  })
  check(`${quien}: con 40 líneas, la caja empieza por encima de la pantalla y la barra sigue a la vista`, pegada.pos === 'sticky' && pegada.cajaArriba < 0 && pegada.arriba >= 0 && pegada.arriba < 120, JSON.stringify(pegada))
  // En el móvil, una fila: pegada no puede tapar media pantalla.
  if (movil) check('móvil: la barra pegada es baja (una fila, ≤ 60 px)', pegada.barraAlto <= 60, pegada.barraAlto)
  // Spoiler: primero el título
  await page.click('#respuestaBarra .rte-btn-spoiler')
  await page.waitForTimeout(200)
  await page.keyboard.type('Mi lista')
  await page.keyboard.press('Enter')
  await page.keyboard.type('4 Dreepy')
  await page.waitForTimeout(200)
  const sp = await page.evaluate(() => {
    const d = [...document.querySelectorAll('#respuestaCuerpo details')].pop()
    return d ? { titulo: d.querySelector('summary').textContent.trim(), cuerpo: [...d.children].slice(1).map((c) => c.textContent).join('|'), abierto: d.open } : null
  })
  check(`${quien}: al poner el spoiler se escribe el título y Enter baja al cuerpo`, sp && sp.titulo === 'Mi lista' && sp.cuerpo.includes('4 Dreepy'), JSON.stringify(sp))
  // Tocar el título no lo pliega
  const sum = page.locator('#respuestaCuerpo details summary').last()
  if (movil) await sum.tap(); else await sum.click()
  await page.waitForTimeout(300)
  const abierto = await page.evaluate(() => [...document.querySelectorAll('#respuestaCuerpo details')].pop()?.open)
  check(`${quien}: tocar el título no pliega el spoiler`, abierto === true)
  await page.keyboard.press('End')
  await page.keyboard.type(' de agua')
  await page.waitForTimeout(200)
  const conEspacio = await page.evaluate(() => [...document.querySelectorAll('#respuestaCuerpo details')].pop()?.querySelector('summary').textContent.trim())
  check(`${quien}: el espacio en el título escribe un espacio`, conEspacio === 'Mi lista de agua' && (await page.evaluate(() => [...document.querySelectorAll('#respuestaCuerpo details')].pop()?.open)), conEspacio)
  check(`${quien}: sin errores`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── Las menciones que no llevan a nadie ──')
{
  const { ctx, page, errores } = await abrir(false)
  await page.locator('#respuestaCuerpo').click()
  await page.keyboard.type('Gracias @Misty y @mistyy y @nadieaqui')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1800)
  const aviso = await page.evaluate(() => {
    const p = document.querySelector('.rte-aviso-menciones')
    return { visible: p && !p.classList.contains('hidden'), texto: p?.textContent || '', resaltes: CSS.highlights?.get('mencion-sin-nadie')?.size ?? -1 }
  })
  check('avisa de las dos que no son nadie, no de @Misty', aviso.visible && /@mistyy/.test(aviso.texto) && /@nadieaqui/.test(aviso.texto) && !/«@misty»/i.test(aviso.texto), aviso.texto)
  check('…con el subrayado en las dos', aviso.resaltes === 2, aviso.resaltes)
  check('…y para @mistyy propone a Misty', /¿Querías decir @Misty\?/i.test(aviso.texto), aviso.texto)
  await page.click('.rte-aviso-menciones button')
  await page.waitForTimeout(1500)
  const despues = await page.evaluate(() => ({ texto: document.getElementById('respuestaCuerpo').textContent, aviso: document.querySelector('.rte-aviso-menciones')?.textContent || '' }))
  check('al tocarla se cambia en el texto y deja de avisar de ella', /@Misty y @Misty y @nadieaqui/.test(despues.texto) && !/mistyy/i.test(despues.aviso) && /@nadieaqui/.test(despues.aviso), JSON.stringify(despues))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
