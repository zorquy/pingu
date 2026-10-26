// Tanda 1016 — la letra, opción B del repaso: los títulos en una letra y la
// marca y las cifras grandes en otra (`--font-marca`). Desde la 1018 las dos
// son Outfit (PINGU eligió la B2 de «PokeDoc como app») y el cuerpo sigue
// en Inter; lo que la prueba vigila es que cada sitio pida SU token.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Los tokens ──')
{
  const css = leer('css/style.css')
  check('--font-display y --font-marca son Outfit (1018), con Inter detrás', /--font-display: 'Outfit', 'Inter', sans-serif;/.test(css) && /--font-marca: 'Outfit', 'Fredoka', 'Inter', sans-serif;/.test(css))
  check('Outfit se sirve desde casa, variable y solo latín', /font-family: 'Outfit';[\s\S]*?font-weight: 100 900;[\s\S]*?outfit-variable-latin\.woff2/.test(css))
  check('la marca y las cifras del perfil van en --font-marca', /\.nav-logo, \.auth-logo, \.pie-marca,\n\.perfil-cifra \.valor[^{]*\{\n  font-family: var\(--font-marca\);/.test(css))
  const hojas = ['mi-coleccion', 'torneos', 'retos', 'partidas', 'hoy', 'comunidad'].map((h) => [h, leer(`css/${h}.css`)])
  check('las cifras grandes de cada hoja piden --font-marca (cartera, marcador, retos, partidas, Hoy, Comunidad)', hojas.every(([, s]) => /var\(--font-marca\)/.test(s)), hojas.filter(([, s]) => !/var\(--font-marca\)/.test(s)).map(([h]) => h).join())
  check('  …y ninguna hoja sigue nombrando Fredoka a pelo fuera de style.css', !/Fredoka/.test(hojas.map(([, s]) => s).join('')))
}

const b = await chromium.launch()
async function abrir(ruta) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1'; window.__FAKE_CARTAS__ = [{ id: 'sv8-1', market: 'WEST', set_id: 'sv8', local_id: '1', name: 'Bulbasaur', name_es: 'Bulbasaur', image_path: 'sv/sv8/1', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }]; window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Corona Astral', serie_id: 'sv', market: 'WEST', card_count_official: 1, card_count_total: 1 }]; window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'user-1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal' }] })
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, errores }
}
const fuente = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).fontFamily : null }, sel)

console.log('\n── 2. En pantalla ──')
{
  const { p, ctx, errores } = await abrir('/aprender.html')
  const h1 = await fuente(p, '.ap-cab h1'), logo = await fuente(p, '.nav-logo'), boton = await fuente(p, '.btn-primary'), pie = await fuente(p, '.pie-marca')
  check('el título de la página va en Outfit, sin Fredoka', /^"?Outfit/.test(h1 || '') && !/Fredoka/.test(h1 || ''), h1)
  check('  …el logo de arriba y el del pie, en Outfit (la marca)', /^"?Outfit/.test(logo || '') && /^"?Outfit/.test(pie || ''), `${logo} / ${pie}`)
  check('  …y los botones en Inter (el cuerpo)', /^"?Inter/.test(boton || '') && !/Outfit|Fredoka/.test(boton || '') && !errores.length, boton + ' ' + errores.join(' | '))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/mi-coleccion.html?ver=resumen')
  const cifra = await fuente(p, '.mc-cartera-cifra'), titulo = await fuente(p, '.mc-subtitulo')
  check('en Mi colección la cifra de la cartera y los subtítulos van en Outfit', (cifra === null || /^"?Outfit/.test(cifra)) && /^"?Outfit/.test(titulo || ''), `${cifra} / ${titulo}`)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/perfil.html')
  const valor = await fuente(p, '.perfil-cifra .valor')
  check('las cifras del perfil, en Outfit', valor === null || /^"?Outfit/.test(valor), valor)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
