// Tanda 570 — «¿Qué carta es?», el segundo reto diario.
//
// Un recorte de una carta al día, la misma para todo el mundo, y seis
// intentos. Lo que se mira:
//   · La elección es DETERMINISTA y pasa por la base: la función la deja
//     en `carta_del_dia` y la segunda petición del día no vuelve a elegir.
//   · Cada intento compara nombre, era, tipo y rareza, y acertar el
//     nombre acaba la partida aunque sea otra impresión.
//   · Las pistas se abren una por fallo; al acabar, todas y la carta entera.
//   · Lo jugado sobrevive a recargar, y el texto que se comparte lleva el
//     número, las filas y el enlace corto.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { numeroDelDia, indiceDelDia, compararIntento, textoParaCompartir, filaEmoji, rachaDeDias, claveDeNombre, DIA_UNO, INTENTOS, ENLACE } from '/home/user/pingu/js/carta-del-dia.js'
import { elegirCartaDelDia, segundosHastaManana, FILTRO_ELEGIBLES } from '/home/user/pingu/netlify/functions/carta-del-dia.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const hoy = new Date().toISOString().slice(0, 10)

console.log('── 1. Lo puro ──')
{
  check('el día uno es el #1', numeroDelDia(DIA_UNO) === 1)
  check('la elección es determinista', indiceDelDia('2026-10-07', 12000) === indiceDelDia('2026-10-07', 12000))
  check('  …distinta de un día a otro', indiceDelDia('2026-10-07', 12000) !== indiceDelDia('2026-10-08', 12000))
  check('  …y dentro del total', [1, 7, 12000].every((t) => indiceDelDia('2026-10-07', t) < t))
  const resp = { name: 'Pikachu ex', rarity_en: 'Double Rare', types: ['Lightning'], tcg_sets: { serie_id: 'sv' } }
  const c = compararIntento({ name: 'Pikachu', rarity_en: 'Common', types: ['Lightning'], tcg_sets: { serie_id: 'sv' } }, resp)
  check('«Pikachu» no es «Pikachu ex»: la coletilla cuenta', c.nombre === false)
  check('  …pero la era y el tipo sí casan', c.era && c.tipo && !c.rareza)
  check('el nombre no mira mayúsculas ni tildes', claveDeNombre('PIKÁCHU ex ') === 'pikachu ex')
  check('otra impresión del mismo nombre acierta', compararIntento({ name: 'pikachu EX', tcg_sets: { serie_id: 'swsh' } }, resp).nombre === true)
  check('la fila son cuatro cuadrados', filaEmoji({ nombre: false, era: true, tipo: false, rareza: true }) === '🟥🟩🟥🟩')
  const t = textoParaCompartir({ dia: hoy, comparaciones: [{ nombre: false, era: true, tipo: false, rareza: false }, { nombre: true, era: true, tipo: true, rareza: true }], acertada: true, rachaDias: 4 })
  check('el texto lleva número, intentos, filas, racha y enlace', t.includes(`¿Qué carta es? #${numeroDelDia(hoy)} · 2/${INTENTOS}`) && t.includes('🟥🟩🟥🟥\n🟩🟩🟩🟩') && t.includes('🔥 4 días') && t.trim().endsWith(ENLACE), t)
  check('  …y sin acertar, X de 6', /X\/6/.test(textoParaCompartir({ dia: hoy, comparaciones: Array(6).fill({ nombre: false, era: false, tipo: false, rareza: false }), acertada: false })))
  check('la racha cuenta hasta hoy', rachaDeDias([hoy, '2000-01-01'], hoy) === 1)
  check('la caché muere a medianoche UTC', segundosHastaManana(new Date('2026-10-06T23:59:00Z')) === 60 && segundosHastaManana(new Date('2026-10-06T00:00:00Z')) === 86400)
  check('solo Pokémon, con foto y con rareza', /category=eq\.Pokemon/.test(FILTRO_ELEGIBLES) && /rarity=not\.is\.null/.test(FILTRO_ELEGIBLES) && /image_path\.not\.is\.null/.test(FILTRO_ELEGIBLES))
}

console.log('── 2. La función: elige una vez y la deja en la base ──')
{
  const guardadas = []
  const llamadas = []
  const base = { carta: [] }
  const CARTA = { id: 'sv8-25', name: 'Pikachu ex', market: 'WEST' }
  const pedir = async (ruta, o = {}) => {
    llamadas.push(ruta.split('?')[0] + (o.cabeceras?.prefer ? ' (count)' : ''))
    if (ruta.startsWith('carta_del_dia')) return { datos: base.carta, total: null }
    if (o.cabeceras?.prefer === 'count=exact') return { datos: [{ id: 'x' }], total: 12000 }
    if (/offset=/.test(ruta)) return { datos: [{ id: 'sv8-25' }], total: null }
    return { datos: [CARTA], total: null }
  }
  const guardar = async (tabla, fila) => {
    guardadas.push(fila)
    base.carta = [{ card_id: fila.card_id }]
  }
  const r1 = await elegirCartaDelDia({ dia: hoy, pedir, guardar })
  check('la primera petición elige y guarda', guardadas.length === 1 && guardadas[0].day === hoy && guardadas[0].card_id === 'sv8-25', JSON.stringify(guardadas))
  check('  …y devuelve la carta con su número', r1.carta?.id === 'sv8-25' && r1.numero === numeroDelDia(hoy), JSON.stringify(r1).slice(0, 120))
  check('  …pidiendo la elegida por su ÍNDICE', llamadas.some((l) => l === 'tcg_cards (count)'), llamadas.join(' | '))
  llamadas.length = 0
  const r2 = await elegirCartaDelDia({ dia: hoy, pedir, guardar })
  check('la segunda NO vuelve a elegir ni a contar', guardadas.length === 1 && !llamadas.some((l) => /count/.test(l)), llamadas.join(' | '))
  check('  …y trae la de ayer si la hay', r2.ayer === null || typeof r2.ayer === 'object')
  check('  …y devuelve la misma', r2.carta?.id === 'sv8-25')
  // Sin cartas elegibles no se inventa nada.
  const vacio = await elegirCartaDelDia({ dia: hoy, pedir: async (ruta, o = {}) => (ruta.startsWith('carta_del_dia') ? { datos: [] } : o.cabeceras ? { datos: [], total: 0 } : { datos: [] }), guardar })
  check('sin elegibles, error y no se guarda', vacio.error && guardadas.length === 1, vacio.error)
}

console.log('── 3. En el navegador ──')
{
  const CARTA = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#f7d354"/><circle cx="122" cy="100" r="60" fill="#e6553a"/></svg>'
  const SETS = [{ id: 'sv8', name: 'Surging Sparks', market: 'WEST', serie_id: 'sv', release_date: '2024-11-08', card_count_official: 191, tcg_online_code: 'SSP' }]
  const base = (id, n, extra = {}) => ({ id, market: 'WEST', set_id: 'sv8', local_id: String(n), name: extra.name || `C${n}`, name_es: extra.name || `C${n}`, image_path: `sv/sv8/${n}`, category: 'Pokemon', rarity: 'Rare', rarity_en: extra.rarity_en || 'Rare', types: extra.types || ['Water'], tcg_sets: { name: 'Surging Sparks', tcg_online_code: 'SSP', serie_id: 'sv' } })
  const RESPUESTA = base('sv8-25', 25, { name: 'Pikachu ex', rarity_en: 'Double Rare', types: ['Lightning'] })
  const CARTAS = [RESPUESTA, base('sv8-1', 1, { name: 'Lapras', types: ['Water'] }), base('sv8-2', 2, { name: 'Raichu', rarity_en: 'Double Rare', types: ['Lightning'] }), base('sv8-3', 3, { name: 'Pikachu ex', rarity_en: 'Illustration Rare', types: ['Lightning'] })]
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1000, height: 1100 } })
  const errores = []
  const pedidas = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  page.on('request', (r) => pedidas.push(r.url()))
  await page.route('**/.netlify/functions/carta-del-dia**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ dia: hoy, numero: numeroDelDia(hoy), carta: RESPUESTA, ayer: { id: 'sv8-9', name: 'Gastly', name_es: 'Gastly', local_id: '9', tcg_sets: { name: 'Surging Sparks' } } }) }))
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA }))
  await page.route('**/limitlesstcg.nyc3.cdn.digitaloceanspaces.com/**', (r) => r.abort())
  await page.route('**/images.pokemontcg.io/**', (r) => r.abort())
  await page.addInitScript(([sets, cartas]) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_ERAS__ = [{ id: 'sv', market: 'WEST', nombre: 'Escarlata y Púrpura', orden: 10 }]
    if (!sessionStorage.getItem('cd-limpio')) {
      localStorage.removeItem('pokedoc-carta-del-dia')
      localStorage.removeItem('pokedoc-carta-del-dia-acertados')
      sessionStorage.setItem('cd-limpio', '1')
    }
    navigator.share = async (d) => { window.__compartido = d; return true }
  }, [SETS, CARTAS])
  await page.goto(`${BASE}/carta-del-dia.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('dice el número del día y el intento', (await page.locator('#cdSub').innerText()).includes(`Carta #${numeroDelDia(hoy)} · intento 1 de 6`), await page.locator('#cdSub').innerText())
  check('  …y el número no es negativo ni cero', numeroDelDia(hoy) >= 1, String(numeroDelDia(hoy)))
  check('seis huecos de intento', (await page.locator('.cd-intento').count()) === 6)
  check('las cinco pistas, cerradas', (await page.locator('.cd-pista-cerrada').count()) === 5)
  // La carta entera, borrosa (572): la foto grande se pide y el
  // desenfoque del primer intento es el más fuerte.
  check('se ha pedido la foto grande', pedidas.some((u) => /assets\.tcgdex\.net.*high/.test(u)), pedidas.filter((u) => /tcgdex/.test(u)).slice(0, 2).join(' | '))
  const desenfoque = () => page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('cdFoto')).filter.replace(/[^\d.]/g, '')))
  check('empieza muy borrosa (28 px)', (await desenfoque()) === 28, String(await desenfoque()))
  check('y dice la de ayer', /Ayer era Gastly/.test(await page.locator('#cdAyer').innerText()), await page.locator('#cdAyer').innerText())

  const intentar = async (texto, id) => {
    await page.locator('#cdAdivinar').click()
    await page.waitForTimeout(300)
    await page.fill('#nvBuscar', texto)
    await page.waitForTimeout(800)
    await page.locator(`[data-elegir="${id}"]`).click()
    await page.waitForTimeout(500)
  }
  await intentar('lapras', 'sv8-1')
  check('un fallo abre la primera pista (la era)', /Escarlata y Púrpura/.test(await page.locator('.cd-pista').first().innerText()), await page.locator('.cd-pista').first().innerText())
  check('  …y afloja el desenfoque (20 px)', (await desenfoque()) === 20, String(await desenfoque()))
  check('  …y la fila dice qué casa: era sí, lo demás no', (await page.$$eval('.cd-intento:not(.cd-intento-vacio) .cd-casilla', (cs) => cs.map((c) => (c.classList.contains('bien') ? 1 : 0)).join(''))) === '0100')
  await intentar('raichu', 'sv8-2')
  check('segundo fallo: era, tipo y rareza casan', (await page.$$eval('.cd-intento:not(.cd-intento-vacio)', (is) => is.map((i) => [...i.querySelectorAll('.cd-casilla')].map((c) => (c.classList.contains('bien') ? 1 : 0)).join('')).join(' '))) === '0100 0111')
  // Sobrevive a recargar.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  check('al recargar siguen los dos intentos', (await page.locator('.cd-intento:not(.cd-intento-vacio)').count()) === 2)
  // Otra impresión del mismo nombre acierta.
  await intentar('pikachu', 'sv8-3')
  check('acertar el nombre acaba la partida', !(await page.locator('#cdFinal').evaluate((e) => e.classList.contains('hidden'))))
  check('  …y dice cuál era', /Pikachu ex/.test(await page.locator('.cd-final-titulo').innerText()))
  check('  …con todas las pistas abiertas', (await page.locator('.cd-pista-cerrada').count()) === 0)
  check('  …y la carta nítida', (await desenfoque()) === 0 || Number.isNaN(await desenfoque()), String(await desenfoque()))
  await page.locator('#cdCompartir').click()
  await page.waitForTimeout(400)
  const texto = (await page.evaluate(() => window.__compartido))?.text || ''
  check('el texto compartido lleva el número y 3/6', texto.includes(`¿Qué carta es? #${numeroDelDia(hoy)} · 3/6`), texto)
  check('  …las tres filas', texto.includes('🟥🟩🟥🟥\n🟥🟩🟩🟩\n🟩🟩🟩🟥'), texto)
  check('  …y el enlace', texto.includes(ENLACE))
  await browser.close()
}

console.log('── 4. El sitio ──')
{
  const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
  check('la tarjeta del índice lleva al juego', /href="\/carta-del-dia"/.test(leer('retos.html')))
  check('el sitemap lista /carta-del-dia', /\['\/carta-del-dia'/.test(leer('netlify/functions/sitemap.mjs')))
  check('hay migración para la tabla', /create table if not exists public\.carta_del_dia/.test(leer('supabase-migration-carta-del-dia.sql')))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
