// Tanda 873 — lo demás que se comparte, en pantalla: «Mi mes» desde el
// calendario de /retos, la expansión desde el ⋮ del álbum, la vitrina
// desde el perfil, y el nivel y el logro desde su celebración. Todas abren
// la hoja común (871) y dibujan sus dos formatos.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''
const hoy = new Date().toISOString().slice(0, 10)
const diaHace = (n) => { const [y, m, d] = hoy.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10) }
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="96"><rect width="240" height="96" fill="#d4471c"/></svg>'
const CARTA = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#3a6"/></svg>'

const browser = await chromium.launch()
async function abrir(ruta, { sesion = 'user-1', movil = true, semilla = () => {} } = {}) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES' })
  await ctx.addInitScript(({ sesion, hoy }) => {
    window.__FAKE_SESSION__ = sesion
    navigator.share = async (d) => { window.__compartido = { text: d.text, ficheros: (d.files || []).map((f) => f.name) }; return true }
    navigator.canShare = () => true
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    window.__hoy = hoy
  }, { sesion, hoy })
  await ctx.addInitScript(semilla, { hoy, hace: [1, 2, 5, 9, 12] })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: /logo/.test(r.request().url()) ? LOGO : CARTA }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { page, ctx, errores }
}
const medida = (page) => page.locator('#chPrevia img').evaluate((img) => ({ w: img.naturalWidth, h: img.naturalHeight })).catch(() => null)
// Desde la 988: Instagram (Historia 1080×1920 y Publicación 1080×1350) y X.
async function pestana(page, sel) { await page.click(sel); await page.waitForTimeout(1000) }
async function dosFormatos(page, que) {
  await pestana(page, '[data-ch-forma="historia"]')
  check(`${que}: la historia mide 1080×1920`, JSON.stringify(await medida(page)) === '{"w":1080,"h":1920}', JSON.stringify(await medida(page)))
  if (CAPS) await page.screenshot({ path: `${CAPS}/873-${que.replace(/\W+/g, '-')}-historia.png` })
  await pestana(page, '[data-ch-forma="publicacion"]')
  check(`  …la publicación, 1080×1350`, JSON.stringify(await medida(page)) === '{"w":1080,"h":1350}', JSON.stringify(await medida(page)))
  await pestana(page, '[data-ch-red="x"]')
  check(`  …y la apaisada 1200×630`, JSON.stringify(await medida(page)) === '{"w":1200,"h":630}')
  if (CAPS) {
    const src = await page.locator('#chPrevia img').getAttribute('src')
    if (src) (await import('node:fs')).writeFileSync(`${CAPS}/873-${que.replace(/\W+/g, '-')}-img.png`, Buffer.from(src.split(',')[1], 'base64'))
  }
}

console.log('── 1. «Mi mes» y «Mi día» desde /retos, con los números de la base ──')
{
  const { page, ctx, errores } = await abrir('/retos.html', {
    semilla: ({ hoy, hace }) => {
      const dia = (n) => { const [y, m, d] = hoy.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10) }
      const dias = { [hoy]: 2 }
      for (const n of hace) dias[dia(n)] = n % 2 ? 4 : 1
      window.__FAKE_RETOS_NUMEROS__ = { hoy: { caro: { aciertos: 4, total: 5, tira: [true, true, false, true, true], xp: 12 }, silueta: { aciertos: 1, total: 1, intentos: 2, acertada: true, xp: 10 } }, racha: 3, dias, jugados: 17, mejorRacha: 4, diasPerfectos: 1, xpHoy: 22 }
    },
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const mes = page.locator('.rt-compartir-mes')
  check('el calendario ofrece «Compartir mi mes», de 44 px', (await mes.count()) === 1 && (await mes.evaluate((b) => b.getBoundingClientRect().height)) >= 44)
  await mes.click()
  await page.waitForTimeout(1000)
  check('  …y abre la hoja «Mi mes en PokeDoc»', (await page.locator('.ch-hoja[open]').count()) === 1 && (await page.locator('#chTitulo').innerText()) === 'Mi mes en PokeDoc')
  const t = await page.locator('.ch-texto').innerText()
  check('  …con 6 días jugados de 30, tres filas y las cifras de la base', /mis últimos 30 días: 6 jugados/.test(t) && t.split('\n').length === 6 && /🎯 17 retos · 🔥 mejor racha 4 · 👑 1 día perfecto/.test(t), t)
  check('  …hoy es el último cuadrado, en amarillo (dos retos)', t.split('\n')[3].endsWith('🟨'), t.split('\n')[3])
  await dosFormatos(page, 'mi mes')
  await page.click('[data-ch-cerrar]')
  await page.waitForTimeout(300)
  // «Mi día» con lo de la base (nada en localStorage): la tira del más caro
  // y el quién es a la segunda.
  await page.click('#rtDiaFila .rt-compartir-dia')
  await page.waitForTimeout(1000)
  const d = await page.locator('.ch-texto').innerText()
  check('«Mi día» lee lo de la base: la tira del más caro y el quién es a la segunda, y la racha', /2\/6 retos/.test(d) && /💶 Más caro o barato  🟩🟩🟥🟩🟩/.test(d) && /👤 ¿Quién es\?  🟥🟩/.test(d) && /🔥 3 días seguidos/.test(d), d)
  await ctx.close()
}

console.log('── 2. La expansión, desde el ⋮ del álbum ──')
{
  const semilla = () => {
    window.__FAKE_SETS__ = [{ id: 'sv3', name: 'Llamas Obsidianas', serie_id: 'sv', market: 'WEST', card_count_official: 4, card_count_total: 4, release_date: '2023-08-11', tcg_online_code: 'OBF', logo_path: 'sv/sv03/logo' }]
    const c = (n) => ({ id: `sv3-${n}`, market: 'WEST', set_id: 'sv3', local_id: String(n), name: `Carta ${n}`, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true } })
    window.__FAKE_CARTAS__ = [1, 2, 3, 4].map(c)
    window.__FAKE_COLECCION__ = ['sv3-1', 'sv3-2', 'sv3-3'].map((id, i) => ({ id: `l${i}`, user_id: 'user-1', card_id: id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
    window.__FAKE_PRECIOS__ = [{ card_id: 'sv3-1', market: 'WEST', cm_low: 12.5 }]
  }
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album&set=sv3', { semilla })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.locator('#mcAlbumMenu summary').click()
  await page.waitForTimeout(300)
  const op = page.locator('#mcAlbumCompartir')
  check('el ⋮ tiene «Compartir la expansión» a la vista (es mía)', (await op.count()) === 1 && (await op.isVisible()), String(await op.count()))
  await op.click()
  await page.waitForTimeout(1200)
  check('  …y abre la hoja con el nombre del set', (await page.locator('.ch-hoja[open]').count()) === 1 && (await page.locator('#chTitulo').innerText()) === 'Llamas Obsidianas')
  const t = await page.locator('.ch-texto').innerText()
  check('  …«llevo 3 de 4 (75 %)» y lo que valen las mías', /📦 Llamas Obsidianas: llevo 3 de 4 \(75 %\) en PokeDoc/.test(t) && /💶 Las mías valen 13 €/.test(t) && /pokedoc\.es\/cartas$/.test(t), t)
  await dosFormatos(page, 'expansion')
  await ctx.close()
  // En el catálogo público (sin cuenta) no sale.
  const sin = await abrir('/cartas.html?ver=album&set=sv3', { sesion: 'none', semilla })
  check('sin cuenta, en /cartas, la opción no sale', !(await sin.page.locator('#mcAlbumCompartir').isVisible()))
  await sin.ctx.close()
}

console.log('── 3. La vitrina, desde el perfil ──')
{
  const { page, ctx, errores } = await abrir('/perfil.html', {
    semilla: () => {
      window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST' }]
      window.__FAKE_CARTAS__ = Array.from({ length: 3 }, (_, i) => ({ id: `xy5-${i + 1}`, market: 'WEST', set_id: 'xy5', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `x/${i}` }))
      window.__FAKE_COLECCION__ = Array.from({ length: 3 }, (_, i) => ({ id: `l${i}`, user_id: 'user-1', card_id: `xy5-${i + 1}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
      window.__FAKE_VITRINA__ = [1, 2, 3].map((n) => ({ user_id: 'user-1', posicion: n, card_id: `xy5-${n}`, market: 'WEST' }))
    },
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.locator('#profileTabs [data-tab="vitrina"]').click().catch(() => {})
  await page.waitForTimeout(800)
  const b = page.locator('#perfilVitrina [data-vitrina-compartir]')
  check('la vitrina (mía, con cartas) tiene «Compartir» junto a «Cambiar»', (await b.count()) === 1 && (await page.locator('#perfilVitrina [data-vitrina-elegir]').count()) >= 1)
  await b.click()
  await page.waitForTimeout(1200)
  check('  …y abre la hoja «Mi vitrina»', (await page.locator('.ch-hoja[open]').count()) === 1 && (await page.locator('#chTitulo').innerText()) === 'Mi vitrina')
  const t = await page.locator('.ch-texto').innerText()
  check('  …con una línea por carta y su set', /🖼️ Mi vitrina en PokeDoc/.test(t) && /· Carta 1 \(Duelos Primigenios\)/.test(t) && /· Carta 3/.test(t), t)
  await dosFormatos(page, 'vitrina')
  await ctx.close()
}

console.log('── 4. El nivel y el logro, desde su celebración ──')
{
  const { page, ctx, errores } = await abrir('/retos.html')
  await page.evaluate(() => import('/js/gamification.js').then((m) => m.celebrarSiSubeDeNivel(0, 10000000)))
  await page.waitForTimeout(500)
  const accion = page.locator('.toast-accion')
  check('al subir de nivel, el aviso lleva «Compartir»', (await accion.count()) === 1 && (await accion.innerText()).trim() === 'Compartir')
  await accion.click()
  await page.waitForTimeout(1200)
  const t = await page.locator('.ch-texto').innerText().catch(() => '')
  check('  …que abre la hoja «Nuevo nivel» con el nivel', (await page.locator('#chTitulo').innerText().catch(() => '')) === 'Nuevo nivel' && /⬆️ He subido de nivel en PokeDoc: ahora soy \S/.test(t), t)
  check('  …y el aviso se va al pulsar', (await page.locator('.toast-accion').count()) === 0)
  await dosFormatos(page, 'nivel')
  await page.click('[data-ch-cerrar]')
  await page.waitForTimeout(300)
  await page.evaluate(() => import('/js/gamification.js').then((m) => m.showAchievementModal({ id: 'veterano', title: 'Veterano', description: 'Cinco torneos jugados.', xp_reward: 50, rarity: 'gold', emoji: 'trophy' })))
  await page.waitForTimeout(500)
  const share = page.locator('#achievementShareBtn')
  check('la tarjeta del logro tiene «Compartir» debajo de «¡Genial!»', (await share.count()) === 1 && (await share.isVisible()))
  await share.click()
  await page.waitForTimeout(1200)
  const l = await page.locator('.ch-texto').innerText().catch(() => '')
  check('  …que abre la hoja del logro con su título y descripción', (await page.locator('#chTitulo').innerText().catch(() => '')) === 'Logro desbloqueado' && /🏅 Logro desbloqueado en PokeDoc: Veterano\nCinco torneos jugados\./.test(l), l)
  await dosFormatos(page, 'logro')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
