// Capturas del «antes» para la propuesta visual: portada, foro, tema, cartas, expansión, colección, perfil, torneos, noticias, guía, retos; PC y móvil, claro y oscuro.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
const OUT = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/antes'
const PAGINAS = { portada: '/', aprender: '/aprender', foro: '/foro', tema: '/tema/tema-2', cartas: '/cartas', expansion: '/cartas?ver=album&set=sv08&catalogo=WEST', coleccion: '/mi-coleccion', perfil: '/usuario/Misty', torneos: '/torneos', torneo: '/torneo?slug=liga-fdn-otono', noticias: '/noticias', guia: '/guia/charizard-ex', retos: '/retos', gente: '/usuarios', mazos: '/mazos' }
const browser = await chromium.launch()
for (const movil of [false, true]) {
  const ctx = await contexto(browser, movil, 'user-1')
  for (const [nombre, ruta] of Object.entries(PAGINAS)) {
    for (const esquema of ['light', 'dark']) {
      const page = await ctx.newPage()
      await page.emulateMedia({ colorScheme: esquema })
      try {
        await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await page.waitForTimeout(2500)
        await page.screenshot({ path: `${OUT}/${nombre}-${movil ? 'm' : 'pc'}-${esquema}.jpg`, type: 'jpeg', quality: 70 })
        if (esquema === 'light') await page.screenshot({ path: `${OUT}/${nombre}-${movil ? 'm' : 'pc'}-${esquema}-full.jpg`, type: 'jpeg', quality: 60, fullPage: true })
      } catch (e) { console.log('fallo', nombre, movil, esquema, String(e).slice(0, 80)) }
      await page.close()
    }
  }
  await ctx.close()
}
await browser.close()
console.log('hecho')
