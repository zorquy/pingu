// Tanda 983 — Menos esperas en fila (propuesta «Rápida al volver», B).
//
// Con la base retrasada 250 ms por consulta, se apunta cuándo y desde qué
// fichero se pide cada consulta (el doble lo hace con __QUIEN__) y se cuentan
// las «olas»: una consulta pedida cuando la anterior ya había vuelto es una
// espera más. Lo que se mira es en qué ola llega lo ÚLTIMO de cada pantalla
// (sin la racha, los avisos y las visitas, que van por detrás), y que el
// perfil de quien mira se pida una sola vez.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const DE_FONDO = /gamification|page-views|messages\.js|notifications\.js|aviso-global|aviso-torneo|en-linea/

const b = await chromium.launch()
async function medir(ruta) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('sb-prueba-auth-token', '{}') } catch {}
    const s = new Proxy({}, { get: () => 250 })
    window.__FAKE_RETRASO__ = s
    window.__RPC_RETRASO__ = s
    window.__QUIEN__ = []
  })
  await ctx.route(/\/\.netlify\/functions\//, (r) => setTimeout(() => r.fulfill({ status: 404, body: '{}' }).catch(() => {}), 250))
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(4000)
  const q = (await p.evaluate(() => window.__QUIEN__)).sort((a, b) => a[1] - b[1])
  await ctx.close()
  let ola = 0, desde = -1e9
  const conOla = q.map(([tabla, ms, f]) => { if (ms >= desde + 200) { ola++; desde = ms } return { tabla, f, ola } })
  const utiles = conOla.filter((x) => !DE_FONDO.test(x.f))
  return { ultima: Math.max(0, ...utiles.map((x) => x.ola)), conOla, errores }
}

console.log('── En qué espera llega lo último de cada pantalla (antes → ahora) ──')
for (const [ruta, antes, tope] of [['/index.html', 3, 2], ['/foro', 4, 2], ['/perfil', 5, 2], ['/usuario?u=Ash', 8, 3]]) {
  const r = await medir(ruta)
  check(`${ruta}: en la ola ${r.ultima} (antes ${antes}, tope ${tope})`, r.ultima > 0 && r.ultima <= tope, r.conOla.filter((x) => !DE_FONDO.test(x.f)).map((x) => `${x.ola}:${x.tabla}@${x.f}`).join(' '))
  check(`  …sin errores`, !r.errores.length, r.errores.join(' | '))
  const mios = r.conOla.filter((x) => x.tabla === 'user_profiles' && /js\/app\.js/.test(x.f))
  check('  …y tu perfil se pide UNA vez (la barra, el arranque y la pantalla comparten)', mios.length === 1, mios.length)
}
{
  const r = await medir('/mi-coleccion')
  const valores = r.conOla.filter((x) => x.tabla === 'tcg_set_valor')
  check('Mi colección pide los valores de las expansiones una vez (antes, cuatro)', valores.length === 1, valores.length)
  check('  …y tus cartas en la segunda ola, detrás solo del perfil', r.conOla.find((x) => x.tabla === 'user_collection')?.ola === 2, JSON.stringify(r.conOla.filter((x) => x.tabla === 'user_collection')))
}
{
  // La racha, ya contada hoy: el perfil que pidió la barra lo dice, sin otra consulta.
  const ctx = await b.newContext({ locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1'; window.__QUIEN__ = [] })
  const p = await ctx.newPage()
  await p.goto(BASE + '/glosario', { waitUntil: 'load' })
  await p.waitForTimeout(1500)
  const r = await p.evaluate(async () => {
    const hoy = new Date()
    const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    const fila = window.__TABLAS__.user_profiles.find((f) => f.id === 'user-1')
    fila.last_active_date = iso
    fila.current_streak = 7
    const { getProfile } = await import('/js/app.js')
    await getProfile('user-1', { fresco: true })
    window.__QUIEN__.length = 0
    const { checkDailyStreak } = await import('/js/gamification.js')
    const racha = await checkDailyStreak('user-1')
    return { racha, pedidas: window.__QUIEN__.map((x) => x[0]) }
  })
  check('la racha ya contada hoy sale del perfil de la página, sin consultas', r.racha === 7 && r.pedidas.length === 0, JSON.stringify(r))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
