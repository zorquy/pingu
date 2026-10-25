// Tanda 1011 — Mi colección por vistas y las rondas por import() (lo primero
// de la propuesta del repaso). El escáner, la selección múltiple, las carpetas
// (con dialogo-adorno), la Pokédex y el importador con la imagen viven en
// módulos que entran por import(): /cartas sin cuenta no baja ninguno. El CSS
// del escáner y de la Pokédex va en su hoja, inyectada por su módulo. Y en
// /torneo, ronda.js (el módulo más grande) sale del grafo estático.
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const PRUEBAS = new URL('..', import.meta.url).pathname
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const MODULOS = ['escaner-ui', 'seleccion', 'carpetas-ui', 'pokedex-ui', 'extras']

console.log('── 1. Lo estático ──')
{
  const main = leer('js/mi-coleccion.js')
  for (const m of MODULOS) {
    const src = leer(`js/mi-coleccion/${m}.js`)
    check(`${m}.js entra por import() y nunca por from, y se monta con ctx`, new RegExp(`import\\('\\./mi-coleccion/${m}\\.js'\\)\\.then\\(\\(m\\) => \\{ m\\.montar\\(ctx\\w+\\)`).test(main) && !new RegExp(`from '\\./mi-coleccion/${m}\\.js'`).test(main) && /^export function montar\(c\) \{\n  ctx = c\n(?:  hojaLista = hojaInyectada\('css\/mc-\w+\.css'\)\n)?  enganchar\(\)\n\}/m.test(src))
    // Un import() dentro de lo mudado apunta un directorio más abajo: 404 sin más aviso que esto.
    check(`  …y dentro no queda ningún import('./mi-coleccion/…')`, !/import\('\.\/mi-coleccion\//.test(src))
    // Sin identificadores libres: lo que no se importa ni se declara llega por ctx.
    const libres = execFileSync('node', [`${PRUEBAS}herramientas/libres.mjs`, `${RAIZ}/js/mi-coleccion/${m}.js`], { encoding: 'utf8' }).trim()
    check(`  …y sin identificadores libres`, /sin libres$/.test(libres), libres)
  }
  check('el principal ya no importa dialogo-adorno (lo trae carpetas-ui, con la Pokédex de especies y los sprites)', !/dialogo-adorno/.test(main) && /from '\.\/dialogo-adorno\.js'/.test(leer('js/mi-coleccion/carpetas-ui.js')))
  check('la rejilla lee la selección por marcadasAhora() (null sin el módulo) y la ficha, las cartas de la especie por cartasDeLaEspecieAhora()', /const marcadasAhora = \(\) => \(selMod \? selMod\.marcadasAhora\(\) : null\)/.test(main) && !/^let marcadas\b/m.test(main) && /cartasDeLaEspecieAhora\(\)\.find\(/.test(main) && !/^let cartasDeLaEspecie\b/m.test(main))
  check('la selección se baja sola en un rato libre cuando la colección es tuya, y «Seleccionar» la carga si llega antes', /if \(sesion\) \(window\.requestIdleCallback \|\| \(\(f\) => setTimeout\(f, 600\)\)\)\(\(\) => void seleccionModulo\(\)/.test(main) && /\$\('mcMarcarAbrir'\)\?\.addEventListener\('click', \(\) => void seleccionModulo\(\)/.test(main))
  check('sin carpetas (la lateral ya preguntó), la ficha esconde el bloque sin bajar el módulo', /if \(carpetas && !carpetasLista\.length && !carpetasMod\) \{\n    \$\('mcEdCarpetasBloque'\)\?\.classList\.add\('hidden'\)/.test(main))
  check('importar, exportar y la imagen entran al pulsar uno de sus tres botones', /closest\('#mcImportarAbrir, \.mc-importar-abrir, #mcExportar, #mcImagenCrear'\)/.test(main) && /extrasModulo\(\)\.then\(\(m\) => m\.pulsar\(b\)\)/.test(main) && /^export function pulsar\(boton\)/m.test(leer('js/mi-coleccion/extras.js')))
  const css = leer('css/mi-coleccion.css')
  check('el CSS del escáner y de la Pokédex ya no está en mi-coleccion.css', !/mc-escaner|#mcEscaner|\.pdx-|#pdx|mc-pokedex|#mcPdx|#mcPokedex/.test(css))
  check('  …sino en css/mc-escaner.css y css/mc-pokedex.css, con sus @media', existsSync(`${RAIZ}/css/mc-escaner.css`) && /\.mc-escaner \{/.test(leer('css/mc-escaner.css')) && /@media/.test(leer('css/mc-escaner.css')) && /\.pdx-rejilla|\.pdx-/.test(leer('css/mc-pokedex.css')) && /@media/.test(leer('css/mc-pokedex.css')))
  check('  …que inyecta su módulo y espera antes de pintar (748)', /hojaInyectada\('css\/mc-escaner\.css'\)/.test(leer('js/mi-coleccion/escaner-ui.js')) && /if \(!caja\) return\n  await hojaLista/.test(leer('js/mi-coleccion/escaner-ui.js')) && /hojaInyectada\('css\/mc-pokedex\.css'\)/.test(leer('js/mi-coleccion/pokedex-ui.js')) && (leer('js/mi-coleccion/pokedex-ui.js').match(/await hojaLista/g) || []).length === 2)
  const torneo = leer('js/torneos/torneo.js')
  check('/torneo baja ronda.js por import() justo antes de montarCiclo, y la gloria y el podio lo leen de ahí', !/from '\.\/ronda\.js'/.test(torneo) && /ronda = await import\('\.\/ronda\.js'\)\n  await ronda\.montarCiclo\(contexto\)/.test(torneo) && /ronda\?\.resumenDeGloria\(\)/.test(torneo) && (torneo.match(/ronda \? ronda\.podioDelTorneo\(\) : \[\]/g) || []).length === 2)
}

const b = await chromium.launch()
const descargas = async (ruta, init, espera = 3000) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  if (init) await ctx.addInitScript(init)
  const p = await ctx.newPage()
  const pedidos = new Set()
  const errores = []
  p.on('request', (r) => { const u = r.url(); if (/\.(js|css)(\?|$)/.test(u)) pedidos.add(u.replace(BASE + '/', '').replace(/\?.*$/, '')) })
  p.on('pageerror', (e) => errores.push(e.message))
  await p.goto(`${BASE}/${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(espera)
  return { p, ctx, pedidos, errores }
}
const deLosCinco = (pedidos) => [...pedidos].filter((x) => MODULOS.some((m) => x.endsWith(`/${m}.js`)) || /dialogo-adorno|mc-escaner\.css|mc-pokedex\.css/.test(x))

console.log('\n── 2. Quién baja qué ──')
{
  const c = await descargas('cartas.html', "window.__FAKE_SESSION__ = 'none'")
  check('/cartas sin cuenta no baja ninguno de los cinco ni sus hojas, y sin errores', deLosCinco(c.pedidos).length === 0 && c.pedidos.has('js/mi-coleccion.js') && !c.errores.length, deLosCinco(c.pedidos).join() + ' ' + c.errores.join(' | '))
  await c.ctx.close()
  const m = await descargas('mi-coleccion.html?ver=album', "window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal' }]")
  const suyos = deLosCinco(m.pedidos)
  check('tu colección baja la selección sola (en un rato libre) y nada más de los cinco, sin errores', suyos.some((x) => x.endsWith('/seleccion.js')) && suyos.every((x) => x.endsWith('/seleccion.js')) && !m.errores.length, suyos.join() + ' ' + m.errores.join(' | '))
  check('  …y la barra de marcar sigue escondida hasta que se pulsa', await m.p.evaluate(() => document.getElementById('mcMarcarBarra')?.classList.contains('hidden')))
  await m.ctx.close()
}

console.log('\n── 3. Los puentes pintan ──')
{
  const k = await descargas('mi-coleccion.html?ver=pokedex', "window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal' }]", 3500)
  const r = await k.p.evaluate(() => ({ mandos: !document.getElementById('mcPdxMandos')?.classList.contains('hidden'), rejilla: !!document.querySelector('#mcPokedexPanel .pdx-rejilla, #mcPokedexPanel [data-dex], #mcPokedexPanel .pdx-regiones'), hoja: !!document.querySelector('link[href="/css/mc-pokedex.css"]')?.sheet }))
  check('la Pokédex se abre por su puente: el módulo, su hoja (cargada) y la rejilla', k.pedidos.has('js/mi-coleccion/pokedex-ui.js') && r.hoja && r.mandos && r.rejilla && !k.errores.length, JSON.stringify(r) + ' ' + k.errores.join(' | '))
  await k.ctx.close()
  const e = await descargas('mi-coleccion.html?ver=buscar', null, 1500)
  await e.p.evaluate(() => document.dispatchEvent(new CustomEvent('pokedoc:escanear')))
  await e.p.waitForTimeout(1500)
  const s = await e.p.evaluate(() => ({ abierto: document.getElementById('mcEscanerCaja')?.open === true, hoja: !!document.querySelector('link[href="/css/mc-escaner.css"]')?.sheet, marco: getComputedStyle(document.getElementById('mcEscanerCaja')).position }))
  check('el escáner se abre por su puente con su hoja puesta', e.pedidos.has('js/mi-coleccion/escaner-ui.js') && s.abierto && s.hoja && s.marco === 'fixed' && !e.errores.length, JSON.stringify(s) + ' ' + e.errores.join(' | '))
  await e.ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
