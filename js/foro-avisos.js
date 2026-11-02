// LO QUE TE ESPERA EN EL FORO, EN SU FORO Y EN SU TEMA (tanda 1183).
//
// PINGU, con una captura del móvil: «cuando hay algo nuevo se marca en la
// burbuja pero no en qué subforo… no sabes dónde entrar». El número de la
// burbuja (1139) cuenta tus AVISOS del foro —te han respondido, citado,
// mencionado o reaccionado—, y el índice solo marcaba los foros con mensajes
// que no has LEÍDO (`nuevosPorForo`): una reacción no es un mensaje nuevo, y
// una respuesta en un tema que ya abriste desde la campana tampoco. Así que
// el número salía en la burbuja y en ninguna tarjeta.
//
// Ahora cada aviso sin leer del foro se cuelga de SU tema (`/tema/<id>` del
// enlace), el tema de su foro (una consulta pequeña, solo si hay avisos) y el
// foro de su padre: la tarjeta lleva «N para ti» y lleva al aviso, y dentro
// del foro, la fila del tema lleva «Para ti». Al abrir el tema el aviso se da
// por leído (1142, `casaConLaPagina`) y la marca se va con el número.
//
// No pregunta por los avisos: los lee de `window.__pdAvisos` (notifications.js)
// y se repinta con `pd-avisos`, como los números de la barra.
import { seccionDeAviso } from './numeros-seccion.js'
import { icons } from './icons.js'
import { escapeHtml } from './html.js'

// El tema de un aviso, por su enlace (`/tema/12`, `/tema/12?p=2#mensaje-80`).
// Como texto: así casa con `data-tema` y con lo que devuelva la base.
export function temaDeAviso(link) {
  const m = /(?:^|\/\/[^/]+)\/tema\/([^/?#]+)/.exec(String(link || ''))
  return m ? decodeURIComponent(m[1]) : null
}

// Los avisos sin leer del foro que llevan a un tema, el más nuevo primero.
export function avisosDelForo(avisos = []) {
  return (avisos || [])
    .filter((a) => a && !a.read_at && seccionDeAviso(a.type) === 'Comunidad' && temaDeAviso(a.link))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
}

// Cuántos y a dónde, por tema y por foro. Un aviso de un subforo cuenta
// también en su padre: si no, en el índice (que enseña los padres) el
// subforo con algo para ti volvía a quedarse sin marca, que es la 360 de
// foro.js con los avisos.
export function avisosPorSitio(avisos, foroDeTema = new Map(), padreDe = new Map()) {
  const porTema = new Map()
  const porForo = new Map()
  const sumar = (mapa, clave, aviso) => {
    const v = mapa.get(clave) || { n: 0, link: aviso.link }
    v.n += 1
    mapa.set(clave, v)
  }
  for (const a of avisosDelForo(avisos)) {
    const tema = temaDeAviso(a.link)
    sumar(porTema, tema, a)
    const foro = foroDeTema.get(tema)
    if (foro == null) continue
    sumar(porForo, String(foro), a)
    const padre = padreDe.get(String(foro))
    if (padre != null) sumar(porForo, String(padre), a)
  }
  return { porTema, porForo }
}

export const textoParaTi = (n) => `${n} para ti`

// ── Lo de la página ──

const foroDeTemaCache = new Map()

async function forosDeTemas(supabase, temas) {
  const faltan = temas.filter((t) => !foroDeTemaCache.has(t))
  if (faltan.length) {
    const { data } = await supabase.from('forum_threads').select('id, board_id').in('id', faltan)
    for (const t of data || []) foroDeTemaCache.set(String(t.id), t.board_id)
  }
  return new Map(temas.filter((t) => foroDeTemaCache.has(t)).map((t) => [t, foroDeTemaCache.get(t)]))
}

// Pinta (o quita) las marcas en lo que haya en `raiz`: las tarjetas de foro
// (`[data-foro]` con su `h3`), los subforos del índice (`a[data-foro]`) y
// las filas de tema (`[data-tema]`). Se puede llamar las veces que haga falta.
export async function marcarAvisosDelForo({ supabase, raiz = document, foros = [], avisos = globalThis.window?.__pdAvisos } = {}) {
  const lista = avisosDelForo(avisos)
  const temas = [...new Set(lista.map((a) => temaDeAviso(a.link)))]
  const foroDeTema = temas.length ? await forosDeTemas(supabase, temas).catch(() => new Map()) : new Map()
  const padreDe = new Map(foros.filter((f) => f.parent_id != null).map((f) => [String(f.id), f.parent_id]))
  const { porTema, porForo } = avisosPorSitio(lista, foroDeTema, padreDe)

  for (const el of raiz.querySelectorAll('.foro-chapa-para-ti')) el.remove()
  for (const el of raiz.querySelectorAll('.foro-con-aviso')) el.classList.remove('foro-con-aviso')

  for (const fila of raiz.querySelectorAll('.foro-fila[data-foro]')) {
    const v = porForo.get(String(fila.dataset.foro))
    if (!v) continue
    fila.classList.add('foro-con-aviso')
    fila.querySelector('.foro-fila-cuerpo h3')?.insertAdjacentHTML(
      'beforeend',
      ` <a class="foro-chapa foro-chapa-para-ti" href="${escapeHtml(v.link)}">${icons.bell(12)}${textoParaTi(v.n)}</a>`
    )
  }
  for (const a of raiz.querySelectorAll('.foro-subforos a[data-foro]')) {
    if (porForo.has(String(a.dataset.foro))) a.classList.add('foro-con-aviso')
  }
  for (const fila of raiz.querySelectorAll('[data-tema]')) {
    const v = porTema.get(String(fila.dataset.tema))
    if (!v) continue
    fila.classList.add('foro-con-aviso')
    fila.querySelector('.foro-conv-arriba')?.insertAdjacentHTML('afterbegin', `<a class="foro-chapa foro-chapa-para-ti" href="${escapeHtml(v.link)}">${icons.bell(12)}Para ti</a>`)
  }
}

// Marca ya y vuelve a marcar cada vez que cambian los avisos (llegan después
// que el foro, se leen desde la campana o entra uno en vivo).
export function montarAvisosDelForo(opciones) {
  const repintar = () => marcarAvisosDelForo({ ...opciones, avisos: window.__pdAvisos }).catch(() => {})
  repintar()
  if (!window.__pdForoAvisosOyente) {
    window.__pdForoAvisosOyente = true
    window.addEventListener('pd-avisos', () => window.__pdForoAvisosRepintar?.())
  }
  window.__pdForoAvisosRepintar = repintar
}
