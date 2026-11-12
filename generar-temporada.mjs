// LA LÍNEA DE LA TEMPORADA (tandas 1134, 1285, 1286 y 1287): un <script> en la cabecera de
// cada página que decide, ANTES del primer pintado, si hoy toca fiesta. Iba
// copiada a mano en 55 páginas; desde la 1285 la escribe este generador, que
// es el único sitio donde vive el calendario. Una fiesta nueva se añade aquí y
// se corre `node generar-temporada.mjs` (test-tanda-1285-pantalla comprueba
// que el repo lleva lo que sale de aquí).
//
// Qué hace la línea:
// - `data-temporada` en <html> y su hoja (`/css/<hoja>.css`) los días de la
//   fiesta, salvo que la persona la haya quitado (`pd-sin-<temporada>`).
// - Halloween el 31 de octubre y el 1 de noviembre (con la web de noche) y
//   Navidad del 22 de diciembre al 6 de enero (con los colores de cada uno).
// - `data-fiesta` el día de una fiesta DENTRO de la Navidad (Inocentes el 28,
//   Nochevieja el 31 y el 1, Reyes el 5 y el 6), con la Navidad puesta
//   igualmente; cada una se quita con su `pd-sin-<fiesta>`, y la broma de
//   Inocentes no la ve una tienda (`pd-tienda`).
// - `data-adviento` del 1 al 31 de diciembre: reserva el sitio de la tarjeta
//   del Calendario de Adviento en Inicio (no es decoración: no se quita).
// - Un navegador automático no ve nada salvo con `?temporada=<nombre>`, para
//   que la suite de esos días siga igual.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = new URL('.', import.meta.url).pathname

// El script, en una línea (las fechas van en mes*100+día: 1031 es el 31 de octubre).
export const LINEA = '  <script>/* Temporada (1134, 1285-1289, generar-temporada.mjs): la fiesta de hoy antes del primer pintado; las pruebas automáticas no la ven salvo con ?temporada=… */' +
  "(function(){try{var n=new Date(),k=(n.getMonth()+1)*100+n.getDate(),q=/[?&]temporada=([a-z]+)/.exec(location.search),a=navigator.webdriver,r=document.documentElement," +
  "t=q?q[1]:a?'':k==1031||k==1101?'halloween':k>=1222||k<=106?'navidad':'',f=q?q[1]:a?'':{1228:'inocentes',1231:'nochevieja',101:'nochevieja',105:'reyes',106:'reyes'}[k]||'',l=localStorage;" +
  "if(/^(inocentes|nochevieja|reyes)$/.test(f)){t='navidad';if(l.getItem('pd-sin-'+f)!=='1'&&!(f=='inocentes'&&l.getItem('pd-tienda')))r.dataset.fiesta=f}" +
  "var s=q||l.getItem('pd-sin-'+t)!=='1';" +
  "if(k>=1201&&k<=1231&&!a||t=='adviento')r.setAttribute('data-adviento','');" +
  "if(t=='halloween'&&s){r.dataset.temporada=t;r.dataset.theme='dark';document.write('<link rel=\"stylesheet\" href=\"/css/temporada.css\">')}" +
  "if(t=='navidad'&&s){r.dataset.temporada=t;document.write('<link rel=\"stylesheet\" href=\"/css/navidad.css\">')}" +
  "if(r.dataset.fiesta=='inocentes')document.write('<link rel=\"stylesheet\" href=\"/css/inocentes.css\">');" +
  "if(r.dataset.fiesta=='reyes')document.write('<link rel=\"stylesheet\" href=\"/css/reyes.css\">');" +
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
