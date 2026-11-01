// LA LIGA AL LADO DE LOS RETOS (tanda 1154, E1 de la ronda 7). En el PC los
// seis retos iban a tres columnas y la liga de la semana, que es lo que da
// ganas de volver, estaba escondida dentro de «Tu historial». Ahora va en una
// columna a la derecha: los cinco primeros y tú (PINGU eligió «los cinco y
// tú»: ver nombres conocidos es lo que pica), tu racha y «Ver la
// clasificación». Son los datos de la portada (`portada_clasificacion`, la
// misma consulta). En el móvil no sale: el menú cabe en una pantalla (989).
//
// Puro: lo pinta retos.js, que le pasa cómo se pinta una cara (`estilo`,
// el `avatarStyle` de app.js) para no arrastrar app.js a las pruebas.
import { escapeHtml } from './html.js'
import { icons } from './icons.js'

const nombre = (p) => p?.display_name || p?.username || 'Alguien'
const inicial = (p) => (nombre(p).trim()[0] || '?').toUpperCase()

export function ligaLadoHtml(d, { racha = 0, conSesion = false, estilo = () => '' } = {}) {
  const r = (d?.ranking || []).slice(0, 5)
  const tu = d?.tu
  const enLista = r.some((x) => x.tu)
  const cara = (x) => `<span class="rt-ll-cara" style="${estilo(x)}" aria-hidden="true">${x?.avatar_url ? '' : escapeHtml(inicial(x))}</span>`
  const fila = (x) => `<li class="${x.tu ? 'rt-ll-tu' : ''}"><span class="rt-ll-pos">${x.puesto}</span>${cara(x)}<b>${x.tu ? 'Tú' : escapeHtml(nombre(x))}</b><span class="rt-ll-xp">${x.xp}</span></li>`
  const filas = r.map(fila).join('')
  const tuFila = tu?.puesto && !enLista ? `<li class="rt-ll-tu rt-ll-aparte"><span class="rt-ll-pos">${tu.puesto}</span>${cara({ display_name: 'Tú', ...tu, tu: true })}<b>Tú</b><span class="rt-ll-xp">${tu.xp}</span></li>` : ''
  const vacio = !r.length ? '<p class="rt-ll-vacio">Esta semana todavía no ha puntuado nadie. Juega un reto y estrénala.</p>' : ''
  const invita = !conSesion
    ? '<p class="rt-ll-invita"><a href="/auth.html?registro=1&amp;volver=/retos">Crea tu cuenta</a> y entra en la liga.</p>'
    : !tu?.puesto && r.length ? '<p class="rt-ll-invita">Todavía no puntúas: cada reto suma su XP.</p>' : ''
  const fuego = conSesion && racha >= 1 ? `<p class="rt-ll-racha">${icons.flame(16)} ${racha} ${racha === 1 ? 'día' : 'días'} de racha</p>` : ''
  return `<h2 class="rt-ll-titulo">${icons.trophy(18)} Liga de la semana</h2>
    ${vacio}${r.length ? `<ol class="rt-ll-lista">${filas}${tuFila}</ol>` : ''}
    ${invita}${fuego}
    <a class="btn-secondary rt-ll-ver" href="/#clasificacion">Ver la clasificación</a>`
}
