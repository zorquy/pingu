// LA LÍNEA DE LA TEMPORADA (tandas 1134 y 1285): un <script> en la cabecera de
// cada página que decide, ANTES del primer pintado, si hoy toca fiesta. Iba
// copiada a mano en 55 páginas; desde la 1285 la escribe este generador, que
// es el único sitio donde vive el calendario. Una fiesta nueva se añade aquí y
// se corre `node generar-temporada.mjs` (test-tanda-1285-pantalla comprueba
// que el repo lleva lo que sale de aquí).
//
// Qué hace la línea:
// - `data-temporada` en <html> y su hoja (`/css/<hoja>.css`) los días de la
//   fiesta, salvo que la persona la haya quitado (`pd-sin-<temporada>`).
// - `data-adviento` del 1 al 31 de diciembre: reserva el sitio de la tarjeta
//   del Calendario de Adviento en Inicio (no es decoración: no se quita).
// - Un navegador automático no ve nada salvo con `?temporada=<nombre>`, para
//   que la suite de esos días siga igual.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = new URL('.', import.meta.url).pathname

// El script, en una línea (las fechas van en mes*100+día: 1031 es el 31 de octubre).
export const LINEA = '  <script>/* Temporada (1134 y 1285, generar-temporada.mjs): la fiesta de hoy antes del primer pintado; las pruebas automáticas no la ven salvo con ?temporada=… */' +
  "(function(){try{var n=new Date(),k=(n.getMonth()+1)*100+n.getDate(),q=/[?&]temporada=([a-z]+)/.exec(location.search),a=navigator.webdriver,r=document.documentElement," +
  "t=q?q[1]:a?'':k==1031||k==1101?'halloween':'';" +
  "if(k>=1201&&k<=1231&&!a||t=='adviento')r.setAttribute('data-adviento','');" +
  "if(t=='halloween'&&(q||localStorage.getItem('pd-sin-'+t)!=='1')){r.dataset.temporada=t;r.dataset.theme='dark';document.write('<link rel=\"stylesheet\" href=\"/css/temporada.css\">')}" +
  '}catch(e){}})();</script>'

// La línea vieja o la nueva: todo lo que empiece por el comentario de la
// temporada, hasta su </script>.
const VIEJA = /^[ \t]*<script>\/\* Temporada \(1134[^\n]*?<\/script>$/m

export function paginas(dir = RAIZ, fuera = []) {
  for (const n of readdirSync(dir)) {
    if (n.startsWith('.') || n === 'node_modules') continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) paginas(p, fuera)
    else if (n.endsWith('.html')) fuera.push(p)
  }
  return fuera
}

export function conLinea(html) {
  return VIEJA.test(html) ? html.replace(VIEJA, LINEA) : html
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let cambiadas = 0
  let con = 0
  for (const p of paginas()) {
    const html = readFileSync(p, 'utf8')
    if (!VIEJA.test(html)) continue
    con++
    const nuevo = conLinea(html)
    if (nuevo !== html) { writeFileSync(p, nuevo); cambiadas++ }
  }
  console.log(`${con} páginas con la línea de temporada; ${cambiadas} reescritas.`)
}
