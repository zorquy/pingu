// Tanda 1039 — Aprender e Inicio, contenido primero (PINGU: «haz todo lo
// recomendado» de la propuesta). En el móvil: Aprender sin título a la vista,
// sin medallero ni chips de nivel, el lápiz junto al buscador y los temas en
// chips; el Glosario con las letras en una fila; Novedades sin título ni lema
// (el foro, al final) y las tres del mes más bajas; Lanzamientos con el
// siguiente set en una tarjeta baja. Y en las cuatro, lo que se viene a ver
// empieza antes del 35 % de un iPhone de 844 (296 px). En el PC, los títulos.
import { chromium, contexto } from '../herramientas/propuesta-compacta/comun.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const TOPE = 296

const b = await chromium.launch()
async function abrir(ruta, movil = true) {
  const ctx = await contexto(b, movil, 'user-1', () => { try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {} })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { ctx, page, errores }
}
const empieza = (page, sel) => page.evaluate((sel) => { const el = [...document.querySelectorAll(sel)].find((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 }); return el ? Math.round(el.getBoundingClientRect().top) : Infinity }, sel)
// Escondido A LA VISTA pero en el árbol (lo lee el lector de pantalla).
// (Recortado a nada con `clip-path` y fuera del flujo; el alto puede ser el de
// un `padding` en línea, que no ocupa sitio porque va en absoluto.)
const soloLector = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return 'no está'; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width <= 1 && cs.position === 'absolute' && /inset\(50%\)/.test(cs.clipPath) && cs.display !== 'none' ? true : `${Math.round(r.width)}×${Math.round(r.height)} ${cs.position} ${cs.clipPath}` }, sel)
const visto = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden' }, sel)

console.log('── 1. Aprender en el móvil ──')
{
  const { ctx, page, errores } = await abrir('/aprender')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el título no ocupa sitio, pero sigue para el lector', (await soloLector(page, '.ap-cab')) === true, await soloLector(page, '.ap-cab'))
  check('sin medallero', !(await page.$('#medallero, .medallero')))
  const r = await page.evaluate(() => {
    const h = document.querySelector('#categoriesList .ap-herramientas')
    const bu = h?.querySelector('.ap-buscar')?.getBoundingClientRect()
    const es = h?.querySelector('.ap-escribir')
    const er = es?.getBoundingClientRect()
    return {
      hijos: h ? [...h.children].map((x) => x.className) : null,
      escribir: er ? { ancho: Math.round(er.width), alto: Math.round(er.height), etiqueta: es.getAttribute('aria-label') || es.innerText.trim() } : null,
      misma: bu && er ? Math.abs((bu.top + bu.height / 2) - (er.top + er.height / 2)) < 4 : false,
      chips: document.querySelectorAll('#categoriesList [data-nivel], #apChips').length,
    }
  })
  check('la fila de mandos es el buscador y el lápiz, nada más', JSON.stringify(r.hijos) === JSON.stringify(['ap-buscar', 'link-btn ap-escribir']) || (r.hijos?.length === 2 && r.hijos[0] === 'ap-buscar' && /ap-escribir/.test(r.hijos[1])), JSON.stringify(r.hijos))
  check('  …sin chips de nivel ni «Sin leer»', r.chips === 0, r.chips)
  check('  …el lápiz es un círculo de 44 en la misma línea que el buscador', r.escribir?.ancho === 44 && r.escribir?.alto === 44 && r.misma, JSON.stringify(r.escribir))
  check('  …y dice qué hace', /escribir/i.test(r.escribir?.etiqueta || ''), r.escribir?.etiqueta)
  const temas = await page.evaluate(() => [...document.querySelectorAll('.ap-baldosa')].map((x) => { const a = getComputedStyle(x, '::after'); return { alto: Math.round(x.getBoundingClientRect().height), franja: -parseFloat(a.top) - parseFloat(a.bottom), icono: !!x.querySelector('.ap-baldosa-icono')?.getBoundingClientRect().width } }))
  check('los temas son chips de 36 (44 al dedo), sin icono', temas.length >= 3 && temas.every((x) => x.alto === 36 && x.alto + x.franja >= 44 && !x.icono), JSON.stringify(temas))
  const sub = await visto(page, '.aprender-seguir-sub')
  check('«Sigue donde lo dejaste» en una línea (sin el bloque)', !sub)
  const top = await empieza(page, '#apLista .guia-tarjeta, #apLista .ap-fila, #apLista a')
  check(`las guías empiezan antes de ${TOPE} px`, top <= TOPE, top)
  await ctx.close()
}

console.log('── 2. Aprender en el PC: título y «Escribir una guía» ──')
{
  const { ctx, page, errores } = await abrir('/aprender', false)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el título se ve', await visto(page, '.ap-cab h1'))
  const r = await page.evaluate(() => { const e = document.querySelector('.ap-escribir'); return { enCab: !!e?.closest('.ap-cab'), texto: e?.innerText.trim() } })
  check('«Escribir una guía» va en la cabecera, con su texto', r.enCab && /Escribir una guía/.test(r.texto), JSON.stringify(r))
  check('sin medallero', !(await page.$('#medallero, .medallero')))
  await ctx.close()
}

console.log('── 3. Glosario: las letras en una fila ──')
{
  const { ctx, page, errores } = await abrir('/glosario')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el título no ocupa sitio', (await soloLector(page, '.cabecera-pagina')) === true, await soloLector(page, '.cabecera-pagina'))
  const l = await page.evaluate(() => {
    const n = document.querySelector('.glosario-letras')
    const as = [...n.querySelectorAll('a')]
    const tops = new Set(as.map((a) => Math.round(a.getBoundingClientRect().top)))
    const a = as[0]; const d = getComputedStyle(a, '::after')
    return { n: as.length, filas: tops.size, desliza: n.scrollWidth > n.clientWidth, ancho: Math.round(a.getBoundingClientRect().width), alto: Math.round(a.getBoundingClientRect().height), franja: -parseFloat(d.top) - parseFloat(d.bottom) }
  })
  check('todas en UNA fila que se desliza', l.n > 8 && l.filas === 1 && l.desliza, JSON.stringify(l))
  check('  …de 44 de ancho y 36 de alto, 44 al dedo', l.ancho >= 44 && l.alto === 36 && l.alto + l.franja >= 44, JSON.stringify(l))
  const top = await empieza(page, '.glosario-termino')
  check(`los términos empiezan antes de ${TOPE} px`, top <= TOPE, top)
  await ctx.close()
}

console.log('── 4. Novedades: lo primero, las novedades ──')
{
  const { ctx, page, errores } = await abrir('/novedades')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el título no ocupa sitio', (await soloLector(page, '.cabecera-pagina h1')) === true, await soloLector(page, '.cabecera-pagina h1'))
  check('el lema tampoco', (await soloLector(page, '.cabecera-pagina .subtext')) === true)
  const pie = await page.evaluate(() => { const p = document.querySelector('.nv-pie-foro'); const a = p?.querySelector('a'); const ultimo = [...document.querySelector('main').children].filter((x) => x.getBoundingClientRect().height > 0).pop(); return { visto: !!p && p.getBoundingClientRect().height > 0, href: a?.getAttribute('href'), alFinal: ultimo === p } })
  check('«Cuéntanoslo en el foro» va al final y lleva al foro', pie.visto && pie.alFinal && /foro/.test(pie.href || ''), JSON.stringify(pie))
  const d = await page.evaluate(() => [...document.querySelectorAll('.nv-dest')].map((x) => ({ dibujo: Math.round(x.querySelector('.nv-dest-dibujo').getBoundingClientRect().height), parrafo: x.querySelector('.nv-dest-texto p')?.getBoundingClientRect().height || 0 })))
  check('las tres del mes: dibujo de 88 y sin párrafo', d.length >= 1 && d.every((x) => x.dibujo === 88 && x.parrafo === 0), JSON.stringify(d))
  const top = await empieza(page, '#nvDestacadas .nv-dest')
  check(`las novedades empiezan antes de ${TOPE} px`, top <= TOPE, top)
  await ctx.close()
}

console.log('── 5. Lanzamientos: el siguiente set en una tarjeta baja ──')
{
  const { ctx, page, errores } = await abrir('/lanzamientos')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el título no ocupa sitio', (await soloLector(page, '.page-header')) === true, await soloLector(page, '.page-header'))
  const r = await page.evaluate(() => {
    const d = document.querySelector('.lanzamiento-destacado')
    const logo = d.querySelector('.lanzamiento-logo-grande').getBoundingClientRect()
    const texto = d.querySelector(':scope > div').getBoundingClientRect()
    const reloj = d.querySelector('.lanz-reloj').getBoundingClientRect()
    const av = d.querySelector('.lanz-avisar')?.getBoundingClientRect()
    return { alto: Math.round(d.getBoundingClientRect().height), logoIzq: logo.right <= texto.left, mismaFila: av ? Math.abs((reloj.top + reloj.height / 2) - (av.top + av.height / 2)) < 8 : null, avAlto: av ? Math.round(av.height) : null }
  })
  check('la tarjeta mide como mucho 160', r.alto <= 160, r.alto)
  check('  …con el logo a la izquierda del nombre', r.logoIzq)
  check('  …y la cuenta atrás al lado de «Avísame» (44)', r.mismaFila === true && r.avAlto >= 44, JSON.stringify(r))
  const top = await empieza(page, '#proximoDestacado .lanzamiento-destacado')
  check(`el siguiente set empieza antes de ${TOPE} px`, top <= TOPE, top)
  await ctx.close()
}

console.log('── 6. En el PC, los títulos siguen ──')
for (const [ruta, sel] of [['/glosario', '.cabecera-pagina h1'], ['/novedades', '.cabecera-pagina h1'], ['/lanzamientos', '.page-header h1']]) {
  const { ctx, page } = await abrir(ruta, false)
  check(`${ruta}: el título se ve`, await visto(page, sel))
  if (ruta === '/novedades') {
    check('  …el lema con el foro arriba, y el del final no sale', (await visto(page, '#nvForo')) && !(await visto(page, '.nv-pie-foro')))
  }
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
