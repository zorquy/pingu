// Tres paneles de Mi colección (A, B, C) sobre la web de verdad (la copia
// servida con las tiras), con una hoja encima por variante.
import { chromium, sembrar, BASE } from './fixtures-app.mjs'
import fs from 'node:fs'
const DIR = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/fiel/panel'
fs.mkdirSync(DIR, { recursive: true })
const NOMBRES = ['Pikachu ex', 'Charizard ex', 'Gardevoir ex', 'Dragapult ex', 'Raichu', 'Mew ex', 'Snorlax', 'Lugia V']
const COL = ['#f2c14e', '#e0552b', '#7fd3a1', '#8e6fd8', '#f2c14e', '#e98fc0', '#b7b7b7', '#5fa8e0']
const svgCarta = (i) => `<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="11" fill="${COL[i%8]}"/><rect x="12" y="34" width="221" height="150" rx="5" fill="#1b1e21" opacity=".75"/><circle cx="122" cy="109" r="46" fill="${COL[(i+3)%8]}" opacity=".9"/><text x="16" y="24" font-size="16" font-weight="800" fill="#1a1408" font-family="Inter,sans-serif">${NOMBRES[i%8]}</text><text x="229" y="24" font-size="13" font-weight="700" fill="#1a1408" text-anchor="end" font-family="Inter,sans-serif">${[330,330,310,320,120,180,150,220][i%8]} PS</text><rect x="12" y="200" width="221" height="2" fill="#1a1408" opacity=".25"/><text x="16" y="236" font-size="12" font-weight="700" fill="#1a1408" font-family="Inter,sans-serif">${['Rayo tornado','Llamarada carmesí','Sueño enigmático','Vuelo fantasma','Chispa','Génesis','Cuerpo pesado','Aerotormenta'][i%8]}</text><text x="229" y="236" font-size="12" font-weight="800" fill="#1a1408" text-anchor="end" font-family="Inter,sans-serif">${[120,180,190,200,60,30,90,210][i%8]}</text><text x="16" y="326" font-size="10" font-weight="700" fill="#1a1408" font-family="Inter,sans-serif">SV08 · ${(i*17%191)+1}/191</text></svg>`
const svgLogo = (code) => `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="110" viewBox="0 0 300 110"><text x="150" y="58" font-size="44" text-anchor="middle" font-family="Outfit,Inter,sans-serif" font-weight="800" fill="#f2c14e" letter-spacing="2">${code.toUpperCase()}</text><text x="150" y="88" font-size="16" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" fill="#eef0f2" opacity=".85">POKÉMON TCG</text></svg>`

// Lo común: la cartera con la gráfica arriba y las cuatro tiras; nada más.
const COMUN = `
.mc-cartera-lado, #mcCambios, #mcMes, #mcMas, #mcAlertas, .mc-nota, #mcCarteraGrafica .subtext, .mc-cartera-reparto, #mcCompartir, #mcMasEstadisticas, #mcFuente { display: none !important; }
#mcPanelResumen .mc-cartera { grid-template-columns: minmax(0, 1fr) !important; }
.mc-cartera-etiqueta { font-size: var(--t-sm) !important; color: var(--text-mid) !important; }
.mc-vistazo-cabecera .mc-subtitulo { font-size: var(--t-lg) !important; }
`
const VARIANTES = {
  // A · CARTERA: la gráfica grande a lo ancho, cuatro tiras de ocho y las
  // expansiones como baldosas con su logo.
  a: COMUN + `
    .mc-cartera-cifra { font-size: 56px !important; }
    .mc-cartera .mc-valor-lienzo, .mc-cartera-esq-lienzo { height: 200px !important; }
    #mcPanelResumen .mc-vistazo-cartas { grid-template-columns: repeat(8, minmax(0, 1fr)) !important; }
    #mcPanelResumen .mc-set-filas { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: var(--e-md) !important; }
    .mc-set-fila { display: grid !important; grid-template-columns: 1fr !important; gap: var(--e-sm) !important; padding: var(--e-md) !important; border: 1px solid var(--border) !important; border-radius: var(--radius-lg) !important; background: var(--white) !important; text-align: left; }
    .mc-set-fila-logo { display: grid !important; place-items: center !important; width: 100% !important; height: 72px !important; }
    .mc-set-fila-logo img { max-height: 64px !important; width: auto !important; max-width: 90% !important; }
    .mc-set-fila > em { justify-self: end; }
    @media (max-width: 1099px) { #mcPanelResumen .mc-vistazo-cartas { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }
    @media (max-width: 600px) { .mc-cartera-cifra { font-size: 44px !important; } .mc-cartera .mc-valor-lienzo { height: 200px !important; } #mcPanelResumen .mc-vistazo-cartas { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } #mcPanelResumen .mc-set-filas { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } #mcVistazoSets .mc-set-fila:nth-child(n + 3) { display: grid !important; } #mcVistazoSets .mc-set-fila:nth-child(n + 5) { display: none !important; } }
  `,
  // B · VITRINA: arriba la cartera y, a su lado, LA carta que más se mueve en
  // grande; el Ranking con las tres primeras grandes; lo demás, tiras.
  b: COMUN + `
    @media (min-width: 1100px) {
      #mcPanelResumen .mc-cartera { grid-template-columns: minmax(0, 1fr) 300px !important; column-gap: var(--e-xl) !important; }
      #mcPanelResumen .mc-cartera > * { grid-column: 1; }
      #mcPanelResumen .mc-cartera > .mc-hero-mov { grid-column: 2; grid-row: 1 / span 6; }
      .mc-cartera .mc-valor-lienzo, .mc-cartera-esq-lienzo { height: 176px !important; }
    }
    .mc-hero-mov { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: var(--e-md); align-items: center; align-self: center; padding: var(--e-md); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg); }
    .mc-hero-mov .mc-vistazo-carta { display: block; width: 120px; aspect-ratio: 245/342; border-radius: 6px; overflow: hidden; }
    .mc-hero-mov .mc-vistazo-carta img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .mc-hero-mov small { display: block; color: var(--text-mid); font-size: var(--t-xs); }
    .mc-hero-mov b { display: block; font-family: var(--font-display); font-size: var(--t-xl); line-height: 1.1; margin-top: 4px; }
    .mc-hero-mov em { display: block; font-style: normal; font-weight: 700; font-size: var(--t-lg); color: var(--success); margin-top: 2px; }
    .mc-hero-mov span { display: block; color: var(--text-mid); font-size: var(--t-sm); margin-top: 2px; }
    #mcMovidas .mc-vistazo-cartas > :first-child { display: none; }
    #mcPanelResumen #mcValiosas .mc-vistazo-cartas { grid-template-columns: repeat(60, minmax(0, 1fr)) !important; grid-auto-rows: auto !important; row-gap: var(--e-lg) !important; column-gap: var(--e-sm) !important; }
    #mcValiosas .mc-vistazo-ficha:nth-child(-n + 3) { grid-column: span 20; }
    #mcValiosas .mc-vistazo-ficha:nth-child(-n + 3) .mc-vistazo-carta { max-width: 180px; margin: 0 auto; }
    #mcValiosas .mc-vistazo-ficha:nth-child(-n + 3) b { font-size: var(--t-xl); }
    #mcValiosas .mc-vistazo-ficha:nth-child(n + 4) { grid-column: span 12; }
    #mcValiosas .mc-vistazo-ficha:nth-child(n + 4) .mc-vistazo-carta { max-width: 120px; margin: 0 auto; }
    #mcValiosas .mc-vistazo-ficha:nth-child(1)::before { content: '1'; } #mcValiosas .mc-vistazo-ficha:nth-child(2)::before { content: '2'; } #mcValiosas .mc-vistazo-ficha:nth-child(3)::before { content: '3'; }
    #mcValiosas .mc-vistazo-ficha { position: relative; }
    #mcValiosas .mc-vistazo-ficha:nth-child(-n + 3)::before { position: absolute; top: 8px; left: calc(50% - 90px + 8px); z-index: 1; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--white); color: var(--text); font-family: var(--font-display); font-weight: 800; font-size: var(--t-sm); border: 1px solid var(--border); }
    @media (max-width: 1099px) { .mc-hero-mov { margin-top: var(--e-md); } #mcPanelResumen .mc-vistazo-cartas { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }
    @media (max-width: 600px) { #mcMovidas .mc-vistazo-cartas, #mcUltimas .mc-vistazo-cartas { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } #mcPanelResumen #mcValiosas .mc-vistazo-cartas { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } #mcValiosas .mc-vistazo-ficha { grid-column: auto !important; } #mcValiosas .mc-vistazo-ficha .mc-vistazo-carta { max-width: none; } #mcValiosas .mc-vistazo-ficha:nth-child(-n + 3)::before { left: 8px; } #mcValiosas .mc-vistazo-ficha:nth-child(n + 4) { display: none; } }
  `,
  // C · MOSAICO: cuatro baldosas iguales, dos y dos, cada una con sus cuatro
  // cartas; la cartera es la primera. Todo cabe en una pantalla.
  c: COMUN + `
    @media (min-width: 1100px) {
      #mcPanelResumen { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: var(--e-lg) !important; }
      #mcValorCaja { grid-column: 1 / -1; }
      #mcPanelResumen .mc-cartera { display: grid !important; grid-template-columns: 320px minmax(0, 1fr) !important; column-gap: var(--e-xl) !important; align-items: center !important; }
      #mcPanelResumen .mc-cartera > * { grid-column: 1; }
      #mcPanelResumen .mc-cartera > .mc-cartera-grafica { grid-column: 2; grid-row: 1 / span 4; }
      .mc-cartera .mc-valor-lienzo, .mc-cartera-esq-lienzo { height: 150px !important; }
      #mcPanelResumen .mc-vistazo-cartas { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
      #mcVistazoSets { grid-column: 1 / -1; }
      #mcPanelResumen .mc-set-filas { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
    }
    .mc-cartera-cifra { font-size: 48px !important; }
    @media (max-width: 1099px) { #mcPanelResumen .mc-vistazo-cartas { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }
    @media (max-width: 600px) { #mcPanelResumen .mc-vistazo-cartas { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } .mc-vistazo-ficha small { display: none; } }
  `,
}
// B: la carta que más se mueve, en grande, al lado de la gráfica.
const HERO_JS = () => {
  const f = document.querySelector('#mcMovidas .mc-vistazo-ficha')
  const cartera = document.querySelector('#mcValorCaja')
  if (!f || !cartera) return
  const img = f.querySelector('img')?.cloneNode(true)
  const h = document.createElement('div'); h.className = 'mc-hero-mov'
  h.innerHTML = `<span class="mc-vistazo-carta"></span><div><small>La que más se mueve esta semana</small><b>${f.querySelector('small')?.textContent || ''}</b><em>${f.querySelector('.mc-ficha-cambio')?.textContent || ''}</em><span>${f.querySelector('b')?.textContent || ''} hoy</span></div>`
  if (img) h.querySelector('.mc-vistazo-carta').append(img)
  cartera.append(h)
}
const browser = await chromium.launch()
for (const movil of [false, true]) for (const [v, css] of Object.entries(VARIANTES)) {
  const ctx = await browser.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: movil ? 2 : 1, isMobile: movil, hasTouch: movil, locale: 'es-ES', colorScheme: 'dark', userAgent: movil ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : undefined })
  await ctx.addInitScript(sembrar, 'user-1')
  let n = 0
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com\/.*\.(png|jpg|webp)|\/escaneo\/|\/.netlify\/functions\/escaneo/, (r) => {
    const u = r.request().url()
    if (/logo|images\.tcggo\.com\/(sv|swsh|me)\d+\.png/.test(u) && !/-s\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svgLogo(u.match(/(sv\d+|swsh\d+|me\d+)/)?.[1] || 'set') })
    if (/-s\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="14" fill="none" stroke="#9ab" stroke-width="4"/></svg>' })
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svgCarta(n++) })
  })
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  await page.goto(`${BASE}/mi-coleccion`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(2500)
  await page.addStyleTag({ content: css })
  if (v === 'b') await page.evaluate(HERO_JS)
  await page.waitForTimeout(400)
  if (movil) {
    fs.writeFileSync(`${DIR}/${v}-m-1.jpg`, await page.screenshot({ type: 'jpeg', quality: 80 }))
    await page.evaluate(() => scrollTo(0, 760)); await page.waitForTimeout(400)
    fs.writeFileSync(`${DIR}/${v}-m-2.jpg`, await page.screenshot({ type: 'jpeg', quality: 80 }))
  } else {
    fs.writeFileSync(`${DIR}/${v}-pc.jpg`, await page.screenshot({ type: 'jpeg', quality: 80, fullPage: true }))
  }
  await ctx.close()
  console.log(v, movil ? 'móvil' : 'PC', 'ok')
}
await browser.close()
