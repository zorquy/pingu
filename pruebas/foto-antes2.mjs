// El «antes» a escala 1 (para incrustarlo en la propuesta), en oscuro, que es lo que usa PINGU.
import { chromium, sembrar, BASE } from './fixtures-app.mjs'
import fs from 'node:fs'
const OUT = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/total/r10'
const PAG = { vportada: ['/', false], vcartas: ['/cartas', false], vforo: ['/foro', false], vtorneos: ['/torneos', false], vperfil: ['/usuario/Misty', false], vmportada: ['/', true], vmcartas: ['/cartas', true], vmforo: ['/foro', true] }
const svgCarta = (i) => `<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" rx="10" fill="${['#2f6fb0','#c8512a','#2f8f5e','#7b4fb3','#b0872f'][i%5]}"/><rect x="18" y="40" width="209" height="150" rx="6" fill="rgba(255,255,255,.25)"/><text x="122" y="290" font-size="22" text-anchor="middle" fill="#fff" font-family="sans-serif">${['Pikachu','Charizard','Gardevoir','Dragapult','Raichu'][i%5]}</text></svg>`
const browser = await chromium.launch()
let n = 0
for (const [nombre, [ruta, movil]] of Object.entries(PAG)) {
  const ctx = await browser.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: movil, hasTouch: movil, locale: 'es-ES', colorScheme: 'dark', userAgent: movil ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : undefined })
  await ctx.addInitScript(sembrar, 'user-1')
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com\/.*\.(png|jpg|webp)|\/escaneo\/|\/.netlify\/functions\/escaneo/, (r) => {
    const u = r.request().url()
    if (/logo|images\.tcggo\.com\/(sv|swsh|me)\d+\.png/.test(u) && !/-s\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="110"><rect width="300" height="110" rx="10" fill="#b58a2c"/><text x="150" y="70" font-size="34" text-anchor="middle" font-family="sans-serif" font-weight="900" fill="#fff">${u.match(/(sv\d+|swsh\d+|me\d+)/)?.[1]?.toUpperCase() || 'SET'}</text></svg>` })
    if (/-s\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="16" fill="#9ab"/></svg>' })
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svgCarta(n++) })
  })
  await ctx.route(/r2\.limitlesstcg\.net|raw\.githubusercontent\.com|cdn\.jsdelivr\.net|\/sprite\//, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="68" height="56"><circle cx="34" cy="30" r="20" fill="#e8763a"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(2500)
  const buf = await page.screenshot({ type: 'jpeg', quality: 72 })
  fs.writeFileSync(`${OUT}/a-${nombre}.txt`, `data:image/jpeg;base64,${buf.toString('base64')}`)
  console.log(nombre, Math.round(buf.length / 1024), 'KB')
  await ctx.close()
}
await browser.close()
