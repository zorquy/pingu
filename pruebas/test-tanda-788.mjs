// Tanda 788 — bloque 9 de «PokeDoc al detalle»: PA4 la cuenta atrás que
// corre, PA7 el precio al lado en el PC, PA8 el catálogo con filas, PA9 la
// lateral plegada con una expansión abierta, PA10b pequeños del móvil.
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

const { relojHasta } = await import(`${RAIZ}/js/lanzamientos.js`)
const ahora = new Date('2026-10-09T20:00:00').getTime()
check('PA4: la cuenta atrás dice días y horas', relojHasta('2026-10-21', ahora) === 'faltan 11 días y 4 h', relojHasta('2026-10-21', ahora))
check('  …y en el último día, horas y minutos', relojHasta('2026-10-10', ahora + 30 * 6e4) === 'faltan 3 h y 30 min', relojHasta('2026-10-10', ahora + 30 * 6e4))
check('  …y lo que ya salió no tiene reloj', relojHasta('2026-10-01', ahora) === '')
const lz = leer('js/lanzamientos.js')
check('  …el reloj corre cada minuto y lo pasado enlaza a sus cartas', /setInterval\(\(\) => \{[\s\S]{0,160}relojHasta/.test(lz) && /Ver sus cartas →/.test(lz) && !/>Ya salió</.test(lz))
const cm = leer('js/carta-mercado.js')
check('PA7: el precio se muda a la columna de la derecha en el PC', /function colocarPrecioAlLado/.test(cm) && /datos\.prepend\(caja\)/.test(cm) && /min-width: 1100px/.test(cm))
check('  …y «Añadir» es el principal, a lo ancho', /\.carta-acciones \.mc-ficha-mas \{\s*flex: 1 0 100%;/.test(leer('css/carta.css')))
const mc = leer('js/mi-coleccion.js')
check('PA8: el catálogo usa la fila compacta de Expansiones', /const lista = true/.test(mc))
check('  …en varias columnas en el PC', /@media \(min-width: 1100px\) \{\s*\.mc-estanteria-lista \{\s*display: grid;/.test(leer('css/mi-coleccion.css')))
check('PA9: con una expansión abierta, la lateral se pliega sola', /function plegarLateralSola/.test(mc) && /plegarLateralSola\(true\)/.test(mc) && /if \(nueva !== 'album'\) plegarLateralSola\(false\)/.test(mc))
check('PA10b: Deseos y cambios y los desplegables de Buscar, en una fila deslizable', /\.mc-deseos-seg,\s*\.mc-bus-afinar \{\s*flex-wrap: nowrap;/.test(leer('css/mi-coleccion.css')))
check('  …y la píldora centra la activa si el control se desliza', /caja\.scrollWidth > caja\.clientWidth \+ 1/.test(leer('js/pildora.js')))

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
