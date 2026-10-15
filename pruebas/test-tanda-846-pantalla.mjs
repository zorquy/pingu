// Tanda 846: /aprender, compacto. PINGU: «los filtros ocupan demasiado y las
// guías están muy muy abajo, sobre todo en móviles. Hazmelo más moderno».
//
// Se mira: que en el móvil la primera guía empiece en la primera pantalla
// (antes, a más de 1.800 px), que cada fila de chips sea UNA línea, que la
// primera vaya en tarjeta y las demás en filas, que el buscador filtre sin
// perder el foco, «Con curso», y que en el PC la primera sea la grande.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ahora = Date.now()
const CATS = ['Primeros pasos', 'Comprar', 'Identificar cartas', 'Historia & curiosidades', 'Mazos & estrategia'].map((name, i) => ({ id: `cat-${i + 1}`, slug: `tema-${i + 1}`, name, description: '', order_pos: i }))
const NIV = ['beginner', 'intermediate', 'advanced']
const TITULOS = ['3 claves mentales para competir mejor', 'Cómo se juega a Pokémon TCG: tu primera partida', '¿Puedo atacar ya? Cómo funciona la energía', 'Cómo distinguir una carta falsa', 'Dónde comprar sobres sin que te timen', 'La historia del Charizard de Base', 'Tu primer mazo de 60', 'Rarezas: qué significa cada símbolo', 'El formato Estándar en 5 minutos', 'Cómo leer una carta', 'Mulligan y manos iniciales', 'Cuidar tus cartas']
const GUIAS = TITULOS.map((title, i) => ({
  id: `guia-${i + 1}`, slug: `guia-${i + 1}`, title, description: 'Lo que vas a encontrar dentro, en dos líneas para que se vea cómo queda.',
  kind: 'guide', category_id: CATS[i % 5].id, level: NIV[i % 3], guide_rarity: 'bronze', estimated_mins: 5 + i,
  author_id: 'admin-1', review_status: 'published', published_at: new Date(ahora - (i + 1) * 86400e3).toISOString(),
  cover_image: i % 3 === 0 ? '/fotos/foto1.svg' : null,
  blocks: i % 2 === 0 ? Array.from({ length: 4 }, () => ({ type: 'quiz' })) : [],
}))
const PROGRESO = [
  { user_id: 'user-1', guide_id: 'guia-3', status: 'in_progress', current_block: 3, read_at: null, started_at: new Date(ahora - 3600e3).toISOString() },
  { user_id: 'user-1', guide_id: 'guia-1', status: 'completed', current_block: 4, read_at: new Date(ahora - 600e3).toISOString(), started_at: new Date(ahora - 600e3).toISOString() },
]

const b = await chromium.launch()
async function abrir({ movil = false, sesion = 'user-1' } = {}) {
  const ctx = await b.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES' })
  await ctx.addInitScript(([s, c, g, p]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_CATEGORIAS__ = c
    window.__FAKE_GUIAS__ = g
    window.__FAKE_PROGRESO__ = p
  }, [sesion, CATS, GUIAS, PROGRESO])
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/aprender.html`, { waitUntil: 'load' })
  await p.waitForTimeout(1600)
  return { p, ctx, errores }
}

console.log('── 1. En el móvil ──')
{
  const { p, ctx, errores } = await abrir({ movil: true })
  check('sin errores', !errores.length, errores.join(' | '))
  const alto = await p.evaluate(() => innerHeight)
  const primera = await p.locator('#apLista .guia-tarjeta').first().boundingBox()
  check('la primera guía empieza en la primera pantalla', primera && primera.y < alto * 0.95, `${primera?.y} de ${alto}`)
  const sigue = await p.locator('.aprender-seguir').boundingBox()
  check('«Sigue donde lo dejaste» es una fila (menos de 100 px)', sigue && sigue.height < 100, String(sigue?.height))
  check('  …con el curso a medias y su bloque', /Bloque 3 de 4/.test(await p.locator('.aprender-seguir').innerText()))
  // Desde la 865 los temas son baldosas (.ap-baldosas), no chips.
  for (const sel of ['.ap-baldosas', '.ap-interruptores']) {
    const filas = await p.$eval(sel, (el) => new Set([...el.children].map((c) => { const r = c.getBoundingClientRect(); return Math.round((r.top + r.bottom) / 2) })).size)
    check(`${sel}: los chips van en UNA línea`, filas === 1, String(filas))
  }
  const sale = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  check('  …y deslizan sin sacar la página de la pantalla', sale <= 1, `${sale}px`)
  check('la primera en tarjeta y las otras 11 en filas', (await p.locator('#apLista .guia-tarjeta').count()) === 1 && (await p.locator('.guia-fila').count()) === 11)
  const fila = await p.locator('.guia-fila').first().boundingBox()
  check('  …cada fila mide menos de 110 px y se pulsa entera', fila && fila.height < 110 && fila.height >= 44, String(fila?.height))
  check('  …lleva a su guía', /^\/guia\/guia-/.test((await p.locator('.guia-fila').first().getAttribute('href')) || ''))
  check('  …y dice si la hiciste', /Curso hecho/.test(await p.locator('#apLista').innerText()))
  await p.screenshot({ path: '/tmp/claude-0/ap-846-movil.png' })
  // El buscador: filtra y no pierde el foco.
  await p.locator('#apBuscar').fill('carta')
  await p.waitForTimeout(200)
  const n = await p.locator('#apLista .guia-tarjeta, #apLista .guia-fila').count()
  const esperadas = GUIAS.filter((g) => /carta/i.test(g.title + g.description)).length
  check('el buscador filtra por título y descripción', n === esperadas, `${n} vs ${esperadas}`)
  check('  …sin perder el foco', await p.evaluate(() => document.activeElement?.id === 'apBuscar'))
  check('  …y la cuenta lo dice', (await p.locator('#apCuenta').innerText()).toLowerCase().includes(`${esperadas} guía`))
  await p.locator('#apBuscar').fill('zzzz')
  await p.waitForTimeout(200)
  check('  …sin nada, lo dice', /Ninguna guía habla de eso/.test(await p.locator('#apLista').innerText()))
  await p.locator('#apBuscar').fill('')
  await p.waitForTimeout(200)
  await p.locator('[data-concurso]').click()
  await p.waitForTimeout(200)
  const cursos = GUIAS.filter((g) => g.blocks.length).length
  check('«Con curso» deja solo las que tienen curso', (await p.locator('#apLista .guia-tarjeta, #apLista .guia-fila').count()) === cursos)
  check('  …y su chip dice que está puesto', (await p.locator('[data-concurso]').getAttribute('aria-pressed')) === 'true')
  await p.locator('[data-concurso]').click()
  await p.waitForTimeout(200)
  check('  …y se quita', (await p.locator('#apLista .guia-tarjeta, #apLista .guia-fila').count()) === GUIAS.length)
  await ctx.close()
}

console.log('── 2. En el PC ──')
{
  const { p, ctx, errores } = await abrir()
  check('sin errores', !errores.length, errores.join(' | '))
  check('todas en tarjeta, sin filas', (await p.locator('.guia-tarjeta').count()) === GUIAS.length && !(await p.locator('.guia-fila').count()))
  const [g1, g2] = await p.$$eval('.ap-rejilla .guia-tarjeta', (ts) => ts.slice(0, 2).map((t) => t.getBoundingClientRect().width))
  check('la primera es la grande (dos pistas)', g1 > g2 * 1.8, `${g1} / ${g2}`)
  const dir = await p.$eval('.ap-rejilla .guia-tarjeta-enlace', (e) => getComputedStyle(e).flexDirection)
  check('  …con la foto al lado del texto', dir === 'row', dir)
  await p.screenshot({ path: '/tmp/claude-0/ap-846-pc.png' })
  await ctx.close()
}
{
  const { p, ctx, errores } = await abrir({ movil: true, sesion: 'none' })
  check('sin cuenta: sin «Sigue», sin medallero, y las guías igual', !errores.length && !(await p.locator('.aprender-seguir').count()) && !(await p.locator('#medallero').isVisible()) && (await p.locator('.guia-fila').count()) === 11, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTODO OK')
process.exit(fails ? 1 : 0)
