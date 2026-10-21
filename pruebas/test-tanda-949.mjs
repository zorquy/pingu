// Tanda 949 — «Versiones de todas»: poner y quitar versiones a muchas cartas
// de un set de una vez, desde /admin.
//
// PINGU: «méteme en admin para poner las versiones de todas las cartas. Pero
// no son todas las cartas… para esos momentos que me dicen "este tenía
// primera edición y unlimited", se arregla en un momento».
//
//   1. La BASE (PostgreSQL de verdad): `catalogo_versiones_lote` solo para el
//      admin, sin repetir, en orden, la Unlimited con el producto, las copias
//      a Unlimited y quitar solo lo de edición.
//   2. Lo PURO: qué cartas entran (rareza y números) y cuántas se crean.
//   3. La PANTALLA de /admin: el botón, los filtros, el resumen antes de
//      tocar nada, poner y quitar; y la web enseña luego esas versiones.
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const MIGRACION = join(RAIZ, 'supabase-migration-949-versiones-en-lote.sql')
const SQL = readFileSync(MIGRACION, 'utf8')

console.log('── 1. La base ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 120000 })
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
  if (hay.status === 0) {
    psql(['-c', 'drop database if exists prueba_949'])
    psql(['-c', 'create database prueba_949'])
    const antes = [join(AQUI, 'sql-tanda-885.sql'), join(RAIZ, 'supabase-migration-885-catalogo-correcciones.sql'), join(AQUI, 'sql-tanda-934.sql'), join(RAIZ, 'supabase-migration-934-versiones-a-mano.sql'), join(AQUI, 'sql-tanda-935.sql'), join(RAIZ, 'supabase-migration-935-ediciones-wizards.sql'), join(AQUI, 'sql-tanda-948.sql')]
    for (const f of antes) {
      const r = psql(['-d', 'prueba_949', '-f', f])
      if (r.status !== 0) check(`carga ${f.split('/').pop()}`, false, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    }
    const una = psql(['-d', 'prueba_949', '-f', MIGRACION])
    check('la migración se ejecuta', una.status === 0, (una.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    const otra = psql(['-d', 'prueba_949', '-f', MIGRACION])
    check('  …y se puede ejecutar dos veces', otra.status === 0, (otra.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    const r = psql(['-t', '-A', '-d', 'prueba_949', '-f', join(AQUI, 'sql-tanda-949-casos.sql')])
    const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
    check('los casos se ejecutan', r.status === 0 && lineas.length >= 15, (r.stderr || '').slice(0, 300))
    for (const l of lineas) check(l.replace(/^(ok|MAL) /, ''), l.startsWith('ok'))
    psql(['-c', 'drop database if exists prueba_949'])
  }
  check('la migración no usa tablas temporales (la 631)', !/create\s+temp/i.test(SQL))
  check('  …y la función es solo para quien ha entrado', /revoke all on function public\.catalogo_versiones_lote[^;]*from public, anon/.test(SQL))
}

console.log('\n── 2. Lo puro ──')
const puro = await import(`${RAIZ}/admin/js/versiones-lote-puro.js`)
const v = await import(`${RAIZ}/js/mi-coleccion/variantes.js`)
{
  const cartas = [
    { id: 'a', local_id: '001', rarity_en: 'Common' }, { id: 'b', local_id: '2', rarity_en: 'Common' },
    { id: 'c', local_id: '050/090', rarity_en: 'Rare Holo' }, { id: 'd', local_id: 'SP', rarity_en: 'Common' }, { id: 'e', local_id: '090', rarity: null },
  ]
  check('las rarezas del set, de más a menos y la que falta como «Sin rareza»', JSON.stringify(puro.rarezasDelSet(cartas)) === JSON.stringify([{ rareza: 'Common', n: 3 }, { rareza: 'Rare Holo', n: 1 }, { rareza: 'Sin rareza', n: 1 }]))
  const ids = (o) => puro.cartasDelLote(cartas, o).map((c) => c.id).join()
  check('sin filtros, todas', ids({}) === 'a,b,c,d,e')
  check('por rareza: solo las que no son holo', ids({ rarezas: new Set(['Common']) }) === 'a,b,d')
  check('por números: «003/090» cuenta como 3 y «SP» no entra en un rango', ids({ desde: 2, hasta: 60 }) === 'b,c')
  check('las dos juntas', ids({ rarezas: new Set(['Common']), desde: 1, hasta: 1 }) === 'a')
  check('las etiquetas: sin repetir (sin caja), las escritas a mano detrás, separadas por comas', puro.etiquetasElegidas(['1st Edition', 'Unlimited'], ' unlimited , Shadowless,, ').join('|') === '1st Edition|Unlimited|Shadowless')
  const tiene = new Map([['a', new Set(['1st edition'])]])
  check('el resumen cuenta las nuevas y las que ya estaban', JSON.stringify(puro.resumenDelLote(cartas.slice(0, 2), ['1st Edition', 'Unlimited'], tiene)) === JSON.stringify({ cartas: 2, nuevas: 3, ya: 1, quitables: 1 }))
  // Lo que la web hará con esas etiquetas: cada una es una versión con su id.
  const idsWeb = puro.VERSIONES_LOTE.map((x) => v.varianteDeEtiqueta(x.etiqueta))
  check('cada versión de la lista tiene su id en la web, sin repetir', new Set(idsWeb).size === idsWeb.length && idsWeb.slice(0, 2).join() === 'primera,unlimited', idsWeb.join())
  const carta = { id: 'x', market: 'JP', versiones: ['1st Edition', 'Unlimited', '1st Edition Reverse Holo', 'Unlimited Reverse Holo'].map((etiqueta, i) => ({ tcggo_id: -1 - i, card_id: 'x', etiqueta, origen: 'edicion', clase: 'impresion' })) }
  check('una carta con las cuatro de Reviving Legends ofrece esas cuatro', v.variantesDeCarta(carta).map((x) => x.nuestro).join() === 'primera,unlimited,1st-edition-reverse-holo,unlimited-reverse-holo', v.variantesDeCarta(carta).map((x) => x.nuestro).join())
  check('  …y la de por defecto es la Unlimited', v.varianteDeCarta(carta) === 'unlimited')
}

console.log('\n── 3. La pantalla de /admin ──')
const SETS = [{ id: 'l2_ja', name: 'Reviving Legends', name_en: 'Reviving Legends', serie_id: 'legend', market: 'JP', release_date: '2010-03-12', card_count_official: 80, card_count_total: 80, tcggo_id: 990 }]
const CARTAS = [
  ...[1, 2, 3].map((n) => ({ id: `tcggo-99${n}`, market: 'JP', set_id: 'l2_ja', local_id: String(n).padStart(3, '0'), name: `カード${n}`, name_en: `Card ${n}`, rarity_en: 'Common', cm_id_product_propio: 900000 + n, origen: 'tcggo' })),
  { id: 'tcggo-9950', market: 'JP', set_id: 'l2_ja', local_id: '050', name: 'ホウオウ', name_en: 'Ho-Oh', rarity_en: 'Rare Holo', cm_id_product_propio: 900050, origen: 'tcggo' },
]
const COLECCION = [{ id: 'l1', user_id: 'admin-1', card_id: 'tcggo-991', market: 'JP', idioma: 'ja', estado: 'NM', variante: 'normal', cantidad: 1 }]
const browser = await chromium.launch()
{
  // /admin con el worker bloqueado se queja al leerlo (como en la 935): va con él.
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_COLECCION__: d.COLECCION, __FAKE_VERSIONES__: [], __FAKE_ERAS__: [] })
  }, { SETS, CARTAS, COLECCION })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  p.on('dialog', (d) => d.accept())
  const rpcs = (n) => p.evaluate((x) => (window.__RPCS__ || []).filter((r) => r.nombre === x), n)
  const tabla = (t) => p.evaluate((n) => window.__TABLAS__[n], t)
  await p.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  await p.locator('[data-section="colecciones"]').click()
  await p.waitForTimeout(500)
  await p.locator('#coleccionesMercado').selectOption('JP').catch(() => {})
  await p.waitForTimeout(600)
  await p.locator('[data-editar="l2_ja"]').click()
  await p.waitForTimeout(300)
  await p.locator('#colCartas').click()
  await p.waitForTimeout(800)
  check('la lista de cartas del set tiene «Versiones de todas»', await p.locator('#catLote').isVisible())
  await p.locator('#catLote').click()
  await p.waitForFunction(() => document.getElementById('loteResumen'), null, { timeout: 5000 }).catch(() => {})
  await p.waitForTimeout(400)
  const resumen = () => p.locator('#loteResumen').textContent()
  check('sin elegir nada: lo pide y no deja poner', /Elige al menos una versión/.test(await resumen()) && (await p.locator('#lotePoner').isDisabled()), await resumen())
  const rarezas = await p.evaluate(() => [...document.querySelectorAll('[data-lote-rareza]')].map((x) => `${x.dataset.loteRareza}:${x.checked}`).join())
  check('las rarezas del set, todas marcadas', rarezas === 'Common:true,Rare Holo:true', rarezas)
  await p.locator('[data-lote-version="1st Edition"]').check()
  await p.locator('[data-lote-version="Unlimited"]').check()
  check('con 1.ª edición y Unlimited: «4 cartas: se crean 8»', /4 cartas: se crean 8 versiones/.test(await resumen()), await resumen())
  // Las Reverse de Reviving Legends, solo para las que no son holo.
  await p.locator('[data-lote-version="1st Edition Reverse Holo"]').check()
  await p.locator('[data-lote-version="Unlimited Reverse Holo"]').check()
  await p.locator('[data-lote-rareza="Rare Holo"]').uncheck()
  check('quitando la holo: «3 cartas: se crean 12»', /3 cartas: se crean 12 versiones/.test(await resumen()), await resumen())
  await p.locator('#lotePoner').click()
  await p.waitForTimeout(900)
  const ll = await rpcs('catalogo_versiones_lote')
  check('«Poner» llama a la base con esas tres cartas, las cuatro versiones en su orden y «mover»', ll.length === 1 && ll[0].args.p_market === 'JP' && ll[0].args.p_cartas.join() === 'tcggo-991,tcggo-992,tcggo-993' && ll[0].args.p_etiquetas.join('|') === '1st Edition|Unlimited|1st Edition Reverse Holo|Unlimited Reverse Holo' && ll[0].args.p_mover === true && ll[0].args.p_quitar === false, JSON.stringify(ll[0]?.args))
  const filas = (await tabla('tcg_card_versions')).filter((x) => x.origen === 'edicion')
  check('  …y quedan las doce, ninguna en la holo', filas.length === 12 && !filas.some((x) => x.card_id === 'tcggo-9950'), filas.length)
  check('  …la copia «normal» pasa a Unlimited', (await tabla('user_collection')).find((x) => x.id === 'l1')?.variante === 'unlimited')
  check('  …y el resumen ya sabe que están («12 ya estaban»)', /se crean 0 versiones \(12 ya estaban\)/.test(await resumen()) && (await p.locator('#lotePoner').isDisabled()), await resumen())
  // Quitar las Reverse.
  await p.locator('[data-lote-version="1st Edition"]').uncheck()
  await p.locator('[data-lote-version="Unlimited"]').uncheck()
  await p.locator('#loteQuitar').click()
  await p.waitForTimeout(900)
  const q = (await rpcs('catalogo_versiones_lote'))[1]
  check('«Quitar» quita las dos Reverse de las tres', q?.args.p_quitar === true && q.args.p_etiquetas.join('|') === '1st Edition Reverse Holo|Unlimited Reverse Holo' && (await tabla('tcg_card_versions')).filter((x) => x.origen === 'edicion').length === 6, JSON.stringify(q?.args))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
