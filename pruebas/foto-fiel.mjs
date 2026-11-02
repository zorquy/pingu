// Capturas fieles: la web de verdad, antes y con la hoja «después» encima.
import { chromium, sembrar, BASE } from './fixtures-app.mjs'
import fs from 'node:fs'
const DIR = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/fiel'
const CSS = fs.readFileSync(`${DIR}/despues.css`, 'utf8')
const SOLO = process.argv[2] ? process.argv[2].split(',') : null
const PAG = { portada: '/', cartas: '/cartas', expansion: '/cartas?ver=album&set=sv08&catalogo=WEST', coleccion: '/mi-coleccion', foro: '/foro', tema: '/tema/tema-2', torneos: '/torneos', perfil: '/usuario/Misty', aprender: '/aprender', noticias: '/noticias' }
const NOMBRES = ['Pikachu ex', 'Charizard ex', 'Gardevoir ex', 'Dragapult ex', 'Raichu', 'Mew ex', 'Snorlax', 'Lugia V']
const COL = ['#f2c14e', '#e0552b', '#7fd3a1', '#8e6fd8', '#f2c14e', '#e98fc0', '#b7b7b7', '#5fa8e0']
const svgCarta = (i) => `<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="11" fill="${COL[i%8]}"/><rect x="12" y="34" width="221" height="150" rx="5" fill="#1b1e21" opacity=".75"/><circle cx="122" cy="109" r="46" fill="${COL[(i+3)%8]}" opacity=".9"/><text x="16" y="24" font-size="16" font-weight="800" fill="#1a1408" font-family="Inter,sans-serif">${NOMBRES[i%8]}</text><text x="229" y="24" font-size="13" font-weight="700" fill="#1a1408" text-anchor="end" font-family="Inter,sans-serif">${[330,330,310,320,120,180,150,220][i%8]} PS</text><rect x="12" y="200" width="221" height="2" fill="#1a1408" opacity=".25"/><text x="16" y="236" font-size="12" font-weight="700" fill="#1a1408" font-family="Inter,sans-serif">${['Rayo tornado','Llamarada carmesí','Sueño enigmático','Vuelo fantasma','Chispa','Génesis','Cuerpo pesado','Aerotormenta'][i%8]}</text><text x="229" y="236" font-size="12" font-weight="800" fill="#1a1408" text-anchor="end" font-family="Inter,sans-serif">${[120,180,190,200,60,30,90,210][i%8]}</text><text x="16" y="326" font-size="10" font-weight="700" fill="#1a1408" font-family="Inter,sans-serif">SV08 · ${(i*17%191)+1}/191</text></svg>`
const svgLogo = (code) => `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="110" viewBox="0 0 300 110"><text x="150" y="58" font-size="44" text-anchor="middle" font-family="Outfit,Inter,sans-serif" font-weight="800" fill="#f2c14e" letter-spacing="2">${code.toUpperCase()}</text><text x="150" y="88" font-size="16" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" fill="#eef0f2" opacity=".85">POKÉMON TCG</text></svg>`
const browser = await chromium.launch()
for (const movil of [false, true]) for (const [nombre, ruta] of Object.entries(PAG)) {
  if (SOLO && !SOLO.includes(nombre)) continue
  for (const despues of [false, true]) {
    const ctx = await browser.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: movil ? 2 : 1, isMobile: movil, hasTouch: movil, locale: 'es-ES', colorScheme: 'dark', userAgent: movil ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : undefined })
    await ctx.addInitScript(sembrar, 'user-1')
    let n = 0
    await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com\/.*\.(png|jpg|webp)|\/escaneo\/|\/.netlify\/functions\/escaneo/, (r) => {
      const u = r.request().url()
      if (/logo|images\.tcggo\.com\/(sv|swsh|me)\d+\.png/.test(u) && !/-s\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svgLogo(u.match(/(sv\d+|swsh\d+|me\d+)/)?.[1] || 'set') })
      if (/-s\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="14" fill="none" stroke="#9ab" stroke-width="4"/></svg>' })
      if (/noticia/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#1e5175"/><circle cx="560" cy="200" r="120" fill="#2a6b96"/><rect x="80" y="260" width="300" height="120" rx="12" fill="#e4b44a"/></svg>' })
      return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svgCarta(n++) })
    })
    await ctx.route(/r2\.limitlesstcg\.net|raw\.githubusercontent\.com|cdn\.jsdelivr\.net|\/sprite\//, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="68" height="56"><circle cx="34" cy="30" r="20" fill="#e8763a"/><circle cx="26" cy="26" r="3" fill="#222"/><circle cx="42" cy="26" r="3" fill="#222"/></svg>' }))
    await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    const page = await ctx.newPage()
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    if (despues) await page.addStyleTag({ content: CSS })
    await page.waitForTimeout(2500)
    if (despues) await page.addStyleTag({ content: CSS })
    await page.waitForTimeout(300)
    const buf = await page.screenshot({ type: 'jpeg', quality: 80 })
    fs.writeFileSync(`${DIR}/${nombre}-${movil ? 'm' : 'pc'}-${despues ? 'despues' : 'antes'}.jpg`, buf)
    await ctx.close()
  }
  console.log(nombre, movil ? 'móvil' : 'PC', 'ok')
}
await browser.close()
