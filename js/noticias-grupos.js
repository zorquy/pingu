// Las noticias por semanas (tanda 1152, D1). Puro: sin red ni documento,
// para que se pruebe en Node (noticias.js pinta al importarse).
import { escapeHtml } from './html.js'

// POR SEMANAS (1152, D1). En el móvil cada noticia era una tarjeta de
// 340 px y para llegar a la de hace una semana había que bajar cinco
// pantallas; en filas caben seis, y el rótulo dice de un vistazo qué es
// nuevo. «Esta semana» y «La semana pasada» (de lunes a domingo, en la hora
// de quien mira); lo de antes, por mes, con el año si no es este.
const NOMBRE_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
function lunesDe(d) {
  const l = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  l.setDate(l.getDate() - ((l.getDay() + 6) % 7))
  return l.getTime()
}
export function grupoDeNoticia(iso, ahora = new Date()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const semanas = Math.round((lunesDe(ahora) - lunesDe(d)) / (7 * 864e5))
  if (semanas <= 0) return { clave: 's0', rotulo: 'Esta semana' }
  if (semanas === 1) return { clave: 's1', rotulo: 'La semana pasada' }
  const mismoAno = d.getFullYear() === ahora.getFullYear()
  return { clave: `m${d.getFullYear()}-${d.getMonth()}`, rotulo: `${NOMBRE_MES[d.getMonth()]}${mismoAno ? '' : ` de ${d.getFullYear()}`}` }
}
// Las tarjetas (las pinta `pintar(noticia, grupo)`) con su rótulo delante de cada grupo
// nuevo. `anterior` es la clave del último grupo ya pintado («Ver más» no
// repite el rótulo).
export function tarjetasPorGrupo(noticias, anterior = null, pintar = () => '', ahora = new Date()) {
  let ultimo = anterior
  let html = ''
  for (const n of noticias) {
    const g = grupoDeNoticia(n.published_at, ahora)
    if (g && g.clave !== ultimo) {
      html += `<h2 class="noticias-grupo" data-grupo="${g.clave}">${escapeHtml(g.rotulo)}</h2>`
      ultimo = g.clave
    }
    html += pintar(n, g)
  }
  return { html, ultimo }
}

// Cuántas de `noticias` son de esta semana y de este mes (la banda, 1210).
// Sobre las que se han pedido: con doce de golpe, si las doce son del mes,
// el mes dice «12+».
export function cuentasDeNoticias(noticias, hayMas = false, ahora = new Date()) {
  let semana = 0
  let mes = 0
  for (const n of noticias) {
    const d = new Date(n.published_at)
    if (Number.isNaN(d.getTime())) continue
    if (grupoDeNoticia(n.published_at, ahora)?.clave === 's0') semana++
    if (d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth()) mes++
  }
  const todas = noticias.length
  return { semana: hayMas && semana === todas ? `${semana}+` : String(semana), mes: hayMas && mes === todas ? `${mes}+` : String(mes) }
}
