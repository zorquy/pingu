// Tanda 1015 — Mi colección y torneo, de la propuesta del repaso: L7 el Panel
// compacto (una línea bajo «Estadísticas», las acciones en chips, «Colección
// pública» a Ajustes › Privacidad), L10 «Escribir una guía» solo el lápiz en
// el móvil, L11 la barra del catálogo en el móvil (buscador a todo el ancho,
// chips debajo), V3 la vitrina con su título y el chip del coste del
// constructor sin amarillo, y en el móvil la Pokédex a cuatro columnas con
// los que faltan apagados y la cabecera de una expansión a dos líneas. L8
// (la liga) la miran 635, 833 y 849 con la fila `torneo-mis-jornadas-proxima`.
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

console.log('── 1. Lo estático ──')
{
  check('L8: la próxima jornada lleva su clase y su aviso, y los chips J1–J3 se esconden con «Tus jornadas»', /torneo-mis-jornadas-proxima/.test(leer('js/torneos/jornadas.js')) && /Sin lista todavía\. Si no la envías antes, no juegas esta jornada\./.test(leer('js/torneos/jornadas.js')) && /con-mis-jornadas/.test(leer('js/torneos/torneo.js')) && /\.torneo-jornadas\.con-mis-jornadas \{ display: none; \}/.test(leer('css/torneos.css')))
  check('L7: el interruptor de «Colección pública» ya no está en Mi colección, sino en Ajustes › Privacidad', !/id="mcPublica"/.test(leer('mi-coleccion.html')) && /href="\/ajustes\?ver=privacidad"/.test(leer('mi-coleccion.html')) && /data-interruptor="coleccion_publica"/.test(leer('js/ajustes.js')) && /guardar\(\{ coleccion_publica: e\.target\.checked \}\)/.test(leer('js/ajustes.js')))
  check('móvil: la cabecera de una expansión va en una fila, con el nombre en su línea cortado con puntos (1020)', /\.mc-album-nombre \{\s*flex-wrap: nowrap;/.test(leer('css/mi-coleccion.css')) && /\.con-logo \.mc-album-titulo \{\s*white-space: nowrap;/.test(leer('css/mi-coleccion.css')))
  check('/cartas sale del generador con lo mismo', leer('cartas.html').includes('id="mcPublicaEstado"'))
}

const b = await chromium.launch()
const abrir = async (ruta, { viewport = { width: 1280, height: 900 }, init = '', espera = 3000 } = {}) => {
  const ctx = await b.newContext({ viewport, locale: 'es-ES', serviceWorkers: 'block', isMobile: viewport.width < 700, hasTouch: viewport.width < 700 })
  await ctx.addInitScript("window.__FAKE_SESSION__ = 'user-1'; window.__FAKE_CARTAS__ = [{ id: 'sv8-1', market: 'WEST', set_id: 'sv8', local_id: '1', name: 'Bulbasaur', name_es: 'Bulbasaur', dex_ids: [1], image_path: 'sv/sv8/1', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }, { id: 'sv8-2', market: 'WEST', set_id: 'sv8', local_id: '2', name: 'Bulbasaur', name_es: 'Bulbasaur', dex_ids: [1], image_path: 'sv/sv8/2', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }]; window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Corona Astral de Escarlata y Púrpura', serie_id: 'sv', market: 'WEST', card_count_official: 2, card_count_total: 2, logo_path: 'x/l' }]; window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'user-1', card_id: 'sv8-1', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal' }, { id: 'l2', user_id: 'user-1', card_id: 'sv8-2', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal' }];" + init)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' }))
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(espera)
  return { p, ctx, errores }
}

console.log('\n── 2. El Panel (L7) ──')
{
  const { p, ctx, errores } = await abrir('/mi-coleccion.html?ver=resumen', { espera: 3500 })
  const r = await p.evaluate(() => {
    const chips = [...document.querySelectorAll('.mc-accion-loseta')].map((c) => ({ t: c.textContent.trim(), h: Math.round(c.getBoundingClientRect().height), y: Math.round(c.getBoundingClientRect().top) }))
    return { linea: document.querySelector('.mc-vistazo-linea')?.textContent.trim(), chips, publica: !!document.getElementById('mcPublica'), estado: document.getElementById('mcPublicaEstado')?.textContent.trim(), ajustes: document.getElementById('mcPublicaAjustes')?.getAttribute('href') }
  })
  check('bajo «Estadísticas» va una línea con lo contado', /^2 cartas distintas · 1 copia repetida$/.test(r.linea || ''), r.linea)
  check('las acciones son chips de una fila (44 px), no losetas de 90', r.chips.length >= 3 && r.chips.every((c) => c.h <= 48) && new Set(r.chips.map((c) => c.y)).size === 1 && r.chips.map((c) => c.t).join('|') === 'Imagen|Importar CSV|Exportar CSV|Modo evento', JSON.stringify(r.chips))
  check('«Colección pública» ya no es un check aquí: se dice cómo está y se manda a Ajustes', !r.publica && /^Colección (pública|privada)$/.test(r.estado || '') && r.ajustes === '/ajustes?ver=privacidad' && !errores.length, JSON.stringify(r) + errores.join(' | '))
  await ctx.close()
}

console.log('\n── 3. Ajustes › Privacidad ──')
{
  const { p, ctx, errores } = await abrir('/ajustes.html?ver=privacidad')
  const sw = p.locator('[data-interruptor="coleccion_publica"]')
  check('el interruptor está, apagado para quien la tiene privada', (await sw.count()) === 1 && !(await sw.isChecked()) && !errores.length, errores.join(' | '))
  await sw.click()
  await p.waitForTimeout(800)
  const fila = await p.evaluate(() => (window.__TABLAS__?.user_profiles || []).find((x) => x.id === 'user-1')?.coleccion_publica)
  check('  …y al encenderlo se guarda en el perfil', fila === true && (await sw.isChecked()), String(fila))
  await ctx.close()
}

console.log('\n── 4. Aprender y el catálogo en el móvil (L10, L11) ──')
{
  const { p, ctx, errores } = await abrir('/aprender.html', { viewport: { width: 390, height: 800 } })
  const r = await p.evaluate(() => {
    const b = document.querySelector('.ap-escribir'), h = document.querySelector('.ap-cab h1')
    const rb = b.getBoundingClientRect(), rh = h.getBoundingClientRect()
    return { w: Math.round(rb.width), h: Math.round(rb.height), texto: b.innerText.trim(), svg: !!b.querySelector('svg'), aria: b.getAttribute('aria-label'), mismaLinea: Math.abs(rb.top + rb.height / 2 - (rh.top + rh.height / 2)) < 20 }
  })
  check('L10: «Escribir una guía» es solo el lápiz (44 px, con su etiqueta) y va en la línea del título', r.w >= 44 && r.h >= 44 && r.texto === '' && r.svg && r.aria === 'Escribir una guía' && r.mismaLinea && !errores.length, JSON.stringify(r) + errores.join(' | '))
  await ctx.close()
  const c = await abrir('/cartas.html', { viewport: { width: 390, height: 800 } })
  const k = await c.p.evaluate(() => {
    const busca = document.getElementById('mcEstanteriaBusca'), barra = document.querySelector('.mc-estanteria-barra')
    const orden = document.getElementById('mcEstanteriaOrdenAbrir').getBoundingClientRect()
    return { ancho: Math.round(busca.getBoundingClientRect().width), barra: Math.round(barra.getBoundingClientRect().width), alLado: Math.abs(orden.top - busca.getBoundingClientRect().top) < 8, desborda: barra.scrollWidth > barra.clientWidth + 1 }
  })
  // Los filtros de qué se ve se fueron a la hoja de «Orden» en la 1038.
  check('L11: el buscador del catálogo ocupa su fila con «Orden» al lado (1020), sin deslizar de lado', k.ancho >= k.barra * 0.6 && k.alLado && !k.desborda && !c.errores.length, JSON.stringify(k) + c.errores.join(' | '))
  await c.ctx.close()
}

console.log('\n── 5. La vitrina y el constructor (V3) ──')
{
  const { p, ctx } = await abrir('/perfil.html')
  const r = await p.evaluate(() => {
    const t = document.querySelector('#perfilVitrina .vitrina-cabeza .section-title')
    const a = document.querySelector('#perfilVitrina .vitrina-acciones')
    if (!t) return null
    const rt = t.getBoundingClientRect(), ra = a?.getBoundingClientRect()
    return { visible: rt.width > 20 && rt.height > 10, texto: t.textContent.trim(), mismaFila: ra ? Math.abs(rt.top + rt.height / 2 - (ra.top + ra.height / 2)) < 24 : null }
  })
  if (r) check('la vitrina enseña su título y los botones van en su fila', r.visible && r.texto === 'Vitrina' && r.mismaFila !== false, JSON.stringify(r))
  else console.log('  (sin vitrina en el doble: no se mira)')
  await ctx.close()
  const k = await abrir('/constructor.html')
  const z = await k.p.evaluate(() => {
    const c = document.getElementById('cmCoste'), ch = document.querySelector('.cm-hero-chapa')
    return { texto: document.getElementById('cmCosteBoton')?.textContent.trim(), fondo: c && getComputedStyle(c).backgroundColor, chapa: ch && getComputedStyle(ch).backgroundColor }
  })
  check('el coste del constructor es un chip como los demás, sin amarillo, y pregunta corto', z.texto === '¿Cuánto me falta?' && z.fondo && z.fondo === z.chapa, JSON.stringify(z))
  await k.ctx.close()
}

console.log('\n── 6. La Pokédex en el móvil ──')
{
  const { p, ctx, errores } = await abrir('/mi-coleccion.html?ver=pokedex', { viewport: { width: 390, height: 800 }, espera: 4000 })
  const r = await p.evaluate(() => {
    const es = [...document.querySelectorAll('.pdx-rejilla .pdx-especie')].slice(0, 12)
    const filas = new Set(es.map((e) => Math.round(e.getBoundingClientRect().top)))
    const falta = es.find((e) => !e.classList.contains('tengo'))
    const tengo = es.find((e) => e.classList.contains('tengo'))
    const oculto = (el, sel) => !el?.querySelector(sel) || el.querySelector(sel).getClientRects().length === 0
    return { porFila: es.length / filas.size, faltaSinTexto: falta ? oculto(falta, '.pdx-cuenta') && oculto(falta, '.pdx-nombre') : null, faltaApagado: falta ? Number(getComputedStyle(falta).opacity) < 1 : null, tengoConNombre: tengo ? !oculto(tengo, '.pdx-nombre') : null, n: es.length }
  })
  check('cuatro por fila; los que faltan, apagados y solo con el número; los tuyos, con su nombre', r.n >= 8 && Math.abs(r.porFila - 4) < 0.01 && r.faltaSinTexto && r.faltaApagado && r.tengoConNombre !== false && !errores.length, JSON.stringify(r) + errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
