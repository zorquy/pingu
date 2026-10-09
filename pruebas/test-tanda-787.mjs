// Tanda 787 — bloque 8 de «PokeDoc al detalle»: SI4 portadas con arte (sin
// puntitos), SI10 los tres tipos que faltaban, PA5 la ficha de guía limpia,
// PA6 los 60 días de los retos, PA16 el sprite que no llega, MV6 la llegada.
import { readFileSync, readdirSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. Estático ──')
const conPuntos = readdirSync(`${RAIZ}/css`).filter((f) => /radial-gradient\(rgba\(255, 255, 255, 0\.\d+\) 1\.\dpx, transparent/.test(leer(`css/${f}`)))
check('SI4: ninguna portada con la trama de puntitos', conPuntos.length === 0, conPuntos.join(' '))
check('SI10: Dragón, Incolora y Hada con su símbolo en la ficha', /data-tipo='Dragon'\] \{ --icono-energia: url\('\/assets\/energias\/N\.svg'\)/.test(leer('css/carta.css')))
const guia = leer('js/guia.js')
check('PA5: la categoría una vez (sin el icono grande)', !/emoji-big/.test(guia))
check('  …sin repetir la descripción en el cuerpo', !/escapeHtml\(guide\.description \|\| 'Esta guía todavía/.test(guia))
check('  …Guardar y Compartir como iconos', /guia-accion-icono" id="btnSave" aria-label="Guardar"/.test(guia) && /texto: ''/.test(guia))
check('  …y «¿Te ha servido?» con dos botones', /class="seg-btn sirve-boton" data-value="5"/.test(leer('js/guide-rating.js')) && !/star-pick"/.test(leer('js/guide-rating.js')))
check('PA6: ¿Más caro? sin cartas no enseña el tablero', /function sinTablero/.test(leer('js/mas-caro-juego.js')))
check('PA16: la fila de filtros del meta, una sola y deslizable', /\.meta-filtros-cab \{[^}]*overflow-x: auto/.test(leer('css/meta.css')))

console.log('── 2. Puro ──')
const { energiaDeTexto } = await import(`${RAIZ}/js/energia-de-texto.js`)
check('SI4: la guía que habla de fuego lleva el patrón de fuego', energiaDeTexto('Mazos de Fuego en 2026') === 'R' && energiaDeTexto('Cómo valorar una carta') === null)
const { inicialDeSprite, SALTO_DE_RESPALDO } = await import(`${RAIZ}/js/torneos/sprites-pokemon.js`)
check('PA16: la inicial sale del nombre del fichero', inicialDeSprite('https://r2.limitlesstcg.net/pokemon/gen9/gardevoir.png') === 'G' && inicialDeSprite('https://x/282.png') === '')
const el = { dataset: { respaldos: '', inicial: 'G' }, classList: { add() {} }, style: {}, src: '' }
new Function(SALTO_DE_RESPALDO).call(el)
check('  …y al agotarse la cadena sale un círculo con la G, no un hueco', /^data:image\/svg\+xml/.test(el.src) && decodeURIComponent(el.src).includes('>G</text>') && el.style.display !== 'none')

console.log('── 3. En el navegador ──')
const b = await chromium.launch()
{
  const p = await b.newPage()
  await p.goto(`${BASE}/retos.html`, { waitUntil: 'domcontentloaded' })
  const r = await p.evaluate(async () => {
    const { calendarioHtml } = await import('/js/retos.js')
    const caja = document.createElement('div')
    caja.innerHTML = calendarioHtml(['2026-10-09', '2026-10-08', '2026-08-01'], '2026-10-09')
    return { celdas: caja.querySelectorAll('.rt-dia').length, jugados: caja.querySelectorAll('.rt-dia.jugado').length, ultima: caja.querySelector('.rt-dia:last-child').title }
  })
  check('PA6: 60 cuadritos, de color los jugados de esos 60 días, hoy el último', r.celdas === 60 && r.jugados === 2 && r.ultima === '2026-10-09', JSON.stringify(r))
  await p.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
