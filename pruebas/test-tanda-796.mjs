// Tanda 796 — MV7 la carta del reto sale de un sobre, MV12 la carta vuelve a
// su hueco al cerrar la ficha, NU12 la hoja del binder gira sobre el lomo, y
// SI4 (resto): el arte de los torneos con los sprites del meta y la portada
// de una guía recortada sola a 16:9.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. En el código ──')
check('el sobre se abre al terminar EN la visita', /if \(terminado\(\)\) abrirSobre\(\$\('cdRecorte'\)\)/.test(leer('js/carta-del-dia-juego.js')))
check('la «×» de la ficha devuelve la carta a su hueco', /volverAlHueco\(\(\) => \$\('mcEditor'\)\.close\(\)\)/.test(leer('js/mi-coleccion.js')))
const css = leer('css/mi-coleccion.css')
check('la hoja gira sobre el lomo', /@keyframes mc-hoja-entra-derecha \{\s*from \{ opacity: 0\.5; transform: perspective\(1600px\) rotateY\(-62deg\); \}/.test(css))
check('los torneos piden el meta una vez por página', /pedido \|\|= supabase\.rpc\('meta_resumen'/.test(leer('js/torneos/arte-meta.js')))
check('la portada se recorta antes de subir', /uploadGuideImage\(currentSession\.user\.id, await recortarPortada\(portadaOriginal, \{ foco \}\)\)/.test(leer('js/editor-guia.js')))

console.log('── 2. En el navegador ──')
const b = await chromium.launch()
{
  const p = await b.newPage({ viewport: { width: 420, height: 800 } })
  await p.goto(`${BASE}/carta-del-dia.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2000)
  const r = await p.evaluate(async () => {
    const m = await import('/js/carta-del-dia-juego.js')
    const c = document.getElementById('cdRecorte')
    const abre = m.abrirSobre(c)
    const durante = { sobre: Boolean(c.querySelector('.cd-sobre')), sale: c.classList.contains('sale') }
    await new Promise((ok) => setTimeout(ok, 2000))
    return { abre, durante, despues: { sobre: Boolean(c.querySelector('.cd-sobre')), sale: c.classList.contains('sale') } }
  })
  check('MV7: el sobre se pone y la carta sale', r.abre && r.durante.sobre && r.durante.sale, JSON.stringify(r))
  check('  …y se quita solo con un temporizador (la 313)', !r.despues.sobre && !r.despues.sale, JSON.stringify(r))
  const pure = await p.evaluate(async () => {
    const { iconosDelMeta } = await import('/js/torneos/arte-meta.js')
    const { cajaDeRecorte } = await import('/js/recorte-portada.js')
    return {
      meta: iconosDelMeta([{ cuota: 5, iconos: ['gardevoir'] }, { cuota: 12, iconos: ['dragapult', 'dusknoir'] }, { cuota: 9, iconos: ['dragapult'] }, { cuota: 1, iconos: [] }, { cuota: 3, iconos: ['raging-bolt'] }]),
      ancha: cajaDeRecorte(4000, 1000), alta: cajaDeRecorte(1080, 1920), justa: cajaDeRecorte(1600, 900),
    }
  })
  check('SI4: los tres mazos de más cuota, sin repetir', pure.meta.join() === 'dragapult,gardevoir,raging-bolt', pure.meta.join())
  check('el recorte 16:9 por el centro, ancha y alta', JSON.stringify(pure.ancha) === JSON.stringify({ x: 1111, y: 0, w: 1778, h: 1000 }) && JSON.stringify(pure.alta) === JSON.stringify({ x: 0, y: 656, w: 1080, h: 608 }) && pure.justa.w === 1600 && pure.justa.h === 900, JSON.stringify(pure))
  const rec = await p.evaluate(async () => {
    const { recortarPortada } = await import('/js/recorte-portada.js')
    const c = document.createElement('canvas'); c.width = 600; c.height = 900
    c.getContext('2d').fillRect(0, 0, 600, 900)
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'))
    const salida = await recortarPortada(new File([blob], 'foto.png', { type: 'image/png' }))
    const bm = await createImageBitmap(salida)
    return { w: bm.width, h: bm.height, tipo: salida.type, nombre: salida.name }
  })
  check('  …y de verdad: una foto vertical sale apaisada', rec.w === 600 && rec.h === 338 && rec.tipo === 'image/png', JSON.stringify(rec))
  await p.close()
}
{
  const ctx = await b.newContext({ reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/carta-del-dia.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)
  const r = await p.evaluate(async () => (await import('/js/carta-del-dia-juego.js')).abrirSobre(document.getElementById('cdRecorte')))
  check('con «menos movimiento», ni sobre', r === false, String(r))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
