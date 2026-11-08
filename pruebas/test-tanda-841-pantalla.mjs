// Tanda 841 — un reto jugado en el móvil sale hecho en el PC. Hasta la 1267
// la partida viajaba en `retos_resultados.estado` y la página la bajaba al
// navegador; desde la 1268 (el árbitro) la partida con cuenta VIVE en la base
// (`retos_partidas`) y cada página la pide al abrirse: en otro aparato sale
// tal cual, a medias o hecha.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { instalarRetos } from './retos-falsos.mjs'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`) }
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

for (const [f, j] of [['carta-del-dia-juego', 'carta'], ['mas-caro-juego', 'caro'], ['quien-es-juego', 'silueta'], ['ordena-precio-juego', 'ordena'], ['que-expansion-juego', 'expansion'], ['parejas-juego', 'parejas']]) {
  const t = leer(`js/${f}.js`)
  check(`${j}: la página pide su partida a la base al abrirse (y no la lee del navegador)`, new RegExp(`partida\\('${j}'`).test(t) && /arbitro\.abrir\(\)/.test(t) && !/traerPartidaDeHoy|cargarEstado\(\)/.test(t))
}
const sql = leer('supabase-migration-1268-retos-arbitro.sql')
check('la base guarda la partida con cuenta (una por reto y día) y la devuelve al abrir', /create table if not exists public\.retos_partidas/.test(sql) && /primary key \(user_id, juego, day\)/.test(sql) && /from public\.retos_partidas p\s+where p\.user_id = v_uid/.test(sql))

const b = await chromium.launch()
const hoy = new Date().toISOString().slice(0, 10)
const SILUETA = { dia: hoy, numero: 1, buena: 25, opciones: [1, 25, 7, 133] }
for (const [nombre, base, esperaHecho] of [
  ['con la partida hecha en otro aparato', { dia: hoy, elegidos: [25], acertada: true }, true],
  ['sin nada en la base', null, false],
]) {
  const ctx = await b.newContext()
  const errores = []
  await ctx.route(/^https:\/\/.*\.(png|webp)(\?.*)?$/i, (r) => r.fulfill({ status: 404, body: '' }))
  await instalarRetos(ctx, { silueta: SILUETA })
  // «La base»: la partida de la cuenta en el árbitro de mentira.
  await ctx.addInitScript(([e, dia]) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_RETOS_NUMEROS__ = { hoy: {}, dias: {} }
    if (e) localStorage.setItem(`__arbitro__:user-1:silueta:${dia}`, JSON.stringify({ e, guardado: { nuevo: false, xp: 30 } }))
  }, [base, hoy])
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/quien-es`, { waitUntil: 'load' })
  await page.waitForTimeout(1800)
  if (esperaHecho) {
    check(`${nombre}: sale hecha (sin opciones que pulsar) y con lo ganado`, (await page.locator('.qe-opcion:not([disabled])').count()) === 0 && /¡Es /.test(await page.locator('#qeFinal').innerText()), await page.locator('#qeFinal').innerText())
    const local = await page.evaluate(() => localStorage.getItem('pokedoc-quien-es'))
    check(`${nombre}: y queda en el navegador para «Mi día»`, JSON.parse(local || 'null')?.elegidos?.[0] === 25, local)
  } else {
    check(`${nombre}: la página se juega como siempre`, (await page.locator('.qe-opcion:not([disabled])').count()) === 4)
  }
  check(`${nombre}: sin errores`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\nTODO OK')
process.exit(fails ? 1 : 0)
