import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 266: crear torneos lo puede hacer cualquiera, y «oficial» pasa
// a ser una casilla que solo marca administración.
//
// Lo pidió PINGU: un usuario le dijo que no le salía la opción de
// crear. Y de paso, que un admin pueda montarse una pachanga suya SIN
// el sello de PokeDoc — hasta ahora «oficial» se deducía de si el
// creador era admin, así que un admin no podía crear nada que no fuera
// oficial.
//
// OJO con lo que esta prueba NO puede ver: el candado de verdad de
// «oficial» está en la base (un disparador revierte el valor a quien no
// es admin). Aquí solo se comprueba que la interfaz no ofrece lo que no
// se puede usar y que se manda lo que toca.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const abrir = async (ruta, semillas = {}) => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}

const escrituras = (page) =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]'))

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Crear un torneo ya no es del equipo ──')
{
  for (const [quien, sesion, sale] of [
    ['administración', 'admin-1', true],
    ['una cuenta normal', 'user-1', true],
    ['sin cuenta', 'none', false],
  ]) {
    const { page, errores } = await abrir('/torneos', { __FAKE_SESSION__: sesion, __FAKE_TORNEOS__: [] })
    check(`${quien}: sin errores`, errores.length === 0, errores[0] || '')
    check(`${quien}: ${sale ? 'sí' : 'no'} le sale el botón`, (await page.locator('#btnNuevoTorneo').isVisible()) === sale)
    await page.close()
  }
}

console.log('\n── 2. La casilla de «oficial» es de administración ──')
{
  // Desde la 1434 la casilla solo EXISTE para administración (crear.js la
  // pinta o no): se mira si está en la ventana.
  const casillaSale = async (sesion) => {
    const { page } = await abrir('/torneos', { __FAKE_SESSION__: sesion, __FAKE_TORNEOS__: [] })
    await page.locator('#btnNuevoTorneo').click()
    await page.waitForSelector('#torneoCrear[open]')
    const sale = (await page.locator('#torneoOficial').count()) === 1
    await page.close()
    return sale
  }
  check('administración la ve', (await casillaSale('admin-1')) === true)
  check('una cuenta normal NO la ve', (await casillaSale('user-1')) === false)
}

console.log('\n── 3. Lo que se escribe al crear ──')
{
  const crear = async (sesion, marcarOficial) => {
    const { page, errores } = await abrir('/torneos', { __FAKE_SESSION__: sesion, __FAKE_TORNEOS__: [] })
    await page.locator('#btnNuevoTorneo').click()
    await page.waitForSelector('#torneoCrear[open]')
    // Una pregunta cada vez (1434): se contesta como lo haría una persona, y
    // la casilla está en la última, «Dale tu toque».
    await page.locator('#torneoNombre').fill('Copa de prueba')
    await page.keyboard.press('Enter')
    const toca = async (sel) => { await page.waitForTimeout(300); await page.locator(sel).click() }
    await toca('.tc-opcion[data-campo="torneoModalidad"][data-valor="online"]') // 1452
    await toca('.tc-opcion[data-valor="standard"]')
    await page.waitForTimeout(300)
    const manana = new Date(Date.now() + 86400e3).toISOString().slice(0, 16)
    await page.locator('#torneoFecha').fill(manana)
    await toca('#btnPasoSiguiente')
    await toca('.tc-opcion[data-campo="torneoPlazas"][data-valor="16"]')
    await toca('#btnPasoSiguiente')
    await toca('.tc-opcion[data-campo="torneoMinutos"][data-valor="30"]')
    await toca('.tc-opcion[data-campo="torneoPrivado"][data-valor="no"]')
    await toca('.tc-opcion[data-campo="torneoListasModo"][data-valor="al_terminar"]')
    await page.waitForTimeout(300)
    if (marcarOficial) await page.locator('#torneoOficial').check()
    await toca('#btnPasoSiguiente')
    await toca('#btnCrearTorneo')
    await page.waitForTimeout(900)
    const w = (await escrituras(page)).find((e) => e.tabla === 'tournaments' && e.tipo === 'insert')
    check(`${sesion}: sin errores`, errores.length === 0, errores[0] || '')
    await page.close()
    return w?.filas?.[0] || null
  }

  const deAdmin = await crear('admin-1', true)
  check('el torneo se crea', !!deAdmin, JSON.stringify(deAdmin && Object.keys(deAdmin)))
  check('con el creador de dueño', deAdmin?.admin_id === 'admin-1', String(deAdmin?.admin_id))
  check('y marcado como oficial', deAdmin?.is_official === true, String(deAdmin?.is_official))

  const deAdminSinMarcar = await crear('admin-1', false)
  check('un admin puede crear uno NO oficial', deAdminSinMarcar?.is_official === false, String(deAdminSinMarcar?.is_official))

  const deUsuario = await crear('user-1', false)
  check('un usuario normal crea su torneo', !!deUsuario && deUsuario.admin_id === 'user-1', String(deUsuario?.admin_id))
  check('y nunca sale oficial', deUsuario?.is_official === false, String(deUsuario?.is_official))
}

console.log('\n── 4. La chapa de «Oficial» en la lista ──')
{
  const conChapa = async (torneos) => {
    const { page } = await abrir('/torneos', { __FAKE_SESSION__: 'user-1', __FAKE_TORNEOS__: torneos })
    // Desde la 1462 la chapa de oficial es la dorada de tipo.
    const n = await page.locator('.torneo-oficial, .chapa-tipo[data-tipo-torneo="oficial"]').count()
    await page.close()
    return n
  }
  const base = { status: 'registration_open', max_players: 8, swiss_rounds: 3, start_at: new Date(Date.now() + 86400e3).toISOString() }
  check('un torneo marcado lleva chapa',
    (await conChapa([{ ...base, id: 't1', slug: 'a', name: 'Oficial', admin_id: 'admin-1', is_official: true }])) === 1)
  // Lo que antes era imposible: un torneo de admin SIN el sello.
  check('uno de admin sin marcar NO la lleva',
    (await conChapa([{ ...base, id: 't2', slug: 'b', name: 'Pachanga de PINGU', admin_id: 'admin-1', is_official: false }])) === 0)
  check('y uno de la comunidad tampoco',
    (await conChapa([{ ...base, id: 't3', slug: 'c', name: 'De un usuario', admin_id: 'user-1', is_official: false }])) === 0)
  // Mientras la migración no esté puesta, `is_official` llega undefined
  // y se cae al criterio viejo: lo creó un admin, luego es oficial. Sin
  // esto la Copa Inaugural perdería su sello hasta que se ejecute el SQL.
  check('sin la columna todavía, manda quién lo creó',
    (await conChapa([{ ...base, id: 't4', slug: 'd', name: 'Antes de la migración', admin_id: 'admin-1' }])) === 1)
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
