// Tanda 905 — una gradeada vale lo que vale su nota.
//
// TCGbycharlie, en el foro: «cuando añado mis cartas gradeadas a mi
// colección me siguen saliendo los precios de las cartas en formato RAW».
// Las gradeadas de TCGGO ya estaban en la ficha y la línea ya guardaba
// «PSA 10»; faltaba juntarlas.
//
//   1. Lo puro: `valorGradeado` (Cardmarket primero, eBay a euros, solo
//      notas numéricas), el orden de `valorDeLinea` (Tu valor → nota →
//      sin gradear) y `deDondeSaleElValor`.
//   2. La foto diaria, contra PostgreSQL con las funciones de precio de
//      verdad: suma LO MISMO que la web con las mismas líneas (la 377).
//   3. En pantalla: la ficha dice de dónde sale el número, y la cabecera
//      suma la gradeada a su precio.
import { readFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const PRUEBAS = new URL('.', import.meta.url).pathname
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const { valorGradeado, valorDeLinea, deDondeSaleElValor, precioDeFila, usdAEuros } = await import(`${RAIZ}/js/cardmarket.js`)
// La fila de precios del Groudon-EX de la 589, con sus gradeadas.
const FILA = { card_id: 'xy5-150', cm_low: 39, cm_low_es: 140, cm_gradeadas: { psa: { psa10: 2621, psa9: 184 } }, ebay_gradeadas: { bgs: { '9.5': { median_price: 100, sample_size: 3 } } } }

console.log('── 1. Lo puro ──')
{
  const p = precioDeFila(FILA)
  const psa = valorGradeado(p, 'PSA 10')
  check('PSA 10: el de Cardmarket, en euros', psa?.valor === 2621 && psa.origen === 'cardmarket' && psa.casa === 'PSA' && psa.nota === '10', JSON.stringify(psa))
  const bgs = valorGradeado(p, 'BGS 9.5')
  check('BGS 9.5: solo hay ventas de eBay, en dólares pasados a euros', bgs?.valor === usdAEuros(100) && bgs.origen === 'ebay' && bgs.ventas === 3, JSON.stringify(bgs))
  check('una nota que no tiene precio no se inventa (PSA 8)', valorGradeado(p, 'PSA 8') === null)
  check('«BGS 10 Black Label» y «CGC Perfect 10» no son el 10 de su casa', valorGradeado(precioDeFila({ ...FILA, cm_gradeadas: { bgs: { bgs10: 3000 }, cgc: { cgc10: 900 } } }), 'BGS 10 Black Label') === null && valorGradeado(precioDeFila({ ...FILA, cm_gradeadas: { cgc: { cgc10: 900 } } }), 'CGC Perfect 10') === null)
  check('un gradeo escrito a mano tampoco casa', valorGradeado(p, 'grado 9 propio') === null && valorGradeado(p, '') === null && valorGradeado(null, 'PSA 10') === null)
  check('«9.5» y «9.50» son la misma nota', valorGradeado(precioDeFila({ ...FILA, cm_gradeadas: { cgc: { 'cgc9.50': 70 } } }), 'CGC 9.5')?.valor === 70)
  check('una gradeada de 2 copias vale 2 × su nota', valorDeLinea({ cantidad: 2, idioma: 'es', gradeo: 'PSA 10' }, p) === 5242)
  check('«Tu valor» manda sobre la nota', valorDeLinea({ cantidad: 1, idioma: 'es', gradeo: 'PSA 10', valor_manual: 5000 }, p) === 5000)
  check('sin precio de su nota, la carta sin gradear', valorDeLinea({ cantidad: 1, idioma: 'es', gradeo: 'PSA 8' }, p) === 140)
  check('y una cruda, como siempre', valorDeLinea({ cantidad: 1, idioma: 'es' }, p) === 140)
  const o = (l) => deDondeSaleElValor(l, p).origen
  check('de dónde sale: manual, gradeada, sin gradear y carta', o({ valor_manual: 3, gradeo: 'PSA 10' }) === 'manual' && o({ gradeo: 'PSA 10' }) === 'gradeada' && o({ gradeo: 'PSA 8' }) === 'sin-gradear' && o({}) === 'carta')
}

// Las líneas del fixture SQL, en la web.
const LINEAS = [
  { card_id: 'xy5-150', idioma: 'es', cantidad: 2, gradeo: 'PSA 10' },
  { card_id: 'xy5-150', idioma: 'es', cantidad: 1, gradeo: 'BGS 9.5' },
  { card_id: 'xy5-150', idioma: 'es', cantidad: 1, gradeo: 'PSA 8' },
  { card_id: 'xy5-150', idioma: 'es', cantidad: 1, gradeo: 'PSA 10', valor_manual: 5000 },
  { card_id: 'sv8-1', idioma: 'es', cantidad: 1 },
  { card_id: 'sv8-1', idioma: 'es', cantidad: 1, gradeo: 'PSA 10' },
]
const FILAS = { 'xy5-150': FILA, 'sv8-1': { card_id: 'sv8-1', cm_low: 2, cm_low_es: 3 } }
const enLaWeb = LINEAS.reduce((n, l) => n + (valorDeLinea(l, precioDeFila(FILAS[l.card_id], { reverse: false, variante: 'normal' })) || 0), 0)

console.log('\n── 2. La foto diaria suma lo mismo que la web ──')
{
  const PSQL = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1']
  const hay = spawnSync('psql', [...PSQL, '-At', '-c', 'select 1'], { encoding: 'utf8' })
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
  if (hay.status === 0) {
    // Las funciones de precio NO se copian: se sacan de sus migraciones
    // (la última definición de cada una), que es lo que corre en la base.
    const bloque = (f, nombre) => {
      const s = leer(f)
      const i = s.lastIndexOf(`create or replace function public.${nombre}(`)
      const cuerpo = s.indexOf('as $$', i) + 5
      return s.slice(i, s.indexOf('$$;', cuerpo) + 3)
    }
    const funciones = [
      bloque('supabase-migration-precios-tcgplayer.sql', 'eur_por_usd'),
      bloque('supabase-migration-precios-tcgplayer.sql', 'tp_de_version'),
      bloque('supabase-migration-precios-tcgplayer.sql', 'emparejamiento_dudoso'),
      bloque('supabase-migration-tcggo-japones.sql', 'valor_de_linea'),
    ].join(';\n\n')
    execFileSync('psql', [...PSQL, '-c', 'drop database if exists pd905'], { encoding: 'utf8' })
    execFileSync('psql', [...PSQL, '-c', 'create database pd905'], { encoding: 'utf8' })
    const db = [...PSQL, '-d', 'pd905']
    execFileSync('psql', [...db, '-f', `${PRUEBAS}sql-tanda-905.sql`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    execFileSync('psql', [...db], { input: funciones, encoding: 'utf8' })
    // La 905 como el SQL Editor: sentencia a sentencia (631). Los cuerpos
    // `$$` se respetan al partir.
    const sql = leer('supabase-migration-905-gradeadas.sql')
    const sentencias = []
    let resto = sql.replace(/^--[^\n]*$/gm, '')
    const re = /\$\$[\s\S]*?\$\$|;/g
    let m, desde = 0
    while ((m = re.exec(resto))) if (m[0] === ';') { sentencias.push(resto.slice(desde, m.index).trim()); desde = m.index + 1 }
    const errores = []
    for (const s of sentencias.filter(Boolean)) {
      const r = spawnSync('psql', [...db, '-c', s], { encoding: 'utf8' })
      if (r.status !== 0) errores.push(`${s.slice(0, 60)}… → ${r.stderr.slice(0, 200)}`)
    }
    check('la migración pasa sentencia a sentencia', !errores.length && sentencias.length >= 6, errores.join(' || ') || String(sentencias.length))
    const q = (s) => execFileSync('psql', [...db, '-At', '-c', s], { encoding: 'utf8' }).trim()
    check('valor_gradeado: PSA 10 de Cardmarket, BGS 9.5 de eBay, y nada para PSA 8, Black Label y a mano',
      q(`select concat_ws('|', public.valor_gradeado('PSA 10', '{"psa":{"psa10":2621}}', null), public.valor_gradeado('BGS 9.5', null, '{"bgs":{"9.5":{"median_price":100}}}'), coalesce(public.valor_gradeado('PSA 8', '{"psa":{"psa10":2621}}', null)::text, '-'), coalesce(public.valor_gradeado('BGS 10 Black Label', '{"bgs":{"bgs10":1}}', null)::text, '-'), coalesce(public.valor_gradeado('grado 9', '{"psa":{"psa9":1}}', null)::text, '-'))`) === `2621|${usdAEuros(100).toFixed(2)}|-|-|-`,
      q(`select public.valor_gradeado('BGS 9.5', null, '{"bgs":{"9.5":{"median_price":100}}}')`))
    check('  …y un `[]` de TCGGO (sin gradeadas) no rompe', q(`select coalesce(public.valor_gradeado('PSA 10', '[]', '[]')::text, 'nulo')`) === 'nulo')
    q(`select public.coleccion_foto_diaria('2026-10-20')`)
    const [valor, copias, sinPrecio] = q(`select valor || '|' || copias || '|' || sin_precio from user_collection_value where dia = '2026-10-20'`).split('|')
    check('la foto diaria suma lo mismo que la web', Number(valor) === enLaWeb && enLaWeb === 10474, `foto ${valor} · web ${enLaWeb}`)
    check('  …con sus 7 copias y ninguna «sin precio»', copias === '7' && sinPrecio === '0', `${copias} · ${sinPrecio}`)
    execFileSync('psql', [...PSQL, '-c', 'drop database if exists pd905'], { encoding: 'utf8' })
  }
}

console.log('\n── 3. Lo estático ──')
{
  const mc = leer('js/mi-coleccion.js')
  check('la ficha dice de dónde sale lo que vale tu copia', /\$\{notaDelValor\(l, precio\)\}/.test(mc) && /\(precio \$\{escapeHtml\(gradeada\.casa\)\}/.test(mc) && /sin gradear<\/span>/.test(mc))
  check('el valor de una línea pasa por la nota antes que por la carta', /valorGradeado\(precio, linea\?\.gradeo\)\?\.valor \|\| valorDe\(precio/.test(leer('js/cardmarket.js')))
}

console.log('\n── 4. En pantalla ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript((fila) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', card_count_official: 160, card_count_total: 164, tcg_online_code: 'PRC' }]
    window.__FAKE_CARTAS__ = [
      { id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon', variants: { normal: true } },
      { id: 'xy5-151', market: 'WEST', set_id: 'xy5', local_id: '151', name: 'Kyogre-EX', name_es: 'Kyogre EX', image_path: 'x/2', rarity: 'Ultra Rare', category: 'Pokemon', variants: { normal: true } },
    ]
    window.__FAKE_COLECCION__ = [
      { id: 'l1', card_id: 'xy5-150', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal', gradeo: 'PSA 10', created_at: '2026-10-01T10:00:00Z' },
      { id: 'l2', card_id: 'xy5-151', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', gradeo: 'PSA 8', created_at: '2026-10-02T10:00:00Z' },
    ]
    window.__FAKE_PRECIOS__ = [
      { ...fila, cm_id_product: 273681, tcggo_updated: '2026-10-05T12:00:00Z', origen: 'tcggo' },
      { card_id: 'xy5-151', cm_id_product: 273682, cm_low: 9, cm_low_es: 10, cm_gradeadas: { psa: { psa10: 300 } }, tcggo_updated: '2026-10-05T12:00:00Z', origen: 'tcggo' },
    ]
  }, FILA)
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  await page.route('**api.tcgdex.net/**', (r) => r.abort())
  await page.route('**/.netlify/functions/tcggo-historial*', (r) => r.fulfill({ contentType: 'application/json', body: '{"filas":[],"pedido":false}' }))
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const cabecera = limpio(await page.locator('.mc-cifra-valor dd').first().innerText().catch(() => ''))
  check('la cabecera suma la gradeada a su nota: 2 × 2.621 + 10 = 5.252 €', cabecera === '5.252,00 €', cabecera)
  const vale = async (nombre) => {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await page.locator('.mc-carta-foto').filter({ hasText: nombre }).first().click()
    await page.waitForTimeout(1200)
    if ((await page.locator('#mcEdEditar').getAttribute('aria-expanded')) !== 'true') await page.click('#mcEdEditar')
    await page.waitForTimeout(250)
    return page.locator('#mcEdCopiaVale')
  }
  const g = await vale('Groudon')
  check('la ficha de la PSA 10: «valen 5.242,00 € (precio PSA 10)»', limpio(await g.innerText()) === '2 copias · valen 5.242,00 € (precio PSA 10)', limpio(await g.innerText()))
  const k = await vale('Kyogre')
  check('la de la PSA 8, sin precio de su nota: el de la carta, y lo dice', limpio(await k.innerText()) === '1 copia · vale 10,00 € sin gradear', limpio(await k.innerText()))
  check('  …con su explicación al pasar por encima', /No hay precio de PSA 8 para esta carta/.test(await k.locator('.mc-nota-precio').getAttribute('title').catch(() => '')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.screenshot({ path: `${process.env.PD_CAPTURAS || '/tmp'}/905-ficha.png` }).catch(() => {})
  await browser.close()
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
