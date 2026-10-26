// Tanda 867 — el perfil en tres capas: quién eres, tus cifras y UNA fila
// de pestañas (Vitrina · Guías · Foro · Torneos · Medallas).
//
// PINGU: «pestañas dentro de otras pestañas», «el muro… no hay que
// utilizar», «el enlace este de referido que quizá no sirve para nada».
// Lo que se mira: que ya no hay niveles ni muro ni invitación ni Cerrar
// sesión / borrado en la ficha; que la cabecera lleva nivel y racha en una
// línea y no enseña «Miembro» sin guías; que las cinco cifras son iguales y
// tocables; que la fila de pestañas es una, con `?ver=` y los alias viejos
// (#about); que la tuya abre por la Vitrina y la de otro por la vitrina
// solo si tiene cartas; que Medallas lleva el logro destacado y los
// trofeos sin acordeón; y que «Editar perfil» ya no lleva avisos.
import { readFileSync, existsSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 0. Lo estático ──')
{
  const perfil = readFileSync(`${RAIZ}/perfil.html`, 'utf8')
  const usuario = readFileSync(`${RAIZ}/usuario.html`, 'utf8')
  for (const [n, h] of [['perfil', perfil], ['usuario', usuario]]) {
    check(`${n}.html: sin niveles, sin muro, sin Acerca; seis pestañas en #profileTabs (con Cambios desde la 887)`, !/perfilNiveles|ptab-wall|ptab-about|commentForm|data-pnivel/.test(h) && (h.match(/data-ptab="/g) || []).length === 6)
  }
  check('perfil.html: sin Cerrar sesión, sin borrado, sin Trofeos como cifra, sin acordeón', !/btnLogout|btnRequestAccountDeletion|heroTrophyCount|accordion/.test(perfil))
  const js = readFileSync(`${RAIZ}/js/perfil.js`, 'utf8')
  check('perfil.js: sin invitación, sin muro, sin avisos en el editor', !/montarInvitacion|panelInvitar|renderWall|NOTIFICATION_TYPES|data-notif-pref|peHideActivity|pePlayerId/.test(js))
  check('ni /admin pregunta por el muro (la analítica cantaba «no existe la tabla» en cuanto PINGU la borró)', !/profile_comments|wallCommentsRes/.test(readFileSync(`${RAIZ}/admin/js/admin.js`, 'utf8')))
  check('js/wall.js ya no existe; el tipo «comentarios en tu muro» tampoco; hay migración que borra la tabla', !existsSync(`${RAIZ}/js/wall.js`) && !/wall_comment/.test(readFileSync(`${RAIZ}/js/notifications.js`, 'utf8')) && /drop table if exists public\.profile_comments/.test(readFileSync(`${RAIZ}/supabase-migration-sin-muro.sql`, 'utf8')))
  check('las cifras son una función sin racha, con Cartas enlazada y Guías/Torneos a su pestaña', /propia \? '\/mi-coleccion'/.test(readFileSync(`${RAIZ}/js/perfil-cifras.js`, 'utf8')) && !/racha/.test(readFileSync(`${RAIZ}/js/perfil-cifras.js`, 'utf8').replace(/\/\/[^\n]*/g, '')))
}

const browser = await chromium.launch()
const semilla = ({ sesion, vitrina }) => {
  window.__FAKE_SESSION__ = sesion
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch { /* sin memoria */ }
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST' }]
  window.__FAKE_CARTAS__ = Array.from({ length: 4 }, (_, i) => ({ id: `xy5-${i + 1}`, market: 'WEST', set_id: 'xy5', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `x/${i}` }))
  window.__FAKE_COLECCION__ = Array.from({ length: 4 }, (_, i) => ({ id: `l${i}`, user_id: sesion, card_id: `xy5-${i + 1}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
  window.__FAKE_VITRINA__ = vitrina
}
async function abrir(ruta, { vitrina = [], sesion = 'user-1', movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 1000 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, { vitrina, sesion })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}
const estado = (page) => page.evaluate(() => {
  const ve = (sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none' && !e.hidden && e.getBoundingClientRect().height > 0 }
  const tabs = [...document.querySelectorAll('#profileTabs .tab-btn')]
  const cifras = [...document.querySelectorAll('.perfil-cifras .perfil-cifra')]
  const tops = tabs.filter((b) => !b.hidden).map((b) => Math.round(b.getBoundingClientRect().top))
  return {
    pestanias: tabs.filter((b) => !b.hidden).map((b) => b.dataset.ptab),
    unaFila: new Set(tops).size === 1,
    activa: tabs.find((b) => b.classList.contains('active'))?.dataset.ptab,
    panelVisible: [...document.querySelectorAll('.tab-panel[id^="ptab-"]')].filter((p) => getComputedStyle(p).display !== 'none').map((p) => p.id),
    cifras: cifras.map((c) => ({ tag: c.tagName, rotulo: c.querySelector('.rotulo')?.textContent.trim(), href: c.getAttribute('href'), ver: c.dataset.ver, tam: Math.round(parseFloat(getComputedStyle(c.querySelector('.valor')).fontSize)) })),
    linea: document.querySelector('.perfil-chapas')?.textContent.replace(/\s+/g, ' ').trim(),
    racha: ve('.perfil-racha'),
    rango: Boolean(document.getElementById('btnTierInfo')),
    xpBar: Boolean(document.querySelector('.profile-xp-bar')),
    huecos: document.querySelectorAll('#perfilVitrina .vitrina-hueco').length,
    vitrinaCartas: document.querySelectorAll('#perfilVitrina .vitrina-carta').length,
    compartir: (() => { const b = document.getElementById('btnCompartirPerfil'); if (!b) return null; const r = b.getBoundingClientRect(); const s = b.querySelector('svg'); return { ancho: Math.round(r.width), alto: Math.round(r.height), icono: s ? getComputedStyle(s).display !== 'none' : false } })(),
    logroDestacado: document.getElementById('logroDestacado')?.textContent.replace(/\s+/g, ' ').trim(),
    trofeosTitulo: document.querySelector('#ptab-medallas .section-title')?.textContent.replace(/\s+/g, ' ').trim(),
    ver: new URLSearchParams(location.search).get('ver'),
    sinCuenta: !document.getElementById('btnLogout') && !document.getElementById('btnRequestAccountDeletion') && !document.getElementById('panelInvitar'),
    muro: Boolean(document.getElementById('commentForm')),
  }
})

console.log('── 1. Tu perfil: tres capas ──')
{
  const { page, ctx, errores } = await abrir('/perfil.html')
  let m = await estado(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la cabecera: nivel y racha en una línea, sin «Miembro» (cero guías) ni barra de XP', /Novato/.test(m.linea) && m.racha && !m.rango && !m.xpBar && !/Miembro/.test(m.linea), JSON.stringify({ linea: m.linea, racha: m.racha, rango: m.rango }))
  check('cinco cifras iguales: Cartas (enlace a Mi colección), Guías y Torneos (a su pestaña), Seguidores, Siguiendo', m.cifras.map((c) => c.rotulo).join('|') === 'Cartas|Guías|Torneos|Seguidores|Siguiendo' && m.cifras[0].tag === 'A' && m.cifras[0].href === '/mi-coleccion' && m.cifras[1].ver === 'guides' && m.cifras[2].ver === 'torneos' && new Set(m.cifras.map((c) => c.tam)).size === 1, JSON.stringify(m.cifras))
  check('UNA fila de pestañas: Vitrina · Cambios · Guías · Foro · Torneos · Medallas', m.pestanias.join('|') === 'vitrina|cambios|guides|foro|torneos|medallas' && m.unaFila, JSON.stringify(m.pestanias))
  check('la tuya abre por la Vitrina aunque esté vacía (seis huecos para elegir), y solo ese panel se ve', m.activa === 'vitrina' && m.huecos === 6 && m.panelVisible.join() === 'ptab-vitrina', JSON.stringify({ activa: m.activa, huecos: m.huecos, paneles: m.panelVisible }))
  check('sin muro, sin invitación, sin Cerrar sesión ni borrado en la ficha', !m.muro && m.sinCuenta)
  check('Compartir: un botón de icono de 44 px con el icono a la vista', m.compartir && m.compartir.ancho >= 44 && m.compartir.alto >= 44 && m.compartir.icono, JSON.stringify(m.compartir))
  // La cifra de Guías abre su pestaña.
  await page.click('.perfil-cifras [data-ver="guides"]')
  await page.waitForTimeout(300)
  m = await estado(page)
  check('tocar la cifra de Guías abre la pestaña Guías', m.activa === 'guides' && m.panelVisible.join() === 'ptab-guides')
  await page.click('#profileTabs [data-ptab="medallas"]')
  await page.waitForTimeout(400)
  m = await estado(page)
  check('Medallas: el logro destacado en una línea (con «Elegir uno»), los trofeos sin acordeón, y `?ver=medallas` en la dirección', m.activa === 'medallas' && /Sin logro destacado/.test(m.logroDestacado || '') && /Elegir uno/.test(m.logroDestacado || '') && /^Trofeos/.test(m.trofeosTitulo || '') && m.ver === 'medallas', JSON.stringify({ l: m.logroDestacado, t: m.trofeosTitulo, ver: m.ver }))
  // «Editar perfil»: solo lo que ven los demás.
  await page.click('#btnEditProfile')
  await page.waitForTimeout(600)
  const editor = await page.evaluate(() => ({
    campos: [...document.querySelectorAll('#profileModalContent .form-group > label')].map((l) => l.textContent.trim()),
    avisos: document.querySelectorAll('#profileModalContent [data-notif-pref], #profileModalContent [data-email-pref], #profileModalContent #peHideActivity, #profileModalContent #pePlayerId').length,
    ajustes: document.querySelector('#profileModalContent a[href="/ajustes"]')?.textContent,
  }))
  check('«Editar perfil»: nombre, usuario, sobre ti, firma, color y logro; ni avisos ni cuenta, y un enlace a Ajustes', editor.campos.length === 6 && editor.avisos === 0 && editor.ajustes === 'Ajustes', JSON.stringify(editor))
  await ctx.close()
}

console.log('── 2. Los enlaces viejos y los nuevos llegan ──')
for (const [ruta, pestania] of [['/perfil.html#about', 'medallas'], ['/perfil.html#foro', 'foro'], ['/perfil.html?ver=torneos', 'torneos'], ['/perfil.html?ver=medallas', 'medallas'], ['/perfil.html#vitrina', 'vitrina'], ['/perfil.html#wall', 'vitrina']]) {
  const { page, ctx } = await abrir(ruta)
  const m = await estado(page)
  check(`${ruta} → ${pestania}`, m.activa === pestania && m.panelVisible.join() === `ptab-${pestania}`, JSON.stringify({ activa: m.activa, paneles: m.panelVisible }))
  await ctx.close()
}

console.log('── 3. La ficha de otra persona ──')
{
  const { page, ctx, errores } = await abrir('/usuario.html?id=user-2', { vitrina: [{ user_id: 'user-2', posicion: 1, card_id: 'xy5-1', market: 'WEST' }] })
  let m = await estado(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('con cartas en la vitrina, se abre por ella; la misma fila de pestañas; Seguir y Mensaje; sin muro', m.activa === 'vitrina' && m.vitrinaCartas === 1 && m.huecos === 0 && m.pestanias.join('|') === 'vitrina|guides|foro|torneos|medallas' && !m.muro && (await page.locator('#btnFollowToggle').isVisible()), JSON.stringify(m))
  check('las cinco cifras, sin enlace en Cartas (la colección de otro no se abre)', m.cifras.length === 5 && m.cifras[0].tag === 'DIV' && m.cifras[1].ver === 'guides', JSON.stringify(m.cifras))
  await page.click('#profileTabs [data-ptab="torneos"]')
  await page.waitForTimeout(800)
  check('Torneos: la pestaña se pinta (vacía, lo dice)', /Todavía no ha jugado/.test(await page.locator('#misTorneos').textContent()))
  await ctx.close()
  const b = await abrir('/usuario.html?id=user-2', { vitrina: [] })
  const n = await estado(b.page)
  check('sin cartas, la Vitrina ni sale y se abre por Guías (lo primero)', n.pestanias.join('|') === 'guides|foro|torneos|medallas' && n.activa === 'guides', JSON.stringify({ p: n.pestanias, a: n.activa }))
  await b.ctx.close()
}

console.log('── 4. En el iPhone ──')
{
  const { page, ctx, errores } = await abrir('/perfil.html', { movil: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const m = await estado(page)
  // Desde la 1038 las pestañas miden 36 a la vista y llegan a 44 con su franja (::after).
  const toca = await page.evaluate(() => [...document.querySelectorAll('#profileTabs .tab-btn, .perfil-cifras .perfil-cifra')].map((b) => { const a = getComputedStyle(b, '::after'); const f = a.position === 'absolute' ? -parseFloat(a.top) - parseFloat(a.bottom) : 0; return Math.round(b.getBoundingClientRect().height + (f || 0)) }))
  check('la fila de pestañas y las cifras, de 44 px; sin desbordar', m.unaFila && toca.every((h) => h >= 44) && (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), JSON.stringify(toca))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
