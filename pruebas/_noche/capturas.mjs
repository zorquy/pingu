import { chromium, contexto, BASE } from '../fixtures-app.mjs'
const S = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/noche'
const RUTAS = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/aprender', '/noticias', '/foro', '/torneos', '/mazos', '/meta', '/cartas', '/mi-coleccion', '/perfil', '/usuarios', '/retos', '/lanzamientos', '/ajustes', '/glosario', '/sobre', '/privacidad', '/terminos', '/colabora', '/novedades', '/eventos', '/tiendas', '/para-tiendas', '/mensajes', '/avisos', '/guardados', '/buscar?q=pikachu', '/mis-partidas', '/constructor', '/laboratorio', '/repeticiones', '/carta-del-dia', '/quien-es', '/parejas', '/mas-caro', '/ordena-precio', '/que-expansion', '/nueve', '/ilustrador', '/coleccion', '/onboarding', '/auth', '/404', '/sin-conexion', '/evento', '/curso']
const b = await chromium.launch()
const errores = {}
for (const movil of [false, true]) {
  const ctx = await contexto(b, movil, 'user-1')
  for (const r of RUTAS) {
    const page = await ctx.newPage()
    const err = []
    page.on('pageerror', (e) => err.push(String(e).slice(0, 140)))
    try {
      await page.goto(`${BASE}${r}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(3500)
      const nombre = (r.replace(/[\/?=&]+/g, '_').replace(/^_|_$/g, '') || 'inicio') + (movil ? '-m' : '-pc')
      await page.screenshot({ path: `${S}/${nombre}.png`, fullPage: !movil, ...(movil ? {} : { clip: undefined }) }).catch(() => {})
      const info = await page.evaluate(() => ({ alto: document.documentElement.scrollHeight, ancho: document.documentElement.scrollWidth > innerWidth }))
      if (err.length || info.ancho) errores[`${r} ${movil ? 'm' : 'pc'}`] = { err, desborda: info.ancho, alto: info.alto }
    } catch (e) { errores[`${r} ${movil ? 'm' : 'pc'}`] = String(e).slice(0, 120) }
    await page.close()
  }
  await ctx.close()
}
await b.close()
console.log(JSON.stringify(errores, null, 1))
