// Tanda 960 — Jungle salió también en portugués y neerlandés, y la ficha no lo
// decía: las tarjetas de precio son de los idiomas que TCGGO cotiza. Los demás
// idiomas del set van en una línea debajo, sin tarjeta vacía.
import { join } from 'node:path'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const { tarjetasDePrecio } = await import(join(RAIZ, 'js/precio-vista.js'))
const precio = { idProduct: 273, porIdioma: { es: 450, en: 250, de: 199, fr: 300, it: 650 } }
const JUNGLE = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pt']
const html = tarjetasDePrecio(precio, { idioma: 'es', idiomasDelSet: JUNGLE })
const linea = html.match(/<p class="pv-tambien">([\s\S]*?)<\/p>/)?.[1] || ''
const texto = linea.replace(/<[^>]+>/g, '')
check('debajo de las tarjetas: también salió en portugués y neerlandés', texto === 'También salió en portugués y neerlandés. De esos no hay precio todavía.', texto)
check('  …el portugués enlaza a Cardmarket con su idioma (8)', /<a href="[^"]*language=8[^"]*"[^>]*>.*portugués<\/a>/.test(linea), linea.slice(0, 200))
check('  …y el neerlandés, sin filtro en Cardmarket, no enlaza', /<span><i class="pv-bandera" data-idioma="nl"[^>]*><\/i>neerlandés<\/span>/.test(linea), linea.slice(-200))
check('  …sin tarjetas de más', (html.match(/class="pv-tarjeta[ "]/g) || []).length === 5)
check('un set sin idiomas sin precio no pinta la línea', !/pv-tambien/.test(tarjetasDePrecio(precio, { idioma: 'es', idiomasDelSet: ['en', 'es'] })))
check('  …ni sin saber los del set', !/pv-tambien/.test(tarjetasDePrecio(precio, { idioma: 'es' })))
const uno = tarjetasDePrecio(precio, { idioma: 'es', idiomasDelSet: ['en', 'es', 'pt'] }).match(/<p class="pv-tambien">([\s\S]*?)<\/p>/)?.[1].replace(/<[^>]+>/g, '')
check('  …y con uno, en singular', uno === 'También salió en portugués. De ese no hay precio todavía.', uno)
const tuyaPt = tarjetasDePrecio(precio, { idioma: 'pt', idiomasDelSet: JUNGLE, rotuloActivo: 'tu copia' })
check('tu copia en portugués va en su tarjeta, y la línea no lo repite', /pv-tarjeta-tuya[\s\S]*?<b>PT<\/b>/.test(tuyaPt) && /También salió en <span>[\s\S]*neerlandés<\/span>\. De ese/.test(tuyaPt))
console.log(fails ? `\n❌ ${fails} fallo(s)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
