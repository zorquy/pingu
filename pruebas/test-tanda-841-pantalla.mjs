// Tanda 841 — un reto jugado en el móvil sale hecho en el PC: la partida
// viaja en `retos_resultados.estado` y la página la baja al navegador.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`) }
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

check('al guardar se manda la partida (y sin la migración nueva se repite sin ella)', /p_estado: partida/.test(leer('js/retos-datos.js')) && /noHayFuncion\(error\)\) \(\{ data, error \} = await supabase\.rpc\('retos_guardar', args\)\)/.test(leer('js/retos-datos.js')))
for (const [f, j] of [['carta-del-dia-juego', 'carta'], ['mas-caro-juego', 'caro'], ['quien-es-juego', 'silueta'], ['ordena-precio-juego', 'ordena'], ['que-expansion-juego', 'expansion']]) {
  const t = leer(`js/${f}.js`)
  check(`${j}: la página baja la partida ANTES de leer la suya`, t.indexOf(`traerPartidaDeHoy('${j}', dia)`) > 0 && t.indexOf(`traerPartidaDeHoy('${j}', dia)`) < t.indexOf(f === 'ordena-precio-juego' || f === 'que-expansion-juego' ? 'const g = leer(CLAVE, null)' : '  cargarEstado()\n', t.indexOf('async function init')))
}
const sql = leer('supabase-migration-retos-xp.sql')
check('la migración guarda la partida y la devuelve en lo de hoy', /add column if not exists estado jsonb/.test(sql) && /p_estado jsonb default null/.test(sql) && /'estado', estado\)/.test(sql))

const b = await chromium.launch()
const { quienEs } = { quienEs: await import(`${RAIZ}/js/quien-es.js`) }
const hoy = new Date().toISOString().slice(0, 10)
const dex = quienEs.pokemonDelDia(hoy)
for (const [nombre, numeros, esperaHecho] of [
  ['con la partida en la base', { hoy: { silueta: { aciertos: 0, total: 0, intentos: 1, acertada: true, xp: 20, estado: { dia: hoy, elegidos: [dex], acertada: true } } }, dias: {} }, true],
  ['sin nada en la base', { hoy: {}, dias: {} }, false],
]) {
  const page = await b.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/^https:\/\/.*\.(png|webp)(\?.*)?$/i, (r) => r.fulfill({ status: 404, body: '' }))
  await page.addInitScript((n) => { window.__FAKE_SESSION__ = 'user-1'; window.__FAKE_RETOS_NUMEROS__ = n }, numeros)
  await page.goto(`${BASE}/quien-es`, { waitUntil: 'load' })
  await page.waitForTimeout(1800)
  const local = await page.evaluate(() => localStorage.getItem('pokedoc-quien-es'))
  if (esperaHecho) {
    check(`${nombre}: baja al navegador`, Boolean(local) && JSON.parse(local).elegidos?.[0] === dex, local)
    check(`${nombre}: y la página sale hecha (sin opciones que pulsar)`, (await page.locator('.qe-opcion:not([disabled])').count()) === 0)
  } else {
    check(`${nombre}: la página se juega como siempre`, (await page.locator('.qe-opcion:not([disabled])').count()) === 4)
  }
  check(`${nombre}: sin errores`, errores.length === 0, errores.join(' | '))
  await page.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\nTODO OK')
process.exit(fails ? 1 : 0)
