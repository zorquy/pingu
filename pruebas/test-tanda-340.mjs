// Tanda 340 — el tipo que no conocemos, y la carta clicable desde
// cualquier sitio.
//
// PINGU, dos cosas del mismo mensaje:
//
//   · «la debilidad está pintada con el círculo blanco y es débil a
//     siniestro». El punto por defecto (#d8dee3) es casi el de Incolora
//     (#e6eaed), así que un tipo sin traducir no se veía como «no lo
//     sé»: se veía como OTRO TIPO. No faltaba un color, se decía uno
//     falso — y en una debilidad eso es decirle a alguien que su carta
//     es débil a otra cosa.
//   · «una carta debería ser clicable desde cualquier sitio». No lo era:
//     ni en la lista de un mazo de torneo (solo enlazaba el nombre del
//     pie, letra pequeña bajo un escaneo de 245 px) ni en una guía
//     (donde no enlazaba nada).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { nucleoDeCarta, TIPOS_CONOCIDOS, TIPOS_ES } from '/home/user/pingu/js/carta-nucleo.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = 'http://localhost:8892'
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const browser = await chromium.launch()

const MEW = (debilidad) => ({
  id: '30th-066', set_id: '30th', market: 'WEST', local_id: '066',
  name: 'Mew ex', name_es: 'Mew ex', image_path: 'sv/30th/66',
  category: 'Pokémon', hp: 160, types: ['Psíquico'], stage: 'Básico', retreat: 0,
  regulation_mark: 'J', detalle_at: 'x', detalle_lang: 'es',
  weaknesses: [{ type: debilidad, value: '×2' }],
  attacks: [{ name: 'Explosión Teleportadora', cost: ['Psíquico'], damage: '30' }],
})

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Un tipo que no conocemos NO se pinta como otro ──')
{
  check('los once tipos son los de la tabla de traducción',
    JSON.stringify(TIPOS_CONOCIDOS) === JSON.stringify(Object.keys(TIPOS_ES)))

  // Las grafías que sí conocemos siguen saliendo con su color.
  for (const escrito of ['Darkness', 'Oscuro', 'Oscuridad', 'Siniestro']) {
    const html = nucleoDeCarta(MEW(escrito), null)
    check(`«${escrito}» sale como Darkness`, /data-tipo="Darkness"/.test(html),
      html.match(/data-tipo="[^"]*"/g)?.join(' '))
  }

  // Y la que no: sale como DESCONOCIDA, no como Incolora.
  const raro = nucleoDeCarta(MEW('Tinieblas'), null)
  check('un tipo sin traducir sale marcado', /data-tipo="\?"/.test(raro),
    raro.match(/data-tipo="[^"]*"/g)?.join(' '))
  check('…y NO se hace pasar por Incolora', !/data-tipo="Colorless"[^>]*Tinieblas/.test(raro))
  check('…y lleva el valor crudo a la vista, para saber qué falta',
    /Tipo sin traducir: Tinieblas/.test(raro), raro.match(/title="[^"]*"/g)?.join(' '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Y en la página se VE distinto ──')
{
  // Comprobar que la clase está puesta no prueba que pinte nada (la
  // lección de la 313): se mide el dibujo.
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page.addInitScript((c) => {
    window.__FAKE_SETS__ = [{ id: '30th', name: '30th Celebration', market: 'WEST', card_count_official: 128 }]
    window.__FAKE_CARTAS__ = [c]
  }, MEW('Tinieblas'))
  await page.goto(`${BASE}/carta/mew-ex-30th-066`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  const punto = await page.locator('.carta-combate .carta-energia').first()
  const dibujo = await punto.evaluate((n) => {
    const s = getComputedStyle(n)
    return { fondo: s.backgroundColor, borde: s.borderTopStyle }
  })
  check('el punto desconocido no lleva color de relleno',
    /rgba\(0, 0, 0, 0\)|transparent/.test(dibujo.fondo), JSON.stringify(dibujo))
  check('…y se dibuja punteado, que no se confunde con ninguno de los once',
    dibujo.borde === 'dashed', JSON.stringify(dibujo))
  await page.close()

  // Y uno conocido sigue con su color sólido.
  const p2 = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await p2.addInitScript((c) => {
    window.__FAKE_SETS__ = [{ id: '30th', name: '30th Celebration', market: 'WEST', card_count_official: 128 }]
    window.__FAKE_CARTAS__ = [c]
  }, MEW('Siniestro'))
  await p2.goto(`${BASE}/carta/mew-ex-30th-066`, { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(2400)
  const bueno = await p2.locator('.carta-combate .carta-energia').first().evaluate((n) => {
    const s = getComputedStyle(n)
    return { fondo: s.backgroundColor, borde: s.borderTopStyle }
  })
  check('un tipo conocido sí lleva su color', bueno.fondo === 'rgb(61, 74, 87)', JSON.stringify(bueno))
  check('…y borde sólido', bueno.borde === 'solid', JSON.stringify(bueno))
  await p2.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. La carta de una guía lleva a su ficha ──')
{
  const page = await browser.newPage()
  await page.goto(`${BASE}/cartas`, { waitUntil: 'domcontentloaded' })
  const r = await page.evaluate(async () => {
    const m = await import('/js/cards-block.js')
    const occidental = { id: 'sv3-172', market: 'WEST', set_id: 'sv3', local_id: '172',
      name: "Boss's Orders", name_es: 'Órdenes del jefe', image_path: 'x/y/1', tcg_sets: { name: 'Llamas' } }
    const japonesa = { id: 'sv3j-1', market: 'JP', set_id: 'sv3j', local_id: '1',
      name: 'Otra', image_path: 'x/y/2', tcg_sets: { name: 'Japo' } }
    return {
      oeste: m.renderDeckHtml([occidental], [occidental.id]),
      japon: m.renderDeckHtml([japonesa], [japonesa.id]),
    }
  })
  check('la carta enlaza', /class="deck-card-enlace" href="\/carta\//.test(r.oeste), r.oeste.slice(0, 200))
  check('…con el nombre en español, que es donde vive la ficha',
    /href="\/carta\/ordenes-del-jefe-sv3-172"/.test(r.oeste), r.oeste.match(/href="[^"]*"/)?.[0])
  check('…y el escaneo va DENTRO del enlace, que es lo que se pulsa',
    /deck-card-enlace[^>]*>\s*<img/.test(r.oeste), r.oeste.slice(0, 260))
  // Y la que no tiene ficha, sin enlace: /carta busca en el catálogo
  // occidental, así que enlazar una japonesa lleva a «no encontrada»,
  // que es peor que no enlazar.
  check('una carta de otro mercado NO enlaza', !/deck-card-enlace/.test(r.japon), r.japon.slice(0, 200))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Y en la lista de un mazo de torneo, el escaneo ──')
{
  const page = await browser.newPage()
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv3', name: 'Llamas', market: 'WEST', tcg_online_code: 'OBF' }]
    window.__FAKE_CARTAS__ = [{ id: 'sv3-172', set_id: 'sv3', market: 'WEST', local_id: '172',
      name: "Boss's Orders", name_es: 'Órdenes del jefe', image_path: 'x/y/1', regulation_mark: 'I' }]
    window.__FAKE_AJUSTES__ = [{ key: 'torneos_reglas', value: { marcas_legales: ['H', 'I', 'J'] } }]
  })
  await page.goto(`${BASE}/torneo?slug=nada`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const html = await page.evaluate(async () => {
    const m = await import('/js/torneos/cartas-decklist.js')
    const caja = document.createElement('div')
    document.body.appendChild(caja)
    await m.pintarDecklistVisual(caja, {
      pokemon: [], energy: [],
      trainer: [{ name: "Boss's Orders", quantity: 2, set: 'OBF', number: '172' }],
    })
    return caja.innerHTML
  })
  check('el escaneo enlaza a la ficha',
    /class="torneo-carta-foto" href="\/carta\/ordenes-del-jefe-sv3-172"/.test(html), html.slice(0, 300))
  check('…con la imagen dentro', /torneo-carta-foto[^>]*>\s*<img/.test(html), html.slice(0, 300))
  // Sin foco propio ni voz: el enlace del pie ya lleva al mismo sitio, y
  // dos paradas de tabulador seguidas al mismo destino son ruido.
  check('…sin duplicar la parada de tabulador', /torneo-carta-foto[^>]*tabindex="-1"/.test(html))
  check('y el nombre del pie sigue enlazando', /torneo-carta-enlace/.test(html))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Y la mudanza de CSS, con su trampa ──')
{
  // Se mudó para hacer sitio en la portada, que estaba a 0,1 KB del
  // presupuesto. Dos cosas que NO podían salir mal:
  // SIN COMENTARIOS. La primera versión buscaba `.deck-empty` en el
  // texto del fichero y lo encontraba… dentro del comentario que explica
  // por qué NO se movió. Es la trampa de la 312: al barrer en busca de
  // una cadena, todo lo que la contiene cuenta, no solo lo que ES.
  const sinComentarios = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
  const comp = sinComentarios(leer('css/components.css'))
  const hoja = sinComentarios(leer('css/cartas-lista.css'))
  check('las clases de la baldosa se han ido', !/^\.deck-card \{/m.test(comp))
  check('…y están en su hoja', /\.deck-card \{/.test(hoja) && /\.deck-card-enlace \{/.test(hoja))
  // LA TRAMPA: `js/curso.js` usa `.deck-empty` para el «Falta la imagen»
  // de un ejercicio, y curso.html NO carga esta hoja. Llevárselas
  // pegadas al bloque de al lado es lo que dejó sin estilo a media web
  // en la tanda 316.
  check('`.deck-empty` se queda donde el curso la encuentra', /\.deck-empty,/.test(comp))
  check('…y no se ha ido a la hoja nueva', !/\.deck-empty/.test(hoja))
  check('…porque el curso la usa', /deck-empty/.test(leer('js/curso.js')))
  // Y la hoja la cargan las ocho páginas que la necesitan. La lista sale
  // del barrido de la 299, que fue quien cazó que no eran dos.
  for (const p of ['guia.html', 'editor-guia.html', 'foro.html', 'tema.html',
                   'perfil.html', 'usuario.html', 'torneo.html', 'torneos.html']) {
    check(`${p} carga la hoja`, /cartas-lista\.css/.test(leer(p)))
  }
  check('…y la portada NO, que es de lo que se trataba', !/cartas-lista\.css/.test(leer('index.html')))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
