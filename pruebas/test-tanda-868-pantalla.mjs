// Tanda 868 — /ajustes: cómo funciona tu cuenta, apartado por apartado, y
// «Editar perfil» con solo lo que ven los demás.
//
// Lo que se mira: que la página existe con sus siete apartados y en el PC
// abre por Avisos (lista a la izquierda, apartado a la derecha); que en el
// móvil se ve la lista y cada apartado es una pantalla con «‹ Ajustes»;
// que los avisos van AGRUPADOS y en tres canales, y que un interruptor
// escribe TODOS los tipos de su grupo en la columna de siempre; que la
// privacidad, el cumpleaños y Play! Pokémon se guardan desde aquí; y que
// `?ver=` lleva al apartado (los correos enlazan a ?ver=avisos).
import { readFileSync, existsSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 0. Lo estático y lo puro ──')
{
  check('ajustes.html existe, con su hoja, su barra de abajo y el pie', existsSync(`${RAIZ}/ajustes.html`) && /css\/ajustes\.css/.test(readFileSync(`${RAIZ}/ajustes.html`, 'utf8')) && /<!-- barra-movil/.test(readFileSync(`${RAIZ}/ajustes.html`, 'utf8')) && /class="footer"/.test(readFileSync(`${RAIZ}/ajustes.html`, 'utf8')))
  check('la página de baja de los correos manda a Ajustes › Avisos, no a «Editar perfil»', !/Editar perfil/.test(readFileSync(`${RAIZ}/netlify/functions/baja-correo.mjs`, 'utf8')) && /Ajustes › Avisos/.test(readFileSync(`${RAIZ}/netlify/functions/baja-correo.mjs`, 'utf8')))
  const { gruposDe, estaActivo, conGrupo, GRUPOS_CAMPANITA } = await import(`${RAIZ}/js/avisos-prefs.js`)
  const { NOTIFICATION_TYPES, EMAIL_TYPES } = await import(`${RAIZ}/js/notifications.js`)
  const grupos = gruposDe(NOTIFICATION_TYPES, GRUPOS_CAMPANITA)
  const cubiertos = new Set(grupos.flatMap((g) => g.tipos))
  check('los grupos de la campanita cubren TODOS los tipos, sin inventarse ninguno', Object.keys(NOTIFICATION_TYPES).every((t) => cubiertos.has(t)) && [...cubiertos].every((t) => t in NOTIFICATION_TYPES) && grupos.length < Object.keys(NOTIFICATION_TYPES).length, `${grupos.length} grupos para ${Object.keys(NOTIFICATION_TYPES).length} tipos`)
  const sinGrupo = gruposDe({ cosa_nueva: 'Una cosa nueva', guide_comment: 'x' }, GRUPOS_CAMPANITA)
  check('un tipo que nadie agrupó sale solo, con su texto', sinGrupo.some((g) => g.id === 'cosa_nueva' && g.titulo === 'Una cosa nueva' && g.tipos.join() === 'cosa_nueva'), JSON.stringify(sinGrupo))
  const g = grupos.find((x) => x.id === 'guias')
  check('un grupo está activo mientras quede un tipo sin apagar, y apagarlo apaga todos', estaActivo(g, ['guide_rating']) && !estaActivo(g, g.tipos) && conGrupo(['forum_reply'], g, false).sort().join() === [...g.tipos, 'forum_reply'].sort().join() && conGrupo([...g.tipos, 'forum_reply'], g, true).join() === 'forum_reply')
  const { GRUPOS_CORREO } = await import(`${RAIZ}/js/avisos-prefs.js`)
  const gc = gruposDe(EMAIL_TYPES, GRUPOS_CORREO)
  check('el correo también tiene sus grupos y cubren sus tipos', Object.keys(EMAIL_TYPES).every((t) => gc.some((x) => x.tipos.includes(t))))
}

const browser = await chromium.launch()
const semilla = ({ play, sinTablas }) => {
  window.__FAKE_SESSION__ = 'user-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch { /* sin memoria */ }
  if (play) window.__FAKE_PLAY__ = [play]
  if (sinTablas) window.__SIN_TABLAS__ = sinTablas
}
async function abrir(ruta, { movil = false, play = null, sinTablas = null } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, { play, sinTablas })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, ctx, errores }
}
const tablas = (page) => page.evaluate(() => window.__TABLAS__)
const perfilGuardado = (page) => page.evaluate(() => (window.__TABLAS__ || {}).user_profiles?.find((p) => p.id === 'user-1'))
const estado = (page) => page.evaluate(() => {
  const ve = (sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0 }
  return {
    modo: document.body.dataset.aj,
    lista: [...document.querySelectorAll('#ajLista a')].map((a) => a.querySelector('.aj-texto').childNodes[0].textContent.trim().split(' ')[0]),
    listaVisible: ve('#ajLista'),
    actual: document.querySelector('#ajLista [aria-current="page"]')?.dataset.ver || null,
    panelVisible: ve('#ajPanel'),
    h2: document.querySelector('#ajPanel h2')?.textContent,
    canales: [...document.querySelectorAll('#ajPanel [data-canal]')].map((b) => `${b.dataset.canal}:${b.getAttribute('aria-pressed')}`),
    interruptores: [...document.querySelectorAll('#ajCanal [data-interruptor]')].map((i) => `${i.dataset.interruptor}:${i.checked ? 1 : 0}`),
    migas: document.getElementById('ajMigas')?.textContent.replace(/\s+/g, ' ').trim(),
    volver: (() => { const a = [...document.querySelectorAll('#ajMigas a')].pop(); if (!a) return null; const r = a.getBoundingClientRect(); return { texto: a.textContent.trim(), alto: Math.round(r.height), visible: r.height > 0 } })(),
    titulo: document.title,
  }
})

console.log('── 1. El PC: la lista y el apartado, abriendo por Avisos ──')
{
  const { page, ctx, errores } = await abrir('/ajustes.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  let m = await estado(page)
  check('siete apartados a la izquierda, Avisos abierto a la derecha', m.lista.join('|') === 'Avisos|Cuenta|Privacidad|Apariencia|Tus|Invitar|Borrar' && m.listaVisible && m.panelVisible && m.actual === 'avisos' && m.h2 === 'Avisos', JSON.stringify(m))
  check('tres canales como chips (campanita puesto) y los avisos agrupados, todos puestos', m.canales.join() === 'campanita:true,correo:false,push:false' && m.interruptores.length >= 10 && m.interruptores.length < 20 && m.interruptores.every((x) => /:1$/.test(x)), JSON.stringify(m.interruptores))
  // Apagar un grupo escribe TODOS sus tipos; volver a encenderlo los quita.
  await page.click('#ajCanal [data-interruptor="guias"]')
  await page.waitForTimeout(600)
  let p = await perfilGuardado(page)
  check('apagar «tus guías» escribe los tres tipos del grupo en notification_prefs_disabled', ['guide_comment', 'guide_rating', 'guide_helpful'].every((t) => (p?.notification_prefs_disabled || []).includes(t)) && (p?.notification_prefs_disabled || []).length === 3, JSON.stringify(p?.notification_prefs_disabled))
  await page.click('#ajCanal [data-interruptor="guias"]')
  await page.waitForTimeout(600)
  p = await perfilGuardado(page)
  check('  …y encenderlo los quita', (p?.notification_prefs_disabled || []).length === 0, JSON.stringify(p?.notification_prefs_disabled))
  await page.click('#ajPanel [data-canal="correo"]')
  await page.waitForTimeout(300)
  m = await estado(page)
  check('«Por correo»: sus propios grupos', m.canales.join() === 'campanita:false,correo:true,push:false' && m.interruptores.some((x) => /^mensajes:/.test(x)), JSON.stringify(m.interruptores))
  await page.click('#ajCanal [data-interruptor="mensajes"]')
  await page.waitForTimeout(600)
  p = await perfilGuardado(page)
  check('  …y escriben en notification_email_disabled', (p?.notification_email_disabled || []).join() === 'private_message', JSON.stringify(p?.notification_email_disabled))
  // Privacidad.
  await page.click('#ajLista [data-ver="privacidad"]')
  await page.waitForTimeout(400)
  m = await estado(page)
  check('tocar un apartado lo abre y lo escribe en la dirección', m.actual === 'privacidad' && m.h2 === 'Privacidad' && /ver=privacidad/.test(page.url()), page.url())
  await page.click('#ajPanel [data-interruptor="hide_activity"]')
  await page.waitForTimeout(600)
  check('«No mostrar mi actividad» se guarda al tocarlo', (await perfilGuardado(page))?.hide_activity === true)
  // Apariencia.
  await page.click('#ajLista [data-ver="apariencia"]')
  await page.waitForTimeout(400)
  await page.click('#ajPanel [data-tema="dark"]')
  await page.waitForTimeout(500)
  check('Apariencia: el tema cambia desde aquí', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark' && (await page.getAttribute('#ajPanel [data-tema="dark"]', 'aria-pressed')) === 'true')
  await page.click('#ajPanel [data-tema="auto"]')
  await page.waitForTimeout(300)
  check('  …y «el del sistema» olvida la elección', (await page.evaluate(() => localStorage.getItem('pokedoc-theme'))) === null)
  // Invitar y borrar.
  await page.click('#ajLista [data-ver="invitar"]')
  await page.waitForTimeout(400)
  check('Invitar: el enlace /r/usuario y Copiar', /\/r\/Ash$/.test(await page.locator('#ajEnlaceInvitar').textContent()) && (await page.locator('#ajCopiarInvitar').isVisible()))
  await page.click('#ajLista [data-ver="borrar"]')
  await page.waitForTimeout(400)
  check('Borrar mi cuenta: al final, con su botón', (await estado(page)).lista.at(-1) === 'Borrar' && (await page.locator('#ajBorrar').isVisible()))
  await ctx.close()
}

console.log('── 2. Cuenta: cumpleaños y Play! Pokémon ──')
{
  const { page, ctx, errores } = await abrir('/ajustes.html?ver=cuenta', { play: { user_id: 'user-1', player_id: '555', player_name: 'Ash Ketchum', birth_date: '2001-01-01' } })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const m = await estado(page)
  check('?ver=cuenta abre Cuenta, con el correo de acceso', m.actual === 'cuenta' && /user-1@/.test(await page.locator('#ajPanel').textContent()))
  check('trae tus datos de Play! Pokémon, y dice que son privados', (await page.locator('#ajPlayerId').inputValue()) === '555' && (await page.locator('#ajPlayNombre').inputValue()) === 'Ash Ketchum' && /solo lo ves tú/.test(await page.locator('#ajPanel').innerText()))
  await page.fill('#ajPlayerId', '9988776')
  await page.click('#ajPlayGuardar')
  await page.waitForTimeout(900)
  const fila = (await tablas(page))?.user_play_pokemon?.find((f) => f.user_id === 'user-1')
  check('Guardar escribe el Player ID nuevo', fila?.player_id === '9988776' && fila?.player_name === 'Ash Ketchum', JSON.stringify(fila))
  await page.fill('#ajCumple', '1999-05-20')
  await page.dispatchEvent('#ajCumple', 'change')
  await page.waitForTimeout(600)
  check('el cumpleaños se guarda al cambiarlo', (await perfilGuardado(page))?.birthday === '1999-05-20')
  await ctx.close()
  const sin = await abrir('/ajustes.html?ver=cuenta', { sinTablas: ['user_play_pokemon'] })
  check('sin la migración de Play!, los campos quietos y el aviso', (await sin.page.locator('#ajPlayerId').isDisabled()) && /falta ejecutar supabase-migration-play-pokemon\.sql/.test(await sin.page.locator('#ajPlayAviso').innerText()))
  await sin.ctx.close()
}

console.log('── 3. En el iPhone: la lista, y cada apartado una pantalla ──')
{
  const { page, ctx, errores } = await abrir('/ajustes.html', { movil: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  let m = await estado(page)
  check('sin ?ver=, la lista de apartados (con su texto pequeño) y ningún apartado', m.modo === 'lista' && m.listaVisible && !m.panelVisible && m.lista.length === 7, JSON.stringify(m))
  const alto = await page.evaluate(() => Math.min(...[...document.querySelectorAll('#ajLista a')].map((a) => a.getBoundingClientRect().height)))
  check('  …cada fila se puede tocar', alto >= 44, String(alto))
  await page.click('#ajLista [data-ver="avisos"]')
  await page.waitForTimeout(500)
  m = await estado(page)
  check('tocar Avisos abre su pantalla: «‹ Ajustes» de 44 px, el apartado, y la lista fuera', m.modo === 'seccion' && m.panelVisible && !m.listaVisible && m.volver?.texto === 'Ajustes' && m.volver.alto >= 44 && m.volver.visible && /ver=avisos/.test(page.url()), JSON.stringify(m))
  await page.goBack()
  await page.waitForTimeout(500)
  m = await estado(page)
  check('«atrás» vuelve a la lista', m.modo === 'lista' && m.listaVisible, JSON.stringify({ modo: m.modo, url: page.url() }))
  check('sin desbordar', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
