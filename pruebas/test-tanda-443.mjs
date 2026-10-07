// Tanda 443 — la estantería: solo las empezadas, y cuántas estás viendo.
//
// Hay 206 colecciones en el catálogo y de casi todas no tienes ninguna
// carta, así que la pantalla son doscientas tarjetas diciendo «0 de N ·
// 0 %». La tanda 409 ya probó a SUBIR arriba las empezadas y lo descartó
// con razón —con cien empezadas eso no es un orden, es la misma lista sin
// fechas—. Un filtro es otra cosa: QUITA las doscientas.
//
// Nada de esto da error al romperse: el filtro deja de filtrar, o la
// cuenta dice el número equivocado. Se ve igual de bien.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Desde la 748 (la C2 de su maqueta) el buscador de la estantería sale con
// la lupa y la serie vive en la hoja de «Orden»: se abren antes de usarlos.
const abrirLupa = async (p) => { if (await p.locator('#mcEstanteriaLupa').isVisible().catch(() => false) && !(await p.locator('#mcEstanteriaBuscar').isVisible())) { await p.click('#mcEstanteriaLupa'); await p.waitForTimeout(150) } }
const abrirOrden = async (p) => { if (!(await p.locator('#mcEstanteriaSerie').isVisible())) { await p.click('#mcEstanteriaOrdenAbrir'); await p.waitForTimeout(250) } }
const cerrarOrden = async (p) => { if (await p.locator('#mcEstanteriaOrden').evaluate((d) => d.open).catch(() => false)) { await p.click('#mcEstanteriaOrdenVer'); await p.waitForTimeout(250) } }


let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const browser = await chromium.launch()

// OCHO colecciones y cartas de DOS, repartidas en dos series: así el
// filtro tiene algo que quitar y además se puede comprobar que se lleva
// bien con el de series, que es donde dos filtros se pisan.
const semilla = () => {
  window.__FAKE_SETS__ = [...Array(8)].map((_, i) => ({
    id: `s${i}`, name: `Set ${i}`, serie_id: i < 4 ? 'sv' : 'swsh',
    serie_name: i < 4 ? 'Escarlata y Púrpura' : 'Espada y Escudo', market: 'WEST',
    logo_path: `x/s${i}/logo`, card_count_official: 100, card_count_total: 100,
    release_date: `2024-0${i + 1}-01`, tcg_online_code: `S${i}`,
  }))
  // Una de la serie `sv` (s0) y otra de la `swsh` (s5).
  window.__FAKE_CARTAS__ = [
    { id: 'c1', market: 'WEST', set_id: 's0', local_id: '1', name: 'A', name_es: 'A', image_path: 'x/1',
      rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
    { id: 'c2', market: 'WEST', set_id: 's5', local_id: '1', name: 'B', name_es: 'B', image_path: 'x/2',
      rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
  ]
  window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.map((c, i) => ({ id: `l${i}`, card_id: c.id,
    market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal',
    created_at: `2026-09-0${i}T00:00:00Z` }))
}
const abrir = async (ancho = 1280) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(semilla)
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  return { page, errores }
}
const cuantas = (page) => page.locator('#mcEstanteriaRejilla .mc-set-tarjeta').count()
const rotulo = async (page) => ((await page.locator('#mcEstanteriaCuantas').textContent()) || '').trim()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Solo las empezadas ──')
{
  const { page, errores } = await abrir()
  check('al entrar salen todas', (await cuantas(page)) === 8, String(await cuantas(page)))
  check('  …y el chip nace apagado',
    (await page.locator('#mcEstanteriaEmpezadas').getAttribute('aria-pressed')) === 'false')
  await page.click('#mcEstanteriaEmpezadas')
  await page.waitForTimeout(700)
  check('pulsándolo quedan solo las que has empezado', (await cuantas(page)) === 2, String(await cuantas(page)))
  check('  …y el chip lo dice',
    (await page.locator('#mcEstanteriaEmpezadas').getAttribute('aria-pressed')) === 'true')
  // Y son LAS SUYAS, no dos cualesquiera: s0 y s5 son las que tienen carta.
  const ids = await page.locator('#mcEstanteriaRejilla .mc-set-tarjeta').evaluateAll(
    (ns) => ns.map((n) => n.dataset.set).sort())
  check('  …y son exactamente esas dos', ids.join(',') === 's0,s5', ids.join(','))
  // Se APAGA, que es la mitad que se olvida de un interruptor. Desde la 748
  // es una de tres chapas (la C2 de su maqueta), y se apaga con «Todas».
  await page.click('#mcEstanteriaTodas')
  await page.waitForTimeout(700)
  check('y se apaga', (await cuantas(page)) === 8, String(await cuantas(page)))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  // Dos filtros a la vez es donde se pisan: con la serie puesta Y el chip,
  // tiene que quedar UNA —la empezada de esa serie—, no las dos empezadas
  // ni las cuatro de la serie.
  const { page } = await abrir()
  await abrirOrden(page)
  await page.selectOption('#mcEstanteriaSerie', 'sv')
  await cerrarOrden(page)
  await page.waitForTimeout(700)
  check('filtrando por serie quedan las cuatro de esa serie', (await cuantas(page)) === 4, String(await cuantas(page)))
  await page.click('#mcEstanteriaEmpezadas')
  await page.waitForTimeout(700)
  const ids = await page.locator('#mcEstanteriaRejilla .mc-set-tarjeta').evaluateAll((ns) => ns.map((n) => n.dataset.set))
  check('  …y con el chip, solo la empezada de esa serie', ids.join(',') === 's0', ids.join(','))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Cuántas estás viendo ──')
{
  const { page } = await abrir()
  check('sin filtrar dice cuántas hay', (await rotulo(page)) === '8 colecciones', await rotulo(page))
  await page.click('#mcEstanteriaEmpezadas')
  await page.waitForTimeout(700)
  // El total es el del CATÁLOGO, no el de lo que queda después de
  // filtrar: si el total se calculara sobre lo filtrado diría «2 de 2».
  check('al filtrar dice cuántas de cuántas', (await rotulo(page)) === '2 de 8', await rotulo(page))
  await abrirLupa(page)
  await page.fill('#mcEstanteriaBuscar', 'Set 0')
  await page.waitForTimeout(700)
  check('  …y el buscador también cuenta', (await rotulo(page)) === '1 de 8', await rotulo(page))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
