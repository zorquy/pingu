// Tanda 1461 — Los arquetipos del catálogo en el buscador de Mis partidas.
// Se quitaron en la 238 (salían sin sprite) y vuelven con el catálogo de
// Limitless de la 1460: con los DOS sprites de sus iconos y guardados por su
// id (`a:<id>`). Un arquetipo es el mazo entero: no se junta con el otro campo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const ARQUETIPOS = [
  { id: 'dragapult-dusknoir', nombre: 'Dragapult Dusknoir', iconos: [{ set: 'TWM', numero: '130', nombre: 'Dragapult ex' }, { set: 'PRE', numero: '37', nombre: 'Dusknoir' }], requiere: [{ nombres: ['Dragapult ex'] }, { nombres: ['Dusknoir'] }], activo: true },
  { id: 'gardevoir', nombre: 'Gardevoir', iconos: [{ set: 'SVI', numero: '86', nombre: 'Gardevoir ex' }], requiere: [{ nombres: ['Gardevoir ex'] }], activo: true },
]

const browser = await chromium.launch()
async function abrir(semillas = {}, { oscuro = false } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', colorScheme: oscuro ? 'dark' : 'light', viewport: { width: 1100, height: 900 } })
  await ctx.route(/r2\.limitlesstcg\.net|cdn\.jsdelivr\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG_1x1 }))
  await ctx.addInitScript((s) => {
    window.__FAKE_SESSION__ = 'user-1'
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, { __FAKE_ARQUETIPOS__: ARQUETIPOS, ...semillas })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/mis-partidas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { ctx, page, errores }
}
async function abrirFormulario(page) {
  await page.click('[data-vista="sueltas"]')
  await page.waitForTimeout(250)
  await page.click('#btnApuntarPartida')
  await page.waitForTimeout(200)
}
async function buscar(page, caja, texto) {
  await page.fill(`#${caja} input`, texto)
  await page.waitForTimeout(400)
}
async function elegir(page, caja, texto, nombre) {
  await buscar(page, caja, texto)
  await page.locator(`#${caja} .selector-mazo-opcion`, { hasText: nombre }).first().click()
  await page.waitForTimeout(150)
}
const campo = (page, caja) =>
  page.evaluate((caja) => {
    const c = document.getElementById(caja)
    const s1 = c.querySelector('.selector-mazo-sprite')
    const s2 = c.querySelector('.selector-mazo-sprite2')
    return {
      texto: c.querySelector('input').value,
      sprite1: s1.classList.contains('hidden') ? null : s1.querySelector('img').getAttribute('src'),
      sprite2: s2.classList.contains('hidden') ? null : s2.querySelector('img').getAttribute('src'),
    }
  }, caja)

console.log('── 1. El buscador enseña los arquetipos, con sus dos Pokémon ──')
{
  const { ctx, page, errores } = await abrir()
  await abrirFormulario(page)
  await buscar(page, 'selRival1', 'drag')
  const ops = await page.locator('#selRival1 .selector-mazo-opcion').evaluateAll((els) =>
    els.slice(0, 4).map((li) => ({ texto: li.innerText.replace(/\s+/g, ' ').trim(), imgs: [...li.querySelectorAll('.selector-mazo-pareja img')].map((i) => i.getAttribute('src')), chapa: li.querySelector('.selector-mazo-etiqueta')?.textContent || null }))
  )
  check('el arquetipo sale el primero, con la chapa «Mazo»', /^Dragapult Dusknoir/.test(ops[0]?.texto) && ops[0]?.chapa === 'Mazo', JSON.stringify(ops))
  check('  …y con los sprites de Dragapult y de Dusknoir', ops[0]?.imgs.length === 2 && /dragapult\.png$/.test(ops[0].imgs[0]) && /dusknoir\.png$/.test(ops[0].imgs[1]), JSON.stringify(ops[0]?.imgs))
  check('  …y la especie suelta, sin chapa, detrás', ops.slice(1).some((o) => o.texto === 'Dragalge' && !o.chapa), JSON.stringify(ops.map((o) => o.texto)))
  const nombreAncho = await page.locator('#selRival1 .selector-mazo-opcion').first().evaluate((li) => {
    const n = li.querySelector('span:not([class])').getBoundingClientRect(); const c = li.querySelector('.selector-mazo-etiqueta').getBoundingClientRect()
    return n.right <= c.left
  })
  check('  …el nombre no pisa la chapa', nombreAncho)
  await buscar(page, 'selRival1', 'gardevoir')
  const garde = await page.locator('#selRival1 .selector-mazo-opcion').allInnerTexts()
  check('el arquetipo que se llama como la especie ocupa su sitio (un solo «Gardevoir»)', garde.filter((t) => /^Gardevoir\b/.test(t.trim()) && !/Mega/.test(t)).length === 1 && /Mazo/.test(garde[0]), JSON.stringify(garde))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Elegido: dos sprites en el campo, y es el mazo entero ──')
{
  const { ctx, page, errores } = await abrir()
  await abrirFormulario(page)
  await elegir(page, 'selRival2', 'pidgeot', 'Pidgeot')
  await elegir(page, 'selRival1', 'dragapult d', 'Dragapult Dusknoir')
  const c = await campo(page, 'selRival1')
  check('el campo dice el arquetipo con sus dos sprites', c.texto === 'Dragapult Dusknoir' && /dragapult\.png$/.test(c.sprite1 || '') && /dusknoir\.png$/.test(c.sprite2 || ''), JSON.stringify(c))
  check('  …y vacía el segundo campo (un arquetipo no se junta con nada)', (await campo(page, 'selRival2')).texto === '')
  // Al revés: con el arquetipo puesto, elegir un Pokémon en el otro campo
  // manda lo último que se elige.
  await elegir(page, 'selRival2', 'pidgeot', 'Pidgeot')
  check('elegir un Pokémon al lado de un arquetipo quita el arquetipo', (await campo(page, 'selRival1')).texto === '' && (await campo(page, 'selRival2')).texto === 'Pidgeot')
  // Dos Pokémon siguen juntándose como siempre.
  await elegir(page, 'selRival1', 'charizard', 'Charizard')
  check('  …y dos Pokémon se juntan como siempre', (await campo(page, 'selRival1')).texto === 'Charizard' && (await campo(page, 'selRival2')).texto === 'Pidgeot')
  // Ahora uno de verdad: el arquetipo tuyo y el del rival, al guardar.
  await elegir(page, 'selMio1', 'gardevoir', 'Gardevoir')
  await elegir(page, 'selRival1', 'dragapult d', 'Dragapult Dusknoir')
  await page.click('#partidaJuegos [data-r="W"]')
  await page.click('#btnGuardarPartida')
  await page.waitForTimeout(1200)
  const escrita = await page.evaluate(() => (window.__TABLAS__.match_log || []).at(-1))
  check('se guarda por el id del catálogo, el tuyo y el del rival', escrita?.mi_mazo === 'a:gardevoir' && escrita?.rival_mazo === 'a:dragapult-dusknoir' && escrita?.rival_mazo_nombre === 'Dragapult Dusknoir', JSON.stringify(escrita))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Al editar, el arquetipo vuelve con sus dos sprites ──')
{
  const hoy = new Date().toISOString().slice(0, 10)
  const { ctx, page, errores } = await abrir({
    __FAKE_PARTIDAS__: [{ id: 'p-1', user_id: 'user-1', mi_mazo: 'a:gardevoir', mi_mazo_nombre: 'Gardevoir', rival_mazo: 'a:dragapult-dusknoir', rival_mazo_nombre: 'Dragapult Dusknoir', resultado: 'loss', jugada_el: hoy, user_deck_id: null, formato: null, juegos: null, salida: null }],
  })
  await page.click('[data-vista="sueltas"]')
  await page.waitForTimeout(300)
  await page.click('[data-fila="p-1"] .partidas-mas-btn')
  await page.locator('[data-editar="p-1"]').click()
  await page.waitForTimeout(400)
  const c = await campo(page, 'selRival1')
  check('el rival vuelve con su nombre y los dos sprites', c.texto === 'Dragapult Dusknoir' && /dragapult\.png$/.test(c.sprite1 || '') && /dusknoir\.png$/.test(c.sprite2 || ''), JSON.stringify(c))
  await page.click('#btnGuardarPartida')
  await page.waitForTimeout(1000)
  const fila = await page.evaluate(() => (window.__TABLAS__.match_log || []).find((x) => x.id === 'p-1'))
  check('  …y guardar sin tocarlo no le cambia la clave', fila?.rival_mazo === 'a:dragapult-dusknoir', JSON.stringify(fila))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. En los dos temas (capturas para mirarlas) ──')
for (const oscuro of [false, true]) {
  const { ctx, page } = await abrir({}, { oscuro })
  await abrirFormulario(page)
  await elegir(page, 'selMio1', 'gardevoir', 'Gardevoir')
  await buscar(page, 'selRival1', 'drag')
  const caja = await page.locator('#selRival1').boundingBox()
  if (process.env.PD_CAPTURAS) await page.screenshot({ path: `${process.env.PD_CAPTURAS}/1461-${oscuro ? 'oscuro' : 'claro'}.png`, clip: { x: Math.max(0, caja.x - 16), y: Math.max(0, caja.y - 90), width: Math.min(700, caja.width + 32), height: 420 } })
  const visible = await page.locator('#selRival1 .selector-mazo-lista').isVisible()
  check(`tema ${oscuro ? 'oscuro' : 'claro'}: la lista se abre`, visible)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
