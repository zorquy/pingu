// Tanda 899 — ocho botones que responden ya (la segunda tanda de R6):
// cambian en el acto, la base confirma por detrás y, si dice que no, se
// vuelve. Con el doble TARDANDO (`__FAKE_RETRASO__`) se mira lo que hay a
// los 200 ms del toque; con el doble FALLANDO (`__FAKE_FALLA__`), que se
// deshace.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

console.log('── 1. Lo estático: ninguno se apaga a esperar ──')
{
  check('seguir: cambia y cuenta antes de la base, y vuelve si falla', /isFollowing = !antes\s*render\(\)/.test(leer('js/usuario.js')) && /if \(error\) \{\s*isFollowing = antes\s*render\(\)/.test(leer('js/usuario.js')))
  check('responder: la respuesta provisional entra al final y el cuadro se vacía', /provisional\.className = 'foro-mensaje foro-mensaje-mio foro-mensaje-enviando'/.test(leer('js/tema.js')) && /provisional\.remove\(\)\s*cuadro\.innerHTML = escrito\.html/.test(leer('js/tema.js')) && /\.foro-mensaje-enviando \{\s*opacity: 0\.55/.test(leer('css/foro.css')))
  check('apuntar partida: la fila provisional entra arriba y se quita si falla', /todas = \[provisional, \.\.\.todas\]\s*repintar\(\)/.test(leer('js/mis-partidas.js')) && /todas = todas\.filter\(\(p\) => p !== provisional\)/.test(leer('js/mis-partidas.js')) && /partidas-fila-provisional/.test(leer('css/partidas.css')))
  check('La quiero: `alternar` avisa con la lista provisional, y /carta y la ficha pintan con ella', /alCambiar = \(\) => \{\}/.test(leer('js/la-quiero.js')) && /alCambiar: \(d\) => laQuiero\.pintarLoseta\(b, carta\.id, d\)/.test(leer('js/carta-mercado.js')) && /alCambiar: \(d\) => \{ deseos = d; pintarLoseta\(id\) \}/.test(leer('js/mi-coleccion.js')))
  check('  …y el Mercado ya no apaga la baldosa', !/boton\.disabled = true/.test(leer('js/mi-coleccion/mercado.js')))
  check('aviso de precio: entra en la lista ya, atenuado', /fila\.className = 'pv-aviso-fila pv-aviso-provisional'/.test(leer('js/avisos-precio.js')) && /pv-aviso-provisional \{ opacity: 0\.55/.test(leer('css/cardmarket.css')))
  check('cambio hecho: el paso siguiente se pinta ya y vuelve si falla', /const provisional = siguiente\[e\.paso\]\?\.\[accion\]/.test(leer('js/cambio-boton.js')) && /caja\.innerHTML = antes\s*caja\.insertAdjacentHTML/.test(leer('js/cambio-boton.js')))
  check('liga de retos: el interruptor no se apaga', !/e\.target\.disabled = true/.test(leer('js/retos-comunidad.js')))
  check('sugerencias: se va de la lista ya y vuelve a su sitio si falla', /lista\.splice\(donde, 1\)\s*pintar\(\)\s*const \{ error \}/.test(leer('js/perfil.js')) && /lista\.splice\(donde, 0, s\)/.test(leer('js/perfil.js')))
}

const browser = await chromium.launch()
async function abrir(ruta, semillas, { movil = false } = {}) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1100, height: 900 } }), locale: 'es-ES' })
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, semillas)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"/>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, ctx, errores }
}

console.log('\n── 2. Seguir a alguien (/usuario) ──')
{
  const { page, ctx, errores } = await abrir('/usuario?u=Ash', { __FAKE_SESSION__: 'user-2', __FAKE_RETRASO__: { user_follows: 1500 } })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const btn = page.locator('#btnFollowToggle').first()
  const antes = limpio(await btn.textContent())
  const seguidores = Number(limpio(await page.locator('#followersCount').textContent()))
  await btn.click({ noWaitAfter: true })
  await page.waitForTimeout(200)
  const ya = { texto: limpio(await btn.textContent()), seguidores: Number(limpio(await page.locator('#followersCount').textContent())) }
  check('a los 200 ms, con la base sin contestar: «Dejar de seguir» y un seguidor más', antes === '+ Seguir' && ya.texto === 'Dejar de seguir' && ya.seguidores === seguidores + 1, JSON.stringify({ antes, ya, seguidores }))
  await page.waitForTimeout(2200)
  check('  …y al contestar, sigue igual', limpio(await btn.textContent()) === 'Dejar de seguir')
  await ctx.close()
  const roto = await abrir('/usuario?u=Ash', { __FAKE_SESSION__: 'user-2', __FAKE_FALLA__: { user_follows: true } })
  const b2 = roto.page.locator('#btnFollowToggle').first()
  await b2.click()
  await roto.page.waitForTimeout(800)
  check('si la base falla, vuelve a «+ Seguir» con su aviso', limpio(await b2.textContent()) === '+ Seguir' && /No se ha podido/.test(limpio(await roto.page.locator('body').innerText())))
  await roto.ctx.close()
}

console.log('\n── 3. Responder en un hilo ──')
{
  const MUNDO = {
    __FAKE_SESSION__: 'user-1',
    __FAKE_SECCIONES__: [{ id: 'sec-1', name: 'General', slug: 'general' }],
    __FAKE_FOROS__: [{ id: 'foro-1', section_id: 'sec-1', name: 'Dudas', slug: 'dudas' }],
    __FAKE_TEMAS__: [{ id: 'tema-1', board_id: 'foro-1', title: '¿Es falsa esta Charizard?', author_id: 'user-2', post_count: 1 }],
    __FAKE_MENSAJES__: [{ id: 'post-1', thread_id: 'tema-1', author_id: 'user-2', body_html: '<p>El holo no tiene el patrón de la época.</p>' }],
  }
  const { page, ctx, errores } = await abrir('/tema?t=tema-1', { ...MUNDO, __FAKE_RETRASO__: { forum_posts: 1500 } })
  check('sin errores', errores.length === 0, errores.join(' | '))
  // Se escribe COMO ESCRIBE LA GENTE: con el cuadro enfocado. Es un editor
  // compacto que crece al tener el foco; si se pulsa «Responder» sin haberlo
  // tocado, el foco llega con el mousedown, el editor crece y el botón se
  // va de debajo del ratón (el clic cae en el formulario).
  await page.locator('#respuestaCuerpo').click()
  await page.evaluate(() => { const c = document.getElementById('respuestaCuerpo'); c.innerHTML = '<p>Gracias, lo miro esta tarde.</p>'; c.dispatchEvent(new Event('input', { bubbles: true })) })
  await page.waitForTimeout(200)
  await page.click('#btnResponder', { noWaitAfter: true })
  await page.waitForTimeout(250)
  const ya = await page.evaluate(() => { const p = document.querySelector('.foro-mensaje-enviando'); return { hay: !!p, texto: p?.textContent.replace(/\s+/g, ' ').trim() || '', atenuada: p ? parseFloat(getComputedStyle(p).opacity) < 1 : null, cuadro: document.getElementById('respuestaCuerpo').textContent.trim() } })
  check('a los 250 ms tu respuesta ya está abajo, atenuada y con «enviando…», y el cuadro vacío', ya.hay && /Gracias, lo miro esta tarde/.test(ya.texto) && /enviando/.test(ya.texto) && ya.atenuada && ya.cuadro === '', JSON.stringify(ya))
  // Con la tabla tardando 1,5 s, publicar y volver a pedir la página son
  // dos esperas seguidas, más los perfiles.
  await page.waitForTimeout(6500)
  const luego = await page.evaluate(() => ({ provisional: document.querySelectorAll('.foro-mensaje-enviando').length, mensajes: [...document.querySelectorAll('[data-mensaje]')].map((m) => m.querySelector('.foro-mensaje-texto')?.textContent.trim()) }))
  check('  …y al confirmar, la de verdad la sustituye', luego.provisional === 0 && luego.mensajes.some((t) => /Gracias, lo miro/.test(t)), JSON.stringify(luego))
  await ctx.close()
  const roto = await abrir('/tema?t=tema-1', { ...MUNDO, __FAKE_FALLA__: { forum_posts: true } })
  // Con la tabla rota los mensajes no cargan, pero el cuadro sí: lo que se mira es que al fallar vuelve el texto.
  const hayCuadro = await roto.page.locator('#respuestaCuerpo').count()
  if (hayCuadro) {
    await roto.page.locator('#respuestaCuerpo').click()
    await roto.page.evaluate(() => { const c = document.getElementById('respuestaCuerpo'); c.innerHTML = '<p>Esto no va a entrar.</p>'; c.dispatchEvent(new Event('input', { bubbles: true })) })
    await roto.page.waitForTimeout(200)
    await roto.page.click('#btnResponder')
    await roto.page.waitForTimeout(800)
    const v = await roto.page.evaluate(() => ({ provisional: document.querySelectorAll('.foro-mensaje-enviando').length, cuadro: document.getElementById('respuestaCuerpo').textContent.trim() }))
    check('si la base falla, la provisional se quita y el texto vuelve al cuadro', v.provisional === 0 && v.cuadro === 'Esto no va a entrar.', JSON.stringify(v))
  } else check('con la tabla rota hay cuadro para probar el fallo', false)
  await roto.ctx.close()
}

console.log('\n── 4. La quiero en /carta y un aviso de precio ──')
{
  const semilla = {
    __FAKE_SESSION__: 'admin-1',
    __FAKE_SETS__: [{ id: 'sv3', name: 'Llamas Obsidianas', serie_id: 'sv', market: 'WEST', card_count_official: 4, card_count_total: 4, release_date: '2023-08-11', tcg_online_code: 'OBF' }],
    __FAKE_CARTAS__: [1, 2].map((n) => ({ id: `sv3-${n}`, market: 'WEST', set_id: 'sv3', local_id: String(n), name: `Carta ${n}`, name_es: `Carta ${n}`, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true } })),
    __FAKE_PRECIOS__: [{ card_id: 'sv3-2', market: 'WEST', cm_low: 12.3, cm_trend: 12.3 }],
    __FAKE_DESEOS__: [{ id: 'd1', user_id: 'admin-1', card_id: 'sv3-2', idioma: null, prioridad: 1, notas: null, created_at: '2026-10-05T10:00:00Z' }],
    __FAKE_AVISOS__: [],
  }
  const { page, ctx, errores } = await abrir('/carta.html?id=sv3-2', { ...semilla, __FAKE_RETRASO__: { user_wants: 1500, user_price_alerts: 1500 } }, { movil: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const b = page.locator('#cmQuiero')
  check('la carta está en «La quiero»', (await b.getAttribute('aria-pressed')) === 'true')
  await b.click({ noWaitAfter: true })
  await page.waitForTimeout(200)
  check('a los 200 ms el corazón ya está quitado, sin apagarse', (await b.getAttribute('aria-pressed')) === 'false' && !(await b.isDisabled()))
  await page.waitForTimeout(2000)
  check('  …y al contestar, sigue quitado', (await b.getAttribute('aria-pressed')) === 'false')
  await page.locator('[data-aviso]').first().click()
  await page.waitForTimeout(600)
  await page.fill('#pvAvisoUmbral', '10')
  await page.click('#pvAvisoGuardar', { noWaitAfter: true })
  await page.waitForTimeout(200)
  const ya = await page.evaluate(() => { const f = document.querySelector('#pvAvisoLista .pv-aviso-provisional'); return { hay: !!f, texto: f?.textContent.replace(/\s+/g, ' ').trim(), atenuada: f ? parseFloat(getComputedStyle(f).opacity) < 1 : null, titulo: !!document.querySelector('#pvAvisoLista .pv-aviso-lista-titulo') } })
  check('a los 200 ms el aviso ya está en «Tus avisos de esta carta», atenuado', ya.hay && /Si baja de 10,00 €/.test(ya.texto) && ya.atenuada && ya.titulo, JSON.stringify(ya))
  await page.waitForTimeout(4000)
  const luego = limpio(await page.locator('#pvAvisoLista').innerText())
  check('  …y al confirmar, es uno de verdad (con su papelera)', /Si baja de 10,00 €/.test(luego) && (await page.locator('#pvAvisoLista .pv-aviso-provisional').count()) === 0 && (await page.locator('#pvAvisoLista [data-quitar-aviso]').count()) === 1, luego)
  await ctx.close()
}

console.log('\n── 5. Apuntar una partida ──')
{
  const { page, ctx, errores } = await abrir('/mis-partidas.html', { __FAKE_SESSION__: 'admin-1', __FAKE_RETRASO__: { match_log: 1200 } })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.waitForTimeout(1500)
  // Las sueltas son la segunda pestaña; su botón vive en su barra.
  await page.click('#partidasTabs [data-vista="sueltas"]')
  await page.waitForTimeout(300)
  await page.click('#btnApuntarPartida')
  await page.waitForTimeout(400)
  await page.locator('#selMio1 .selector-mazo-texto').fill('Charizard')
  await page.waitForTimeout(400)
  await page.locator('#selMio1 .selector-mazo-opcion').first().click()
  await page.locator('#selRival1 .selector-mazo-texto').fill('Gardevoir')
  await page.waitForTimeout(400)
  await page.locator('#selRival1 .selector-mazo-opcion').first().click()
  const sinMarcar = await page.evaluate(() => !document.querySelector('#partidaResultado')?.value && !document.querySelector('#partidaCampoResultado')?.classList.contains('hidden'))
  if (sinMarcar) await page.click('#partidaJuegos [data-r="W"]')
  await page.click('#btnGuardarPartida', { noWaitAfter: true })
  await page.waitForTimeout(250)
  const ya = await page.evaluate(() => { const f = document.querySelector('#partidasLista .partidas-fila-provisional'); return { hay: !!f, texto: f?.textContent.replace(/\s+/g, ' ').trim().slice(0, 80), atenuada: f ? parseFloat(getComputedStyle(f).opacity) < 1 : null, resumen: document.getElementById('partidasResumen')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) } })
  check('a los 250 ms la partida ya está arriba de la lista, atenuada, y el resumen la suma', ya.hay && /Charizard/.test(ya.texto) && ya.atenuada && /Partidas 1/.test(ya.resumen), JSON.stringify(ya))
  await page.waitForTimeout(3500)
  const luego = await page.evaluate(() => ({ provisional: document.querySelectorAll('#partidasLista .partidas-fila-provisional').length, filas: document.querySelectorAll('#partidasLista .partidas-fila').length }))
  check('  …y al confirmar, es una fila de verdad', luego.provisional === 0 && luego.filas === 1, JSON.stringify(luego))
  await ctx.close()
}
await browser.close()

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
