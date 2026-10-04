// Tanda 580 — importar un CSV de otra app y exportar la colección.
//
// PINGU: «quien ya tiene 2.000 cartas apuntadas en otro sitio no las va a
// meter a mano». Esta prueba hace el viaje entero en pantalla: pegar un
// CSV de Collectr, ver qué se ha encontrado y qué no ANTES de guardar,
// confirmar, y que las filas lleguen a la base con el idioma, el estado,
// la versión y las copias que decía el fichero. Y la vuelta: descargar.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, acceptDownloads: true })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.addInitScript(() => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [
    { id: 'sv2', name: 'Evoluciones en Paldea', name_en: 'Paldea Evolved', serie_id: 'sv', market: 'WEST', card_count_official: 193, card_count_total: 279, logo_path: 'x/l', tcg_online_code: 'PAL' },
    { id: 'base1', name: 'Base Set', name_en: 'Base Set', serie_id: 'base', market: 'WEST', card_count_official: 102, card_count_total: 102, logo_path: 'x/b', tcg_online_code: 'BS' },
  ]
  window.__FAKE_CARTAS__ = [
    { id: 'sv2-25', market: 'WEST', set_id: 'sv2', local_id: '25', name: 'Pikachu', name_es: 'Pikachu', image_path: 'x/1', rarity: 'Common', category: 'Pokemon', variants: { normal: true, reverse: true } },
    { id: 'sv2-193', market: 'WEST', set_id: 'sv2', local_id: '193', name: 'Chien-Pao ex', name_es: 'Chien-Pao ex', image_path: 'x/2', rarity: 'Rare', category: 'Pokemon', variants: { holo: true } },
    { id: 'base1-4', market: 'WEST', set_id: 'base1', local_id: '4', name: 'Charizard', name_es: 'Charizard', image_path: 'x/3', rarity: 'Rare', category: 'Pokemon', variants: { holo: true, firstEdition: true } },
  ]
  // Ya tiene un Pikachu normal en español: el del fichero es reverse en
  // inglés, así que es OTRA línea y no una copia más.
  window.__FAKE_COLECCION__ = [
    { id: 'l1', card_id: 'sv2-25', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
  ]
})
await page.route('**assets.tcgdex.net/**', (r) => r.abort())
await page.route('**api.tcgdex.net/**', (r) => r.abort())
await page.goto(`${BASE}/mi-coleccion.html?ver=resumen`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

console.log('── 1. La tarjeta del Panel ──')
{
  const tarjeta = page.locator('.mc-vistazo-importar')
  check('hay una tarjeta «Importar y exportar»', (await tarjeta.count()) === 1 && /Importar/.test(await tarjeta.innerText()))
  check('  …con un botón de importar y otro de descargar', (await page.locator('#mcImportarAbrir').count()) === 1 && (await page.locator('#mcExportar').count()) === 1)
}

console.log('── 2. Importar un CSV de Collectr ──')
{
  await page.click('#mcImportarAbrir')
  await page.waitForTimeout(600)
  const abierto = await page.evaluate(() => {
    const d = document.getElementById('mcImportarDialogo')
    return !!d && d.open && getComputedStyle(d).display !== 'none'
  })
  check('se abre la bandeja', abierto === true)
  const csv = [
    'Game,Set,Name,Card Number,Rarity,Variant,Condition,Grading Company,Grade,Quantity,Purchase Price,Date Added',
    'Pokemon,Scarlet & Violet: Paldea Evolved,Pikachu,025/193,Common,Reverse Holofoil,Lightly Played,,,2,$1.20,2025-01-02',
    'Pokemon,Scarlet & Violet: Paldea Evolved,Chien-Pao ex,193/193,Special Illustration Rare,Holofoil,Near Mint,PSA,10,1,$180.00,2025-01-02',
    'Pokemon,Base Set,Charizard,4/102,Holo Rare,1st Edition Holofoil,Moderately Played,,,1,,2025-01-03',
    'Pokemon,Un set que no existe,Pikachu,25/100,Common,Normal,Near Mint,,,1,,2025-01-03',
  ].join('\n')
  await page.fill('#mcImpTexto', csv)
  await page.selectOption('#mcImpIdioma', 'en')
  await page.click('#mcImpAnalizar')
  await page.waitForSelector('#mcImpPaso2:not(.hidden)', { timeout: 8000 })
  const resumen = await page.locator('#mcImpResumen').innerText()
  check('la vista previa cuenta 3 encontradas y 1 sin encontrar', /3 cartas encontradas/.test(resumen) && /1 sin encontrar/.test(resumen), resumen)
  check('  …y dice de qué app es', /Collectr/.test(resumen), resumen)
  check('  …y que el idioma se ha elegido a mano', /no dice el idioma/.test(resumen), resumen)
  const perdidas = await page.locator('#mcImpPerdidas').innerText()
  check('la perdida sale con su línea y su motivo', /Línea 5/.test(perdidas) && /no conozco la expansión/.test(perdidas), perdidas)
  const lista = await page.locator('#mcImpLista').innerText()
  check('las que se van a añadir salen con copias, idioma, estado y versión', /Pikachu[\s\S]*×2 · en · EX · reverse/.test(lista) && /PSA 10/.test(lista), lista.slice(0, 200))
  const boton = page.locator('#mcImpConfirmar')
  check('el botón dice cuántas', /Añadir 3 cartas/.test(await boton.innerText()), await boton.innerText())
  await boton.click()
  await page.waitForTimeout(1500)
  const filas = await page.evaluate(() => (window.__TABLAS__?.user_collection || []).map((l) => ({ card_id: l.card_id, idioma: l.idioma, estado: l.estado, variante: l.variante, cantidad: l.cantidad, gradeo: l.gradeo, precio_compra: l.precio_compra })))
  check('hay cuatro líneas en la base: la que había y las tres nuevas', filas.length === 4, JSON.stringify(filas))
  const pika = filas.find((f) => f.card_id === 'sv2-25' && f.variante === 'reverse')
  check('el Pikachu reverse en inglés, EX, con dos copias y su precio', pika && pika.idioma === 'en' && pika.estado === 'EX' && pika.cantidad === 2 && Number(pika.precio_compra) === 1.2, JSON.stringify(pika))
  check('  …y el que ya había NO ha subido de copias (es otra línea)', filas.find((f) => f.card_id === 'sv2-25' && f.variante === 'normal')?.cantidad === 1)
  check('el Chien-Pao con su PSA 10', filas.find((f) => f.card_id === 'sv2-193')?.gradeo === 'PSA 10')
  check('el Charizard de primera edición, GD', filas.find((f) => f.card_id === 'base1-4')?.variante === 'primera' && filas.find((f) => f.card_id === 'base1-4')?.estado === 'GD')
  check('la bandeja se cierra', await page.evaluate(() => !document.getElementById('mcImportarDialogo')?.open))
  // Y la pantalla se entera sin recargar.
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const cuantas = await page.locator('.mc-carta-foto').count()
  check('la pestaña Cartas enseña las nuevas', cuantas >= 3, String(cuantas))
}

console.log('── 3. Un fichero sin lo mínimo lo dice ──')
{
  await page.goto(`${BASE}/mi-coleccion.html?ver=resumen`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.click('#mcImportarAbrir')
  await page.waitForTimeout(500)
  await page.fill('#mcImpTexto', 'Name,Quantity\nPikachu,2')
  await page.click('#mcImpAnalizar')
  await page.waitForTimeout(800)
  const estado = await page.locator('#mcImpEstado').innerText()
  check('dice qué columnas faltan', /no encuentro la expansión/.test(estado) && /número/.test(estado), estado)
  check('  …y no pasa a la vista previa', await page.evaluate(() => document.getElementById('mcImpPaso2').classList.contains('hidden')))
  await page.click('#mcImportarCerrar')
  await page.waitForTimeout(300)
}

console.log('── 4. Exportar ──')
{
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#mcExportar')])
  const ruta = await descarga.path()
  const texto = (await import('node:fs')).readFileSync(ruta, 'utf8').replace(/^﻿/, '')
  check('se descarga un .csv', /\.csv$/.test(descarga.suggestedFilename()), descarga.suggestedFilename())
  check('con nuestra cabecera', /^Id,Carta,Expansión,Código,Número,Idioma,Estado,Versión,Cantidad/.test(texto), texto.slice(0, 80))
  check('  …y las líneas con su id, set y código', /sv2-25,Pikachu,Evoluciones en Paldea,PAL,25,/.test(texto), texto.split('\n')[1])
  check('  …todas', texto.trim().split('\n').length === 5, String(texto.trim().split('\n').length))
}

check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
