import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

// Tanda 315: el resto de la escala de color.
//
// De la lista que aprobó PINGU. Al medirlo de verdad, los «502 colores a
// mano» no eran 502 descuidos: casi todos son colores FIJOS de la marca
// que NO pueden seguir al tema porque llevan texto blanco encima. Lo que
// hacía falta no era sustituirlos por tokens semánticos —eso los habría
// roto— sino ponerles nombre para que se vea que son fijos a propósito.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const HOJAS = readdirSync(`${RAIZ}/css`).filter((f) => f.endsWith('.css')).map((f) => `css/${f}`)
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<![:'"`])\/\/[^\n]*/g, '')
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El blanco que va sobre un color tiene nombre propio ──')
{
  // `--white` es la SUPERFICIE de la página y en oscuro vale #182430, o
  // sea negro. Pero en 62 sitios el blanco es blanco porque va encima de
  // un color. Iban a mano, y eso es una trampa: cualquiera que «ordene»
  // un `#fff` a `var(--white)` deja letra negra sobre azul sin que nada
  // dé error.
  const style = sinComentarios(leer('css/style.css'))
  const claro = style.match(/^:root\s*\{([\s\S]*?)\n\}/m)?.[1] || ''
  const oscuro = style.match(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/)?.[1] || ''
  check('existe --blanco-fijo', /--blanco-fijo:\s*#fff/.test(claro))
  // LA FORMA: los tokens «sólidos» son los que llevan texto blanco
  // encima, y por eso NO pueden tener versión clara en el tema oscuro.
  // Si alguien se la diera, el blanco se quedaría sin contraste — que es
  // justo lo que le pasó al enlace de salto en la tanda 313.
  const FIJOS = ['--blanco-fijo', '--danger-solid', '--navy-solid', '--navy-solid-dark', '--navy-solid-light',
                 '--arte-verde', '--arte-azul', '--arte-ambar', '--arte-cian', '--arte-morado', '--arte-rosa']
  const redefinidos = FIJOS.filter((t) => new RegExp(t + '\\s*:').test(oscuro))
  check('ningún token fijo se redefine en el tema oscuro', redefinidos.length === 0, redefinidos.join(', '))
  const sinDefinir = FIJOS.filter((t) => !new RegExp(t + '\\s*:').test(claro))
  check('  …y todos están definidos', sinDefinir.length === 0, sinDefinir.join(', '))

  // Y ya no queda ni un `#fff` suelto en ninguna hoja.
  const sueltos = []
  for (const hoja of HOJAS) {
    for (const m of sinComentarios(leer(hoja)).matchAll(/([a-z-]+)\s*:\s*([^;{}]*#fff\b[^;{}]*)/gi)) {
      if (m[1] === '--blanco-fijo') continue
      sueltos.push(`${hoja}: ${m[1]}`)
    }
  }
  check('ninguna hoja escribe #fff a mano', sueltos.length === 0, sueltos.slice(0, 5).join(', '))

  // Medido: el token vale lo mismo en los dos temas.
  for (const tema of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
    await page.addInitScript((t) => localStorage.setItem('pokedoc-theme', t), tema)
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    const v = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement)
      return { fijo: s.getPropertyValue('--blanco-fijo').trim(), superficie: s.getPropertyValue('--white').trim() }
    })
    check(`[${tema}] --blanco-fijo es blanco`, /#fff|rgb\(255, 255, 255\)/i.test(v.fijo), v.fijo)
    if (tema === 'dark') check('  …mientras --white NO lo es', !/#fff/i.test(v.superficie), v.superficie)
    await page.close()
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La paleta de arte vive en un solo sitio ──')
{
  // Los seis degradados de tarjeta estaban escritos DOS VECES —en
  // components.css y en torneos.css, los mismos seis en distinto orden—
  // así que cambiar la paleta era cambiar doce degradados y acordarse de
  // los dos sitios.
  const style = sinComentarios(leer('css/style.css'))
  const ARTE = ['verde', 'azul', 'ambar', 'cian', 'morado', 'rosa']
  const faltan = ARTE.filter((c) => !new RegExp(`--arte-${c}:\\s*linear-gradient`).test(style))
  check('los seis degradados están en style.css', faltan.length === 0, faltan.join(', '))

  const aMano = []
  for (const hoja of HOJAS) {
    if (hoja === 'css/style.css') continue
    for (const m of sinComentarios(leer(hoja)).matchAll(/(\.(?:torneo-)?arte-\d)\s*\{([^}]*)\}/g)) {
      if (!/var\(--arte-/.test(m[2])) aMano.push(`${hoja}: ${m[1]}`)
    }
  }
  check('ninguna tarjeta escribe su degradado a mano', aMano.length === 0, aMano.join(', '))

  // Y las doce clases siguen existiendo: unificar no puede dejar sin
  // arte a media rejilla.
  const cuantas = HOJAS.reduce((n, h) =>
    n + [...sinComentarios(leer(h)).matchAll(/\.(?:torneo-)?arte-\d\s*\{/g)].length, 0)
  check('  …y siguen siendo doce', cuantas === 12, String(cuantas))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Ningún token se pide con un respaldo que ya no hace falta ──')
{
  // La norma sale de la tanda 310 con `--shadow-lg`: el respaldo existía
  // porque el token no, y mientras los dos convivan dicen cosas
  // distintas. Aquí se generaliza a TODOS los tokens en vez de vigilar
  // uno.
  //
  // La excepción, declarada: los tokens que pone el JavaScript en un
  // `style=` —el color de una chapa, el galón de una tarjeta, el índice
  // de una animación—. Ahí el respaldo ES el valor por defecto y tiene
  // que estar.
  const DESDE_JS = new Set(['--chapa', '--galon', '--i', '--vuelta', '--dx', '--dy'])
  const definidos = new Set()
  for (const hoja of HOJAS) {
    for (const m of leer(hoja).matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)) definidos.add(m[1])
  }
  const conRespaldo = []
  for (const hoja of HOJAS) {
    for (const m of sinComentarios(leer(hoja)).matchAll(/var\(\s*(--[a-z0-9-]+)\s*,/g)) {
      if (DESDE_JS.has(m[1])) continue
      if (definidos.has(m[1])) conRespaldo.push(`${hoja}: ${m[1]}`)
    }
  }
  check('ningún token existente se pide con respaldo',
    conRespaldo.length === 0, [...new Set(conRespaldo)].slice(0, 6).join(', '))
  check('  …y el barrido encuentra tokens que mirar', definidos.size > 40, `${definidos.size} tokens`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Y las tarjetas siguen teniendo su color ──')
{
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_CATEGORIAS__ = [{ id: 'cat-1', name: 'Mazos', slug: 'mazos' }]
    window.__FAKE_GUIAS__ = [1, 2, 3, 4, 5, 6].map((i) => ({
      id: `g${i}`, slug: `g${i}`, title: `Guía ${i}`, description: 'x', category_id: 'cat-1',
    }))
  })
  await page.goto(`${BASE}/aprender`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  const artes = await page.evaluate(() =>
    [...document.querySelectorAll('.guia-arte')].map((n) => getComputedStyle(n).backgroundImage))
  check('las seis tarjetas tienen arte', artes.length === 6, String(artes.length))
  check('  …y todas con un degradado de verdad',
    artes.every((a) => /gradient/.test(a)), artes.filter((a) => !/gradient/.test(a)).join(' | ').slice(0, 60))
  // Y son colores DISTINTOS: si la unificación hubiera dejado a las seis
  // apuntando al mismo token, la rejilla sería una pared de un color.
  check('  …y no todas del mismo color', new Set(artes).size >= 5, `${new Set(artes).size} distintos`)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
