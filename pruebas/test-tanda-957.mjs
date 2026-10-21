// Tanda 957 — lo que faltaba del catálogo de la lista de Sergio.M y sí tiene
// fuente: el McDonald's 2019 en francés (TCGdex), los cuatro sellos del
// Scyther de Dark Explorers, las barajas japonesas de Lucario VSTAR (TCGdex +
// Bulbapedia) y Zekrom-EX (Bulbapedia), y en /admin la lista de cartas pegada
// al crear una colección a mano.
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
const MIGRACION = join(RAIZ, 'supabase-migration-957-mcdonalds-fr-y-sellos.sql')
const SQL = readFileSync(MIGRACION, 'utf8')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 120000 })

console.log('── 1. La migración, contra PostgreSQL ──')
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
if (hay.status === 0) {
  psql(['-c', 'drop database if exists prueba_957'])
  psql(['-c', 'create database prueba_957'])
  const antes = [join(AQUI, 'sql-tanda-885.sql'), join(RAIZ, 'supabase-migration-885-catalogo-correcciones.sql'), join(AQUI, 'sql-tanda-934.sql'), join(RAIZ, 'supabase-migration-934-versiones-a-mano.sql'), join(AQUI, 'sql-tanda-957.sql'), join(RAIZ, 'supabase-migration-956-idiomas-y-versiones-a-mano.sql')]
  for (const f of antes) {
    const r = psql(['-v', 'ON_ERROR_STOP=1', '-d', 'prueba_957', '-f', f])
    if (r.status !== 0) check(`carga ${f.split('/').pop()}`, false, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
  }
  const una = psql(['-v', 'ON_ERROR_STOP=1', '-d', 'prueba_957', '-f', MIGRACION])
  check('la 957 se ejecuta', una.status === 0, (una.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
  const otra = psql(['-v', 'ON_ERROR_STOP=1', '-d', 'prueba_957', '-f', MIGRACION])
  check('  …y dos veces', otra.status === 0, (otra.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
  const q = (sql) => (psql(['-t', '-A', '-d', 'prueba_957', '-c', sql]).stdout || '').trim()
  check('el McDonald\'s 2019 en francés: 41 cartas (40 y la 33b)', q("select count(*) from tcg_cards where set_id = '2019sm-fr'") === '41')
  check('  …a mano, en la era del McDonald\'s inglés, sin esconder', q("select origen || ',' || serie_id || ',' || oculto from tcg_sets where id = '2019sm-fr'") === 'mano,mc,false', q("select origen || ',' || serie_id || ',' || oculto from tcg_sets where id = '2019sm-fr'"))
  check('  …con el inglés de su Pokédex y el español de las de Alola', q("select name || '|' || name_es from tcg_cards where id = '2019sm-fr-5'") === 'Alolan Exeggutor|Exeggutor de Alola' && q("select name from tcg_cards where id = '2019sm-fr-1'") === 'Bulbasaur', q("select name || '|' || name_es from tcg_cards where id = '2019sm-fr-5'"))
  check('  …con PS, tipo, Pokédex e ilustrador', q("select hp || ',' || types[1] || ',' || dex_ids[1] || ',' || illustrator from tcg_cards where id = '2019sm-fr-1'") === '70,Grass,1,Mizue')
  check('  …y sin foto inventada', q("select count(*) from tcg_cards where set_id = '2019sm-fr' and image_path is not null") === '0')
  check('  …y solo en francés', q("select array_to_string(idiomas_de_set('2019sm-fr', 'WEST'), ',')") === 'fr', q("select array_to_string(idiomas_de_set('2019sm-fr', 'WEST'), ',')"))
  check('el Scyther de Dark Explorers con sus cuatro sellos, una vez', q("select count(*) from tcg_card_versions where card_id = 'bw5-4' and clase = 'sello' and origen = 'mano'") === '4')
  check('  …del 1.er al 4.º puesto', q("select string_agg(etiqueta, ',' order by etiqueta) from tcg_card_versions where card_id = 'bw5-4'") === 'Sello 1.er puesto,Sello 2.º puesto,Sello 3.er puesto,Sello 4.º puesto')
  check('las barajas japonesas con coreano (y la de Lucario con chino)', q("select string_agg(set_id || ':' || idioma, ',' order by set_id, idioma) from tcg_set_idiomas_mano where market = 'JP'") === 'bkz_ja:ko,sll_ja:ko,sll_ja:zh')
  psql(['-c', 'drop database if exists prueba_957'])
}
check('la migración no usa tablas temporales (la 631)', !/create\s+temp/i.test(SQL))

console.log('\n── 2. Lo puro ──')
const { cartasDeLista, idDeCartaAMano } = await import(join(RAIZ, 'admin/js/lista-cartas-puro.js'))
const l = cartasDeLista('001 · ストライク · Scyther\n002 アサナン\n\n003;チャーレム;Medicham\nTG05 | Pikachu\n003 · Otra')
check('la lista: número, nombre y el inglés si lo hay, con varios separadores', JSON.stringify(l.cartas) === JSON.stringify([{ local_id: '001', name: 'ストライク', name_en: 'Scyther' }, { local_id: '002', name: 'アサナン' }, { local_id: '003', name: 'チャーレム', name_en: 'Medicham' }, { local_id: 'TG05', name: 'Pikachu' }]), JSON.stringify(l.cartas))
check('  …y un número repetido es un error que se dice', l.errores.length === 1 && /003 está dos veces/.test(l.errores[0]), l.errores.join())
check('  …igual que una línea sin número', /no empieza por un número/.test(cartasDeLista('Pikachu').errores[0] || ''))
check('el id de una carta a mano es el de «Nueva carta»', idDeCartaAMano('pcg-silver_ja', '001') === 'mano-pcg-silver_ja-001')
const { DECKS, filasDelDeck } = await import(join(RAIZ, 'netlify/functions/decks-jp-a-mano.mjs'))
for (const [clave, n] of [['sll_ja', 21], ['bkz_ja', 18]]) {
  const d = DECKS.find((x) => x.clave === clave)
  const r = d ? filasDelDeck(d) : { filas: [] }
  check(`${clave}: ${n} cartas, numeradas del 001`, r.filas.length === n && r.filas[0]?.local_id === '001' && r.filas.at(-1)?.local_id === String(n).padStart(3, '0'), String(r.filas.length))
  check('  …con nombre japonés e inglés, y sin ficha copiada (no hay una comprobada)', r.filas.every((f) => f.name && f.name_en) && r.copiadas === 0)
}
check('las de V, VSTAR y EX, holo', ['sll_ja-004', 'sll_ja-005', 'sll_ja-010', 'bkz_ja-009'].every((id) => [...filasDelDeck(DECKS.find((d) => d.clave === 'sll_ja')).filas, ...filasDelDeck(DECKS.find((d) => d.clave === 'bkz_ja')).filas].find((f) => f.id === id)?.variants?.holo))

console.log('\n── 3. /admin: la lista pegada al crear ──')
{
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    Object.assign(window, { __FAKE_SETS__: [{ id: 'base1', name: 'Base Set', market: 'JP', serie_id: 'pcg' }], __FAKE_CARTAS__: [], __FAKE_COLECCION__: [], __FAKE_VERSIONES__: [], __FAKE_ERAS__: [] })
  })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await p.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  await p.locator('[data-section="colecciones"]').click()
  await p.waitForTimeout(500)
  await p.locator('#coleccionesMercado').selectOption('JP').catch(() => {})
  await p.waitForTimeout(500)
  await p.locator('#coleccionesNueva').click()
  await p.waitForTimeout(300)
  await p.locator('#colNuevoId').fill('sll_ja')
  await p.locator('#colNuevoNombre').fill('スターターセットVSTAR ルカリオ')
  await p.locator('#colNuevoLista').fill('001 · ストライク · Scyther\n001 · アサナン · Meditite')
  check('la lista dice lo que va a crear y lo que está mal', /1 carta · Línea 2: el número 001 está dos veces/.test(await p.locator('#colNuevoListaResumen').textContent()), await p.locator('#colNuevoListaResumen').textContent())
  await p.locator('#colNuevoCrear').click()
  await p.waitForTimeout(300)
  const rpcs = () => p.evaluate(() => (window.__RPCS__ || []).filter((r) => r.nombre === 'catalogo_corregir'))
  check('  …y con un error no crea nada', (await rpcs()).length === 0)
  await p.locator('#colNuevoLista').fill('001 · ストライク · Scyther\n002 · アサナン · Meditite\n003 · チャーレム')
  await p.locator('#colNuevoCrear').click()
  await p.waitForTimeout(900)
  const hechas = await rpcs()
  check('crea la colección y sus tres cartas', hechas.length === 4 && hechas[0].args.p_tabla === 'tcg_sets', String(hechas.length))
  check('  …la colección cuenta las tres', hechas[0]?.args.p_cambios.card_count_total === 3)
  const cartas = await p.evaluate(() => window.__TABLAS__.tcg_cards.filter((c) => c.set_id === 'sll_ja').map((c) => `${c.id}|${c.local_id}|${c.name}|${c.name_en || ''}`).sort().join(','))
  check('  …con su número, nombre e inglés', cartas === 'mano-sll_ja-001|001|ストライク|Scyther,mano-sll_ja-002|002|アサナン|Meditite,mano-sll_ja-003|003|チャーレム|', cartas)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await browser.close()
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
