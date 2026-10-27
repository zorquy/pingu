// Tanda 898 — la hoja de filtros de Mi colección › Cartas en cuatro bloques
// plegables. LA 1055 LA SUSTITUYÓ: la hoja de Cartas es la hoja común de las
// cuatro pantallas de cartas (los grupos sueltos, en el orden de
// js/mi-coleccion/hoja-filtros.js, y «Limpiar» abajo). Lo de la pantalla lo
// prueba test-tanda-1055-pantalla.mjs; aquí queda la guarda de que los
// bloques no vuelven a medias (HTML sin su JS o al revés).
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const html = leer('mi-coleccion.html')
const js = leer('js/mi-coleccion.js')
const css = leer('css/mi-coleccion.css')
check('sin bloques plegables en la hoja (ni en /cartas, que se genera)', !/mc-bloque-filtro/.test(html) && !/mc-bloque-filtro/.test(leer('cartas.html')))
check('  …ni el JS que los pintaba', !/BLOQUE_DE_GRUPO|pintarResumenesDeBloques|abrirBloquesDeFiltros/.test(js))
check('  …ni su CSS', !/\.mc-bloque-(filtro|cab|resumen|cuenta|flecha)\b/.test(css))
const ini = html.indexOf('id="mcPanelFiltros"')
const hoja = html.slice(ini, html.indexOf('</dialog>', ini))
const orden = [...hoja.matchAll(/data-hoja="([a-z]+)"/g)].map((m) => m[1])
check('la hoja de Cartas: precio, idioma, la raya y la expansión, en ese orden', orden.join(',') === 'precio,idioma,raya,expansion', orden.join(','))
check('  …y los chips entran por la hoja común', /meterEnLaHoja\(cuerpo, GRUPOS\.map\(grupoDeChipsHtml\)\.join\(''\)\)/.test(js))

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
