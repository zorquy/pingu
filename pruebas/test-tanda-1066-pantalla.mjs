// Tanda 1066 — la analítica que se entiende, en el navegador: las cuatro
// pestañas (Resumen, Tráfico, Qué hacen, Técnico), el Resumen (la frase con
// sus colores, las seis cifras, las personas por día web/app, lo que hace la
// gente, las altas paso a paso y la salud), la tarjeta «App instalada o web»
// en Tráfico, la pestaña recordada, la salud que lleva a Técnico, el enlace
// /admin/?ver=analytics, y sin la migración 1065: aviso y a Tráfico.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hoy = new Date()
const dia = (i) => new Date(hoy.getTime() - (29 - i) * 864e5).toISOString().slice(0, 10)
const semana = (i) => new Date(hoy.getTime() - (7 - i) * 7 * 864e5).toISOString().slice(0, 10)
const POR_DIA = Array.from({ length: 30 }, (_, i) => ({ dia: dia(i), personas: 120 + Math.round(60 * Math.sin(i / 3)) + i * 4, con_sesion: 40 + (i % 7) * 6 }))
const HORAS = []
for (let d = 1; d <= 7; d++) for (let h = 0; h < 24; h++) HORAS.push({ dia: d, hora: h, n: Math.max(0, Math.round((h > 8 ? 10 : 1) * (1 + Math.sin((h - 6) / 4)) * (d >= 5 ? 1.6 : 1))) })
HORAS.find((x) => x.dia === 4 && x.hora === 21).n = 99
const DATOS = {
  resumen: { personas: 4680, personas_antes: 3900, entradas: 1620, entradas_antes: 1700, activos: 212, activos_antes: 180, con_sesion: 1500, robots: 2310, altas: 34, altas_antes: 20, registrados: 1290, con_aparato: 3000, movil: 2040 },
  por_dia: POR_DIA,
  origenes: [{ origen: 'google', n: 720 }, { origen: 'directo', n: 410 }, { origen: 'instagram', n: 260 }, { origen: 'telegram', n: 140 }, { origen: 'x', n: 50 }, { origen: 'blog.ejemplo.com', n: 40 }],
  campanas: [{ campana: 'telegram', n: 120 }, { campana: 'instagram', n: 90 }],
  aparatos: [{ aparato: 'movil', n: 2040 }, { aparato: 'pc', n: 840 }, { aparato: 'tablet', n: 120 }],
  paginas: [{ ruta: '/', n: 1500 }, { ruta: '/mi-coleccion', n: 900 }, { ruta: '/retos', n: 600 }, { ruta: '/aprender', n: 300 }],
  retencion: Array.from({ length: 8 }, (_, i) => ({ semana: semana(i), activos: 120 + i * 12, vuelven: i === 7 ? null : 50 + i * 6, altas: 10 + i })),
  horas: HORAS,
  busquedas: { total: 820, vacias: 95, top: [{ q: 'charizard', n: 80, vacias: 0 }, { q: 'mega gardevoir', n: 40, vacias: 12 }, { q: '<img src=x onerror=window.__XSS__=1>', n: 3, vacias: 3 }], sin_resultado: [{ q: 'pokemon pocket', n: 30 }, { q: 'mega gardevoir', n: 12 }] },
  rotos: [{ ruta: '/guia/vieja', n: 9, desde: '/aprender', ultima: hoy.toISOString() }, { ruta: '/wp-admin', n: 4, desde: null, ultima: hoy.toISOString() }],
}


const RESUMEN = {
  medido_desde: hoy.toISOString(), personas: 612, personas_antes: 537, personas_app: 208, personas_app_antes: 130,
  visitas: 900, instalaciones: 19, instalaciones_antes: 12, instalaciones_por: { ios: 11, android: 7, otro: 1 },
  activos: 212, activos_antes: 180, registrados: 1290,
  acciones: { cartas: { n: 1840, antes: 1508 }, deseos: { n: 410, antes: 376 }, retos: { n: 520, antes: 397 }, foro: { n: 96, antes: 104 }, guias: { n: 74, antes: 71 }, partidas: { n: 63, antes: 56 } },
  altas: { n: 34, hacen: 21, carta: 16, vuelven: 10, n_antes: 20, hacen_antes: 11 },
  salud: { errores: 21, errores_antes: 30, rotos: 2, lcp_p75: 2100 },
  por_dia: Array.from({ length: 7 }, (_, i) => ({ dia: dia(23 + i), web: 60 + i * 3, app: 25 + i * 2 })),
}

const b = await chromium.launch()
async function abrir({ resumen = RESUMEN, ancho = 1280, ruta = '/admin/', movil = false, guardada = null } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: ancho, height: 900 } })
  await ctx.addInitScript(([d, r, g]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_ANALITICA__ = d
    if (r) window.__FAKE_RESUMEN__ = r
    try { if (g) localStorage.setItem('pd-admin-analitica', g); else localStorage.removeItem('pd-admin-analitica') } catch {}
  }, [DATOS, resumen, guardada])
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  if (!ruta.includes('ver=')) await p.locator('[data-section="analytics"]').click()
  await p.waitForTimeout(900)
  return { p, ctx, errores }
}
const visibles = (p) => p.evaluate(() => [...document.querySelectorAll('#section-analytics [data-an-tab]')].filter((e) => e.offsetParent !== null).map((e) => e.dataset.anTab + ':' + (e.querySelector('h2')?.textContent || e.id || e.className)))
const pestana = (p) => p.evaluate(() => document.getElementById('section-analytics').dataset.anVer)

console.log('── 1. El Resumen, de entrada ──')
{
  const { p, ctx, errores } = await abrir()
  check('sin errores', !errores.length, errores.join(' | '))
  check('las cuatro pestañas, con Resumen elegida', (await p.locator('#anPestanas').isVisible()) && (await pestana(p)) === 'resumen' && (await p.getAttribute('[data-an-pestana="resumen"]', 'aria-selected')) === 'true')
  const vis = await visibles(p)
  check('  …y solo se ve lo del Resumen', vis.length > 0 && vis.every((v) => v.startsWith('resumen:')), vis.join(' | '))
  const frase = await p.textContent('.an-frase')
  check('la frase: personas, su subida, «1 de cada 3 desde la app» y lo que vuelve', /han entrado 612 personas \(\+14 %\), 1 de cada 3 desde la app\. Vuelve el \d+ % de quien tiene cuenta\./.test(frase), frase)
  check('  …con lo que sube en verde y lo que baja en rojo', (await p.locator('.an-frase .an-frase-sube').count()) >= 1 && (await p.locator('.an-frase .an-frase-baja').count()) === 1, await p.innerHTML('.an-frase'))
  const tiles = await p.$$eval('#anResumen .an-tile', (ts) => ts.map((t) => t.innerText.replace(/\s+/g, ' ')))
  check('seis cifras', tiles.length === 6, tiles.join(' / '))
  check('  …personas 612 (+14 %) y la media al día', /612/.test(tiles[0]) && /\+14 %/.test(tiles[0]) && /87 al día/.test(tiles[0]), tiles[0])
  check('  …desde la app 34 % y su subida en PUNTOS (24 → 34)', /34 %/.test(tiles[1]) && /\+10 puntos/.test(tiles[1]) && /19 instalaciones nuevas/.test(tiles[1]), tiles[1])
  check('  …altas que empiezan 62 % (+7 puntos: 55 → 62)', /62 %/.test(tiles[4]) && /\+7 puntos/.test(tiles[4]) && /21 de 34/.test(tiles[4]), tiles[4])
  check('  …y cosas hechas, la suma de las seis (3.003 contra 2.512: +20 %)', /3 mil/.test(tiles[5]) && /\+20 %/.test(tiles[5]), tiles[5])
  const acc = await p.$$eval('#anResumen .an-acciones li', (ls) => ls.map((l) => l.innerText.replace(/\s+/g, ' ')))
  check('lo que hace la gente: las seis, con el foro bajando', acc.length === 6 && /Cartas añadidas 1840 \+22 %/.test(acc[0].replace('.', '')) && /Mensajes del foro 96 -8 %/.test(acc[3]), acc.join(' / '))
  const pasos = await p.$$eval('#anResumen .an-embudo li', (ls) => ls.map((l) => l.innerText.replace(/\s+/g, ' ')))
  check('las altas paso a paso: 34, 21, 16 y 10', pasos.length === 4 && /34/.test(pasos[0]) && /21.*62 %/.test(pasos[1]) && /16.*47 %/.test(pasos[2]) && /10.*29 %/.test(pasos[3]), pasos.join(' / '))
  const salud = await p.$$eval('#anResumen .an-salud-celda', (cs) => cs.map((c) => c.className.match(/an-salud-(bien|regular|mal|nada)/)[1] + ':' + c.innerText.replace(/\s+/g, ' ')))
  check('salud: 3 errores al día (bien), 2 rotas (regular), 2,1 s (bien)', /^bien:.*3 al día/.test(salud[0]) && /^regular:.*2/.test(salud[1]) && /^bien:.*2,1 s/.test(salud[2]), salud.join(' / '))
  const cols = await p.$$eval('#anResumen .an-dia', (cs) => cs.length)
  check('personas por día: siete columnas, web y app', cols === 7 && (await p.locator('#anResumen .an-dia i.an-s3').count()) === 7)
  if (CAPS) await p.screenshot({ path: `${CAPS}/1066-resumen-pc.png`, fullPage: true })

  console.log('── 2. Las otras pestañas ──')
  await p.click('[data-an-pestana="trafico"]')
  await p.waitForTimeout(400)
  let vis2 = await visibles(p)
  check('Tráfico: solo lo suyo (visitas, orígenes, aparatos, calor…)', vis2.every((v) => v.startsWith('trafico:')) && vis2.some((v) => /Visitas por día/.test(v)) && vis2.some((v) => /De dónde llegan/.test(v)), vis2.join(' | '))
  const app = await p.textContent('#anPanel [data-an-tab="trafico"] .an-pila + .an-leyenda').catch(() => '')
  check('  …con «App instalada o web»: web 404 y app 208, e iPhone 11 · Android 7', /Web 404/.test(app) && /App instalada 208/.test(app) && /iPhone 11 · Android 7/.test(await p.textContent('#anPanel')), app)
  check('  …y la gráfica de líneas se dibuja al enseñarse', (await p.$$eval('#anLineas path.an-linea', (ps) => ps.length)) === 2)
  await p.click('[data-an-pestana="hacen"]')
  await p.waitForTimeout(300)
  vis2 = await visibles(p)
  check('Qué hacen: quién vuelve, búsquedas, páginas, guías y comunidad', vis2.every((v) => v.startsWith('hacen:')) && vis2.some((v) => /Quién vuelve/.test(v)) && vis2.some((v) => /Lo más buscado/.test(v)) && vis2.some((v) => /Actividad de la comunidad/.test(v)), vis2.join(' | '))
  await p.click('[data-an-pestana="tecnico"]')
  await p.waitForTimeout(300)
  vis2 = await visibles(p)
  check('Técnico: páginas rotas y lo que tarda de verdad', vis2.every((v) => v.startsWith('tecnico:')) && vis2.some((v) => /Páginas rotas/.test(v)) && vis2.some((v) => /Lo que tarda/.test(v)), vis2.join(' | '))
  await ctx.close()
}

console.log('── 3. La pestaña se recuerda, y la salud lleva a Técnico ──')
{
  const { p, ctx } = await abrir({ guardada: 'hacen' })
  check('vuelve a la última que miraste', (await pestana(p)) === 'hacen')
  await p.click('[data-an-pestana="resumen"]')
  await p.waitForTimeout(300)
  await p.locator('#anResumen .an-salud-celda').nth(1).click()
  await p.waitForTimeout(300)
  check('«Páginas rotas» del Resumen abre Técnico', (await pestana(p)) === 'tecnico')
  await p.click('[data-an-pestana="resumen"]')
  await p.locator('#anResumen .an-salud-celda').nth(0).click()
  await p.waitForTimeout(400)
  check('  …y «Errores», la sección de errores', await p.evaluate(() => document.getElementById('section-errors')?.classList.contains('active')))
  await ctx.close()
}

console.log('── 4. El enlace del lunes abre la analítica ──')
{
  const { p, ctx, errores } = await abrir({ ruta: '/admin/?ver=analytics' })
  check('/admin/?ver=analytics abre la sección', await p.evaluate(() => document.getElementById('section-analytics')?.classList.contains('active')) && (await p.locator('.an-frase').isVisible()), errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Sin la migración 1065 ──')
{
  const { p, ctx, errores } = await abrir({ resumen: null })
  check('sin errores', !errores.length, errores.join(' | '))
  check('abre en Tráfico, con sus datos', (await pestana(p)) === 'trafico' && (await p.locator('#anLineas path.an-linea').count()) === 2)
  await p.click('[data-an-pestana="resumen"]')
  await p.waitForTimeout(300)
  check('  …y el Resumen dice qué migración falta', /supabase-migration-1065-analitica-app\.sql/.test(await p.textContent('#anResumen')))
  check('  …sin la tarjeta de la app en Tráfico', !/App instalada o web/.test(await p.textContent('#anPanel')))
  await ctx.close()
}

console.log('── 6. En el móvil ──')
{
  const { p, ctx, errores } = await abrir({ movil: true })
  const r = await p.evaluate(() => ({ ancho: document.documentElement.scrollWidth, vista: innerWidth, cols: getComputedStyle(document.querySelector('.an-tiles-resumen')).gridTemplateColumns.split(' ').length }))
  check('sin desbordar y las cifras a dos columnas', r.ancho <= r.vista && r.cols === 2, JSON.stringify(r))
  check('sin errores', !errores.length, errores.join(' | '))
  if (CAPS) await p.screenshot({ path: `${CAPS}/1066-resumen-m.png`, fullPage: true })
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO OK')
process.exit(fails ? 1 : 0)
